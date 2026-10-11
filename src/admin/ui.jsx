import { useState } from 'react'
import { supabase, MEDIA_BUCKET, errMsg } from '../lib/supabase'

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** Campo de URL con botón para subir el archivo a Supabase Storage. */
export function MediaInput({ value, onChange, folder, accept, setMsg }) {
  const [busy, setBusy] = useState(false)
  async function onFile(e) {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 50 * 1024 * 1024) return setMsg({ ok: false, text: 'Archivo muy grande (máx. 50 MB). Usa YouTube para videos largos.' })
    setBusy(true)
    const path = `${folder}/${Date.now()}-${f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, f, { contentType: f.type, upsert: false })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    onChange(supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl)
    setMsg({ ok: true, text: 'Archivo subido. Recuerda guardar.' })
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

export function downloadCsv(name, rows) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
