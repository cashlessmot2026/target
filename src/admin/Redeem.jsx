import { useEffect, useState } from 'react'
import { supabase, errMsg } from '../lib/supabase'
import { downloadCsv } from './ui'

const fmt = (d) => (d ? new Date(d).toLocaleString() : '')

/** Validación de cupones en caja + historial de premios entregados. */
export default function Redeem({ companyId, campaigns }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [claims, setClaims] = useState([])
  const titles = Object.fromEntries(campaigns.map((c) => [c.id, c.title]))

  async function loadClaims() {
    const { data } = await supabase
      .from('geo_claims')
      .select('code,status,claimed_at,redeemed_at,campaign_id')
      .eq('company_id', companyId)
      .order('claimed_at', { ascending: false })
      .limit(200)
    setClaims(data || [])
  }
  useEffect(() => {
    loadClaims()
  }, [companyId])

  async function redeem(e) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('geo_redeem', { p_code: code.trim() })
    setBusy(false)
    if (error) setResult({ ok: false, text: errMsg(error) })
    else if (data.already) setResult({ ok: false, text: `Este código YA fue canjeado el ${fmt(data.redeemed_at)} (${data.title}).` })
    else {
      setResult({ ok: true, text: `✓ Válido. Entrega el premio: ${data.title}` })
      setCode('')
      loadClaims()
    }
  }

  const redeemed = claims.filter((c) => c.status === 'redeemed').length

  return (
    <section className="form">
      <form className="redeem-box" onSubmit={redeem}>
        <label className="field">
          <span>Código o folio que muestra el cliente</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GEOCAFE-7F3A2" autoCapitalize="characters" />
        </label>
        <button className="btn primary" disabled={busy}>{busy ? 'Validando…' : 'Validar y canjear'}</button>
      </form>
      {result && <div className={`notice big ${result.ok ? 'ok' : 'bad'}`}>{result.text}</div>}

      <div className="row between">
        <h3>Premios entregados ({claims.length}, canjeados {redeemed})</h3>
        <button className="btn small" disabled={!claims.length}
          onClick={() => downloadCsv('cupones.csv', claims.map((c) => ({ campaña: titles[c.campaign_id] || '', codigo: c.code, estado: c.status, capturado: fmt(c.claimed_at), canjeado: fmt(c.redeemed_at) })))}>
          Exportar CSV
        </button>
      </div>
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th>Código</th><th>Campaña</th><th>Estado</th><th>Capturado</th><th>Canjeado</th></tr></thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.code}>
                <td><code>{c.code}</code></td>
                <td>{titles[c.campaign_id] || '—'}</td>
                <td><span className={`pill ${c.status === 'redeemed' ? 'ok' : ''}`}>{c.status === 'redeemed' ? 'Canjeado' : 'Pendiente'}</span></td>
                <td>{fmt(c.claimed_at)}</td>
                <td>{fmt(c.redeemed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
