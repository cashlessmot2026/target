import { useCallback, useEffect, useState } from 'react'
import { supabase, errMsg } from '../lib/supabase'
import { loadData, fromDbCampaign, slugify } from '../lib/data'
import { Login, NoAccess } from './Auth'
import CampaignEditor, { newCampaign } from './CampaignEditor'
import Stats from './Stats'
import Redeem from './Redeem'
import Company from './Company'
import Users from './Users'

export default function Admin() {
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(undefined) // fila de geo_admins | null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadMe = useCallback(async () => {
    if (!session) return setMe(undefined)
    const { data } = await supabase.from('geo_admins').select('*').eq('user_id', session.user.id).maybeSingle()
    setMe(data || null)
  }, [session?.user.id])
  useEffect(() => {
    loadMe()
  }, [loadMe])

  if (session === undefined) return <div className="center muted">Cargando…</div>
  if (!session) return <Login />
  if (me === undefined) return <div className="center muted">Verificando acceso…</div>
  if (!me) return <NoAccess email={session.user.email} onClaimed={loadMe} />
  return <Panel me={me} email={session.user.email} />
}

function Panel({ me, email }) {
  const isSuper = me.role === 'super'
  const [companies, setCompanies] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [companyId, setCompanyId] = useState(me.company_id || '')
  const [tab, setTab] = useState('campaigns')
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const d = await loadData()
      const cos = isSuper ? d.companies : d.companies.filter((c) => c.id === me.company_id)
      setCompanies(cos)
      setCampaigns(d.campaigns)
      setCompanyId((cur) => (cos.some((c) => c.id === cur) ? cur : cos[0]?.id || ''))
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) })
    }
    setLoading(false)
  }, [isSuper, me.company_id])
  useEffect(() => {
    reload()
  }, [reload])

  const company = companies.find((c) => c.id === companyId)
  const mine = campaigns.filter((c) => c.companyId === companyId)

  async function addCompany() {
    const name = prompt('Nombre de la nueva empresa')
    if (!name?.trim()) return
    const { data, error } = await supabase.from('geo_companies').insert({ name: name.trim(), slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 5)}` }).select().single()
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    setCompanies((cs) => [...cs, data].sort((a, b) => a.name.localeCompare(b.name)))
    setCompanyId(data.id)
    setTab('company')
  }

  function onSaved(row) {
    const c = fromDbCampaign(row)
    setCampaigns((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c]))
  }

  const TABS = [
    ['campaigns', 'Campañas'],
    ['stats', 'Estadísticas'],
    ['redeem', 'Canjear'],
    ['company', 'Empresa'],
    ...(isSuper ? [['users', 'Usuarios']] : []),
  ]

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <h1>GeoAds · Panel</h1>
          <small className="muted">{email} · {isSuper ? 'Superadmin' : 'Admin de empresa'}</small>
        </div>
        <div className="row">
          <a className="btn small ghost" href="./#/">Ver app</a>
          <button className="btn small" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>

      {msg && <div className={`notice ${msg.ok ? 'ok' : 'bad'}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      <div className="company-bar">
        <label>Empresa</label>
        <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setEditing(null) }} disabled={!isSuper}>
          {companies.length === 0 && <option value="">— Sin empresas —</option>}
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({campaigns.filter((x) => x.companyId === c.id).length})</option>
          ))}
        </select>
        {isSuper && <button className="btn small" onClick={addCompany}>+ Empresa</button>}
      </div>

      <nav className="tabs scroll">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setEditing(null) }}>{label}</button>
        ))}
      </nav>

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : !company && tab !== 'users' ? (
        <p className="muted">{isSuper ? 'Crea tu primera empresa con "+ Empresa".' : 'Tu empresa ya no existe.'}</p>
      ) : (
        <>
          {tab === 'campaigns' && (editing ? (
            <CampaignEditor
              key={editing.id}
              initial={editing}
              color={company.color}
              setMsg={setMsg}
              onSaved={onSaved}
              onDeleted={(id) => { setCampaigns((cs) => cs.filter((c) => c.id !== id)); setEditing(null) }}
              onBack={() => setEditing(null)}
            />
          ) : (
            <section>
              <div className="list">
                {mine.length === 0 && <p className="muted">Esta empresa aún no tiene campañas.</p>}
                {mine.map((c) => (
                  <button key={c.id} className="card-item" style={{ '--c': company.color }} onClick={() => setEditing(c)}>
                    <div className="ci-logo">{c.type === 'video' ? '▶' : '%'}</div>
                    <div className="ci-body">
                      <strong>{c.title}</strong>
                      <span className="muted">{c.lat.toFixed(5)}, {c.lng.toFixed(5)} · {c.radius} m{c.maxClaims ? ` · cupo ${c.maxClaims}` : ''}</span>
                    </div>
                    <span className={`pill ${c.active ? 'ok' : ''}`}>{c.active ? 'Activa' : 'Pausada'}</span>
                  </button>
                ))}
              </div>
              <button className="btn primary block" onClick={() => setEditing(newCampaign(companyId, mine[mine.length - 1]))}>+ Nueva campaña</button>
            </section>
          ))}
          {tab === 'stats' && <Stats companyId={companyId} companyName={company.name} />}
          {tab === 'redeem' && <Redeem companyId={companyId} campaigns={mine} />}
          {tab === 'company' && (
            <Company
              company={company}
              isSuper={isSuper}
              setMsg={setMsg}
              onChanged={(co) => setCompanies((cs) => cs.map((x) => (x.id === co.id ? co : x)))}
              onDeleted={() => reload()}
            />
          )}
          {tab === 'users' && isSuper && <Users companies={companies} myId={me.user_id} setMsg={setMsg} />}
        </>
      )}
    </div>
  )
}
