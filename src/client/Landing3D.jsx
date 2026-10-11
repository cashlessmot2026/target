import { useEffect, useRef, useState } from 'react'
import { saveToWallet } from '../lib/data'
import { claim, track } from '../lib/track'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function youtubeId(url = '') {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)
  return m ? m[1] : null
}

/** Landing flotante en 3D sobre la cámara; se inclina con el movimiento del teléfono. */
export default function Landing3D({ campaign, company, orient, onClose, onSaved }) {
  const cardRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [prize, setPrize] = useState(null) // { promo, folio, status, repeat }
  const [prizeError, setPrizeError] = useState(null)
  const color = company?.color || '#00e5ff'
  const yt = youtubeId(campaign.videoUrl)
  const isCoupon = campaign.type !== 'video'

  // Inclinación 3D según el giroscopio
  useEffect(() => {
    let raf
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const o = orient.current
      const ry = clamp(o.gamma * 0.5, -18, 18)
      const rx = clamp((o.beta - 75) * -0.35, -14, 14)
      if (cardRef.current) cardRef.current.style.setProperty('--tilt', `rotateX(${rx}deg) rotateY(${ry}deg)`)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [orient])

  // Cupón: se reclama en la base de datos (código único, cupo máximo, folio de canje)
  useEffect(() => {
    if (!isCoupon) {
      track(campaign.id, 'video')
      return
    }
    let alive = true
    claim(campaign)
      .then((p) => {
        if (!alive) return
        setPrize(p)
        // Se guarda solo en la billetera para que no se pierda
        saveToWallet({
          campaignId: campaign.id,
          title: campaign.title,
          discount: campaign.discount,
          code: p.promo,
          folio: p.folio,
          companyName: company?.name,
          color,
        })
        setSaved(true)
        onSaved?.()
      })
      .catch((e) => alive && setPrizeError(e.message))
    return () => {
      alive = false
    }
  }, [campaign.id])

  async function copy() {
    try {
      await navigator.clipboard.writeText(prize.promo)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  return (
    <div className="landing-wrap" onClick={(e) => e.stopPropagation()}>
      <div className="landing-burst" style={{ '--c': color }} />
      <div className="landing-stage">
        <article ref={cardRef} className="landing" style={{ '--c': color }}>
          <div className="landing-glow" />
          <header>
            <div className="l-logo">{company?.logo ? <img src={company.logo} alt="" /> : (company?.name || '?')[0]}</div>
            <div>
              <small>{company?.name}</small>
              <h2>{campaign.title}</h2>
            </div>
          </header>
          {campaign.subtitle && <p className="l-sub">{campaign.subtitle}</p>}

          {!isCoupon ? (
            <div className="l-video">
              {yt ? (
                <iframe
                  src={`https://www.youtube.com/embed/${yt}?autoplay=1&playsinline=1&rel=0`}
                  title={campaign.title}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : campaign.videoUrl ? (
                <video src={campaign.videoUrl} autoPlay playsInline controls />
              ) : (
                <p className="muted">Video no configurado.</p>
              )}
            </div>
          ) : (
            <>
              {campaign.discount && <div className="l-discount">{campaign.discount}</div>}
              {prizeError ? (
                <p className="l-error">{prizeError}</p>
              ) : !prize ? (
                <div className="l-code loading"><span>· · ·</span><small>Generando tu código…</small></div>
              ) : (
                <>
                  <button className="l-code" onClick={copy}>
                    <span>{prize.promo}</span>
                    <small>{copied ? '¡Copiado!' : 'Toca para copiar'}</small>
                  </button>
                  {prize.folio !== prize.promo && <small className="muted">Folio de canje: <b>{prize.folio}</b></small>}
                  {prize.status === 'redeemed' && <p className="l-error">Este premio ya fue canjeado.</p>}
                  {prize.repeat && prize.status !== 'redeemed' && <small className="muted l-note">Ya habías capturado este premio.</small>}
                </>
              )}
            </>
          )}

          {campaign.description && <p className="l-desc">{campaign.description}</p>}

          <div className="l-actions">
            {isCoupon && saved && <div className="l-saved">✓ Guardado en Mis premios</div>}
            {campaign.ctaUrl && (
              <a className="btn primary" href={campaign.ctaUrl} target="_blank" rel="noopener noreferrer" onClick={() => track(campaign.id, 'cta')}>
                {campaign.ctaText || 'Ver más'}
              </a>
            )}
            <button className="btn ghost" onClick={onClose}>Seguir explorando</button>
          </div>
        </article>
      </div>
    </div>
  )
}
