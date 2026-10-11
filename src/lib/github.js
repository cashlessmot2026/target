// Publicación directa al repositorio de GitHub (API REST "contents").
// El token se guarda solo en el navegador del administrador.

const api = (gh, path) =>
  `https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/contents/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

const headers = (gh) => ({
  Authorization: `Bearer ${gh.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

function assertConfig(gh) {
  if (!gh.owner || !gh.repo || !gh.token) throw new Error('Configura usuario, repositorio y token de GitHub en "Publicar".')
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })

async function githubError(res) {
  let detail = ''
  try {
    detail = (await res.json()).message
  } catch {}
  const hints = { 401: 'Token inválido o vencido.', 403: 'El token no tiene permiso de escritura (Contents: Read and write).', 404: 'Repositorio o rama no encontrados.', 409: 'Conflicto: alguien publicó al mismo tiempo, vuelve a intentar.' }
  return new Error(`GitHub ${res.status}: ${hints[res.status] || ''} ${detail}`.trim())
}

async function getSha(gh, path) {
  const res = await fetch(`${api(gh, path)}?ref=${encodeURIComponent(gh.branch)}`, { headers: headers(gh), cache: 'no-store' })
  if (res.status === 404) return undefined
  if (!res.ok) throw await githubError(res)
  return (await res.json()).sha
}

async function putFile(gh, path, base64, message) {
  const sha = await getSha(gh, path)
  const res = await fetch(api(gh, path), {
    method: 'PUT',
    headers: headers(gh),
    body: JSON.stringify({ message, content: base64, branch: gh.branch, sha }),
  })
  if (!res.ok) throw await githubError(res)
  return res.json()
}

export async function testRepo(gh) {
  assertConfig(gh)
  const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}`, { headers: headers(gh) })
  if (!res.ok) throw await githubError(res)
  const repo = await res.json()
  if (!repo.permissions?.push) throw new Error('El token puede leer pero no escribir en este repositorio.')
  return repo
}

export async function publishData(gh, data) {
  assertConfig(gh)
  const json = JSON.stringify(data, null, 2) + '\n'
  return putFile(gh, gh.path, utf8ToBase64(json), `GeoAds: publicar campañas v${data.version}`)
}

/** Sube un archivo (logo, video, sonido) junto a campaigns.json y devuelve su URL relativa al sitio. */
export async function uploadMedia(gh, file) {
  assertConfig(gh)
  if (file.size > 40 * 1024 * 1024) throw new Error('Archivo muy grande (máx. 40 MB). Usa una URL externa, p. ej. YouTube.')
  const dir = gh.path.includes('/') ? gh.path.slice(0, gh.path.lastIndexOf('/') + 1) : ''
  const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  const name = `media/${Date.now()}-${safe}`
  await putFile(gh, `${dir}${name}`, await fileToBase64(file), `GeoAds: subir ${safe}`)
  return name
}
