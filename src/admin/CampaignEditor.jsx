import { useState } from 'react'
import MapPicker from './MapPicker'
import { Field, MediaInput } from './ui'
import { supabase, errMsg } from '../lib/supabase'
import { toDbCampaign } from '../lib/data'

export const newCampaign = (companyId, near) => ({
  id: crypto.randomUUID(),
  isNew: true,
  companyId,
  title: 'Nueva campaña',
  subtitle: '¡Encontraste un premio!',
  type: 'coupon',
  discount: '20% OFF',
  code: 'GEO20',
  couponMode: 'unique',
  maxClaims: '',
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

/** Formulario de una campaña: se edita localmente y se guarda en la BD con "Guardar". */
export default function CampaignEditor({ initial, color, setMsg, onSaved, onDeleted, onBack }) {
  const [c, setC] = useState(initial)
  const [dirty, setDirty] = useState(!!initial.isNew)
  const [busy, setBusy] = useState(false)
  const set = (p) => {
    setC((x) => ({ ...x, ...p }))
    setDirty(true)
  }
  const num = (v) => (v === '' || v === '-' ? v : Number(v))

  async function save() {
    if (!Number.isFinite(Number(c.lat)) || !Number.isFinite(Number(c.lng))) return setMsg({ ok: false, text: 'Coordenadas inválidas.' })
    setBusy(true)
    const { data, error } = await supabase.from('geo_campaigns').upsert(toDbCampaign(c)).select().single()
    setBusy(false)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    setC((x) => ({ ...x, isNew: false }))
    setDirty(false)
    setMsg({ ok: true, text: 'Campaña guardada. Ya está visible en la app.' })
    onSaved(data)
  }

  async function remove() {
    if (!confirm('¿Eliminar esta campaña? También se borran sus estadísticas y cupones.')) return
    if (!c.isNew) {
      const { error } = await supabase.from('geo_campaigns').delete().eq('id', c.id)
      if (error) return setMsg({ ok: false, text: errMsg(error) })
    }
    setMsg({ ok: true, text: 'Campaña eliminada.' })
    onDeleted(c.id)
  }

  function back() {
    if (dirty && !confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return
    onBack()
  }

  const playUrl = `${location.origin}${location.pathname}#/play/${c.id}`

  return (
    <div className="form">
      <div className="row between sticky-actions">
        <button className="btn small ghost" onClick={back}>← Campañas</button>
        <div className="row">
          <label className="switch">
            <input type="checkbox" checked={!!c.active} onChange={(e) => set({ active: e.target.checked })} />
            <span>{c.active ? 'Activa' : 'Pausada'}</span>
          </label>
          <button className="btn small primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado ✓'}</button>
        </div>
      </div>

      <h3>Ubicación</h3>
      <MapPicker key={c.id} lat={Number(c.lat)} lng={Number(c.lng)} radius={Number(c.radius) || 20} color={color} onChange={set} />
      <div className="grid3">
        <Field label="Latitud"><input inputMode="decimal" value={c.lat} onChange={(e) => set({ lat: num(e.target.value) })} /></Field>
        <Field label="Longitud"><input inputMode="decimal" value={c.lng} onChange={(e) => set({ lng: num(e.target.value) })} /></Field>
        <Field label="Rango (m)"><input type="number" min="5" max="1000" value={c.radius} onChange={(e) => set({ radius: num(e.target.value) })} /></Field>
      </div>

      <h3>Landing</h3>
      <Field label="Título"><input value={c.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><input value={c.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
      <Field label="Tipo">
        <div className="seg">
          <button className={c.type === 'coupon' ? 'on' : ''} onClick={() => set({ type: 'coupon' })}>Código de descuento</button>
          <button className={c.type === 'video' ? 'on' : ''} onClick={() => set({ type: 'video' })}>Video publicitario</button>
        </div>
      </Field>

      {c.type === 'coupon' ? (
        <>
          <div className="grid2">
            <Field label="Oferta (texto grande)"><input value={c.discount} onChange={(e) => set({ discount: e.target.value })} placeholder="20% OFF" /></Field>
            <Field label={c.couponMode === 'unique' ? 'Prefijo del código' : 'Código'}>
              <input value={c.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="GEO20" />
            </Field>
          </div>
          <Field label="Tipo de código">
            <div className="seg">
              <button className={c.couponMode === 'unique' ? 'on' : ''} onClick={() => set({ couponMode: 'unique' })}>Único por persona</button>
              <button className={c.couponMode === 'shared' ? 'on' : ''} onClick={() => set({ couponMode: 'shared' })}>Mismo para todos</button>
            </div>
          </Field>
          <small className="muted">
            {c.couponMode === 'unique'
              ? `Cada persona recibe un código distinto (ej. ${(c.code || 'GEO').replace(/[^A-Z0-9]/g, '').slice(0, 8)}-7F3A2) que solo se puede canjear una vez.`
              : 'Todos ven el mismo código; además cada persona recibe un folio para validar el canje.'}
          </small>
          <Field label="Cupo máximo de premios (vacío = ilimitado)">
            <input type="number" min="1" value={c.maxClaims ?? ''} onChange={(e) => set({ maxClaims: e.target.value })} placeholder="Ej. 100" />
          </Field>
        </>
      ) : (
        <Field label="Video (YouTube, MP4 o subir)">
          <MediaInput value={c.videoUrl} onChange={(v) => set({ videoUrl: v })} folder={c.companyId} accept="video/mp4,video/webm" setMsg={setMsg} />
        </Field>
      )}

      <Field label="Descripción / condiciones"><textarea rows="3" value={c.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Texto del botón"><input value={c.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
        <Field label="Enlace del botón"><input value={c.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="https://…" /></Field>
      </div>
      <Field label="Sonido al llegar (opcional)">
        <MediaInput value={c.soundUrl} onChange={(v) => set({ soundUrl: v })} folder={c.companyId} accept="audio/*" setMsg={setMsg} />
      </Field>
      <div className="grid2">
        <Field label="Desde"><input type="date" value={c.startsAt} onChange={(e) => set({ startsAt: e.target.value })} /></Field>
        <Field label="Hasta"><input type="date" value={c.endsAt} onChange={(e) => set({ endsAt: e.target.value })} /></Field>
      </div>

      <div className="row wrap">
        {!c.isNew && <a className="btn" href={`./?sim=1#/play/${c.id}`} target="_blank" rel="noopener">Probar en simulador</a>}
        <button className="btn danger" onClick={remove}>Eliminar</button>
      </div>
      {!c.isNew && <small className="muted">Enlace directo para QR: <code>{playUrl}</code></small>}
    </div>
  )
}
