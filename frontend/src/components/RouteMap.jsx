import { useEffect, useMemo } from 'react'
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// React-Leaflet doesn't ship default icon URLs that work with Vite — fix manually.
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

function makeIcon(color, glyph) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};border:2px solid white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">${glyph}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

const ICONS = {
  Start: makeIcon('#0f766e', 'A'),
  Pickup: makeIcon('#2563eb', 'P'),
  Fuel: makeIcon('#f59e0b', 'F'),
  Dropoff: makeIcon('#dc2626', 'B'),
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (!positions || positions.length === 0) return
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [positions, map])
  return null
}

export default function RouteMap({ result }) {
  const { route, geocoded, plan } = result

  const polyline = useMemo(() => {
    return [...route.leg1.geometry, ...route.leg2.geometry]
  }, [route])

  const startMarker = {
    label: 'Start',
    position: [geocoded.current.latitude, geocoded.current.longitude],
    name: geocoded.current.display_name,
    note: 'Trip start',
  }

  const stopMarkers = (plan.stops || []).map((s) => ({
    label: s.label,
    position: s.location,
    name: s.location_name,
    note: s.note,
    arrival: s.arrival,
  }))

  const allPositions = [
    startMarker.position,
    ...stopMarkers.map((m) => m.position),
  ]

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-ink-100">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Route Map</h2>
          <p className="text-xs text-ink-500">
            {route.total_distance_miles.toLocaleString()} mi · OSRM driving estimate{' '}
            {route.osrm_duration_hours.toFixed(1)} hrs
          </p>
        </div>
        <Legend />
      </div>
      <div className="h-[460px] w-full">
        <MapContainer
          center={startMarker.position}
          zoom={5}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline
            positions={polyline}
            pathOptions={{ color: '#0f766e', weight: 4, opacity: 0.85 }}
          />
          <Marker position={startMarker.position} icon={ICONS.Start}>
            <Popup>
              <strong>Start</strong>
              <br />
              {startMarker.name}
            </Popup>
          </Marker>
          {stopMarkers.map((m, i) => (
            <Marker
              key={i}
              position={m.position}
              icon={ICONS[m.label] || ICONS.Pickup}
            >
              <Popup>
                <strong>{m.label}</strong>
                <br />
                {m.name}
                <br />
                <span style={{ color: '#6f7889' }}>{m.note}</span>
                {m.arrival && (
                  <>
                    <br />
                    <em style={{ color: '#6f7889' }}>
                      ETA: {new Date(m.arrival).toLocaleString()}
                    </em>
                  </>
                )}
              </Popup>
            </Marker>
          ))}
          <FitBounds positions={allPositions} />
        </MapContainer>
      </div>
    </div>
  )
}

function Legend() {
  const items = [
    { color: '#0f766e', label: 'Start' },
    { color: '#2563eb', label: 'Pickup' },
    { color: '#f59e0b', label: 'Fuel' },
    { color: '#dc2626', label: 'Dropoff' },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-xs text-ink-700">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: it.color }}
          />
          {it.label}
        </div>
      ))}
    </div>
  )
}
