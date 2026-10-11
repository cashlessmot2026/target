import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { gameLink } from '../lib/data'

/** Link + QR del juego de una empresa, listo para copiar, compartir o imprimir. */
export default function GameLink({ company }) {
  const link = gameLink(company)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [link])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  async function share() {
    try {
      await navigator.share({ title: company.name, text: `¡Encuentra el premio de ${company.name}!`, url: link })
    } catch {}
  }

  return (
    <div className="game-link" style={{ '--c': company.color }}>
      <div>
        <h3>Link del juego</h3>
        <p className="muted small">Quien lo abra verá la marca de {company.name}, se activará la cámara y será guiado a la promoción más cercana.</p>
        <code className="link-box">{link}</code>
        <div className="row wrap">
          <button className="btn small primary" onClick={copy}>{copied ? '¡Copiado!' : 'Copiar link'}</button>
          {navigator.share && <button className="btn small" onClick={share}>Compartir</button>}
          <a className="btn small" href={link} target="_blank" rel="noopener">Abrir</a>
          {qr && <a className="btn small" href={qr} download={`qr-${company.slug || company.id}.png`}>Descargar QR</a>}
        </div>
      </div>
      {qr && <img className="qr" src={qr} alt={`Código QR de ${company.name}`} />}
    </div>
  )
}
