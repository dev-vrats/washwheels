'use client'

/**
 * app/LeafletMapClient.tsx
 * Client-only Leaflet map component — imported dynamically (ssr: false) from page.tsx
 * Uses CARTO Dark Matter tiles (no API key, attribution required)
 */

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import L from 'leaflet'

// Custom gold pin icon
const goldIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#FED71A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid rgba(0,0,0,0.3);box-shadow:0 0 12px rgba(254,215,26,0.6)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

const washerIcon = L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;background:#ffffff;border-radius:50%;border:2px solid #FED71A;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(255,255,255,0.4);font-size:12px;">🚗</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// Animate map center changes
function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  const prevCenter = useRef<[number, number] | null>(null)
  useEffect(() => {
    if (
      !prevCenter.current ||
      Math.abs(prevCenter.current[0] - center[0]) > 0.0001 ||
      Math.abs(prevCenter.current[1] - center[1]) > 0.0001
    ) {
      map.flyTo(center, map.getZoom(), { duration: 0.8 })
      prevCenter.current = center
    }
  }, [center, map])
  return null
}

interface LeafletMapProps {
  center: [number, number]
  pin?: [number, number]           // draggable pin for location screen
  onPinDrop?: (lat: number, lng: number) => void
  customerPin?: [number, number]   // customer location (tracking)
  washerPin?: [number, number]     // washer location (tracking, moving)
  height?: number
}

export default function LeafletMapClient({
  center,
  pin,
  onPinDrop,
  customerPin,
  washerPin,
  height = 300,
}: LeafletMapProps) {
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!markerRef.current || !onPinDrop) return
    const marker = markerRef.current
    const handleDragEnd = () => {
      const pos = marker.getLatLng()
      onPinDrop(pos.lat, pos.lng)
    }
    marker.on('dragend', handleDragEnd)
    return () => { marker.off('dragend', handleDragEnd) }
  }, [onPinDrop])

  const routePoints: LatLngExpression[] | null =
    washerPin && customerPin ? [washerPin, customerPin] : null

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height, width: '100%', background: '#0a0a0a' }}
      zoomControl={false}
      attributionControl={true}
    >
      <MapController center={center} />

      {/* CARTO Dark Matter — no API key needed, attribution required */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />

      {/* Draggable pin for location screen */}
      {pin && (
        <Marker
          position={pin}
          icon={goldIcon}
          draggable={!!onPinDrop}
          ref={(r) => { markerRef.current = r }}
        >
          <Popup>Your location</Popup>
        </Marker>
      )}

      {/* Customer pin (tracking) */}
      {customerPin && (
        <Marker position={customerPin} icon={goldIcon}>
          <Popup>Your location</Popup>
        </Marker>
      )}

      {/* Washer marker (moving) */}
      {washerPin && (
        <Marker position={washerPin} icon={washerIcon}>
          <Popup>Washer</Popup>
        </Marker>
      )}

      {/* Route line */}
      {routePoints && (
        <Polyline
          positions={routePoints}
          color="#FED71A"
          weight={3}
          opacity={0.7}
          dashArray="8 6"
        />
      )}
    </MapContainer>
  )
}
