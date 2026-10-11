import { supabase } from './supabase'
import { deviceId } from './data'

export const SIM = new URLSearchParams(location.search).has('sim')

/** Registra un evento de analítica. Nunca bloquea ni rompe la experiencia. En el simulador no registra nada. */
export function track(campaignId, type, distance = null) {
  if (SIM || !campaignId) return
  supabase
    .rpc('geo_track', { p_campaign: campaignId, p_device: deviceId(), p_type: type, p_distance: distance })
    .then(({ error }) => error && console.warn('[geoads] track', error.message))
}

/** Impresión: una sola vez por sesión y campaña. */
export function trackImpression(campaignId) {
  try {
    const k = `geoads_imp_${campaignId}`
    if (sessionStorage.getItem(k)) return
    sessionStorage.setItem(k, '1')
  } catch {}
  track(campaignId, 'impression')
}

/** Reclama el premio: devuelve { promo, folio, status, repeat } o lanza un error legible. */
export async function claim(campaign) {
  if (SIM) return { promo: campaign.code || 'DEMO', folio: 'SIMULADOR', status: 'claimed', repeat: false }
  const { data, error } = await supabase.rpc('geo_claim', { p_campaign: campaign.id, p_device: deviceId() })
  if (error) {
    if (error.message.includes('AGOTADO')) throw new Error('¡Se agotaron los premios de esta promoción!')
    throw new Error(error.message)
  }
  return data
}
