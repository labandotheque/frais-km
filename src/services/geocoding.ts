// @ts-nocheck
export const GEOCODE_URL = 'https://api-adresse.data.gouv.fr/search/'

export function buildGeocodingUrl(query, limit = 6) {
  return `${GEOCODE_URL}?q=${encodeURIComponent(query)}&limit=${limit}`
}
