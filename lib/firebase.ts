// lib/firebase.ts
// Firebase init, auth/Firestore/messaging helpers, shared types

import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  limit,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

// ─── Firebase config ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// ─── Types ──────────────────────────────────────────────────────────────────
export type Role = 'customer' | 'washer' | 'admin'

export interface UserProfile {
  uid: string
  name: string
  email: string
  phone: string
  address: {
    text: string
    lat: number
    lng: number
    details: string
  }
  car: {
    name: string
    plate: string
  }
  createdAt: Timestamp
}

export interface WasherProfile {
  uid: string
  name: string
  phone: string
  online: boolean
  lat: number
  lng: number
  updatedAt: Timestamp
  fcmTokens: string[]
}

export interface Package {
  id: string
  name: string
  description: string
  price: number
  durationMins: number
  features: string[]
  active: boolean
  order: number
}

export interface Addon {
  id: string
  name: string
  price: number
  active: boolean
}

export type BookingStatus =
  | 'searching'
  | 'accepted'
  | 'on_the_way'
  | 'reached'
  | 'washing'
  | 'completed'
  | 'cancelled'

export interface Booking {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  address: { text: string; lat: number; lng: number; details: string }
  car: { name: string; plate: string }
  packageSnapshot: Package
  addonsSnapshot: Addon[]
  total: number
  status: BookingStatus
  washerId?: string
  washerName?: string
  rating?: number
  // per-status timestamps
  searchingAt?: Timestamp
  acceptedAt?: Timestamp
  on_the_wayAt?: Timestamp
  reachedAt?: Timestamp
  washingAt?: Timestamp
  completedAt?: Timestamp
  cancelledAt?: Timestamp
  createdAt: Timestamp
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function signInEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function signUpEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export { onAuthStateChanged, type User }

// ─── Role helpers ─────────────────────────────────────────────────────────────
export async function getUserRole(email: string): Promise<Role> {
  try {
    const snap = await getDoc(doc(db, 'roles', email.toLowerCase()))
    if (snap.exists()) {
      return (snap.data()?.role as Role) ?? 'customer'
    }
    return 'customer'
  } catch {
    return 'customer'
  }
}

// ─── User profile helpers ─────────────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (snap.exists()) return { uid, ...snap.data() } as UserProfile
  return null
}

export async function saveUserProfile(
  uid: string,
  data: Omit<Partial<UserProfile>, 'createdAt'> & { createdAt?: unknown }
): Promise<void> {
  await setDoc(doc(db, 'users', uid), data as DocumentData, { merge: true })
}

// ─── Washer helpers ────────────────────────────────────────────────────────────
export async function getWasherProfile(uid: string): Promise<WasherProfile | null> {
  const snap = await getDoc(doc(db, 'washers', uid))
  if (snap.exists()) return { uid, ...snap.data() } as WasherProfile
  return null
}

export async function updateWasherLocation(
  uid: string,
  lat: number,
  lng: number,
  online: boolean,
  fcmToken?: string,
): Promise<void> {
  const data: Partial<WasherProfile> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
    online,
    lat,
    lng,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  }
  if (fcmToken) {
    // append token if not already present
    await setDoc(
      doc(db, 'washers', uid),
      { ...data, fcmTokens: [] },
      { merge: true },
    )
    // use array union via batch
    const washerRef = doc(db, 'washers', uid)
    const snap = await getDoc(washerRef)
    const existing: string[] = snap.data()?.fcmTokens ?? []
    if (!existing.includes(fcmToken)) {
      await updateDoc(washerRef, { fcmTokens: [...existing, fcmToken] })
    }
    return
  }
  await setDoc(doc(db, 'washers', uid), data, { merge: true })
}

export async function setWasherOnline(uid: string, online: boolean): Promise<void> {
  await setDoc(doc(db, 'washers', uid), { online, updatedAt: serverTimestamp() }, { merge: true })
}

// ─── Package / Addon helpers ──────────────────────────────────────────────────
export function subscribePackages(cb: (packages: Package[]) => void): () => void {
  const q = query(collection(db, 'packages'), where('active', '==', true), orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Package))
  })
}

export function subscribeAllPackages(cb: (packages: Package[]) => void): () => void {
  const q = query(collection(db, 'packages'), orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Package))
  })
}

export function subscribeAddons(cb: (addons: Addon[]) => void): () => void {
  const q = query(collection(db, 'addons'), where('active', '==', true))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Addon))
  })
}

export function subscribeAllAddons(cb: (addons: Addon[]) => void): () => void {
  return onSnapshot(collection(db, 'addons'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Addon))
  })
}

export async function savePackage(pkg: Omit<Package, 'id'> & { id?: string }): Promise<string> {
  if (pkg.id) {
    const { id, ...rest } = pkg
    await setDoc(doc(db, 'packages', id), rest)
    return id
  }
  const ref = await addDoc(collection(db, 'packages'), pkg)
  return ref.id
}

export async function deletePackage(id: string): Promise<void> {
  await deleteDoc(doc(db, 'packages', id))
}

export async function saveAddon(addon: Omit<Addon, 'id'> & { id?: string }): Promise<string> {
  if (addon.id) {
    const { id, ...rest } = addon
    await setDoc(doc(db, 'addons', id), rest)
    return id
  }
  const ref = await addDoc(collection(db, 'addons'), addon)
  return ref.id
}

export async function deleteAddon(id: string): Promise<void> {
  await deleteDoc(doc(db, 'addons', id))
}

// ─── Booking helpers ──────────────────────────────────────────────────────────
export async function createBooking(
  data: Omit<Booking, 'id' | 'createdAt' | 'searchingAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'bookings'), {
    ...data,
    status: 'searching',
    searchingAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await updateDoc(doc(db, 'bookings', bookingId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
  })
}

export function subscribeBooking(bookingId: string, cb: (booking: Booking | null) => void): () => void {
  return onSnapshot(doc(db, 'bookings', bookingId), (snap) => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() } as Booking)
    else cb(null)
  })
}

export function subscribeCustomerBookings(customerId: string, cb: (bookings: Booking[]) => void): () => void {
  const q = query(
    collection(db, 'bookings'),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc'),
    limit(20),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking))
  })
}

export function subscribeSearchingBookings(cb: (bookings: Booking[]) => void): () => void {
  const q = query(collection(db, 'bookings'), where('status', '==', 'searching'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking))
  })
}

export function subscribeWasherActiveBooking(washerId: string, cb: (booking: Booking | null) => void): () => void {
  const activeStatuses: BookingStatus[] = ['accepted', 'on_the_way', 'reached', 'washing']
  const q = query(
    collection(db, 'bookings'),
    where('washerId', '==', washerId),
    where('status', 'in', activeStatuses),
    limit(1),
  )
  return onSnapshot(q, (snap) => {
    if (snap.empty) cb(null)
    else cb({ id: snap.docs[0].id, ...snap.docs[0].data() } as Booking)
  })
}

export function subscribeWasherBookings(washerId: string, cb: (bookings: Booking[]) => void): () => void {
  const q = query(
    collection(db, 'bookings'),
    where('washerId', '==', washerId),
    orderBy('createdAt', 'desc'),
    limit(50),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking))
  })
}

export async function acceptBooking(
  bookingId: string,
  washerId: string,
  washerName: string,
): Promise<boolean> {
  try {
    await runTransaction(db, async (t) => {
      const ref = doc(db, 'bookings', bookingId)
      const snap = await t.get(ref)
      if (!snap.exists() || snap.data()?.status !== 'searching') {
        throw new Error('already_taken')
      }
      t.update(ref, {
        status: 'accepted',
        washerId,
        washerName,
        acceptedAt: serverTimestamp(),
      })
    })
    return true
  } catch {
    return false
  }
}

export async function advanceBookingStatus(
  bookingId: string,
  nextStatus: BookingStatus,
): Promise<void> {
  await updateDoc(doc(db, 'bookings', bookingId), {
    status: nextStatus,
    [`${nextStatus}At`]: serverTimestamp(),
  })
}

export async function rateBooking(bookingId: string, rating: number): Promise<void> {
  await updateDoc(doc(db, 'bookings', bookingId), { rating })
}

// ─── Admin helpers ─────────────────────────────────────────────────────────────
export function subscribeAllBookings(cb: (bookings: Booking[]) => void): () => void {
  const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(100))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking))
  })
}

export function subscribeAllWashers(cb: (washers: WasherProfile[]) => void): () => void {
  return onSnapshot(collection(db, 'washers'), (snap) => {
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as WasherProfile))
  })
}

export async function getAllCustomersCount(): Promise<number> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.size
}

export async function adminAssignWasher(
  bookingId: string,
  washerId: string,
  washerName: string,
): Promise<void> {
  await updateDoc(doc(db, 'bookings', bookingId), {
    washerId,
    washerName,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
  })
}

export async function adminCancelBooking(bookingId: string): Promise<void> {
  await updateDoc(doc(db, 'bookings', bookingId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
  })
}

// ─── FCM helpers ──────────────────────────────────────────────────────────────
export async function getFCMToken(): Promise<string | null> {
  try {
    const supported = await isSupported()
    if (!supported) return null
    const messaging = getMessaging(app)
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!
    const token = await getToken(messaging, { vapidKey })
    return token || null
  } catch {
    return null
  }
}

export async function subscribeFCMMessages(cb: (payload: unknown) => void): Promise<(() => void) | null> {
  try {
    const supported = await isSupported()
    if (!supported) return null
    const messaging = getMessaging(app)
    const unsub = onMessage(messaging, cb)
    return unsub
  } catch {
    return null
  }
}

// ─── Re-exports for convenience ───────────────────────────────────────────────
export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  limit,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
}
