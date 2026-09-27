// @ts-nocheck
export function safeGetLocalStorage(key, fallback) {
  try {
    const item = localStorage.getItem(key)
    if (item === null) return fallback
    try {
      return JSON.parse(item)
    } catch {
      return item
    }
  } catch (err) {
    console.error(`Erreur lecture localStorage pour ${key}:`, err)
    return fallback
  }
}

export function safeSetLocalStorage(key, value) {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}
