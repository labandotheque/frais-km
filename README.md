# Calculateur de frais — Vue 3 / Vite / TypeScript

Le comportement et le layout de la page d'origine sont conservés. La modification porte sur l'organisation technique :

- UI découpée en composants Vue par domaine
- logique principale dans `src/composables/useCalculator.ts`
- services, utils et constantes séparés
- projet entièrement passé en TypeScript (`.ts` + `<script lang="ts">`)
- Vue Router pour les trois views :
  - `/villes-etapes` — Villes & Étapes
  - `/km-directs` — Km directs
  - `/covoiturage` — Covoiturage
- `main.ts` monte l'application avec Vue Router
- Tailwind, Leaflet et Turf conservés via les mêmes CDN que la version originale

## Installation

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

> Le build local n'a pas pu être exécuté dans l'environnement de génération car `npm install` a dépassé le délai disponible. La structure TypeScript, les imports et la configuration Vite/Router ont été préparés pour l'installation standard ci-dessus.
