import { useEffect, useRef, useState } from 'react'
import { saveToWallet } from '../lib/data'

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
  const color = company?.color || '#00e5ff'
  const yt = youtubeId(campaign.videoUrl)

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

  async function copy() {
    try {
      await navigator.clipboard.writeText(campaign.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  function save() {
    saveToWallet({
      campaignId: campaign.id,
      title: campaign.title,
      discount: campaign.discount,
      code: campaign.code,
      companyName: company?.name,
      color,
    })
    setSaved(true)
    onSaved?.()
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

          {campaign.type === 'video' ? (
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
              {campaign.code && (
                <button className="l-code" onClick={copy}>
                  <span>{campaign.code}</span>
                  <small>{copied ? '¡Copiado!' : 'Toca para copiar'}</small>
                </button>
              )}
            </>
          )}

          {campaign.description && <p className="l-desc">{campaign.description}</p>}

          <div className="l-actions">
            {campaign.type !== 'video' && campaign.code && (
              <button className="btn primary" onClick={save} disabled={saved}>
                {saved ? '✓ Guardado en Mis premios' : 'Guardar premio'}
              </button>
            )}
            {campaign.ctaUrl && (
              <a className="btn" href={campaign.ctaUrl} target="_blank" rel="noopener noreferrer">
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
