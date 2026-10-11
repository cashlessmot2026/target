export const DATA_URL = import.meta.env.VITE_DATA_URL || `${import.meta.env.BASE_URL}campaigns.json`
export const DRAFT_KEY = 'geoads_admin_draft'

export const emptyData = () => ({ version: 0, updatedAt: null, companies: [], campaigns: [] })

export function normalize(d) {
  return {
    ...emptyData(),
    ...d,
    companies: Array.isArray(d?.companies) ? d.companies : [],
    campaigns: (Array.isArray(d?.campaigns) ? d.campaigns : []).map((c) => ({
      radius: 20,
      type: 'coupon',
      active: true,
      ...c,
      lat: Number(c.lat),
      lng: Number(c.lng),
    })),
  }
}

export async function loadData() {
  const sep = DATA_URL.includes('?') ? '&' : '?'
  const res = await fetch(`${DATA_URL}${sep}t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`No se pudo cargar ${DATA_URL} (${res.status})`)
  return normalize(await res.json())
}

/** Datos del borrador del admin (solo para el modo simulador ?sim). */
export function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY))
    return d ? normalize(d) : null
  } catch {
    return null
  }
}

export function isLive(c, now = new Date()) {
  if (!c.active || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false
  if (c.startsAt && new Date(`${c.startsAt}T00:00:00`) > now) return false
  if (c.endsAt && new Date(`${c.endsAt}T23:59:59`) < now) return false
  return true
}

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
