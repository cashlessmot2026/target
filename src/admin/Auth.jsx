import { useState } from 'react'
import { supabase, errMsg } from '../lib/supabase'

/** Inicio de sesión / registro de administradores (Supabase Auth, correo + contraseña). */
export function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, {
      email,
      password,
      options: mode === 'signup' ? { emailRedirectTo: `${location.origin}${location.pathname}#/admin` } : undefined,
    })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: errMsg(error) })
    if (mode === 'signup' && !data.session) {
      setMsg({ ok: true, text: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' })
      setMode('login')
    }
  }

  return (
    <div className="admin auth">
      <h1>GeoAds · Panel</h1>
      <p className="muted">{mode === 'login' ? 'Inicia sesión para administrar tus campañas.' : 'Crea tu cuenta de administrador.'}</p>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Correo</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        <button className="btn primary" disabled={busy}>{busy ? '…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
      </button>
      <a className="link" href="./#/">← Volver a la app</a>
    </div>
  )
}

/** Usuario con sesión pero sin rol asignado. */
export function NoAccess({ email, onClaimed }) {
  const [msg, setMsg] = useState(null)
  async function claimSuper() {
    const { error } = await supabase.rpc('geo_claim_superadmin')
    if (error) return setMsg(errMsg(error))
    onClaimed()
  }
  return (
    <div className="admin auth">
      <h1>Sin acceso</h1>
      <p className="muted">
        La cuenta <b>{email}</b> aún no administra ninguna empresa. Pide al superadministrador que te agregue
        desde la pestaña <i>Usuarios</i>.
      </p>
      <p className="muted small">¿Eres el dueño de la plataforma y es la primera vez? Reclama el rol de superadministrador (solo funciona una vez):</p>
      <button className="btn" onClick={claimSuper}>Soy el superadministrador</button>
      {msg && <div className="notice bad">{msg}</div>}
      <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  )
}
