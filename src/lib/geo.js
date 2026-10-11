const R = 6371000
const toRad = (d) => (d * Math.PI) / 180
const toDeg = (r) => (r * 180) / Math.PI

/** Distancia en metros entre dos puntos {lat,lng} (haversine). */
export function distance(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Rumbo inicial en grados (0 = norte, 90 = este) de a hacia b. */
export function bearing(a, b) {
  const p1 = toRad(a.lat)
  const p2 = toRad(b.lat)
  const dl = toRad(b.lng - a.lng)
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Punto a `meters` de p en dirección `brg` grados. */
export function offset(p, meters, brg) {
  const d = meters / R
  const t = toRad(brg)
  const p1 = toRad(p.lat)
  const l1 = toRad(p.lng)
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t))
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2))
  return { lat: toDeg(p2), lng: toDeg(l2) }
}

/** Diferencia angular con signo en [-180, 180). Positivo = a la derecha. */
export const angleDiff = (target, current) => ((target - current + 540) % 360) - 180

export const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
export const cardinal = (deg) => DIRS[Math.round(deg / 45) % 8]
