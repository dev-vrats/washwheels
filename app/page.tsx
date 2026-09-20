'use client'

/**
 * app/page.tsx — Washwheels complete client app
 *
 * Sections:
 *  1. Imports & types
 *  2. Constants & utilities
 *  3. Background canvas (orbs + grain)
 *  4. Auth screen (login/signup)
 *  5. Location screen
 *  6. Address details screen
 *  7. Customer dashboard (Home / Packages / Booking / Tracking / History / Profile)
 *  8. Washer dashboard (Jobs / Earnings / Profile)
 *  9. Admin dashboard (Overview / Bookings / Washers / Catalog)
 * 10. Root component (auth gate + role router)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. IMPORTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
} from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence, useMotionValue, useTransform, LayoutGroup } from 'framer-motion'
import {
  Car,
  MapPin,
  Phone,
  Star,
  Check,
  X,
  ChevronRight,
  Navigation,
  Wifi,
  WifiOff,
  User as UserIcon,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  Menu,
  Bell,
  Home,
  ClipboardList,
  Wallet,
  RefreshCw,
  Clock,
  IndianRupee,
  Zap,
  Droplets,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Circle,
  ToggleLeft,
  ToggleRight,
  Share2,
} from 'lucide-react'

import { onSnapshot, doc } from 'firebase/firestore'

import {
  auth,
  db,
  signInWithGoogle,
  signInEmail,
  signUpEmail,
  signOut,
  onAuthStateChanged,
  getUserRole,
  getUserProfile,
  saveUserProfile,
  getWasherProfile,
  updateWasherLocation,
  setWasherOnline,
  subscribePackages,
  subscribeAllPackages,
  subscribeAddons,
  subscribeAllAddons,
  savePackage,
  deletePackage,
  saveAddon,
  deleteAddon,
  createBooking,
  cancelBooking,
  subscribeBooking,
  subscribeCustomerBookings,
  subscribeSearchingBookings,
  subscribeWasherActiveBooking,
  subscribeWasherBookings,
  acceptBooking,
  advanceBookingStatus,
  rateBooking,
  subscribeAllBookings,
  subscribeAllWashers,
  getAllCustomersCount,
  adminAssignWasher,
  adminCancelBooking,
  getFCMToken,
  subscribeFCMMessages,
  serverTimestamp,
  type User,
  type Role,
  type UserProfile,
  type WasherProfile,
  type Package,
  type Addon,
  type Booking,
  type BookingStatus,
} from '@/lib/firebase'

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONSTANTS & UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const LUCKNOW_CENTER: [number, number] = [26.8467, 80.9462]
const LUCKNOW_BBOX = '80.77,26.73,81.12,27.00' // Photon bbox

const STATUS_LABELS: Record<BookingStatus, string> = {
  searching: 'Finding washer',
  accepted: 'Washer assigned',
  on_the_way: 'On the way',
  reached: 'Reached',
  washing: 'Washing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_ORDER: BookingStatus[] = [
  'accepted',
  'on_the_way',
  'reached',
  'washing',
  'completed',
]

const WASHER_NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  accepted: 'on_the_way',
  on_the_way: 'reached',
  reached: 'washing',
  washing: 'completed',
}

const WASHER_NEXT_LABEL: Partial<Record<BookingStatus, string>> = {
  accepted: 'Start trip',
  on_the_way: "I've reached",
  reached: 'Start wash',
  washing: 'Complete wash',
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

function formatTime(ts: { seconds: number } | undefined): string {
  if (!ts) return ''
  return new Date(ts.seconds * 1000).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function useVibrate(pattern: number[]): () => void {
  return useCallback(() => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }, [pattern])
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

// Toast state
type ToastType = 'info' | 'success' | 'error'
interface Toast {
  id: number
  message: string
  type: ToastType
}

// Spring config
const spring = { type: 'spring', stiffness: 300, damping: 30 } as const
const springFast = { type: 'spring', stiffness: 400, damping: 35 } as const

// ─────────────────────────────────────────────────────────────────────────────
// 3. BACKGROUND CANVAS (orbs + grain)
// ─────────────────────────────────────────────────────────────────────────────

function Background() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Film grain */}
      <div
        className="absolute inset-0 animate-grain opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />
      {/* Kodak Gold orbs */}
      {[
        { x: '15%', y: '20%', delay: '0s', size: 320 },
        { x: '75%', y: '60%', delay: '4s', size: 240 },
        { x: '45%', y: '80%', delay: '8s', size: 180 },
      ].map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-orb-drift"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, rgba(254,215,26,0.12) 0%, rgba(254,215,26,0.04) 50%, transparent 70%)`,
            filter: 'blur(40px)',
            animationDelay: orb.delay,
            animationDuration: `${14 + i * 3}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. TOAST SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

let toastCounter = 0

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return { toasts, addToast }
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-32px)] max-w-sm pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={spring}
            className="glass rounded-xl px-4 py-3 flex items-center gap-3"
            style={{
              borderColor:
                t.type === 'error'
                  ? 'rgba(192,57,43,0.4)'
                  : t.type === 'success'
                  ? 'rgba(100,200,100,0.3)'
                  : 'rgba(255,255,255,0.14)',
            }}
          >
            {t.type === 'error' && <AlertCircle size={16} color="#e05252" strokeWidth={1.5} />}
            {t.type === 'success' && <CheckCircle2 size={16} color="#6ce07c" strokeWidth={1.5} />}
            {t.type === 'info' && <Bell size={16} color="#FED71A" strokeWidth={1.5} />}
            <span className="text-sm text-white">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3c. SKELETON COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ''}`} />
}

// ─────────────────────────────────────────────────────────────────────────────
// 3d. STAR RATING
// ─────────────────────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => !readonly && onChange?.(n)}
          className={`transition-transform ${!readonly ? 'active:scale-125' : ''}`}
          style={{ background: 'none', border: 'none', cursor: readonly ? 'default' : 'pointer', padding: 4 }}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star
            size={24}
            strokeWidth={1.5}
            fill={n <= value ? '#FED71A' : 'transparent'}
            color={n <= value ? '#FED71A' : '#D1D1D1'}
          />
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUTH SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1200)
    return () => clearTimeout(t)
  }, [])

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    try {
      const user = await signInWithGoogle()
      onAuth(user)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEmail = async () => {
    setLoading(true)
    setError('')
    try {
      let user: User
      if (mode === 'signup') {
        user = await signUpEmail(email, password)
      } else {
        user = await signInEmail(email, password)
      }
      onAuth(user)
    } catch (e) {
      setError(e instanceof Error ? e.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '') : 'Auth failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 relative" style={{ zIndex: 1 }}>
      {/* Splash wordmark */}
      <AnimatePresence>
        {!splashDone && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 10, background: '#000' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative overflow-hidden">
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-4xl font-black tracking-tight text-white"
              >
                Washwheels
              </motion.h1>
              <motion.div
                className="absolute inset-0"
                initial={{ x: '-120%', skewX: '-20deg' }}
                animate={{ x: '120%', skewX: '-20deg' }}
                transition={{ delay: 0.2, duration: 0.8, ease: 'easeInOut' }}
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(254,215,26,0.7), transparent)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring, delay: 0.2 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: '#FED71A', boxShadow: '0 0 40px rgba(254,215,26,0.4)' }}
          >
            <Droplets size={28} color="#000" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-black text-white">Washwheels</h1>
          <p className="text-silver-grain text-sm mt-1">15-min doorstep car wash · Lucknow</p>
        </div>

        {/* Card */}
        <div className="glass rounded-[28px] p-6">
          {/* Specular overlay handled by .glass::before */}
          <div className="relative z-10">
            {/* Toggle */}
            <div className="flex glass rounded-xl p-1 mb-6">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative"
                  style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="auth-tab"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'rgba(254,215,26,0.15)', border: '1px solid rgba(254,215,26,0.3)' }}
                      transition={spring}
                    />
                  )}
                  <span className={`relative z-10 ${mode === m ? 'text-gold' : 'text-silver-grain'}`}>
                    {m === 'login' ? 'Sign in' : 'Sign up'}
                  </span>
                </button>
              ))}
            </div>

            {/* Google */}
            <motion.button
              onClick={handleGoogle}
              disabled={loading}
              whileTap={{ scale: 0.96 }}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-white mb-4 transition-all"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                cursor: 'pointer',
                minHeight: 48,
              }}
            >
              {/* Google SVG icon */}
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </motion.button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="text-xs text-silver-grain">or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input"
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                onKeyDown={(e) => e.key === 'Enter' && handleEmail()}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm mt-3"
                style={{ color: '#e05252' }}
              >
                {error}
              </motion.p>
            )}

            <motion.button
              onClick={handleEmail}
              disabled={loading || !email || !password}
              whileTap={{ scale: 0.97 }}
              className="btn-primary w-full mt-5"
              style={{ minHeight: 48 }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
              ) : mode === 'login' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </motion.button>
          </div>
        </div>

        <p className="text-center text-xs text-silver-grain mt-6" style={{ opacity: 0.5 }}>
          By continuing, you agree to our Terms of Service
        </p>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LOCATION SCREEN
// ─────────────────────────────────────────────────────────────────────────────

// Leaflet map loaded client-side only
const LeafletMap = dynamic(() => import('@/app/LeafletMapClient'), { ssr: false })

interface LocationResult {
  text: string
  lat: number
  lng: number
}

function LocationScreen({
  onLocation,
}: {
  onLocation: (result: LocationResult) => void
}) {
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'fallback' | 'done'>('idle')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<LocationResult[]>([])
  const [mapCenter, setMapCenter] = useState<[number, number]>(LUCKNOW_CENTER)
  const [pinPos, setPinPos] = useState<[number, number]>(LUCKNOW_CENTER)
  const [addressText, setAddressText] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 400)
  const nominatimCache = useRef<Map<string, string>>(new Map())
  const lastNominatimCall = useRef<number>(0)

  // Fetch Photon suggestions
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setSuggestions([])
      return
    }
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(debouncedQuery + ' Lucknow')}&limit=5&bbox=${LUCKNOW_BBOX}&lang=en`
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then((r) => r.json())
      .then((data) => {
        const results: LocationResult[] = (data.features ?? []).map(
          (f: { geometry: { coordinates: [number, number] }; properties: { name?: string; street?: string; city?: string; state?: string } }) => ({
            text: [f.properties.name, f.properties.street, f.properties.city, f.properties.state]
              .filter(Boolean)
              .join(', '),
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          })
        )
        setSuggestions(results)
      })
      .catch(() => setSuggestions([]))
  }, [debouncedQuery])

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (nominatimCache.current.has(key)) return nominatimCache.current.get(key)!

    const now = Date.now()
    const delay = Math.max(0, 1000 - (now - lastNominatimCall.current))
    await new Promise((r) => setTimeout(r, delay))
    lastNominatimCall.current = Date.now()

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'Washwheels/1.0' } }
      )
      const data = await res.json()
      const addr =
        data.display_name ||
        [data.address?.road, data.address?.suburb, data.address?.city].filter(Boolean).join(', ')
      nominatimCache.current.set(key, addr)
      return addr
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
  }

  const requestGPS = async () => {
    setPhase('fetching')
    setError('')
    if (!navigator.geolocation) {
      setPhase('fallback')
      setError('Geolocation not supported. Search your address below.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const text = await reverseGeocode(lat, lng)
        setAddressText(text)
        setMapCenter([lat, lng])
        setPinPos([lat, lng])
        setPhase('done')
        onLocation({ text, lat, lng })
      },
      (err) => {
        setPhase('fallback')
        setError(
          err.code === 1
            ? 'Location denied. Search or drop a pin below.'
            : 'Could not get location. Search or drop a pin.'
        )
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const selectSuggestion = (s: LocationResult) => {
    setSuggestions([])
    setSearchQuery(s.text)
    setAddressText(s.text)
    setMapCenter([s.lat, s.lng])
    setPinPos([s.lat, s.lng])
    setPhase('done')
  }

  const onPinDrop = async (lat: number, lng: number) => {
    setPinPos([lat, lng])
    const text = await reverseGeocode(lat, lng)
    setAddressText(text)
    setSearchQuery(text)
  }

  const confirmManual = () => {
    if (!addressText) return
    onLocation({ text: addressText, lat: pinPos[0], lng: pinPos[1] })
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 relative" style={{ zIndex: 1 }}>
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold text-white text-center mb-2">Where are you?</h2>
        <p className="text-silver-grain text-sm text-center mb-8">
          We&apos;ll send a washer to your door.
        </p>

        {phase === 'idle' && (
          <motion.button
            onClick={requestGPS}
            whileTap={{ scale: 0.95 }}
            className="btn-primary w-full flex items-center justify-center gap-3"
            style={{ minHeight: 56 }}
          >
            <MapPin size={20} strokeWidth={1.5} />
            Allow location
          </motion.button>
        )}

        {phase === 'fetching' && (
          <div className="flex flex-col items-center gap-6 py-8">
            {/* Radar rings */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              {[0, 0.4, 0.8].map((delay, i) => (
                <div
                  key={i}
                  className="absolute rounded-full border animate-radar-ping"
                  style={{
                    width: 48 + i * 12,
                    height: 48 + i * 12,
                    borderColor: '#FED71A',
                    animationDelay: `${delay}s`,
                    opacity: 0.8 - i * 0.2,
                  }}
                />
              ))}
              <MapPin size={28} color="#FED71A" strokeWidth={1.5} />
            </div>
            <p className="text-silver-grain text-sm">Locating you…</p>
          </div>
        )}

        {(phase === 'fallback' || phase === 'done') && (
          <div className="flex flex-col gap-4">
            {error && (
              <p className="text-sm text-center" style={{ color: '#e05252' }}>
                {error}
              </p>
            )}

            {/* Search box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search address…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input"
              />
              {suggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 glass rounded-xl overflow-hidden"
                  style={{ zIndex: 20 }}
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-4 py-3 text-sm text-white flex items-start gap-3 hover:bg-white/5 transition-colors"
                      style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                    >
                      <MapPin size={14} color="#D1D1D1" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                      <span>{s.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Map */}
            <div className="rounded-2xl overflow-hidden" style={{ height: 220 }}>
              <Suspense fallback={<Skeleton className="w-full h-full" />}>
                <LeafletMap
                  center={mapCenter}
                  pin={pinPos}
                  onPinDrop={onPinDrop}
                  height={220}
                />
              </Suspense>
            </div>

            {addressText && (
              <div className="glass rounded-xl px-4 py-3 flex items-start gap-3">
                <MapPin size={16} color="#FED71A" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm outline-none"
                  placeholder="Edit address…"
                />
              </div>
            )}

            <motion.button
              onClick={phase === 'done' ? () => onLocation({ text: addressText, lat: pinPos[0], lng: pinPos[1] }) : confirmManual}
              disabled={!addressText}
              whileTap={{ scale: 0.97 }}
              className="btn-primary w-full"
              style={{ minHeight: 52 }}
            >
              Confirm location
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ADDRESS DETAILS SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function AddressDetailsScreen({
  user,
  initialAddress,
  onSaved,
}: {
  user: User
  initialAddress: LocationResult
  onSaved: (profile: UserProfile) => void
}) {
  const [name, setName] = useState(user.displayName ?? '')
  const [phone, setPhone] = useState('')
  const [details, setDetails] = useState('')
  const [carName, setCarName] = useState('')
  const [plate, setPlate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name || !phone || !carName || !plate) {
      setError('Please fill all required fields.')
      return
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit phone number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const profile: Omit<UserProfile, 'createdAt'> = {
        uid: user.uid,
        name,
        email: user.email ?? '',
        phone,
        address: { ...initialAddress, details },
        car: { name: carName, plate: plate.toUpperCase() },
      }
      await saveUserProfile(user.uid, {
        ...profile,
        createdAt: serverTimestamp(),
      })
      onSaved(profile as UserProfile)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col px-4 pb-8 relative overflow-y-auto sheet-scroll"
      style={{ zIndex: 1, paddingTop: 'max(32px, env(safe-area-inset-top))' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="max-w-sm mx-auto w-full"
      >
        <h2 className="text-2xl font-bold text-white mb-1">Your details</h2>
        <p className="text-silver-grain text-sm mb-6">Just a few more things before your first wash.</p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-silver-grain mb-1 block">Full name *</label>
            <input
              className="glass-input"
              placeholder="Rajesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="text-xs text-silver-grain mb-1 block">Phone number *</label>
            <input
              className="glass-input"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="text-xs text-silver-grain mb-1 block">Address</label>
            <div
              className="glass rounded-xl px-4 py-3 text-sm text-silver-grain"
              style={{ wordBreak: 'break-word' }}
            >
              {initialAddress.text}
            </div>
          </div>
          <div>
            <label className="text-xs text-silver-grain mb-1 block">Flat / House / Landmark</label>
            <input
              className="glass-input"
              placeholder="e.g. B-204, Sector 10"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

          <div>
            <label className="text-xs text-silver-grain mb-1 block">Car model *</label>
            <input
              className="glass-input"
              placeholder="e.g. Maruti Swift"
              value={carName}
              onChange={(e) => setCarName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-silver-grain mb-1 block">Number plate *</label>
            <input
              className="glass-input"
              placeholder="UP 32 AB 1234"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              autoCapitalize="characters"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm mt-3" style={{ color: '#e05252' }}>
            {error}
          </p>
        )}

        <motion.button
          onClick={handleSave}
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="btn-primary w-full mt-6"
          style={{ minHeight: 52 }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
          ) : (
            'Save & continue'
          )}
        </motion.button>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CUSTOMER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

type CustomerTab = 'home' | 'bookings' | 'profile'

function CustomerDashboard({
  user,
  profile,
  onSignOut,
  onChangeAddress,
  addToast,
}: {
  user: User
  profile: UserProfile
  onSignOut: () => void
  onChangeAddress: () => void
  addToast: (msg: string, type?: ToastType) => void
}) {
  const [tab, setTab] = useState<CustomerTab>('home')
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null)

  const vibrate = useVibrate([100, 50, 100])

  const handleTabChange = (t: CustomerTab) => {
    setTab(t)
    vibrate()
  }

  return (
    <div className="min-h-[100dvh] relative flex flex-col" style={{ zIndex: 1 }}>
      <AnimatePresence mode="wait">
        {tab === 'home' && !activeBookingId && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
            className="flex-1"
          >
            <CustomerHome
              user={user}
              profile={profile}
              onChangeAddress={onChangeAddress}
              onBookingCreated={(id) => setActiveBookingId(id)}
              addToast={addToast}
            />
          </motion.div>
        )}
        {activeBookingId && (
          <motion.div
            key={`tracking-${activeBookingId}`}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -32 }}
            transition={spring}
            className="flex-1"
          >
            <BookingTracker
              bookingId={activeBookingId}
              customerProfile={profile}
              onDone={() => setActiveBookingId(null)}
              addToast={addToast}
            />
          </motion.div>
        )}
        {tab === 'bookings' && !activeBookingId && (
          <motion.div
            key="bookings"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
            className="flex-1"
          >
            <BookingHistory
              customerId={user.uid}
              addToast={addToast}
            />
          </motion.div>
        )}
        {tab === 'profile' && !activeBookingId && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
            className="flex-1"
          >
            <CustomerProfile
              profile={profile}
              onSignOut={onSignOut}
              onChangeAddress={onChangeAddress}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom dock */}
      {!activeBookingId && (
        <CustomerDock tab={tab} onTabChange={handleTabChange} />
      )}
    </div>
  )
}

function CustomerDock({
  tab,
  onTabChange,
}: {
  tab: CustomerTab
  onTabChange: (t: CustomerTab) => void
}) {
  const tabs: { id: CustomerTab; icon: React.ReactNode; label: string }[] = [
    { id: 'home', icon: <Home size={20} strokeWidth={1.5} />, label: 'Home' },
    { id: 'bookings', icon: <ClipboardList size={20} strokeWidth={1.5} />, label: 'Bookings' },
    { id: 'profile', icon: <UserIcon size={20} strokeWidth={1.5} />, label: 'Profile' },
  ]
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center"
      style={{
        zIndex: 50,
        padding: '0 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="glass-strong rounded-[24px] px-2 py-2 flex gap-1 w-full max-w-xs mb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all relative"
            style={{ border: 'none', background: 'none', cursor: 'pointer', minHeight: 52 }}
          >
            {tab === t.id && (
              <motion.div
                layoutId="customer-tab-bg"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'rgba(254,215,26,0.12)' }}
                transition={spring}
              />
            )}
            <span className={`relative z-10 transition-colors ${tab === t.id ? 'text-gold' : 'text-silver-grain'}`}>
              {t.icon}
            </span>
            <span
              className={`relative z-10 text-[10px] font-semibold tracking-wide ${tab === t.id ? 'text-gold' : 'text-silver-grain'}`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Customer Home ────────────────────────────────────────────────────────────

function CustomerHome({
  user,
  profile,
  onChangeAddress,
  onBookingCreated,
  addToast,
}: {
  user: User
  profile: UserProfile
  onChangeAddress: () => void
  onBookingCreated: (id: string) => void
  addToast: (msg: string, type?: ToastType) => void
}) {
  const [packages, setPackages] = useState<Package[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [booking, setBooking] = useState(false)
  const [loadingPkgs, setLoadingPkgs] = useState(true)
  const vibrate = useVibrate([50])

  useEffect(() => {
    const unsub1 = subscribePackages((pkgs) => {
      setPackages(pkgs)
      setLoadingPkgs(false)
    })
    const unsub2 = subscribeAddons(setAddons)
    return () => { unsub1(); unsub2() }
  }, [])

  const total = useMemo(() => {
    if (!selectedPkg) return 0
    const addonTotal = addons
      .filter((a) => selectedAddons.has(a.id))
      .reduce((s, a) => s + a.price, 0)
    return selectedPkg.price + addonTotal
  }, [selectedPkg, selectedAddons, addons])

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    vibrate()
  }

  const handleBook = async () => {
    if (!selectedPkg || booking) return
    setBooking(true)
    try {
      const addonsSnapshot = addons.filter((a) => selectedAddons.has(a.id))
      const id = await createBooking({
        customerId: user.uid,
        customerName: profile.name,
        customerPhone: profile.phone,
        address: profile.address,
        car: profile.car,
        packageSnapshot: selectedPkg,
        addonsSnapshot,
        total,
        status: 'searching',
        washerId: undefined,
        washerName: undefined,
      })

      // Notify washers
      const idToken = await user.getIdToken()
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          bookingId: id,
          packageName: selectedPkg.name,
          area: profile.address.text.split(',').slice(-2).join(',').trim(),
        }),
      }).catch(() => {}) // fire-and-forget

      onBookingCreated(id)
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Booking failed', 'error')
    } finally {
      setBooking(false)
    }
  }

  return (
    <div
      className="pb-[120px] px-4"
      style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-silver-grain text-sm">Good day,</p>
          <h2 className="text-xl font-bold text-white">{profile.name.split(' ')[0]} 👋</h2>
        </div>
        <button
          onClick={onChangeAddress}
          className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-sm text-silver-grain"
          style={{ border: 'none', cursor: 'pointer' }}
        >
          <MapPin size={14} strokeWidth={1.5} color="#FED71A" />
          <span className="max-w-[120px] truncate text-xs">{profile.address.text.split(',')[0]}</span>
        </button>
      </div>

      {/* Car info bento */}
      <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(254,215,26,0.12)' }}
        >
          <Car size={22} color="#FED71A" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{profile.car.name}</p>
          <p className="text-silver-grain text-sm">{profile.car.plate}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-silver-grain">Address</p>
          <p className="text-xs text-white truncate max-w-[100px]">
            {profile.address.details || profile.address.text.split(',')[0]}
          </p>
        </div>
      </div>

      {/* Packages */}
      <h3 className="text-lg font-bold text-white mb-3">Choose a package</h3>
      {loadingPkgs ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-silver-grain text-sm">No packages available right now. Check back soon.</p>
        </div>
      ) : (
        <LayoutGroup>
          <div className="flex flex-col gap-3">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                selected={selectedPkg?.id === pkg.id}
                onSelect={() => { setSelectedPkg(pkg); vibrate() }}
              />
            ))}
          </div>
        </LayoutGroup>
      )}

      {/* Add-ons */}
      {addons.length > 0 && selectedPkg && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-white mb-3">Add-ons</h3>
          <div className="flex flex-wrap gap-2">
            {addons.map((a) => (
              <AddonChip
                key={a.id}
                addon={a}
                selected={selectedAddons.has(a.id)}
                onToggle={() => toggleAddon(a.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sticky summary bar */}
      <AnimatePresence>
        {selectedPkg && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring}
            className="fixed bottom-[88px] left-0 right-0 flex justify-center px-4"
            style={{ zIndex: 40 }}
          >
            <div className="glass-strong rounded-2xl p-4 w-full max-w-sm flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-silver-grain">{selectedPkg.name}</p>
                <p className="text-xl font-black text-gold">{formatCurrency(total)}</p>
                <p className="text-xs text-silver-grain">{selectedPkg.durationMins} min · {selectedAddons.size > 0 ? `+${selectedAddons.size} add-on${selectedAddons.size > 1 ? 's' : ''}` : 'no add-ons'}</p>
              </div>
              <motion.button
                onClick={handleBook}
                disabled={booking}
                whileTap={{ scale: 0.95 }}
                className="btn-primary shrink-0"
                style={{ padding: '14px 22px' }}
              >
                {booking ? (
                  <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                ) : (
                  'Book wash'
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PackageCard({
  pkg,
  selected,
  onSelect,
}: {
  pkg: Package
  selected: boolean
  onSelect: () => void
}) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useTransform(my, [-100, 100], [3, -3])
  const rotateY = useTransform(mx, [-100, 100], [-3, 3])

  const packageIcons: Record<string, React.ReactNode> = {
    default: <Droplets size={20} color="#FED71A" strokeWidth={1.5} />,
  }

  return (
    <motion.div
      layoutId={`pkg-${pkg.id}`}
      onClick={onSelect}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        mx.set(e.clientX - rect.left - rect.width / 2)
        my.set(e.clientY - rect.top - rect.height / 2)
      }}
      onMouseLeave={() => { mx.set(0); my.set(0) }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', willChange: 'transform' }}
      animate={{
        scale: selected ? 1.02 : 1,
        boxShadow: selected
          ? '0 0 0 2px #FED71A, 0 0 32px rgba(254,215,26,0.3), 0 8px 32px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.4)',
      }}
      transition={spring}
      className="glass rounded-2xl p-4 cursor-pointer relative overflow-hidden"
    >
      {selected && (
        <motion.div
          layoutId="pkg-selected-glow"
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: 'rgba(254,215,26,0.06)' }}
        />
      )}
      <div className="relative z-10 flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: selected ? 'rgba(254,215,26,0.18)' : 'rgba(255,255,255,0.06)' }}
        >
          {packageIcons.default}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-bold text-white text-base">{pkg.name}</p>
            <p className="font-black text-gold text-lg shrink-0">{formatCurrency(pkg.price)}</p>
          </div>
          <p className="text-silver-grain text-sm mt-0.5 line-clamp-2">{pkg.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs text-silver-grain">
              <Clock size={12} strokeWidth={1.5} />
              <span>{pkg.durationMins} min</span>
            </div>
            {pkg.features.slice(0, 2).map((f, i) => (
              <div key={i} className="flex items-center gap-1 text-xs text-silver-grain">
                <Check size={12} strokeWidth={1.5} color="#FED71A" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
        {selected && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ background: '#FED71A' }}
          >
            <Check size={14} color="#000" strokeWidth={2.5} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

function AddonChip({
  addon,
  selected,
  onToggle,
}: {
  addon: Addon
  selected: boolean
  onToggle: () => void
}) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.92 }}
      animate={{
        background: selected ? 'rgba(254,215,26,0.18)' : 'rgba(255,255,255,0.06)',
        borderColor: selected ? 'rgba(254,215,26,0.5)' : 'rgba(255,255,255,0.14)',
      }}
      transition={springFast}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
      style={{
        border: '1px solid',
        cursor: 'pointer',
        color: selected ? '#FED71A' : '#D1D1D1',
      }}
    >
      {selected && <Check size={12} strokeWidth={2} color="#FED71A" />}
      {addon.name}
      <span style={{ color: selected ? 'rgba(254,215,26,0.7)' : 'rgba(209,209,209,0.5)' }}>
        +{formatCurrency(addon.price)}
      </span>
    </motion.button>
  )
}

// ─── Booking Tracker ──────────────────────────────────────────────────────────

function BookingTracker({
  bookingId,
  customerProfile,
  onDone,
  addToast,
}: {
  bookingId: string
  customerProfile: UserProfile
  onDone: () => void
  addToast: (msg: string, type?: ToastType) => void
}) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [washerPos, setWasherPos] = useState<[number, number] | null>(null)
  const [eta, setEta] = useState<string | null>(null)
  const [etaApprox, setEtaApprox] = useState(false)
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)
  const [showBurst, setShowBurst] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const prevStatusRef = useRef<BookingStatus | null>(null)
  const vibrate = useVibrate([100, 80, 200])

  useEffect(() => {
    const unsub = subscribeBooking(bookingId, (b) => {
      setBooking(b)
      if (b && b.status !== prevStatusRef.current) {
        if (prevStatusRef.current !== null) {
          addToast(STATUS_LABELS[b.status], 'success')
          vibrate()
        }
        prevStatusRef.current = b.status
        if (b.status === 'completed') setShowBurst(true)
      }
    })
    return unsub
  }, [bookingId, addToast, vibrate])

  // Track washer location
  useEffect(() => {
    if (!booking?.washerId) return
    if (!['on_the_way', 'reached', 'washing', 'accepted'].includes(booking.status)) return
    const unsub = onSnapshot(doc(db, 'washers', booking.washerId), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        if (d['lat'] && d['lng']) setWasherPos([d['lat'] as number, d['lng'] as number])
      }
    })
    return unsub
  }, [booking?.washerId, booking?.status])

  // Compute OSRM ETA
  useEffect(() => {
    if (!washerPos || !booking) return
    const dst = booking.address
    const url = `https://router.project-osrm.org/route/v1/driving/${washerPos[1]},${washerPos[0]};${dst.lng},${dst.lat}?overview=false`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const duration = data.routes?.[0]?.duration as number | undefined
        if (duration !== undefined) {
          const mins = Math.max(1, Math.round(duration / 60))
          setEta(`${mins} min`)
          setEtaApprox(false)
        }
      })
      .catch(() => {
        if (washerPos) {
          const km = haversineKm(washerPos[0], washerPos[1], dst.lat, dst.lng)
          const mins = Math.max(1, Math.round((km / 25) * 60))
          setEta(`~${mins} min`)
          setEtaApprox(true)
        }
      })
  }, [washerPos, booking])

  const handleCancel = async () => {
    if (!booking || booking.status !== 'searching') return
    setCancelling(true)
    try {
      await cancelBooking(bookingId)
      addToast('Booking cancelled', 'info')
      onDone()
    } catch {
      addToast('Could not cancel', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const handleRate = async () => {
    if (!rating || rated) return
    await rateBooking(bookingId, rating)
    setRated(true)
    addToast('Thanks for the rating!', 'success')
  }

  if (!booking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isCompleted = booking.status === 'completed'
  const isCancelled = booking.status === 'cancelled'

  return (
    <div
      className="min-h-[100dvh] flex flex-col pb-8 relative overflow-y-auto sheet-scroll"
      style={{ zIndex: 1 }}
    >
      {/* Map */}
      {!isCompleted && !isCancelled && (
        <div style={{ height: 280, position: 'relative' }}>
          <Suspense fallback={<Skeleton className="w-full h-full" />}>
            <LeafletMap
              center={washerPos ?? [customerProfile.address.lat, customerProfile.address.lng]}
              customerPin={[customerProfile.address.lat, customerProfile.address.lng]}
              washerPin={washerPos ?? undefined}
              height={280}
            />
          </Suspense>
        </div>
      )}

      <div className="px-4 pt-4 flex-1">
        {/* Status */}
        {booking.status === 'searching' && (
          <SearchingState
            onCancel={handleCancel}
            cancelling={cancelling}
          />
        )}

        {isCompleted && (
          <CompletedState
            booking={booking}
            rating={rating}
            rated={rated}
            onRate={setRating}
            onSubmitRating={handleRate}
            onDone={onDone}
            showBurst={showBurst}
          />
        )}

        {isCancelled && (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-xl font-bold text-white mb-2">Booking cancelled</p>
            <p className="text-silver-grain text-sm mb-4">Your booking has been cancelled.</p>
            <button onClick={onDone} className="btn-primary">Back to home</button>
          </div>
        )}

        {!['searching', 'completed', 'cancelled'].includes(booking.status) && (
          <ActiveBookingInfo
            booking={booking}
            eta={eta}
            etaApprox={etaApprox}
          />
        )}
      </div>
    </div>
  )
}

function SearchingState({ onCancel, cancelling }: { onCancel: () => void; cancelling: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Radar */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {[0, 0.5, 1].map((delay, i) => (
          <div
            key={i}
            className="absolute rounded-full border-2 animate-radar-ping"
            style={{
              width: 48 + i * 18,
              height: 48 + i * 18,
              borderColor: '#FED71A',
              animationDelay: `${delay}s`,
            }}
          />
        ))}
        <Car size={28} color="#FED71A" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-lg">Finding a washer near you</p>
        <p className="text-silver-grain text-sm mt-1">This usually takes under a minute</p>
      </div>
      <motion.button
        onClick={onCancel}
        disabled={cancelling}
        whileTap={{ scale: 0.95 }}
        className="px-6 py-3 rounded-xl text-sm font-medium"
        style={{
          border: '1px solid rgba(192,57,43,0.4)',
          background: 'rgba(192,57,43,0.1)',
          color: '#e05252',
          cursor: 'pointer',
        }}
      >
        {cancelling ? 'Cancelling…' : 'Cancel booking'}
      </motion.button>
    </div>
  )
}

function ActiveBookingInfo({
  booking,
  eta,
  etaApprox,
}: {
  booking: Booking
  eta: string | null
  etaApprox: boolean
}) {
  const stepIndex = STATUS_ORDER.indexOf(booking.status)

  return (
    <div className="flex flex-col gap-4">
      {/* ETA + washer */}
      {booking.washerId && (
        <div className="glass rounded-2xl p-4 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <UserIcon size={22} color="#D1D1D1" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{booking.washerName}</p>
            {eta && (
              <p className="text-sm" style={{ color: '#FED71A' }}>
                {eta} away {etaApprox && <span className="text-silver-grain text-xs">(approx)</span>}
              </p>
            )}
          </div>
          <a
            href={`tel:${booking.customerPhone}`}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(254,215,26,0.12)', textDecoration: 'none' }}
          >
            <Phone size={18} color="#FED71A" strokeWidth={1.5} />
          </a>
        </div>
      )}

      {/* Status stepper */}
      <div className="glass rounded-2xl p-4">
        <p className="text-xs text-silver-grain mb-4 uppercase tracking-widest">Progress</p>
        <div className="relative">
          {/* Track line */}
          <div
            className="absolute top-4 left-4 right-4 h-0.5"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          />
          {/* Gold fill */}
          <motion.div
            className="absolute top-4 left-4 h-0.5"
            style={{ background: '#FED71A', originX: 0 }}
            animate={{
              width: stepIndex >= 0
                ? `${(stepIndex / (STATUS_ORDER.length - 1)) * (100 - 8)}%`
                : '0%',
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />

          {/* Steps */}
          <div className="flex justify-between relative z-10">
            {STATUS_ORDER.map((s, i) => {
              const done = i <= stepIndex
              const active = i === stepIndex
              return (
                <div key={s} className="flex flex-col items-center gap-2">
                  <motion.div
                    animate={{
                      background: done ? '#FED71A' : 'rgba(255,255,255,0.1)',
                      scale: active ? 1.2 : 1,
                    }}
                    transition={spring}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                  >
                    {done ? (
                      s === 'washing' ? (
                        <Droplets size={14} color="#000" strokeWidth={2} />
                      ) : (
                        <Check size={14} color="#000" strokeWidth={2.5} />
                      )
                    ) : (
                      <Circle size={8} color="#D1D1D1" strokeWidth={1.5} />
                    )}
                  </motion.div>
                  <p className="text-[9px] text-silver-grain text-center w-14 leading-tight">
                    {STATUS_LABELS[s]}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Washing animation */}
        {booking.status === 'washing' && (
          <div className="mt-4 relative h-12 overflow-hidden rounded-xl" style={{ background: 'rgba(100,216,255,0.06)' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute bottom-0 w-2 h-2 rounded-full animate-bubble-rise"
                style={{
                  left: `${15 + i * 17}%`,
                  background: 'rgba(100,216,255,0.5)',
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${2 + i * 0.3}s`,
                }}
              />
            ))}
            <div
              className="absolute inset-0 animate-gloss-sweep"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
                width: '50%',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-white font-semibold">✨ Washing your car…</p>
            </div>
          </div>
        )}
      </div>

      {/* Package summary */}
      <div className="glass rounded-2xl p-4">
        <div className="flex justify-between items-center">
          <p className="text-white font-semibold">{booking.packageSnapshot.name}</p>
          <p className="text-gold font-black">{formatCurrency(booking.total)}</p>
        </div>
        {booking.addonsSnapshot.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {booking.addonsSnapshot.map((a) => (
              <span
                key={a.id}
                className="text-xs text-silver-grain px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                {a.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Car size={14} color="#D1D1D1" strokeWidth={1.5} />
          <p className="text-xs text-silver-grain">{booking.car.name} · {booking.car.plate}</p>
        </div>
      </div>
    </div>
  )
}

function CompletedState({
  booking,
  rating,
  rated,
  onRate,
  onSubmitRating,
  onDone,
  showBurst,
}: {
  booking: Booking
  rating: number
  rated: boolean
  onRate: (v: number) => void
  onSubmitRating: () => void
  onDone: () => void
  showBurst: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Gold burst */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {showBurst &&
          [0, 0.1, 0.2].map((delay, i) => (
            <div
              key={i}
              className="absolute rounded-full border-2 animate-burst-ring"
              style={{
                width: 48 + i * 10,
                height: 48 + i * 10,
                borderColor: '#FED71A',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(254,215,26,0.15)', border: '2px solid #FED71A' }}
        >
          <CheckCircle2 size={36} color="#FED71A" strokeWidth={1.5} />
        </div>
      </div>

      <div className="text-center">
        <p className="text-2xl font-black text-white">Car washed! ✨</p>
        <p className="text-silver-grain text-sm mt-1">Your car is sparkling clean.</p>
      </div>

      {/* Summary */}
      <div className="glass rounded-2xl p-4 w-full">
        <div className="flex justify-between items-center mb-3">
          <p className="text-silver-grain text-sm">Package</p>
          <p className="text-white font-medium">{booking.packageSnapshot.name}</p>
        </div>
        <div className="flex justify-between items-center mb-3">
          <p className="text-silver-grain text-sm">Washer</p>
          <p className="text-white font-medium">{booking.washerName}</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-silver-grain text-sm">Total</p>
          <p className="text-gold font-black text-lg">{formatCurrency(booking.total)}</p>
        </div>
      </div>

      {/* Rating */}
      {!rated && (
        <div className="glass rounded-2xl p-4 w-full text-center">
          <p className="text-white font-semibold mb-3">Rate your experience</p>
          <div className="flex justify-center mb-4">
            <StarRating value={rating} onChange={onRate} />
          </div>
          {rating > 0 && (
            <motion.button
              onClick={onSubmitRating}
              whileTap={{ scale: 0.96 }}
              className="btn-primary w-full"
            >
              Submit rating
            </motion.button>
          )}
        </div>
      )}

      {rated && (
        <p className="text-silver-grain text-sm">Thanks for rating! ⭐</p>
      )}

      <button onClick={onDone} className="text-silver-grain text-sm underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        Back to home
      </button>
    </div>
  )
}

// ─── Booking History ──────────────────────────────────────────────────────────

function BookingHistory({
  customerId,
  addToast,
}: {
  customerId: string
  addToast: (msg: string, type?: ToastType) => void
}) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeCustomerBookings(customerId, (b) => {
      setBookings(b)
      setLoading(false)
    })
    return unsub
  }, [customerId])

  return (
    <div
      className="pb-[100px] px-4"
      style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      <h2 className="text-xl font-bold text-white mb-4">Booking history</h2>
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <ClipboardList size={32} color="#D1D1D1" strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="text-silver-grain">No bookings yet. Book your first wash!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b) => (
            <div key={b.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-white">{b.packageSnapshot.name}</p>
                <span className={`status-pill status-${b.status}`}>{STATUS_LABELS[b.status]}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-silver-grain text-sm">{b.car.name} · {b.car.plate}</p>
                <p className="text-gold font-bold">{formatCurrency(b.total)}</p>
              </div>
              {b.rating && (
                <div className="mt-2">
                  <StarRating value={b.rating} readonly />
                </div>
              )}
              <p className="text-silver-grain text-xs mt-1">{formatTime(b.createdAt as unknown as { seconds: number })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Customer Profile ─────────────────────────────────────────────────────────

function CustomerProfile({
  profile,
  onSignOut,
  onChangeAddress,
}: {
  profile: UserProfile
  onSignOut: () => void
  onChangeAddress: () => void
}) {
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
    setIsIOS(ios && !standalone)
  }, [])

  return (
    <div
      className="pb-[100px] px-4"
      style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      <h2 className="text-xl font-bold text-white mb-6">Profile</h2>

      {isIOS && !showIOSHint && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4 mb-4 flex items-start gap-3"
          style={{ border: '1px solid rgba(254,215,26,0.3)' }}
        >
          <Share2 size={18} color="#FED71A" strokeWidth={1.5} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">Add to Home Screen</p>
            <p className="text-silver-grain text-xs mt-0.5">
              Tap <Share2 size={10} className="inline" /> then &ldquo;Add to Home Screen&rdquo; for push notifications on iOS.
            </p>
          </div>
          <button
            onClick={() => setShowIOSHint(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} color="#D1D1D1" strokeWidth={1.5} />
          </button>
        </motion.div>
      )}

      <div className="flex flex-col gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black"
              style={{ background: 'rgba(254,215,26,0.15)', color: '#FED71A' }}
            >
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold">{profile.name}</p>
              <p className="text-silver-grain text-sm">{profile.email}</p>
              <p className="text-silver-grain text-sm">{profile.phone}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-silver-grain text-xs uppercase tracking-widest">Car</p>
          </div>
          <div className="flex items-center gap-3">
            <Car size={18} color="#FED71A" strokeWidth={1.5} />
            <div>
              <p className="text-white font-medium">{profile.car.name}</p>
              <p className="text-silver-grain text-sm">{profile.car.plate}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-silver-grain text-xs uppercase tracking-widest">Address</p>
            <button
              onClick={onChangeAddress}
              className="text-xs text-gold"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Change
            </button>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={16} color="#D1D1D1" strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <p className="text-white text-sm">{profile.address.text}</p>
          </div>
          {profile.address.details && (
            <p className="text-silver-grain text-sm mt-1 ml-7">{profile.address.details}</p>
          )}
        </div>

        <motion.button
          onClick={onSignOut}
          whileTap={{ scale: 0.97 }}
          className="glass rounded-2xl p-4 flex items-center gap-3 w-full"
          style={{ border: '1px solid rgba(192,57,43,0.2)', cursor: 'pointer', background: 'rgba(192,57,43,0.06)' }}
        >
          <LogOut size={18} color="#e05252" strokeWidth={1.5} />
          <span style={{ color: '#e05252' }} className="font-medium">Sign out</span>
        </motion.button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. WASHER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

type WasherTab = 'jobs' | 'earnings' | 'profile'

function WasherDashboard({
  user,
  onSignOut,
  addToast,
}: {
  user: User
  onSignOut: () => void
  addToast: (msg: string, type?: ToastType) => void
}) {
  const [tab, setTab] = useState<WasherTab>('jobs')
  const [washerProfile, setWasherProfile] = useState<WasherProfile | null>(null)
  const [online, setOnline] = useState(false)
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  const [notifGranted, setNotifGranted] = useState(false)
  const [incomingBooking, setIncomingBooking] = useState<Booking | null>(null)
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastLocationUpdate = useRef<number>(0)
  const vibrate = useVibrate([300, 100, 300])

  // Load profile
  useEffect(() => {
    getWasherProfile(user.uid).then((p) => {
      if (p) {
        setWasherProfile(p)
        setOnline(p.online)
      }
    })
  }, [user.uid])

  // Check notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifGranted(Notification.permission === 'granted')
    }
  }, [])

  // Subscribe to active job
  useEffect(() => {
    const unsub = subscribeWasherActiveBooking(user.uid, setActiveBooking)
    return unsub
  }, [user.uid])

  // Subscribe to new searching bookings
  useEffect(() => {
    if (!online) return
    const unsub = subscribeSearchingBookings((bookings) => {
      if (bookings.length > 0 && !activeBooking) {
        const b = bookings[0]
        if (b.id !== incomingBooking?.id) {
          setIncomingBooking(b)
          vibrate()
          // Play sound
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.8)
          } catch { /* ignore */ }
        }
      } else if (bookings.length === 0) {
        setIncomingBooking(null)
      }
    })
    return unsub
  }, [online, activeBooking, incomingBooking, vibrate])

  // Watch position when online
  const startLocationWatch = useCallback(() => {
    if (!navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now()
        if (now - lastLocationUpdate.current < 5000) return
        lastLocationUpdate.current = now
        const { latitude: lat, longitude: lng } = pos.coords
        await updateWasherLocation(user.uid, lat, lng, true)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 }
    )
  }, [user.uid])

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const handleToggleOnline = async () => {
    if (!online) {
      // First time going online — ask for notification permission
      if (!notifGranted && 'Notification' in window && Notification.permission !== 'denied') {
        setShowNotifSheet(true)
        return
      }
      await goOnline()
    } else {
      await goOffline()
    }
  }

  const goOnline = async () => {
    setOnline(true)
    await setWasherOnline(user.uid, true)
    startLocationWatch()
    // Get FCM token
    const token = await getFCMToken()
    if (token) {
      await updateWasherLocation(user.uid, 0, 0, true, token)
    }
  }

  const goOffline = async () => {
    setOnline(false)
    stopLocationWatch()
    await setWasherOnline(user.uid, false)
    setIncomingBooking(null)
  }

  const requestNotifAndGoOnline = async () => {
    setShowNotifSheet(false)
    try {
      const perm = await Notification.requestPermission()
      setNotifGranted(perm === 'granted')
    } catch { /* ignore */ }
    await goOnline()
  }

  const handleAccept = async (bookingId: string) => {
    const name = washerProfile?.name ?? user.displayName ?? user.email ?? 'Washer'
    const success = await acceptBooking(bookingId, user.uid, name)
    if (success) {
      setIncomingBooking(null)
      addToast('Job accepted! 🚀', 'success')
    } else {
      setIncomingBooking(null)
      addToast('Taken by another washer', 'info')
    }
  }

  const handleDecline = () => {
    setIncomingBooking(null)
  }

  const advanceJob = async (nextStatus: BookingStatus) => {
    if (!activeBooking) return
    await advanceBookingStatus(activeBooking.id, nextStatus)
    addToast(STATUS_LABELS[nextStatus], 'success')
    vibrate()
  }

  useEffect(() => {
    return () => {
      stopLocationWatch()
    }
  }, [stopLocationWatch])

  const tabs: { id: WasherTab; icon: React.ReactNode; label: string }[] = [
    { id: 'jobs', icon: <Car size={20} strokeWidth={1.5} />, label: 'Jobs' },
    { id: 'earnings', icon: <Wallet size={20} strokeWidth={1.5} />, label: 'Earnings' },
    { id: 'profile', icon: <UserIcon size={20} strokeWidth={1.5} />, label: 'Profile' },
  ]

  return (
    <div className="min-h-[100dvh] relative flex flex-col" style={{ zIndex: 1 }}>
      {/* Incoming booking sheet */}
      <AnimatePresence>
        {incomingBooking && !activeBooking && (
          <IncomingBookingSheet
            booking={incomingBooking}
            washerLat={washerProfile?.lat ?? 0}
            washerLng={washerProfile?.lng ?? 0}
            onAccept={() => handleAccept(incomingBooking.id)}
            onDecline={handleDecline}
          />
        )}
      </AnimatePresence>

      {/* Notification permission sheet */}
      <AnimatePresence>
        {showNotifSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-end justify-center"
            style={{ zIndex: 90, background: 'rgba(0,0,0,0.7)' }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
              className="glass-strong rounded-t-[32px] p-6 w-full max-w-sm pb-10"
            >
              <div className="text-center mb-6">
                <Bell size={32} color="#FED71A" strokeWidth={1.5} className="mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white">Enable notifications</h3>
                <p className="text-silver-grain text-sm mt-2">
                  Allow notifications so we can alert you when a new wash request comes in, even when the app is in the background.
                </p>
              </div>
              <button onClick={requestNotifAndGoOnline} className="btn-primary w-full mb-3">
                Allow notifications & go online
              </button>
              <button
                onClick={() => { setShowNotifSheet(false); goOnline() }}
                className="w-full py-3 text-sm text-silver-grain text-center"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Skip for now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {tab === 'jobs' && (
          <motion.div
            key="washer-jobs"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
            className="flex-1"
          >
            <WasherJobs
              user={user}
              washerProfile={washerProfile}
              online={online}
              onToggleOnline={handleToggleOnline}
              activeBooking={activeBooking}
              onAdvanceJob={advanceJob}
              addToast={addToast}
            />
          </motion.div>
        )}
        {tab === 'earnings' && (
          <motion.div
            key="washer-earnings"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
            className="flex-1"
          >
            <WasherEarnings washerId={user.uid} />
          </motion.div>
        )}
        {tab === 'profile' && (
          <motion.div
            key="washer-profile"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
            className="flex-1"
          >
            <WasherProfileView
              washerProfile={washerProfile}
              user={user}
              onSignOut={onSignOut}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dock */}
      <div
        className="fixed bottom-0 left-0 right-0 flex justify-center"
        style={{
          zIndex: 50,
          padding: '0 16px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="glass-strong rounded-[24px] px-2 py-2 flex gap-1 w-full max-w-xs mb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all relative"
              style={{ border: 'none', background: 'none', cursor: 'pointer', minHeight: 52 }}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="washer-tab-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'rgba(254,215,26,0.12)' }}
                  transition={spring}
                />
              )}
              <span className={`relative z-10 ${tab === t.id ? 'text-gold' : 'text-silver-grain'}`}>
                {t.icon}
              </span>
              <span className={`relative z-10 text-[10px] font-semibold tracking-wide ${tab === t.id ? 'text-gold' : 'text-silver-grain'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function IncomingBookingSheet({
  booking,
  washerLat,
  washerLng,
  onAccept,
  onDecline,
}: {
  booking: Booking
  washerLat: number
  washerLng: number
  onAccept: () => void
  onDecline: () => void
}) {
  const [timeLeft, setTimeLeft] = useState(30)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onDecline()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onDecline])

  const distance =
    washerLat && washerLng
      ? haversineKm(washerLat, washerLng, booking.address.lat, booking.address.lng).toFixed(1)
      : null

  const circumference = 2 * Math.PI * 28
  const dashOffset = circumference * (1 - timeLeft / 30)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 80, background: 'rgba(0,0,0,0.8)' }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring}
        className="glass-strong rounded-t-[32px] p-6 w-full max-w-sm pb-10 relative overflow-hidden"
      >
        {/* Radar rings */}
        <div className="absolute top-6 right-6 w-16 h-16 flex items-center justify-center">
          {[0, 0.6, 1.2].map((delay, i) => (
            <div
              key={i}
              className="absolute rounded-full border animate-radar-ping"
              style={{
                width: 20 + i * 16,
                height: 20 + i * 16,
                borderColor: '#FED71A',
                animationDelay: `${delay}s`,
                opacity: 0.6 - i * 0.15,
              }}
            />
          ))}
          {/* Countdown circle */}
          <svg width="64" height="64" className="absolute" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke="#FED71A" strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className="text-gold font-bold text-sm relative z-10">{timeLeft}s</span>
        </div>

        <h3 className="text-xl font-black text-white mb-1">New request 🚗</h3>
        <p className="text-silver-grain text-sm mb-5">Accept quickly — it goes to the next washer!</p>

        <div className="flex flex-col gap-3 mb-6">
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <span className="text-silver-grain text-sm">Package</span>
            <span className="text-white font-semibold">{booking.packageSnapshot.name}</span>
          </div>
          {booking.addonsSnapshot.length > 0 && (
            <div className="glass rounded-xl p-3 flex items-center justify-between">
              <span className="text-silver-grain text-sm">Add-ons</span>
              <span className="text-white text-sm">{booking.addonsSnapshot.map(a => a.name).join(', ')}</span>
            </div>
          )}
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <span className="text-silver-grain text-sm">Area</span>
            <span className="text-white text-sm truncate max-w-[180px]">
              {booking.address.text.split(',').slice(0, 2).join(',')}
            </span>
          </div>
          {distance && (
            <div className="glass rounded-xl p-3 flex items-center justify-between">
              <span className="text-silver-grain text-sm">Distance</span>
              <span className="text-white font-semibold">{distance} km away</span>
            </div>
          )}
          <div className="glass rounded-xl p-3 flex items-center justify-between">
            <span className="text-silver-grain text-sm">Your payout</span>
            <span className="text-gold font-black text-lg">{formatCurrency(booking.total)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <motion.button
            onClick={onDecline}
            whileTap={{ scale: 0.95 }}
            className="flex-1 py-4 rounded-2xl font-semibold"
            style={{
              background: 'rgba(192,57,43,0.12)',
              border: '1px solid rgba(192,57,43,0.3)',
              color: '#e05252',
              cursor: 'pointer',
            }}
          >
            Decline
          </motion.button>
          <motion.button
            onClick={onAccept}
            whileTap={{ scale: 0.95 }}
            className="flex-[2] py-4 rounded-2xl font-black text-black"
            style={{ background: '#FED71A', cursor: 'pointer', boxShadow: '0 0 20px rgba(254,215,26,0.4)' }}
          >
            Accept 🚀
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function WasherJobs({
  user,
  washerProfile,
  online,
  onToggleOnline,
  activeBooking,
  onAdvanceJob,
  addToast,
}: {
  user: User
  washerProfile: WasherProfile | null
  online: boolean
  onToggleOnline: () => void
  activeBooking: Booking | null
  onAdvanceJob: (status: BookingStatus) => void
  addToast: (msg: string, type?: ToastType) => void
}) {
  return (
    <div
      className="pb-[100px] px-4"
      style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-silver-grain text-sm">Welcome back,</p>
          <h2 className="text-xl font-bold text-white">
            {washerProfile?.name ?? user.displayName ?? 'Washer'} 👋
          </h2>
        </div>
        {/* Online toggle */}
        <motion.button
          onClick={onToggleOnline}
          whileTap={{ scale: 0.92 }}
          animate={{
            background: online ? 'rgba(100,220,100,0.12)' : 'rgba(255,255,255,0.06)',
            borderColor: online ? 'rgba(100,220,100,0.4)' : 'rgba(255,255,255,0.14)',
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ border: '1px solid', cursor: 'pointer' }}
        >
          {online ? (
            <Wifi size={16} color="#6ce07c" strokeWidth={1.5} />
          ) : (
            <WifiOff size={16} color="#D1D1D1" strokeWidth={1.5} />
          )}
          <span className={`text-sm font-semibold ${online ? 'text-[#6ce07c]' : 'text-silver-grain'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
        </motion.button>
      </div>

      {!online && (
        <div className="glass rounded-2xl p-6 text-center mb-6">
          <WifiOff size={28} color="#D1D1D1" strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="text-white font-semibold">You&apos;re offline</p>
          <p className="text-silver-grain text-sm mt-1">Go online to start receiving wash requests.</p>
          <motion.button
            onClick={onToggleOnline}
            whileTap={{ scale: 0.96 }}
            className="btn-primary mt-4"
            style={{ padding: '12px 32px' }}
          >
            Go online
          </motion.button>
        </div>
      )}

      {online && !activeBooking && (
        <div className="glass rounded-2xl p-6 text-center">
          <div className="relative w-16 h-16 flex items-center justify-center mx-auto mb-4">
            {[0, 0.6, 1.2].map((delay, i) => (
              <div
                key={i}
                className="absolute rounded-full border animate-radar-ping"
                style={{
                  width: 20 + i * 16,
                  height: 20 + i * 16,
                  borderColor: '#FED71A',
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
            <Zap size={22} color="#FED71A" strokeWidth={1.5} />
          </div>
          <p className="text-white font-semibold">Waiting for requests…</p>
          <p className="text-silver-grain text-sm mt-1">We&apos;ll alert you when a booking comes in.</p>
        </div>
      )}

      {activeBooking && (
        <ActiveJobCard
          booking={activeBooking}
          onAdvance={onAdvanceJob}
        />
      )}
    </div>
  )
}

function ActiveJobCard({
  booking,
  onAdvance,
}: {
  booking: Booking
  onAdvance: (status: BookingStatus) => void
}) {
  const nextStatus = WASHER_NEXT_STATUS[booking.status]
  const nextLabel = WASHER_NEXT_LABEL[booking.status]
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${booking.address.lat},${booking.address.lng}`
  const [mapCenter] = useState<[number, number]>([booking.address.lat, booking.address.lng])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">Active job</h3>
        <span className={`status-pill status-${booking.status}`}>{STATUS_LABELS[booking.status]}</span>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden" style={{ height: 200 }}>
        <Suspense fallback={<Skeleton className="w-full h-full" />}>
          <LeafletMap
            center={mapCenter}
            customerPin={[booking.address.lat, booking.address.lng]}
            height={200}
          />
        </Suspense>
      </div>

      {/* Customer info */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <UserIcon size={18} color="#D1D1D1" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold truncate">{booking.customerName}</p>
              <p className="text-silver-grain text-xs truncate">{booking.address.text}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href={`tel:${booking.customerPhone}`}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(254,215,26,0.12)' }}
            >
              <Phone size={16} color="#FED71A" strokeWidth={1.5} />
            </a>
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(254,215,26,0.12)' }}
            >
              <Navigation size={16} color="#FED71A" strokeWidth={1.5} />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Car size={14} color="#D1D1D1" strokeWidth={1.5} />
          <p className="text-silver-grain text-sm">{booking.car.name} · {booking.car.plate}</p>
        </div>
        {booking.address.details && (
          <p className="text-silver-grain text-xs mt-1 ml-5">{booking.address.details}</p>
        )}
      </div>

      {/* Package */}
      <div className="glass rounded-2xl p-4">
        <div className="flex justify-between items-center">
          <p className="text-white font-semibold">{booking.packageSnapshot.name}</p>
          <p className="text-gold font-black">{formatCurrency(booking.total)}</p>
        </div>
        {booking.addonsSnapshot.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {booking.addonsSnapshot.map((a) => (
              <span key={a.id} className="text-xs text-silver-grain px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Primary action */}
      {nextStatus && nextLabel && (
        <motion.button
          onClick={() => onAdvance(nextStatus)}
          whileTap={{ scale: 0.97 }}
          className="btn-primary w-full"
          style={{ minHeight: 56, fontSize: 17 }}
        >
          {nextLabel}
        </motion.button>
      )}

      {booking.status === 'completed' && (
        <div className="glass rounded-2xl p-4 text-center">
          <CheckCircle2 size={28} color="#FED71A" strokeWidth={1.5} className="mx-auto mb-2" />
          <p className="text-white font-bold">Job completed!</p>
        </div>
      )}
    </div>
  )
}

function WasherEarnings({ washerId }: { washerId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeWasherBookings(washerId, (b) => {
      setBookings(b)
      setLoading(false)
    })
    return unsub
  }, [washerId])

  const completed = bookings.filter((b) => b.status === 'completed')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCompleted = completed.filter((b) => {
    const ts = b.completedAt as unknown as { seconds: number } | undefined
    return ts && ts.seconds * 1000 >= today.getTime()
  })
  const todayRevenue = todayCompleted.reduce((s, b) => s + b.total, 0)
  const totalRevenue = completed.reduce((s, b) => s + b.total, 0)

  return (
    <div
      className="pb-[100px] px-4"
      style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      <h2 className="text-xl font-bold text-white mb-6">Earnings</h2>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: "Today's earnings", value: formatCurrency(todayRevenue), icon: <IndianRupee size={18} color="#FED71A" strokeWidth={1.5} /> },
          { label: 'Total earnings', value: formatCurrency(totalRevenue), icon: <Wallet size={18} color="#FED71A" strokeWidth={1.5} /> },
          { label: "Today's jobs", value: String(todayCompleted.length), icon: <Car size={18} color="#FED71A" strokeWidth={1.5} /> },
          { label: 'Total jobs', value: String(completed.length), icon: <CheckCircle2 size={18} color="#FED71A" strokeWidth={1.5} /> },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              {stat.icon}
              <p className="text-silver-grain text-xs">{stat.label}</p>
            </div>
            <p className="text-white font-black text-xl">{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent completed */}
      <h3 className="text-sm font-semibold text-silver-grain mb-3 uppercase tracking-widest">Recent</h3>
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : completed.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-silver-grain text-sm">No completed jobs yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {completed.slice(0, 10).map((b) => (
            <div key={b.id} className="glass rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">{b.packageSnapshot.name}</p>
                <p className="text-silver-grain text-xs">{formatTime(b.completedAt as unknown as { seconds: number })}</p>
              </div>
              <p className="text-gold font-bold">{formatCurrency(b.total)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WasherProfileView({
  washerProfile,
  user,
  onSignOut,
}: {
  washerProfile: WasherProfile | null
  user: User
  onSignOut: () => void
}) {
  return (
    <div
      className="pb-[100px] px-4"
      style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      <h2 className="text-xl font-bold text-white mb-6">Profile</h2>
      <div className="flex flex-col gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black"
              style={{ background: 'rgba(254,215,26,0.15)', color: '#FED71A' }}
            >
              {(washerProfile?.name ?? user.displayName ?? 'W').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold">{washerProfile?.name ?? user.displayName ?? 'Washer'}</p>
              <p className="text-silver-grain text-sm">{user.email}</p>
              {washerProfile?.phone && <p className="text-silver-grain text-sm">{washerProfile.phone}</p>}
            </div>
          </div>
        </div>
        <motion.button
          onClick={onSignOut}
          whileTap={{ scale: 0.97 }}
          className="glass rounded-2xl p-4 flex items-center gap-3 w-full"
          style={{ border: '1px solid rgba(192,57,43,0.2)', cursor: 'pointer', background: 'rgba(192,57,43,0.06)' }}
        >
          <LogOut size={18} color="#e05252" strokeWidth={1.5} />
          <span style={{ color: '#e05252' }} className="font-medium">Sign out</span>
        </motion.button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

type AdminTab = 'overview' | 'bookings' | 'washers' | 'catalog'

function AdminDashboard({
  user,
  onSignOut,
  addToast,
}: {
  user: User
  onSignOut: () => void
  addToast: (msg: string, type?: ToastType) => void
}) {
  const [tab, setTab] = useState<AdminTab>('overview')
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [allWashers, setAllWashers] = useState<WasherProfile[]>([])
  const [customerCount, setCustomerCount] = useState<number>(0)

  useEffect(() => {
    const unsub1 = subscribeAllBookings(setAllBookings)
    const unsub2 = subscribeAllWashers(setAllWashers)
    getAllCustomersCount().then(setCustomerCount)
    return () => { unsub1(); unsub2() }
  }, [])

  const tabs: { id: AdminTab; icon: React.ReactNode; label: string }[] = [
    { id: 'overview', icon: <Home size={18} strokeWidth={1.5} />, label: 'Overview' },
    { id: 'bookings', icon: <ClipboardList size={18} strokeWidth={1.5} />, label: 'Bookings' },
    { id: 'washers', icon: <UserIcon size={18} strokeWidth={1.5} />, label: 'Washers' },
    { id: 'catalog', icon: <Sparkles size={18} strokeWidth={1.5} />, label: 'Catalog' },
  ]

  return (
    <div
      className="min-h-[100dvh] relative"
      style={{ zIndex: 1, paddingTop: 'max(24px, env(safe-area-inset-top))' }}
    >
      {/* Header */}
      <div className="px-4 md:px-8 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Admin</h1>
          <p className="text-silver-grain text-sm">Washwheels command centre</p>
        </div>
        <motion.button
          onClick={onSignOut}
          whileTap={{ scale: 0.92 }}
          className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-sm text-silver-grain"
          style={{ border: 'none', cursor: 'pointer' }}
        >
          <LogOut size={14} strokeWidth={1.5} />
          Sign out
        </motion.button>
      </div>

      {/* Tab bar */}
      <div className="px-4 md:px-8 mb-6">
        <div className="glass rounded-2xl p-1 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all relative"
              style={{ border: 'none', background: 'none', cursor: 'pointer', minWidth: 80 }}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="admin-tab-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'rgba(254,215,26,0.15)' }}
                  transition={spring}
                />
              )}
              <span className={`relative z-10 ${tab === t.id ? 'text-gold' : 'text-silver-grain'}`}>{t.icon}</span>
              <span className={`relative z-10 ${tab === t.id ? 'text-gold' : 'text-silver-grain'}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'overview' && (
          <motion.div key="admin-overview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
            <AdminOverview bookings={allBookings} washers={allWashers} customerCount={customerCount} />
          </motion.div>
        )}
        {tab === 'bookings' && (
          <motion.div key="admin-bookings" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
            <AdminBookings bookings={allBookings} washers={allWashers} addToast={addToast} />
          </motion.div>
        )}
        {tab === 'washers' && (
          <motion.div key="admin-washers" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
            <AdminWashers washers={allWashers} bookings={allBookings} />
          </motion.div>
        )}
        {tab === 'catalog' && (
          <motion.div key="admin-catalog" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
            <AdminCatalog addToast={addToast} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AdminOverview({
  bookings,
  washers,
  customerCount,
}: {
  bookings: Booking[]
  washers: WasherProfile[]
  customerCount: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const active = bookings.filter((b) => !['completed', 'cancelled'].includes(b.status))
  const washersOnline = washers.filter((w) => w.online)
  const completedToday = bookings.filter((b) => {
    const ts = b.completedAt as unknown as { seconds: number } | undefined
    return b.status === 'completed' && ts && ts.seconds * 1000 >= today.getTime()
  })
  const revenueToday = completedToday.reduce((s, b) => s + b.total, 0)

  const tiles = [
    { label: 'Active bookings', value: String(active.length), icon: <Zap size={20} color="#FED71A" strokeWidth={1.5} />, highlight: active.length > 0 },
    { label: 'Washers online', value: String(washersOnline.length), icon: <Wifi size={20} color="#6ce07c" strokeWidth={1.5} />, highlight: false },
    { label: "Completed today", value: String(completedToday.length), icon: <CheckCircle2 size={20} color="#FED71A" strokeWidth={1.5} />, highlight: false },
    { label: "Revenue today", value: formatCurrency(revenueToday), icon: <IndianRupee size={20} color="#FED71A" strokeWidth={1.5} />, highlight: false },
    { label: 'Total customers', value: String(customerCount), icon: <UserIcon size={20} color="#D1D1D1" strokeWidth={1.5} />, highlight: false },
  ]

  return (
    <div className="px-4 md:px-8 pb-8">
      {washersOnline.length === 0 && (
        <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ border: '1px solid rgba(254,215,26,0.3)' }}>
          <AlertCircle size={18} color="#FED71A" strokeWidth={1.5} className="shrink-0" />
          <p className="text-gold text-sm font-medium">No washers are online right now.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map((tile, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: i * 0.05 }}
            className="glass rounded-2xl p-4"
            style={tile.highlight ? { border: '1px solid rgba(254,215,26,0.3)' } : {}}
          >
            <div className="flex items-center gap-2 mb-3">
              {tile.icon}
            </div>
            <p className="text-white font-black text-2xl">{tile.value}</p>
            <p className="text-silver-grain text-xs mt-1">{tile.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function AdminBookings({
  bookings,
  washers,
  addToast,
}: {
  bookings: Booking[]
  washers: WasherProfile[]
  addToast: (msg: string, type?: ToastType) => void
}) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedWasherId, setSelectedWasherId] = useState('')

  const handleAssign = async () => {
    if (!selectedBooking || !selectedWasherId) return
    const washer = washers.find((w) => w.uid === selectedWasherId)
    if (!washer) return
    await adminAssignWasher(selectedBooking.id, selectedWasherId, washer.name)
    addToast('Washer assigned', 'success')
    setSelectedBooking(null)
  }

  const handleCancel = async (bookingId: string) => {
    await adminCancelBooking(bookingId)
    addToast('Booking cancelled', 'info')
    setSelectedBooking(null)
  }

  return (
    <div className="px-4 md:px-8 pb-8">
      <div className="flex flex-col gap-3">
        {bookings.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <ClipboardList size={32} color="#D1D1D1" strokeWidth={1.5} className="mx-auto mb-3" />
            <p className="text-silver-grain">No bookings yet.</p>
          </div>
        )}
        {bookings.map((b) => (
          <div
            key={b.id}
            className="glass rounded-2xl p-4 cursor-pointer"
            onClick={() => setSelectedBooking(b)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-white font-semibold">{b.customerName}</p>
                <p className="text-silver-grain text-xs">{b.packageSnapshot.name}</p>
              </div>
              <span className={`status-pill status-${b.status} shrink-0`}>{STATUS_LABELS[b.status]}</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-silver-grain text-xs truncate">{b.address.text.split(',').slice(0, 2).join(',')}</p>
              <p className="text-gold font-bold shrink-0">{formatCurrency(b.total)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-end justify-center"
            style={{ zIndex: 70, background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setSelectedBooking(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-t-[32px] p-6 w-full max-w-lg pb-10 sheet-scroll max-h-[85dvh] overflow-y-auto"
            >
              <div className="w-12 h-1 rounded-full mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <h3 className="text-xl font-bold text-white mb-4">Booking detail</h3>

              <div className="flex flex-col gap-3">
                {[
                  { label: 'Customer', value: selectedBooking.customerName },
                  { label: 'Phone', value: selectedBooking.customerPhone },
                  { label: 'Address', value: selectedBooking.address.text },
                  { label: 'Car', value: `${selectedBooking.car.name} · ${selectedBooking.car.plate}` },
                  { label: 'Package', value: selectedBooking.packageSnapshot.name },
                  { label: 'Total', value: formatCurrency(selectedBooking.total) },
                  { label: 'Status', value: STATUS_LABELS[selectedBooking.status] },
                  { label: 'Washer', value: selectedBooking.washerName ?? 'None assigned' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-start gap-4">
                    <p className="text-silver-grain text-sm shrink-0">{item.label}</p>
                    <p className="text-white text-sm text-right">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Assign washer */}
              {!['completed', 'cancelled'].includes(selectedBooking.status) && (
                <div className="mt-6">
                  <p className="text-silver-grain text-xs mb-2 uppercase tracking-widest">Assign / Reassign washer</p>
                  <select
                    value={selectedWasherId}
                    onChange={(e) => setSelectedWasherId(e.target.value)}
                    className="glass-input mb-3"
                    style={{ color: '#fff', background: 'rgba(255,255,255,0.06)' }}
                  >
                    <option value="">Select a washer…</option>
                    {washers.map((w) => (
                      <option key={w.uid} value={w.uid} style={{ background: '#111' }}>
                        {w.name} {w.online ? '🟢' : '⚫'}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedWasherId}
                    className="btn-primary w-full"
                  >
                    Assign washer
                  </button>
                </div>
              )}

              {/* Cancel */}
              {!['completed', 'cancelled'].includes(selectedBooking.status) && (
                <button
                  onClick={() => handleCancel(selectedBooking.id)}
                  className="w-full mt-3 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: 'rgba(192,57,43,0.1)',
                    border: '1px solid rgba(192,57,43,0.3)',
                    color: '#e05252',
                    cursor: 'pointer',
                  }}
                >
                  Cancel booking
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AdminWashers({ washers, bookings }: { washers: WasherProfile[]; bookings: Booking[] }) {
  return (
    <div className="px-4 md:px-8 pb-8">
      {washers.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <UserIcon size={32} color="#D1D1D1" strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="text-silver-grain">No washers registered yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {washers.map((w) => {
            const completedJobs = bookings.filter(
              (b) => b.washerId === w.uid && b.status === 'completed'
            ).length
            return (
              <div key={w.uid} className="glass rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#D1D1D1' }}
                  >
                    {w.name?.charAt(0)?.toUpperCase() ?? 'W'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold truncate">{w.name}</p>
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: w.online ? '#6ce07c' : '#D1D1D1' }}
                      />
                    </div>
                    <p className="text-silver-grain text-xs">{w.phone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-bold">{completedJobs}</p>
                    <p className="text-silver-grain text-xs">jobs done</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AdminCatalog({ addToast }: { addToast: (msg: string, type?: ToastType) => void }) {
  const [packages, setPackages] = useState<Package[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [editingPkg, setEditingPkg] = useState<Partial<Package> | null>(null)
  const [editingAddon, setEditingAddon] = useState<Partial<Addon> | null>(null)
  const [savingPkg, setSavingPkg] = useState(false)
  const [savingAddon, setSavingAddon] = useState(false)

  useEffect(() => {
    const u1 = subscribeAllPackages(setPackages)
    const u2 = subscribeAllAddons(setAddons)
    return () => { u1(); u2() }
  }, [])

  const handleSavePkg = async () => {
    if (!editingPkg?.name || !editingPkg?.price) return
    setSavingPkg(true)
    try {
      await savePackage({
        id: editingPkg.id,
        name: editingPkg.name ?? '',
        description: editingPkg.description ?? '',
        price: Number(editingPkg.price),
        durationMins: Number(editingPkg.durationMins ?? 30),
        features: editingPkg.features ?? [],
        active: editingPkg.active ?? true,
        order: editingPkg.order ?? packages.length,
      })
      addToast('Package saved', 'success')
      setEditingPkg(null)
    } catch {
      addToast('Failed to save package', 'error')
    } finally {
      setSavingPkg(false)
    }
  }

  const handleDeletePkg = async (id: string) => {
    await deletePackage(id)
    addToast('Package deleted', 'info')
  }

  const handleSaveAddon = async () => {
    if (!editingAddon?.name || editingAddon?.price === undefined) return
    setSavingAddon(true)
    try {
      await saveAddon({
        id: editingAddon.id,
        name: editingAddon.name ?? '',
        price: Number(editingAddon.price),
        active: editingAddon.active ?? true,
      })
      addToast('Add-on saved', 'success')
      setEditingAddon(null)
    } catch {
      addToast('Failed to save add-on', 'error')
    } finally {
      setSavingAddon(false)
    }
  }

  const handleDeleteAddon = async (id: string) => {
    await deleteAddon(id)
    addToast('Add-on deleted', 'info')
  }

  return (
    <div className="px-4 md:px-8 pb-8">
      {/* Packages */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold">Packages</h3>
        <motion.button
          onClick={() => setEditingPkg({ active: true, features: [], order: packages.length })}
          whileTap={{ scale: 0.92 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gold"
          style={{ background: 'rgba(254,215,26,0.1)', border: '1px solid rgba(254,215,26,0.2)', cursor: 'pointer' }}
        >
          <Plus size={14} strokeWidth={2} />
          Add package
        </motion.button>
      </div>

      {packages.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center mb-6">
          <Sparkles size={28} color="#D1D1D1" strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="text-silver-grain text-sm">No packages yet. Add your first package.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {packages.map((pkg) => (
            <div key={pkg.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold truncate">{pkg.name}</p>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: pkg.active ? 'rgba(100,220,100,0.15)' : 'rgba(192,57,43,0.1)',
                        color: pkg.active ? '#6ce07c' : '#e05252',
                      }}
                    >
                      {pkg.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-silver-grain text-xs mb-1">{pkg.description}</p>
                  <p className="text-gold font-bold">{formatCurrency(pkg.price)} · {pkg.durationMins} min</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditingPkg(pkg)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer' }}
                  >
                    <Edit2 size={14} color="#D1D1D1" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => handleDeletePkg(pkg.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(192,57,43,0.1)', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} color="#e05252" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-ons */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold">Add-ons</h3>
        <motion.button
          onClick={() => setEditingAddon({ active: true })}
          whileTap={{ scale: 0.92 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gold"
          style={{ background: 'rgba(254,215,26,0.1)', border: '1px solid rgba(254,215,26,0.2)', cursor: 'pointer' }}
        >
          <Plus size={14} strokeWidth={2} />
          Add add-on
        </motion.button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {addons.map((a) => (
          <div
            key={a.id}
            className="glass rounded-xl px-3 py-2 flex items-center gap-2"
          >
            <span className="text-white text-sm">{a.name}</span>
            <span className="text-gold text-xs">+{formatCurrency(a.price)}</span>
            <button
              onClick={() => setEditingAddon(a)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <Edit2 size={12} color="#D1D1D1" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handleDeleteAddon(a.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <X size={12} color="#e05252" strokeWidth={1.5} />
            </button>
          </div>
        ))}
        {addons.length === 0 && (
          <p className="text-silver-grain text-sm">No add-ons yet.</p>
        )}
      </div>

      {/* Package editor sheet */}
      <AnimatePresence>
        {editingPkg !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-end justify-center"
            style={{ zIndex: 70, background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setEditingPkg(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-t-[32px] p-6 w-full max-w-lg pb-10 sheet-scroll max-h-[90dvh] overflow-y-auto"
            >
              <div className="w-12 h-1 rounded-full mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <h3 className="text-xl font-bold text-white mb-5">{editingPkg.id ? 'Edit package' : 'New package'}</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-silver-grain mb-1 block">Name *</label>
                  <input
                    className="glass-input"
                    value={editingPkg.name ?? ''}
                    onChange={(e) => setEditingPkg((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Express Wash"
                  />
                </div>
                <div>
                  <label className="text-xs text-silver-grain mb-1 block">Description</label>
                  <input
                    className="glass-input"
                    value={editingPkg.description ?? ''}
                    onChange={(e) => setEditingPkg((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Short description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-silver-grain mb-1 block">Price (₹) *</label>
                    <input
                      className="glass-input"
                      type="number"
                      value={editingPkg.price ?? ''}
                      onChange={(e) => setEditingPkg((p) => ({ ...p, price: Number(e.target.value) }))}
                      placeholder="199"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-silver-grain mb-1 block">Duration (min)</label>
                    <input
                      className="glass-input"
                      type="number"
                      value={editingPkg.durationMins ?? ''}
                      onChange={(e) => setEditingPkg((p) => ({ ...p, durationMins: Number(e.target.value) }))}
                      placeholder="30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-silver-grain mb-1 block">Features (comma-separated)</label>
                  <input
                    className="glass-input"
                    value={(editingPkg.features ?? []).join(', ')}
                    onChange={(e) => setEditingPkg((p) => ({
                      ...p,
                      features: e.target.value.split(',').map((f) => f.trim()).filter(Boolean)
                    }))}
                    placeholder="Exterior wash, Wheel clean, Glass wipe"
                  />
                </div>
                <div>
                  <label className="text-xs text-silver-grain mb-1 block">Order (lower = first)</label>
                  <input
                    className="glass-input"
                    type="number"
                    value={editingPkg.order ?? 0}
                    onChange={(e) => setEditingPkg((p) => ({ ...p, order: Number(e.target.value) }))}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingPkg((p) => ({ ...p, active: !p?.active }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {editingPkg.active ? (
                      <ToggleRight size={28} color="#FED71A" strokeWidth={1.5} />
                    ) : (
                      <ToggleLeft size={28} color="#D1D1D1" strokeWidth={1.5} />
                    )}
                  </button>
                  <span className="text-white text-sm">Active</span>
                </div>
              </div>
              <button
                onClick={handleSavePkg}
                disabled={savingPkg}
                className="btn-primary w-full mt-5"
              >
                {savingPkg ? (
                  <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                ) : 'Save package'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Addon editor sheet */}
      <AnimatePresence>
        {editingAddon !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-end justify-center"
            style={{ zIndex: 70, background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setEditingAddon(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-t-[32px] p-6 w-full max-w-lg pb-10"
            >
              <div className="w-12 h-1 rounded-full mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <h3 className="text-xl font-bold text-white mb-5">{editingAddon.id ? 'Edit add-on' : 'New add-on'}</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-silver-grain mb-1 block">Name *</label>
                  <input
                    className="glass-input"
                    value={editingAddon.name ?? ''}
                    onChange={(e) => setEditingAddon((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Interior vacuum"
                  />
                </div>
                <div>
                  <label className="text-xs text-silver-grain mb-1 block">Price (₹) *</label>
                  <input
                    className="glass-input"
                    type="number"
                    value={editingAddon.price ?? ''}
                    onChange={(e) => setEditingAddon((p) => ({ ...p, price: Number(e.target.value) }))}
                    placeholder="99"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingAddon((p) => ({ ...p, active: !p?.active }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {editingAddon.active ? (
                      <ToggleRight size={28} color="#FED71A" strokeWidth={1.5} />
                    ) : (
                      <ToggleLeft size={28} color="#D1D1D1" strokeWidth={1.5} />
                    )}
                  </button>
                  <span className="text-white text-sm">Active</span>
                </div>
              </div>
              <button
                onClick={handleSaveAddon}
                disabled={savingAddon}
                className="btn-primary w-full mt-5"
              >
                {savingAddon ? (
                  <div className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                ) : 'Save add-on'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type AppScreen =
  | 'loading'
  | 'auth'
  | 'location'
  | 'address-details'
  | 'customer'
  | 'washer'
  | 'admin'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>('customer')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null)
  const { toasts, addToast } = useToasts()

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setScreen('auth')
        setCurrentUser(null)
        setProfile(null)
        return
      }
      setCurrentUser(user)

      // Get role
      const userRole = await getUserRole(user.email ?? '')
      setRole(userRole)

      if (userRole === 'admin') {
        setScreen('admin')
        return
      }

      if (userRole === 'washer') {
        setScreen('washer')
        return
      }

      // Customer — check profile
      try {
        const userProfile = await getUserProfile(user.uid)
        if (userProfile?.address?.lat) {
          setProfile(userProfile)
          setScreen('customer')
        } else {
          setScreen('location')
        }
      } catch {
        setScreen('location')
      }
    })
    return unsub
  }, [])

  // Register service worker and send firebase config
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((reg) => {
        if (reg.active) {
          reg.active.postMessage({
            type: 'FIREBASE_CONFIG',
            config: {
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
              messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
              appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            },
          })
        }
      })
      .catch(() => {})
  }, [])

  // FCM foreground messages
  useEffect(() => {
    if (!currentUser) return
    let cleanup: (() => void) | null = null
    subscribeFCMMessages((payload) => {
      const p = payload as { notification?: { title?: string; body?: string } }
      addToast(p.notification?.body ?? 'New notification', 'info')
    }).then((unsub) => { cleanup = unsub })
    return () => { cleanup?.() }
  }, [currentUser, addToast])

  const handleSignOut = async () => {
    await signOut()
    setScreen('auth')
    setCurrentUser(null)
    setProfile(null)
  }

  const handleAuth = async (user: User) => {
    setCurrentUser(user)
    const userRole = await getUserRole(user.email ?? '')
    setRole(userRole)

    if (userRole === 'admin') { setScreen('admin'); return }
    if (userRole === 'washer') { setScreen('washer'); return }

    try {
      const userProfile = await getUserProfile(user.uid)
      if (userProfile?.address?.lat) {
        setProfile(userProfile)
        setScreen('customer')
      } else {
        setScreen('location')
      }
    } catch {
      setScreen('location')
    }
  }

  const handleLocation = (result: LocationResult) => {
    setLocationResult(result)
    setScreen('address-details')
  }

  const handleAddressSaved = (p: UserProfile) => {
    setProfile(p)
    setScreen('customer')
  }

  const handleChangeAddress = () => {
    setScreen('location')
  }

  return (
    <div className="relative" style={{ minHeight: '100dvh', background: '#000' }}>
      <Background />
      <ToastContainer toasts={toasts} />

      <AnimatePresence mode="wait">
        {screen === 'loading' && (
          <motion.div
            key="loading"
            className="fixed inset-0 flex items-center justify-center"
            exit={{ opacity: 0 }}
            style={{ zIndex: 1 }}
          >
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: '#FED71A', boxShadow: '0 0 40px rgba(254,215,26,0.4)' }}
              >
                <Droplets size={28} color="#000" strokeWidth={2} />
              </div>
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          </motion.div>
        )}

        {screen === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AuthScreen onAuth={handleAuth} />
          </motion.div>
        )}

        {screen === 'location' && (
          <motion.div key="location" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -32 }} transition={spring}>
            <LocationScreen onLocation={handleLocation} />
          </motion.div>
        )}

        {screen === 'address-details' && currentUser && locationResult && (
          <motion.div key="address" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -32 }} transition={spring}>
            <AddressDetailsScreen
              user={currentUser}
              initialAddress={locationResult}
              onSaved={handleAddressSaved}
            />
          </motion.div>
        )}

        {screen === 'customer' && currentUser && profile && (
          <motion.div key="customer" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring}>
            <CustomerDashboard
              user={currentUser}
              profile={profile}
              onSignOut={handleSignOut}
              onChangeAddress={handleChangeAddress}
              addToast={addToast}
            />
          </motion.div>
        )}

        {screen === 'washer' && currentUser && (
          <motion.div key="washer" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring}>
            <WasherDashboard
              user={currentUser}
              onSignOut={handleSignOut}
              addToast={addToast}
            />
          </motion.div>
        )}

        {screen === 'admin' && currentUser && (
          <motion.div key="admin" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring}>
            <AdminDashboard
              user={currentUser}
              onSignOut={handleSignOut}
              addToast={addToast}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
