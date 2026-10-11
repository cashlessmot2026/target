import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/** Mapa para elegir coordenadas: toca el mapa para mover el punto; el círculo muestra el rango de captura. */
export default function MapPicker({ lat, lng, radius, color, onChange }) {
  const el = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const circle = useRef(null)
  const cb = useRef(onChange)
  cb.current = onChange
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const valid = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    const start = valid ? [lat, lng] : [19.4326, -99.1332]
    const m = L.map(el.current).setView(start, 18)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 21,
      maxNativeZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m)
    circle.current = L.circle(start, { radius, color, weight: 2, fillOpacity: 0.15 }).addTo(m)
    marker.current = L.circleMarker(start, { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(m)
    m.on('click', (e) => cb.current({ lat: +e.latlng.lat.toFixed(7), lng: +e.latlng.lng.toFixed(7) }))
    map.current = m
    return () => m.remove()
  }, [])

  useEffect(() => {
    if (!valid || !map.current) return
    const ll = [lat, lng]
    circle.current.setLatLng(ll).setRadius(Number(radius) || 20).setStyle({ color })
    marker.current.setLatLng(ll).setStyle({ fillColor: color })
    if (!map.current.getBounds().contains(ll)) map.current.setView(ll)
  }, [lat, lng, radius, color, valid])

  async function search(e) {
    e.preventDefault()
    if (!q.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)
      const [hit] = await res.json()
      if (hit) {
        const p = { lat: +(+hit.lat).toFixed(7), lng: +(+hit.lon).toFixed(7) }
        cb.current(p)
        map.current.setView([p.lat, p.lng], 18)
      }
    } catch {}
    setSearching(false)
  }

  function locateMe() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const pt = { lat: +p.coords.latitude.toFixed(7), lng: +p.coords.longitude.toFixed(7) }
        cb.current(pt)
        map.current.setView([pt.lat, pt.lng], 19)
      },
      () => alert('No se pudo obtener tu ubicación'),
      { enableHighAccuracy: true }
    )
  }

  return (
    <div className="map-picker">
      <form className="row" onSubmit={search}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar dirección o lugar…" />
        <button className="btn small" disabled={searching}>{searching ? '…' : 'Buscar'}</button>
        <button type="button" className="btn small" onClick={locateMe} title="Usar mi ubicación actual">📍 Aquí</button>
      </form>
      <div ref={el} className="map" />
      <small className="muted">Toca el mapa para colocar la publicidad. El círculo es el rango de captura.</small>
    </div>
  )
}
