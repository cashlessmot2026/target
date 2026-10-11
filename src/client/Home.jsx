import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { loadData, loadDraft, isLive, getWallet, removeFromWallet } from '../lib/data'
import { distance, fmtDist, offset } from '../lib/geo'
import { useGeo, useOrientation, requestOrientationPermission } from '../lib/sensors'
import { audio } from '../lib/sound'
const ARView = lazy(() => import('./ARView'))

const SIM = new URLSearchParams(location.search).has('sim')

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

  useEffect(() => {
    const draft = SIM ? loadDraft() : null
    if (draft) return setData(draft)
    loadData().then(setData).catch((e) => setLoadError(e.message))
  }, [])

  // Enlace directo: #/play/<id> (útil para QR o para probar desde el admin)
  useEffect(() => {
    const m = hash.match(/^#\/play\/(.+)$/)
    if (m) setActiveId(decodeURIComponent(m[1]))
  }, [hash])

  const companies = useMemo(() => Object.fromEntries((data?.companies || []).map((c) => [c.id, c])), [data])

  const list = useMemo(() => {
    const live = (data?.campaigns || []).filter((c) => isLive(c))
    return live
      .map((c) => ({ ...c, dist: geo.pos ? distance(geo.pos, c) : null }))
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))
  }, [data, geo.pos])

  // Objeto estable (no la copia con `dist`) para no reconstruir la escena 3D en cada lectura GPS
  const active = useMemo(() => data?.campaigns.find((c) => c.id === activeId && isLive(c)), [data, activeId])

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
    if (location.hash.startsWith('#/play/')) history.replaceState(null, '', location.pathname + location.search)
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

  return (
    <div className="home">
      <header className="home-head">
        <button className="logo" onClick={onLogoTap} aria-label="GeoAds">
          <img src="./icon.svg" alt="" />
          <span>GeoAds<b>AR</b></span>
        </button>
        {SIM && <span className="pill warn">Simulador</span>}
      </header>

      {!started ? (
        <section className="hero">
          <div className="hero-orb" />
          <h1>Promociones ocultas a tu alrededor</h1>
          <p className="muted">
            Camina, apunta tu cámara y sigue la flecha. Cuando llegues al punto exacto se revelará un premio en 3D.
          </p>
          <button className="btn primary big" onClick={start} disabled={!data && !loadError}>
            {data || loadError ? 'Comenzar exploración' : 'Cargando…'}
          </button>
          <p className="tiny muted">Necesitamos tu ubicación, cámara y brújula. No guardamos ningún dato personal.</p>
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
