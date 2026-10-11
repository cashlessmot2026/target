import { lazy, Suspense, useEffect, useState } from 'react'
import Home from './client/Home'

// El panel admin se descarga solo si alguien entra a #/admin (no pesa en la app del cliente)
const Admin = lazy(() => import('./admin/Admin'))

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  if (hash.startsWith('#/admin')) {
    return (
      <Suspense fallback={<div className="center muted">Cargando panel…</div>}>
        <Admin />
      </Suspense>
    )
  }
  return <Home hash={hash} />
}
