// @ts-nocheck
// Palette unique (carte, rail des arrêts, listes, paramètres) : celle d'origine, lumineuse.
export const PARTICIPANT_COLORS = [
  '#4f46e5', // indigo
  '#10b981', // émeraude
  '#f59e0b', // ambre
  '#ec4899', // rose
  '#8b5cf6', // violet
  '#06b6d4'  // cyan
]

export const DESTINATION_COLOR = '#dc2626'
export const STOP_NEUTRAL_COLOR = '#475569'   // arrêt dont la voiture n'est pas encore choisie

export function getParticipantColor(id) {
  const n = PARTICIPANT_COLORS.length
  return PARTICIPANT_COLORS[(((Number(id) || 0) % n) + n) % n]
}