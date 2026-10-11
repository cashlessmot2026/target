import { useEffect, useState } from 'react'
import MapPicker from './MapPicker'
import { DATA_URL, DRAFT_KEY, emptyData, loadData, normalize } from '../lib/data'
import { publishData, testRepo, uploadMedia } from '../lib/github'

const GH_KEY = 'geoads_gh'
const uid = () => Math.random().toString(36).slice(2, 10)
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d
  } catch {
    return d
  }
}
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {}
}
const strip = (d) => JSON.stringify({ companies: d.companies, campaigns: d.campaigns })

const newCompany = () => ({ id: uid(), name: 'Nueva empresa', color: '#00e5ff', logo: '' })
const newCampaign = (companyId, near) => ({
  id: uid(),
  companyId,
  title: 'Nueva campaña',
  subtitle: '¡Encontraste un premio!',
  type: 'coupon',
  discount: '20% OFF',
  code: 'GEO20',
  description: '',
  videoUrl: '',
  ctaText: 'Ver más',
  ctaUrl: '',
  soundUrl: '',
  lat: near?.lat ?? 19.4326,
  lng: near?.lng ?? -99.1332,
  radius: 20,
  active: true,
  startsAt: '',
  endsAt: '',
})

export default function Admin() {
  const [data, setData] = useState(() => {
    const d = read(DRAFT_KEY, null)
    return d ? normalize(d) : null
  })
  const [published, setPublished] = useState(null)
  const [gh, setGh] = useState(() => read(GH_KEY, { owner: '', repo: '', branch: 'main', path: 'public/campaigns.json', token: '' }))
  const [tab, setTab] = useState('campaigns')
  const [companyId, setCompanyId] = useState('')
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadData()
      .then((d) => {
        setPublished(d)
        setData((cur) => cur ?? d)
      })
      .catch(() => setData((cur) => cur ?? emptyData()))
  }, [])
  useEffect(() => {
    if (data) write(DRAFT_KEY, data)
  }, [data])
  useEffect(() => write(GH_KEY, gh), [gh])
  useEffect(() => {
    if (data && !data.companies.some((c) => c.id === companyId)) setCompanyId(data.companies[0]?.id || '')
  }, [data, companyId])

  if (!data) return <div className="center muted">Cargando…</div>

  const dirty = !published || strip(published) !== strip(data)
  const company = data.companies.find((c) => c.id === companyId)
  const campaigns = data.campaigns.filter((c) => c.companyId === companyId)
  const editing = data.campaigns.find((c) => c.id === editId)

  const patchCompany = (id, p) => setData((d) => ({ ...d, companies: d.companies.map((c) => (c.id === id ? { ...c, ...p } : c)) }))
  const patchCampaign = (id, p) => setData((d) => ({ ...d, campaigns: d.campaigns.map((c) => (c.id === id ? { ...c, ...p } : c)) }))

  function addCompany() {
    const c = newCompany()
    setData((d) => ({ ...d, companies: [...d.companies, c] }))
    setCompanyId(c.id)
    setTab('companies')
  }
  function removeCompany(id) {
    if (!confirm('¿Eliminar la empresa y TODAS sus campañas?')) return
    setData((d) => ({ ...d, companies: d.companies.filter((c) => c.id !== id), campaigns: d.campaigns.filter((c) => c.companyId !== id) }))
  }
  function addCampaign() {
    if (!companyId) return addCompany()
    const last = campaigns[campaigns.length - 1]
    const c = newCampaign(companyId, last)
    setData((d) => ({ ...d, campaigns: [...d.campaigns, c] }))
    setEditId(c.id)
  }
  function duplicateCampaign(c) {
    const copy = { ...c, id: uid(), title: `${c.title} (copia)` }
    setData((d) => ({ ...d, campaigns: [...d.campaigns, copy] }))
    setEditId(copy.id)
  }
  function removeCampaign(id) {
    if (!confirm('¿Eliminar esta campaña?')) return
    setData((d) => ({ ...d, campaigns: d.campaigns.filter((c) => c.id !== id) }))
    setEditId(null)
  }

  async function run(fn, okText) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      if (okText) setMsg({ ok: true, text: okText })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  const publish = () =>
    run(async () => {
      const out = { ...data, version: (published?.version || data.version || 0) + 1, updatedAt: new Date().toISOString() }
      await publishData(gh, out)
      setData(out)
      setPublished(out)
    }, 'Publicado ✓ GitHub Pages se actualizará en 1–2 minutos.')

  function discard() {
    if (!published || !confirm('¿Descartar el borrador y volver a lo publicado?')) return
    setData(published)
    setEditId(null)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'campaigns.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  function importJson(e) {
    const f = e.target.files[0]
    if (!f) return
    f.text()
      .then((t) => setData(normalize(JSON.parse(t))))
      .then(() => setMsg({ ok: true, text: 'JSON importado al borrador.' }))
      .catch(() => setMsg({ ok: false, text: 'Archivo JSON inválido.' }))
    e.target.value = ''
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <h1>GeoAds · Panel</h1>
          <small className={dirty ? 'warn-text' : 'muted'}>
            {dirty ? '● Cambios sin publicar' : `Publicado v${published?.version ?? 0}`}
          </small>
        </div>
        <div className="row">
          <a className="btn small ghost" href="./#/">Ver app</a>
          <button className="btn small primary" onClick={publish} disabled={busy || !dirty}>{busy ? 'Publicando…' : 'Publicar'}</button>
        </div>
      </header>

      {msg && <div className={`notice ${msg.ok ? 'ok' : 'bad'}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      <div className="company-bar">
        <label>Empresa</label>
        <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setEditId(null) }}>
          {data.companies.length === 0 && <option value="">— Sin empresas —</option>}
          {data.companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({data.campaigns.filter((x) => x.companyId === c.id).length})</option>
          ))}
        </select>
        <button className="btn small" onClick={addCompany}>+ Empresa</button>
      </div>

      <nav className="tabs">
        <button className={tab === 'campaigns' ? 'on' : ''} onClick={() => setTab('campaigns')}>Campañas</button>
        <button className={tab === 'companies' ? 'on' : ''} onClick={() => setTab('companies')}>Empresa</button>
        <button className={tab === 'publish' ? 'on' : ''} onClick={() => setTab('publish')}>GitHub</button>
      </nav>

      {tab === 'campaigns' && (
        <section>
          {!company ? (
            <p className="muted">Crea primero una empresa.</p>
          ) : editing ? (
            <CampaignEditor
              c={editing}
              color={company.color}
              gh={gh}
              setMsg={setMsg}
              onChange={(p) => patchCampaign(editing.id, p)}
              onBack={() => setEditId(null)}
              onDelete={() => removeCampaign(editing.id)}
              onDuplicate={() => duplicateCampaign(editing)}
            />
          ) : (
            <>
              <div className="list">
                {campaigns.length === 0 && <p className="muted">Esta empresa aún no tiene campañas.</p>}
                {campaigns.map((c) => (
                  <button key={c.id} className="card-item" style={{ '--c': company.color }} onClick={() => setEditId(c.id)}>
                    <div className="ci-logo">{c.type === 'video' ? '▶' : '%'}</div>
                    <div className="ci-body">
                      <strong>{c.title}</strong>
                      <span className="muted">{Number(c.lat).toFixed(5)}, {Number(c.lng).toFixed(5)} · {c.radius} m</span>
                    </div>
                    <span className={`pill ${c.active ? 'ok' : ''}`}>{c.active ? 'Activa' : 'Pausada'}</span>
                  </button>
                ))}
              </div>
              <button className="btn primary block" onClick={addCampaign}>+ Nueva campaña</button>
            </>
          )}
        </section>
      )}

      {tab === 'companies' && company && (
        <section className="form">
          <Field label="Nombre"><input value={company.name} onChange={(e) => patchCompany(company.id, { name: e.target.value })} /></Field>
          <Field label="Color de marca">
            <div className="row">
              <input type="color" value={company.color} onChange={(e) => patchCompany(company.id, { color: e.target.value })} />
              <input value={company.color} onChange={(e) => patchCompany(company.id, { color: e.target.value })} />
            </div>
          </Field>
          <Field label="Logo (URL o subir)">
            <MediaInput value={company.logo} onChange={(v) => patchCompany(company.id, { logo: v })} gh={gh} accept="image/*" setMsg={setMsg} />
          </Field>
          {company.logo && <img className="logo-preview" src={company.logo} alt="" />}
          <button className="btn danger" onClick={() => removeCompany(company.id)}>Eliminar empresa</button>
        </section>
      )}

      {tab === 'publish' && (
        <section className="form">
          <p className="muted small">
            La app lee <code>{DATA_URL}</code>. Al publicar se guarda <code>{gh.path}</code> en tu repositorio y GitHub Pages se vuelve a desplegar.
            El token se queda solo en este navegador.
          </p>
          <Field label="Usuario u organización"><input value={gh.owner} onChange={(e) => setGh({ ...gh, owner: e.target.value.trim() })} placeholder="mi-usuario" /></Field>
          <Field label="Repositorio"><input value={gh.repo} onChange={(e) => setGh({ ...gh, repo: e.target.value.trim() })} placeholder="geoads-ar" /></Field>
          <div className="grid2">
            <Field label="Rama"><input value={gh.branch} onChange={(e) => setGh({ ...gh, branch: e.target.value.trim() })} /></Field>
            <Field label="Ruta del archivo"><input value={gh.path} onChange={(e) => setGh({ ...gh, path: e.target.value.trim() })} /></Field>
          </div>
          <Field label="Token (fine-grained, Contents: Read & write)">
            <input type="password" value={gh.token} onChange={(e) => setGh({ ...gh, token: e.target.value.trim() })} placeholder="github_pat_…" autoComplete="off" />
          </Field>
          <div className="row wrap">
            <button className="btn" disabled={busy} onClick={() => run(() => testRepo(gh), 'Conexión correcta ✓ El token puede escribir en el repositorio.')}>Probar conexión</button>
            <button className="btn" onClick={() => run(async () => { const d = await loadData(); setPublished(d) }, 'Versión publicada recargada.')}>Recargar publicado</button>
            <button className="btn" onClick={discard} disabled={!dirty || !published}>Descartar borrador</button>
          </div>
          <hr />
          <div className="row wrap">
            <button className="btn" onClick={exportJson}>Descargar JSON</button>
            <label className="btn">Importar JSON<input type="file" accept="application/json" hidden onChange={importJson} /></label>
            <button className="btn ghost" onClick={() => { if (confirm('¿Borrar el token guardado?')) setGh({ ...gh, token: '' }) }}>Olvidar token</button>
          </div>
        </section>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function MediaInput({ value, onChange, gh, accept, setMsg }) {
  const [busy, setBusy] = useState(false)
  async function onFile(e) {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      onChange(await uploadMedia(gh, f))
      setMsg({ ok: true, text: 'Archivo subido. Se verá en la app cuando termine el despliegue.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="row">
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      <label className="btn small">
        {busy ? '…' : 'Subir'}
        <input type="file" hidden accept={accept} onChange={onFile} disabled={busy} />
      </label>
    </div>
  )
}

function CampaignEditor({ c, color, gh, setMsg, onChange, onBack, onDelete, onDuplicate }) {
  const num = (v) => (v === '' || v === '-' ? v : Number(v))
  const testUrl = `./?sim=1#/play/${encodeURIComponent(c.id)}`
  return (
    <div className="form">
      <div className="row between">
        <button className="btn small ghost" onClick={onBack}>← Campañas</button>
        <label className="switch">
          <input type="checkbox" checked={!!c.active} onChange={(e) => onChange({ active: e.target.checked })} />
          <span>{c.active ? 'Activa' : 'Pausada'}</span>
        </label>
      </div>

      <h3>Ubicación</h3>
      <MapPicker key={c.id} lat={Number(c.lat)} lng={Number(c.lng)} radius={Number(c.radius) || 20} color={color} onChange={onChange} />
      <div className="grid3">
        <Field label="Latitud"><input inputMode="decimal" value={c.lat} onChange={(e) => onChange({ lat: num(e.target.value) })} /></Field>
        <Field label="Longitud"><input inputMode="decimal" value={c.lng} onChange={(e) => onChange({ lng: num(e.target.value) })} /></Field>
        <Field label="Rango (m)"><input type="number" min="5" max="500" value={c.radius} onChange={(e) => onChange({ radius: num(e.target.value) })} /></Field>
      </div>

      <h3>Contenido</h3>
      <Field label="Título"><input value={c.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><input value={c.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Tipo de landing">
        <div className="seg">
          <button className={c.type === 'coupon' ? 'on' : ''} onClick={() => onChange({ type: 'coupon' })}>Código de descuento</button>
          <button className={c.type === 'video' ? 'on' : ''} onClick={() => onChange({ type: 'video' })}>Video publicitario</button>
        </div>
      </Field>
      {c.type === 'coupon' ? (
        <div className="grid2">
          <Field label="Oferta (texto grande)"><input value={c.discount} onChange={(e) => onChange({ discount: e.target.value })} placeholder="20% OFF" /></Field>
          <Field label="Código"><input value={c.code} onChange={(e) => onChange({ code: e.target.value.toUpperCase() })} placeholder="GEO20" /></Field>
        </div>
      ) : (
        <Field label="Video (YouTube, MP4 o subir)">
          <MediaInput value={c.videoUrl} onChange={(v) => onChange({ videoUrl: v })} gh={gh} accept="video/mp4,video/webm" setMsg={setMsg} />
        </Field>
      )}
      <Field label="Descripción / condiciones"><textarea rows="3" value={c.description} onChange={(e) => onChange({ description: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Texto del botón"><input value={c.ctaText} onChange={(e) => onChange({ ctaText: e.target.value })} /></Field>
        <Field label="Enlace del botón"><input value={c.ctaUrl} onChange={(e) => onChange({ ctaUrl: e.target.value })} placeholder="https://…" /></Field>
      </div>
      <Field label="Sonido al llegar (opcional, además de la fanfarria)">
        <MediaInput value={c.soundUrl} onChange={(v) => onChange({ soundUrl: v })} gh={gh} accept="audio/*" setMsg={setMsg} />
      </Field>
      <div className="grid2">
        <Field label="Desde"><input type="date" value={c.startsAt} onChange={(e) => onChange({ startsAt: e.target.value })} /></Field>
        <Field label="Hasta"><input type="date" value={c.endsAt} onChange={(e) => onChange({ endsAt: e.target.value })} /></Field>
      </div>

      <div className="row wrap">
        <a className="btn" href={testUrl} target="_blank" rel="noopener">Probar en simulador</a>
        <button className="btn" onClick={onDuplicate}>Duplicar</button>
        <button className="btn danger" onClick={onDelete}>Eliminar</button>
      </div>
      <small className="muted">
        Enlace directo para QR: <code>{`${location.origin}${location.pathname}#/play/${c.id}`}</code>
      </small>
    </div>
  )
}
