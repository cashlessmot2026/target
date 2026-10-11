import { useEffect, useState } from 'react'
import { supabase, errMsg } from '../lib/supabase'
import { downloadCsv } from './ui'

const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const n = (v) => Number(v || 0)

const COLS = [
  ['impressions', 'Vistas en lista'],
  ['opens', 'Abrieron AR'],
  ['arrivals', 'Llegaron'],
  ['captures', 'Capturaron'],
  ['claims', 'Cupones'],
  ['redeemed', 'Canjeados'],
  ['ctas', 'Clic botón'],
  ['videos', 'Videos'],
  ['devices', 'Personas'],
]

/** Estadísticas por campaña: embudo completo y desglose diario. */
export default function Stats({ companyId, companyName }) {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState(null)
  const [daily, setDaily] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(null)
    Promise.all([
      supabase.rpc('geo_campaign_stats', { p_company: companyId, p_days: days }),
      supabase.rpc('geo_daily_stats', { p_company: companyId, p_days: days }),
    ]).then(([s, d]) => {
      if (!alive) return
      if (s.error || d.error) return setError(errMsg(s.error || d.error))
      setRows(s.data)
      setDaily(d.data)
    })
    return () => {
      alive = false
    }
  }, [companyId, days])

  const total = Object.fromEntries(COLS.map(([k]) => [k, (rows || []).reduce((s, r) => s + n(r[k]), 0)]))

  // Tabla diaria: una fila por día con cada tipo de evento como columna
  const byDay = {}
  daily.forEach((d) => {
    byDay[d.day] = byDay[d.day] || { day: d.day }
    byDay[d.day][d.type] = n(d.n)
  })
  const dayRows = Object.values(byDay).sort((a, b) => (a.day < b.day ? 1 : -1))

  return (
    <section className="form">
      <div className="row between">
        <div className="seg">
          {[7, 30, 90].map((d) => (
            <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} días</button>
          ))}
        </div>
        <button className="btn small" disabled={!rows?.length}
          onClick={() => downloadCsv(`estadisticas-${companyName}-${days}d.csv`, rows.map(({ campaign_id, ...r }) => r))}>
          Exportar CSV
        </button>
      </div>

      {error && <div className="notice bad">{error}</div>}
      {!rows && !error && <p className="muted">Cargando…</p>}

      {rows && (
        <>
          <div className="funnel">
            {[
              ['Abrieron AR', total.opens, total.impressions],
              ['Llegaron', total.arrivals, total.opens],
              ['Capturaron', total.captures, total.arrivals],
              ['Canjearon', total.redeemed, total.claims],
            ].map(([label, v, base]) => (
              <div key={label} className="funnel-step">
                <small className="muted">{label}</small>
                <strong>{v}</strong>
                <small className="muted">{pct(v, base)} del paso anterior</small>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th>Campaña</th>
                  {COLS.map(([k, label]) => <th key={k}>{label}</th>)}
                  <th>Conversión</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.campaign_id} className={r.active ? '' : 'off'}>
                    <td>{r.title}</td>
                    {COLS.map(([k]) => <td key={k}>{n(r[k])}</td>)}
                    <td>{pct(n(r.captures), n(r.opens))}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total</td>
                  {COLS.map(([k]) => <td key={k}>{k === 'devices' ? '—' : total[k]}</td>)}
                  <td>{pct(total.captures, total.opens)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <small className="muted">Conversión = capturas ÷ personas que abrieron la cámara. "Personas" = dispositivos únicos.</small>

          <h3>Por día</h3>
          {dayRows.length === 0 ? (
            <p className="muted">Aún no hay actividad en este periodo.</p>
          ) : (
            <div className="table-wrap">
              <table className="stats">
                <thead>
                  <tr><th>Día</th><th>Vistas</th><th>Abrieron</th><th>Llegaron</th><th>Capturaron</th><th>Cupones</th><th>Canjes</th></tr>
                </thead>
                <tbody>
                  {dayRows.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td><td>{d.impression || 0}</td><td>{d.open || 0}</td><td>{d.arrive || 0}</td>
                      <td>{d.capture || 0}</td><td>{d.claim || 0}</td><td>{d.redeem || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
