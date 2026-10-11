import { supabase } from './supabase'

// ---------- Mapeo BD (snake_case) <-> app (camelCase) ----------
export const fromDbCampaign = (r) => ({
  id: r.id,
  companyId: r.company_id,
  title: r.title,
  subtitle: r.subtitle,
  type: r.type,
  discount: r.discount,
  code: r.code,
  couponMode: r.coupon_mode,
  maxClaims: r.max_claims,
  description: r.description,
  videoUrl: r.video_url,
  ctaText: r.cta_text,
  ctaUrl: r.cta_url,
  soundUrl: r.sound_url,
  lat: Number(r.lat),
  lng: Number(r.lng),
  radius: r.radius,
  active: r.active,
  startsAt: r.starts_at || '',
  endsAt: r.ends_at || '',
})

export const toDbCampaign = (c) => ({
  id: c.id,
  company_id: c.companyId,
  title: c.title,
  subtitle: c.subtitle,
  type: c.type,
  discount: c.discount,
  code: c.code,
  coupon_mode: c.couponMode,
  max_claims: c.maxClaims ? Number(c.maxClaims) : null,
  description: c.description,
  video_url: c.videoUrl,
  cta_text: c.ctaText,
  cta_url: c.ctaUrl,
  sound_url: c.soundUrl,
  lat: Number(c.lat),
  lng: Number(c.lng),
  radius: Number(c.radius) || 20,
  active: !!c.active,
  starts_at: c.startsAt || null,
  ends_at: c.endsAt || null,
})

/** Empresas y campañas visibles para quien consulta (público: solo activas; admin: las suyas). */
export async function loadData() {
  const [co, ca] = await Promise.all([
    supabase.from('geo_companies').select('*').order('name'),
    supabase.from('geo_campaigns').select('*').order('created_at'),
  ])
  if (co.error) throw co.error
  if (ca.error) throw ca.error
  return { companies: co.data, campaigns: ca.data.map(fromDbCampaign) }
}

export function isLive(c, now = new Date()) {
  if (!c.active || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false
  if (c.startsAt && new Date(`${c.startsAt}T00:00:00`) > now) return false
  if (c.endsAt && new Date(`${c.endsAt}T23:59:59`) < now) return false
  return true
}

/** "Café Demo!" → "cafe-demo" (para links de empresa) */
export const slugify = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

/** Link público del juego de una empresa. */
export const gameLink = (company) =>
  `${location.origin}${location.pathname}#/e/${encodeURIComponent(company.slug || company.id)}`

// ---------- Dispositivo anónimo ----------
export function deviceId() {
  try {
    let id = localStorage.getItem('geoads_device')
    if (!id) {
      id = crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
      localStorage.setItem('geoads_device', id)
    }
    return id
  } catch {
    return 'anon-device'
  }
}

// ---------- Billetera local ----------
const WALLET_KEY = 'geoads_wallet'

export function getWallet() {
  try {
    return JSON.parse(localStorage.getItem(WALLET_KEY)) || []
  } catch {
    return []
  }
}

function setWallet(w) {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(w))
  } catch {}
  return w
}

export const saveToWallet = (item) =>
  setWallet([{ ...item, savedAt: new Date().toISOString() }, ...getWallet().filter((x) => x.campaignId !== item.campaignId)])

export const removeFromWallet = (campaignId) => setWallet(getWallet().filter((x) => x.campaignId !== campaignId))
