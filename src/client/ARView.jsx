import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { angleDiff, bearing, cardinal, distance, fmtDist, offset } from '../lib/geo'
import { blip, capture, fanfare, playUrl } from '../lib/sound'
import Landing3D from './Landing3D'
import { track } from '../lib/track'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const deg = THREE.MathUtils.degToRad

export default function ARView({ campaign, company, geo, orient, sim, onExit, onSaved }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const coinTapRef = useRef(null)
  const state = useRef({ brg: 0, dist: Infinity, arrived: false, arrivedAt: 0 })
  const [camError, setCamError] = useState(null)
  const [arrived, setArrived] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [, setTick] = useState(0)
  const color = company?.color || '#00e5ff'
  const radius = Number(campaign.radius) || 20

  // HUD a 5 fps (la brújula vive en un ref para no re-renderizar en cada evento)
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 200)
    return () => clearInterval(i)
  }, [])

  // Cámara trasera
  useEffect(() => {
    let stream
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        videoRef.current.srcObject = s
        videoRef.current.play().catch(() => {})
      })
      .catch(() => setCamError('No se pudo abrir la cámara. Revisa los permisos.'))
    if (!navigator.mediaDevices) setCamError('Cámara no disponible (se requiere HTTPS).')
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Distancia / rumbo / llegada
  const pos = geo.pos
  const dist = pos ? distance(pos, campaign) : null
  const brg = pos ? bearing(pos, campaign) : 0
  state.current.dist = dist ?? Infinity
  state.current.brg = brg

  useEffect(() => {
    if (dist == null || state.current.arrived || dist > radius) return
    state.current.arrived = true
    state.current.arrivedAt = performance.now()
    setArrived(true)
    track(campaign.id, 'arrive', Math.round(dist))
    if (soundOn) {
      fanfare()
      playUrl(campaign.soundUrl)
    }
    navigator.vibrate?.([120, 60, 120, 60, 300])
  }, [dist, radius, campaign.id, campaign.soundUrl, soundOn])

  // Radar sonoro: más rápido y agudo mientras más cerca
  useEffect(() => {
    if (!soundOn || arrived) return
    let timer
    const loop = () => {
      const d = state.current.dist
      if (Number.isFinite(d) && d < 300) blip(clamp(1400 - d * 3, 500, 1400))
      timer = setTimeout(loop, Number.isFinite(d) ? clamp(d * 12, 160, 2200) : 2000)
    }
    loop()
    return () => clearTimeout(timer)
  }, [soundOn, arrived])

  // Escena 3D superpuesta
  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 300)
    cam.rotation.order = 'YXZ'
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.4))
    const sun = new THREE.DirectionalLight(0xffffff, 2)
    sun.position.set(3, 6, 4)
    scene.add(sun)
    const col = new THREE.Color(color)

    // Flecha guía en el piso (estilo Pokémon GO)
    const shape = new THREE.Shape()
    shape.moveTo(0, 1)
    shape.lineTo(0.75, 0)
    shape.lineTo(0.28, 0)
    shape.lineTo(0.28, -0.9)
    shape.lineTo(-0.28, -0.9)
    shape.lineTo(-0.28, 0)
    shape.lineTo(-0.75, 0)
    shape.closePath()
    const arrowGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 })
    arrowGeo.rotateX(-Math.PI / 2)
    arrowGeo.center()
    const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.3 }))
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.3, 64),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    )
    ring.rotation.x = -Math.PI / 2
    const guide = new THREE.Group()
    guide.add(ring, arrow)
    scene.add(guide)

    // Faro en la dirección del objetivo
    const beacon = new THREE.Group()
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 40, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    )
    beam.position.y = 18
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.7, flatShading: true, metalness: 0.5, roughness: 0.2 }))
    beacon.add(beam, gem)
    scene.add(beacon)

    // Moneda/premio 3D que aparece al llegar
    const coin = makeCoin(col, campaign.type === 'video' ? '▶' : campaign.discount || '%', company?.name || '')
    coin.visible = false
    scene.add(coin)
    const sparkles = makeSparkles(col)
    coin.add(sparkles)

    const raycaster = new THREE.Raycaster()
    coinTapRef.current = (x, y) => {
      if (!coin.visible) return false
      const r = canvas.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), cam)
      return raycaster.intersectObject(coin, true).length > 0
    }

    const resize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      renderer.setSize(w, h, false)
      cam.aspect = w / h
      cam.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    const fwd = new THREE.Vector3()
    let raf
    const loop = (t) => {
      raf = requestAnimationFrame(loop)
      const o = orient.current
      const s = state.current
      const h = deg(o.heading)
      cam.rotation.y = -h
      cam.rotation.x = deg(clamp(o.beta - 90, -85, 85))
      cam.rotation.z = deg(clamp(-o.gamma, -30, 30)) * 0.3

      const b = deg(s.brg)
      // Flecha: siempre frente al usuario, en el suelo, apuntando al objetivo
      guide.position.set(Math.sin(h) * 3.4, -1.6 + Math.sin(t / 280) * 0.06, -Math.cos(h) * 3.4)
      arrow.rotation.y = -b
      ring.scale.setScalar(1 + ((t / 1200) % 1) * 0.25)
      ring.material.opacity = 0.55 * (1 - ((t / 1200) % 1))
      guide.visible = !s.arrived

      // Faro: más grande cuanto más cerca
      const near = Number.isFinite(s.dist) ? clamp(1 - s.dist / 200, 0, 1) : 0
      const bd = 16 - near * 6
      beacon.position.set(Math.sin(b) * bd, -1.6, -Math.cos(b) * bd)
      beacon.scale.setScalar(0.7 + near * 0.8)
      gem.rotation.y += 0.025
      gem.position.y = 2.2 + Math.sin(t / 450) * 0.35
      beacon.visible = !s.arrived && Number.isFinite(s.dist)

      // Premio: aparece frente a la cámara con animación
      if (s.arrived) {
        coin.visible = true
        cam.getWorldDirection(fwd)
        fwd.y = 0
        fwd.normalize()
        const target = new THREE.Vector3(fwd.x * 3.2, 0.1 + Math.sin(t / 500) * 0.12, fwd.z * 3.2)
        if (coin.userData.placed) coin.position.lerp(target, 0.08)
        else {
          coin.position.copy(target)
          coin.userData.placed = true
        }
        const k = clamp((t - s.arrivedAt) / 700, 0, 1)
        coin.scale.setScalar(easeOutBack(k))
        coin.rotation.y += 0.035
        sparkles.rotation.y -= 0.01
        sparkles.rotation.x += 0.004
      }
      renderer.render(scene, cam)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      scene.traverse((obj) => {
        obj.geometry?.dispose()
        const m = obj.material
        ;(Array.isArray(m) ? m : m ? [m] : []).forEach((mm) => {
          mm.map?.dispose()
          mm.dispose()
        })
      })
      renderer.dispose()
    }
  }, [campaign, company, color, orient])

  function onScreenTap(e) {
    if (!arrived || captured) return
    // Toca la moneda (o en cualquier parte tras 1.5 s) para capturar
    const hit = coinTapRef.current?.(e.clientX, e.clientY)
    if (hit || performance.now() - state.current.arrivedAt > 1500) {
      if (soundOn) capture()
      navigator.vibrate?.(60)
      track(campaign.id, 'capture')
      setCaptured(true)
    }
  }

  // Indicaciones
  const o = orient.current
  const rel = angleDiff(brg, o.heading)
  let hint = 'Sigue la flecha'
  if (!pos) hint = sim ? 'Iniciando simulador…' : 'Buscando señal GPS…'
  else if (arrived) hint = '¡Llegaste! Toca el premio para capturarlo'
  else if (!o.available && !sim) hint = `Camina hacia el ${cardinal(brg)} (brújula no disponible)`
  else if (Math.abs(rel) < 20) hint = '¡Vas bien, sigue derecho!'
  else if (Math.abs(rel) > 150) hint = 'Date la vuelta'
  else hint = rel > 0 ? 'Gira a la derecha →' : '← Gira a la izquierda'

  const warmth = dist == null ? 0 : clamp(1 - (dist - radius) / 150, 0, 1)

  function simMove(dir) {
    if (!pos) return
    if (dir === 'L' || dir === 'R') {
      o.heading = (o.heading + (dir === 'R' ? 20 : -20) + 360) % 360
      return
    }
    geo.setSim(offset(pos, 4, (o.heading + (dir === 'F' ? 0 : 180)) % 360))
  }

  return (
    <div className="ar" onClick={onScreenTap}>
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay />
      {camError && <div className="ar-nocam">{camError}</div>}
      <canvas ref={canvasRef} className="ar-canvas" />

      <div className="ar-top" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" onClick={onExit} aria-label="Salir">✕</button>
        <div className="ar-title" style={{ '--c': color }}>
          <small>{company?.name}</small>
          <strong>{campaign.title}</strong>
        </div>
        <button className="icon-btn" onClick={() => setSoundOn((s) => !s)} aria-label="Sonido">{soundOn ? '🔊' : '🔇'}</button>
      </div>

      {!captured && (
        <div className="ar-hud">
          <div className={`ar-hint ${arrived ? 'win' : ''}`}>{hint}</div>
          {!arrived && (
            <div className="ar-meter">
              <Radar rel={o.available || sim ? rel : brg} dist={dist} radius={radius} color={color} />
              <div className="ar-dist">
                <span className="big">{dist != null ? fmtDist(Math.max(0, dist - radius)) : '—'}</span>
                <small className="muted">para el área de captura · ±{Math.round(geo.accuracy || 0)} m GPS</small>
                <div className="heat"><i style={{ width: `${warmth * 100}%`, background: color }} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {sim && !captured && (
        <div className="sim-pad" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => simMove('L')}>⟲</button>
          <button onClick={() => simMove('F')}>▲</button>
          <button onClick={() => simMove('B')}>▼</button>
          <button onClick={() => simMove('R')}>⟳</button>
        </div>
      )}

      {captured && (
        <Landing3D
          campaign={campaign}
          company={company}
          orient={orient}
          onClose={onExit}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

function Radar({ rel, dist, radius, color }) {
  const r = 46
  const scaled = dist == null ? r : clamp(Math.log10(1 + Math.max(dist, 0)) / Math.log10(1 + 500), 0, 1) * r
  const a = deg(rel)
  const x = 50 + Math.sin(a) * scaled
  const y = 50 - Math.cos(a) * scaled
  const zone = clamp(Math.log10(1 + radius) / Math.log10(501), 0, 1) * r
  return (
    <svg className="radar" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} className="radar-bg" />
      <circle cx="50" cy="50" r={r * 0.66} className="radar-ring" />
      <circle cx="50" cy="50" r={r * 0.33} className="radar-ring" />
      <path d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z" className="radar-sweep" />
      <circle cx={x} cy={y} r={Math.max(zone * 0.6, 3)} fill={color} opacity="0.25" />
      <circle cx={x} cy={y} r="4" fill={color} className="radar-dot" />
      <path d="M50 44 L54.5 55 L50 52.5 L45.5 55 Z" fill="#fff" />
    </svg>
  )
}

function easeOutBack(x) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function makeCoin(col, label, sub) {
  const size = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const g = cv.getContext('2d')
  const grad = g.createRadialGradient(size * 0.35, size * 0.3, 20, size / 2, size / 2, size / 2)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.25, `#${col.getHexString()}`)
  grad.addColorStop(1, `#${col.clone().multiplyScalar(0.45).getHexString()}`)
  g.fillStyle = grad
  g.beginPath()
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 18
  g.strokeStyle = 'rgba(255,255,255,.75)'
  g.beginPath()
  g.arc(size / 2, size / 2, size / 2 - 40, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = 'rgba(0,0,0,.45)'
  g.shadowBlur = 16
  const text = String(label).slice(0, 10)
  g.font = `900 ${text.length > 5 ? 82 : 130}px system-ui, Arial`
  g.fillText(text, size / 2, size / 2 - 10)
  g.font = '700 40px system-ui, Arial'
  g.fillText(String(sub).slice(0, 18).toUpperCase(), size / 2, size / 2 + 110)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  // Las tapas del cilindro quedan giradas 90° tras rotateX; compensamos para que el texto se lea derecho
  tex.center.set(0.5, 0.5)
  tex.rotation = Math.PI / 2

  const geom = new THREE.CylinderGeometry(1, 1, 0.16, 64)
  geom.rotateX(Math.PI / 2)
  const edge = new THREE.MeshStandardMaterial({ color: col, metalness: 0.85, roughness: 0.25, emissive: col, emissiveIntensity: 0.2 })
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.35, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 })
  const mesh = new THREE.Mesh(geom, [edge, face, face])
  const group = new THREE.Group()
  group.add(mesh)
  return group
}

function makeSparkles(col) {
  const n = 160
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = 1.4 + Math.random() * 1.2
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(2 * Math.random() - 1)
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
    pos[i * 3 + 1] = r * Math.cos(ph)
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(
    geom,
    new THREE.PointsMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.5), size: 0.045, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  )
}
