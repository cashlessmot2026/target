import { useCallback, useEffect, useRef, useState } from 'react'
import { angleDiff } from './geo'

/** Pide permiso de brújula/giroscopio (iOS 13+). Debe llamarse dentro de un toque. */
export async function requestOrientationPermission() {
  const DOE = window.DeviceOrientationEvent
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      return (await DOE.requestPermission()) === 'granted'
    } catch {
      return false
    }
  }
  return true
}

/** GPS en vivo. En modo simulador la posición se fija con setSim(). */
export function useGeo(enabled, sim) {
  const [state, setState] = useState({ pos: null, accuracy: null, error: null })

  useEffect(() => {
    if (!enabled || sim) return
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Este dispositivo no tiene GPS disponible.' }))
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setState({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy, error: null }),
      (e) => setState((s) => ({ ...s, error: e.code === 1 ? 'Permiso de ubicación denegado.' : e.message })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, sim])

  const setSim = useCallback((pos) => setState({ pos, accuracy: 3, error: null }), [])
  return { ...state, setSim }
}

/**
 * Orientación del dispositivo en un ref (sin re-renders, para el loop 3D).
 * heading: 0 = norte, en grados, hacia donde apunta la cámara trasera.
 * beta: 90 = teléfono vertical mirando al horizonte.
 */
export function useOrientation(enabled) {
  const ref = useRef({ heading: 0, beta: 90, gamma: 0, available: false })

  useEffect(() => {
    if (!enabled) return
    const r = ref.current
    const onEvent = (e) => {
      let h = null
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading
      else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null) h = 360 - e.alpha
      if (h != null) {
        const so = screen.orientation?.angle ?? window.orientation ?? 0
        h = (h + so + 360) % 360
        r.heading = r.available ? (r.heading + angleDiff(h, r.heading) * 0.2 + 360) % 360 : h
        r.available = true
      }
      if (e.beta != null) {
        r.beta += (e.beta - r.beta) * 0.25
        r.gamma += ((e.gamma ?? 0) - r.gamma) * 0.25
      }
    }
    const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(type, onEvent, true)
    return () => window.removeEventListener(type, onEvent, true)
  }, [enabled])

  return ref
}
