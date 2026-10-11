import { useEffect, useState } from 'react'
import { supabase, errMsg } from '../lib/supabase'
import { Field, MediaInput } from './ui'

/** Datos de la empresa (nombre, color, logo). Solo el super puede eliminarla. */
export default function Company({ company, isSuper, setMsg, onChanged, onDeleted }) {
  const [c, setC] = useState(company)
  const [busy, setBusy] = useState(false)
  useEffect(() => setC(company), [company.id])
  const dirty = JSON.stringify(c) !== JSON.stringify(company)

  async function save() {
    setBusy(true)
    const { data, error } = await supabase
      .from('geo_companies')
      .update({ name: c.name, color: c.color, logo: c.logo })
      .eq('id', c.id)
      .select()
      .single()
    setBusy(false)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    setMsg({ ok: true, text: 'Empresa guardada.' })
    onChanged(data)
  }

  async function remove() {
    if (!confirm(`¿Eliminar "${company.name}" con TODAS sus campañas, cupones y estadísticas?`)) return
    const { error } = await supabase.from('geo_companies').delete().eq('id', company.id)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    setMsg({ ok: true, text: 'Empresa eliminada.' })
    onDeleted(company.id)
  }

  return (
    <section className="form">
      <Field label="Nombre"><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
      <Field label="Color de marca">
        <div className="row">
          <input type="color" value={c.color} onChange={(e) => setC({ ...c, color: e.target.value })} />
          <input value={c.color} onChange={(e) => setC({ ...c, color: e.target.value })} />
        </div>
      </Field>
      <Field label="Logo (URL o subir)">
        <MediaInput value={c.logo} onChange={(v) => setC({ ...c, logo: v })} folder={c.id} accept="image/*" setMsg={setMsg} />
      </Field>
      {c.logo && <img className="logo-preview" src={c.logo} alt="" />}
      <div className="row wrap">
        <button className="btn primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar empresa'}</button>
        {isSuper && <button className="btn danger" onClick={remove}>Eliminar empresa</button>}
      </div>
    </section>
  )
}
