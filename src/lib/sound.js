let ctx

/** Devuelve (y desbloquea) el AudioContext. La primera llamada debe ocurrir dentro de un toque. */
export function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, start, dur, vol = 0.2, type = 'sine') {
  const a = audio()
  if (!a) return
  const t = a.currentTime + start
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Pitido de radar. */
export const blip = (freq = 880) => tone(freq, 0, 0.09, 0.12, 'triangle')

/** Fanfarria de llegada. */
export function fanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => tone(f, i * 0.11, 0.35, 0.22, 'triangle'))
  tone(1567.98, 0.5, 0.8, 0.15, 'sine')
  tone(2093, 0.55, 0.9, 0.08, 'sine')
}

/** Sonido de captura. */
export function capture() {
  const notes = [1200, 1600, 2000]
  notes.forEach((f, i) => tone(f, i * 0.05, 0.15, 0.15, 'square'))
}

export function playUrl(url) {
  if (!url) return
  new Audio(url).play().catch(() => {})
}
