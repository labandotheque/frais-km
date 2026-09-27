// @ts-nocheck
export const ROUTING_URL = 'https://router.project-osrm.org/route/v1/driving/'

export function buildRoutingUrl(coordinates, options = {}) {
  const params = new URLSearchParams({
    overview: options.overview || 'full',
    geometries: options.geometries || 'geojson'
  })
  return `${ROUTING_URL}${coordinates}?${params.toString()}`
}
