// @ts-nocheck
export const formatAddress = (item) => item?.properties ? item.properties.label : ''

export const formatAddressMain = (item) => {
  if (!item || !item.properties) return ''
  return item.properties.name || item.properties.label || ''
}

export const formatAddressSecondary = (item) => {
  if (!item || !item.properties) return ''
  const { postcode, city, name } = item.properties
  const parts = []
  if (postcode) parts.push(postcode)
  if (city && city !== name) parts.push(city)
  return parts.join(' · ')
}

export const addressTypeIcon = (item) => {
  const type = item && item.properties ? item.properties.type : ''
  // if (type === 'housenumber') return '🏠'
  // if (type === 'street') return '🛣️'
  // if (type === 'municipality') return '🏙️'
  return '📍'
}

const ADDRESS_TYPE_BOOST = {
  municipality: 0.12,
  locality: 0.06,
  street: 0,
  housenumber: 0.02
}

export const sortByScore = (features) => [...features].sort((a, b) => {
  const scoreA = (a.properties.score || 0) + (ADDRESS_TYPE_BOOST[a.properties.type] || 0)
  const scoreB = (b.properties.score || 0) + (ADDRESS_TYPE_BOOST[b.properties.type] || 0)
  return scoreB - scoreA
})


export function cityOf(label = '') {
    if (!label) return '—'
    const zip = label.match(/\b\d{5}\s+([^,]+)/)            // « 12 rue X 29300 Quimperlé »
    if (zip) return zip[1].trim()
    const parts = label.split(/,|\s[–-]\s/).map(s => s.trim()).filter(Boolean)   // « Aire – adresse, Commune »
    return parts[parts.length - 1] || label
}