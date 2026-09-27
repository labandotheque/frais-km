// @ts-nocheck
export const PARTICIPANT_COLORS = [
  '#4f46e5',
  '#059669',
  '#dc2626',
  '#d97706',
  '#7c3aed',
  '#0891b2'
]

export function getParticipantColor(id) {
  return PARTICIPANT_COLORS[id % PARTICIPANT_COLORS.length]
}
