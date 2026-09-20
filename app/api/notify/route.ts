// app/api/notify/route.ts
// Server-side FCM multicast to online washers, auth-gated with Firebase ID token

import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

// ─── Firebase Admin init ───────────────────────────────────────────────────────
function getAdminApp(): admin.app.App {
  if (admin.apps.length) return admin.apps[0]!
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountRaw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing')
  const serviceAccount = JSON.parse(serviceAccountRaw) as admin.ServiceAccount & { project_id?: string }
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: (serviceAccount.projectId ?? serviceAccount.project_id) as string,
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify caller's Firebase ID token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const idToken = authHeader.slice(7)
    const adminApp = getAdminApp()
    const decodedToken = await admin.auth(adminApp).verifyIdToken(idToken)
    if (!decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 2. Parse request body
    const body = (await req.json()) as {
      bookingId: string
      packageName: string
      area: string
    }
    const { bookingId, packageName, area } = body

    // 3. Load all online washers with FCM tokens
    const washersSnap = await admin
      .firestore(adminApp)
      .collection('washers')
      .where('online', '==', true)
      .get()

    const tokens: string[] = []
    washersSnap.forEach((doc) => {
      const fcmTokens = doc.data()?.fcmTokens as string[] | undefined
      if (fcmTokens?.length) tokens.push(...fcmTokens)
    })

    if (!tokens.length) {
      return NextResponse.json({ sent: 0, message: 'No online washers' })
    }

    // 4. Send multicast FCM push
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: `New car wash request 🚗`,
        body: `${packageName} · ${area}`,
      },
      data: {
        bookingId,
        packageName,
        area,
      },
      webpush: {
        notification: {
          title: `New car wash request 🚗`,
          body: `${packageName} · ${area}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
        fcmOptions: { link: '/' },
      },
    }

    const response = await admin.messaging(adminApp).sendEachForMulticast(message)

    // 5. Clean up invalid tokens
    const invalidTokens: string[] = []
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx])
        }
      }
    })

    if (invalidTokens.length) {
      const batch = admin.firestore(adminApp).batch()
      washersSnap.forEach((docSnap) => {
        const fcmTokens = (docSnap.data()?.fcmTokens as string[]) ?? []
        const cleaned = fcmTokens.filter((t) => !invalidTokens.includes(t))
        if (cleaned.length !== fcmTokens.length) {
          batch.update(docSnap.ref, { fcmTokens: cleaned })
        }
      })
      await batch.commit()
    }

    return NextResponse.json({
      sent: response.successCount,
      failed: response.failureCount,
      cleaned: invalidTokens.length,
    })
  } catch (err) {
    console.error('[notify]', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
