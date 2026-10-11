import { createClient } from '@supabase/supabase-js'

// La anon key es pública por diseño: la seguridad la dan las políticas RLS de supabase/schema.sql
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://xetflthjncbypzigtsay.supabase.co'
const KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGZsdGhqbmNieXB6aWd0c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NTI0MjgsImV4cCI6MjEwNDIyODQyOH0.G1e01PJoqoKPxlzmgHvDwddy4PZBg15qoEc2lmmrsa8'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, storageKey: 'geoads-auth' },
})

export const MEDIA_BUCKET = 'geo-media'

/** Mensaje legible de un error de Supabase/Postgres. */
export const errMsg = (e) => e?.message || e?.error_description || String(e)
