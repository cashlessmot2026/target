import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { loadData, isLive, getWallet, removeFromWallet } from '../lib/data'
import { SIM, track, trackImpression } from '../lib/track'
import { distance, fmtDist, offset } from '../lib/geo'
import { useGeo, useOrientation, requestOrientationPermission } from '../lib/sensors'
import { audio } from '../lib/sound'
const ARView = lazy(() => import('./ARView'))

// iOS exige un toque para dar permiso de brújula; Android/Chrome puede arrancar directo
const NEEDS_TAP = typeof window.DeviceOrientationEvent?.requestPermission === 'function'

/** Rutas del cliente:  #/e/<empresa>  → juego de una empresa  ·  #/play/<campaña> → una promo concreta */
function parseRoute(hash) {
  const m = hash.match(/^#\/(e|play)\/([^/?]+)/)
  return m ? { kind: m[1], key: decodeURIComponent(m[2]) } : null
}

export default function Home({ hash }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [started, setStarted] = useState(false)
  const [tab, setTab] = useState('explore')
  const [wallet, setWallet] = useState(getWallet)
  const [activeId, setActiveId] = useState(null)
  const geo = useGeo(started, SIM)
  const orient = useOrientation(started)
  const taps = useRef([])
  const autoPicked = useRef(false)
  const route = useMemo(() => parseRoute(hash), [hash])

  useEffect(() => {
    loadData().then(setData).catch((e) => setLoadError(e.message))
  }, [])

  // El audio solo se desbloquea con un toque: lo hacemos en el primero que ocurra
  useEffect(() => {
    const unlock = () => audio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const companies = useMemo(() => Object.fromEntries((data?.companies || []).map((c) => [c.id, c])), [data])

  // Empresa del link (#/e/<slug o id>)
  const brand = useMemo(() => {
    if (route?.kind !== 'e' || !data) return null
    const k = route.key.toLowerCase()
    return data.companies.find((c) => c.slug === k || c.id === route.key) || false
  }, [route, data])

  const list = useMemo(() => {
    const live = (data?.campaigns || []).filter((c) => (SIM || isLive(c)) && (!brand || c.companyId === brand.id))
    return live
      .map((c) => ({ ...c, dist: geo.pos ? distance(geo.pos, c) : null }))
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))
  }, [data, geo.pos, brand])

  // Objeto estable (no la copia con `dist`) para no reconstruir la escena 3D en cada lectura GPS
  const active = useMemo(() => data?.campaigns.find((c) => c.id === activeId && (SIM || isLive(c))), [data, activeId])

  // Link de campaña: #/play/<id>
  useEffect(() => {
    if (route?.kind === 'play') setActiveId(route.key)
  }, [route])

  // Links directos: arrancar solos (en iOS espera el toque de "Jugar")
  useEffect(() => {
    if (route && data && !started && !NEEDS_TAP) start()
  }, [route, data])

  // Link de empresa: en cuanto haya GPS, ir directo a su promo más cercana (solo la primera vez)
  useEffect(() => {
    if (!brand || !started || activeId || autoPicked.current || !list.length) return
    if (!geo.pos && !SIM) return
    autoPicked.current = true
    setActiveId(list[0].id)
  }, [brand, started, activeId, list, geo.pos])

  // Analítica: impresión cuando la campaña aparece en la lista; apertura al entrar en AR
  useEffect(() => {
    if (started && geo.pos) list.forEach((c) => trackImpression(c.id))
  }, [started, list.length, !!geo.pos])
  useEffect(() => {
    if (started && active) track(active.id, 'open', geo.pos ? Math.round(distance(geo.pos, active)) : null)
  }, [started, active?.id])

  // Simulador: aparecer a 60 m al sur del objetivo
  useEffect(() => {
    if (SIM && started && active && !geo.pos) geo.setSim(offset(active, 60, 200))
  }, [started, active, geo])

  async function start() {
    audio()
    await requestOrientationPermission()
    setStarted(true)
  }

  function onLogoTap() {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 3000), now]
    if (taps.current.length >= 7) {
      taps.current = []
      location.hash = '#/admin'
    }
  }

  function closeAR() {
    setActiveId(null)
    if (route?.kind === 'play') history.replaceState(null, '', location.pathname + location.search)
  }

  if (started && active) {
    return (
      <Suspense fallback={<div className="ar center muted">Abriendo cámara…</div>}>
        <ARView
          campaign={active}
          company={companies[active.companyId]}
          geo={geo}
          orient={orient}
          sim={SIM}
          onExit={closeAR}
          onSaved={() => setWallet(getWallet())}
        />
      </Suspense>
    )
  }

  const color = brand?.color
  const waitingAuto = brand && started && !autoPicked.current && list.length > 0

  return (
    <div className="home" style={color ? { '--accent': color } : undefined}>
      <header className="home-head">
        {brand ? (
          <div className="brand-head">
            <div className="ci-logo" style={{ '--c': color }}>{brand.logo ? <img src={brand.logo} alt="" /> : brand.name[0]}</div>
            <strong>{brand.name}</strong>
          </div>
        ) : (
          <button className="logo" onClick={onLogoTap} aria-label="GeoAds">
            <img src="./icon.svg" alt="" />
            <span>GeoAds<b>AR</b></span>
          </button>
        )}
        {SIM && <span className="pill warn">Simulador</span>}
      </header>

      {brand === false && <p className="error center-text">Este link no corresponde a ninguna empresa activa.</p>}

      {!started ? (
        <section className="hero">
          {brand?.logo ? <img className="hero-logo" src={brand.logo} alt="" /> : <div className="hero-orb" />}
          <h1>{brand ? `¡Encuentra el premio de ${brand.name}!` : 'Promociones ocultas a tu alrededor'}</h1>
          <p className="muted">
            Camina, apunta tu cámara y sigue la flecha. Cuando llegues al punto exacto se revelará un premio en 3D.
          </p>
          <button className="btn primary big" onClick={start} disabled={!data && !loadError}>
            {!data && !loadError ? 'Cargando…' : route ? '▶ Jugar' : 'Comenzar exploración'}
          </button>
          <p className="tiny muted">Necesitamos tu ubicación, cámara y brújula. No guardamos ningún dato personal.</p>
        </section>
      ) : waitingAuto ? (
        <section className="hero">
          <div className="hero-orb" />
          <h1>Buscando tu ubicación…</h1>
          <p className="muted">{geo.error || 'Sal a un lugar abierto para mejorar la señal GPS.'}</p>
        </section>
      ) : (
        <>
          <nav className="tabs">
            <button className={tab === 'explore' ? 'on' : ''} onClick={() => setTab('explore')}>Explorar</button>
            <button className={tab === 'wallet' ? 'on' : ''} onClick={() => setTab('wallet')}>
              Mis premios {wallet.length > 0 && <span className="badge">{wallet.length}</span>}
            </button>
          </nav>

          {tab === 'explore' && (
            <section className="list">
              {loadError && <p className="error">{loadError}</p>}
              {geo.error && <p className="error">{geo.error}</p>}
              {!geo.pos && !geo.error && !SIM && <p className="muted center-text">Buscando tu ubicación…</p>}
              {list.length === 0 && data && <p className="muted center-text">No hay promociones activas por ahora.</p>}
              {list.map((c) => {
                const co = companies[c.companyId]
                return (
                  <button key={c.id} className="card-item" style={{ '--c': co?.color || '#00e5ff' }} onClick={() => setActiveId(c.id)}>
                    <div className="ci-logo">{co?.logo ? <img src={co.logo} alt="" /> : (co?.name || '?')[0]}</div>
                    <div className="ci-body">
                      <strong>{c.title}</strong>
                      <span className="muted">{co?.name}{c.type === 'video' ? ' · Video' : c.discount ? ` · ${c.discount}` : ''}</span>
                    </div>
                    <div className="ci-dist">{c.dist != null ? fmtDist(c.dist) : '—'}</div>
                  </button>
                )
              })}
            </section>
          )}

          {tab === 'wallet' && (
            <section className="list">
              {wallet.length === 0 && <p className="muted center-text">Aún no capturas premios. ¡Sal a explorar!</p>}
              {wallet.map((w) => (
                <div key={w.campaignId} className="wallet-item" style={{ '--c': w.color || '#00e5ff' }}>
                  <div>
                    <small className="muted">{w.companyName}</small>
                    <strong>{w.title}</strong>
                    {w.discount && <span>{w.discount}</span>}
                    {w.folio && w.folio !== w.code && <small className="muted">Folio {w.folio}</small>}
                  </div>
                  <code>{w.code}</code>
                  <button className="link" onClick={() => setWallet(removeFromWallet(w.campaignId))}>Quitar</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
