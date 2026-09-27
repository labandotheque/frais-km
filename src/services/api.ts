// @ts-nocheck
export async function safeFetchJson(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Erreur réseau')
    return await res.json()
  } catch (err) {
    console.error(err)
    return null
  }
}
