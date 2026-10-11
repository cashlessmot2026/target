import { useEffect, useState } from 'react'
import { supabase, errMsg } from '../lib/supabase'

/** Solo superadministrador: da acceso a usuarios registrados (por correo) a una empresa o como super. */
export default function Users({ companies, myId, setMsg }) {
  const [admins, setAdmins] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('company')
  const [companyId, setCompanyId] = useState(companies[0]?.id || '')
  const names = Object.fromEntries(companies.map((c) => [c.id, c.name]))

  async function load() {
    const { data, error } = await supabase.from('geo_admins').select('*').order('created_at')
    if (error) setMsg({ ok: false, text: errMsg(error) })
    else setAdmins(data)
  }
  useEffect(() => {
    load()
  }, [])

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.rpc('geo_add_admin', { p_email: email, p_role: role, p_company: role === 'company' ? companyId : null })
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    setMsg({ ok: true, text: `Acceso otorgado a ${email}.` })
    setEmail('')
    load()
  }

  async function revoke(a) {
    if (!confirm(`¿Quitar el acceso a ${a.email}?`)) return
    const { error } = await supabase.from('geo_admins').delete().eq('user_id', a.user_id)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    load()
  }

  return (
    <section className="form">
      <p className="muted small">
        1) La persona se registra en este panel (<code>#/admin</code> → Regístrate). 2) Aquí le das acceso con su correo.
      </p>
      <form className="form" onSubmit={add}>
        <label className="field"><span>Correo registrado</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="grid2">
          <label className="field"><span>Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="company">Admin de empresa</option>
              <option value="super">Superadministrador</option>
            </select>
          </label>
          {role === 'company' && (
            <label className="field"><span>Empresa</span>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <button className="btn primary">Dar acceso</button>
      </form>

      <h3>Usuarios con acceso</h3>
      <div className="list">
        {admins.map((a) => (
          <div key={a.user_id} className="user-row">
            <div>
              <strong>{a.email}</strong>
              <small className="muted">{a.role === 'super' ? 'Superadministrador' : names[a.company_id] || 'Empresa eliminada'}</small>
            </div>
            {a.user_id !== myId && <button className="btn small danger" onClick={() => revoke(a)}>Quitar</button>}
          </div>
        ))}
      </div>
    </section>
  )
}
