<template>
  <AppHeader />
  <Notification />

  <div class="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
    <div class="grid grid-cols-1 items-start gap-5 md:grid-cols-12">
      <!-- Colonne gauche : Formulaire et paramètres -->
      <div class="space-y-5 md:col-span-7">
        <ItineraryForm />
        <CalculationSettings />
      </div>

      <!-- Colonne droite : Carte et résumé -->
      <div class="space-y-5 self-start md:sticky md:top-5 md:col-span-5">
        <MapPreview v-if="inputMode !== 'km'" />
        <Summary />
        <div class="flex justify-end">
          <button
        @click="shareTrip"
        class="w-full inline-flex items-center justify-center gap-2
               h-9 px-3.5 rounded-lg
               border border-indigo-200 bg-indigo-50
               text-xs font-medium text-indigo-700
               hover:bg-indigo-100 hover:text-indigo-900
               focus:outline-none focus:ring-2 focus:ring-indigo-200
               transition-colors"
        title="Copier le lien de partage">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" class="w-3.5 h-3.5">
    <path d="M11 3H17V9M10 10L16.5 3.5M5 5H4C3.44772 5 3 5.44772 3 6V16C3 16.5523 3.44772 17 4 17H14C14.5523 17 15 16.5523 15 16V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

        Lien de partage
    </button>
      </div>
      </div>
    </div>
    
  </div>
</template>

<script setup lang="ts">
import { provide, watch } from 'vue'
import { useRoute } from 'vue-router'

// Components
import AppHeader from '../components/common/AppHeader.vue'
import Notification from '../components/common/Notification.vue'
import ItineraryForm from '../components/itinerary/ItineraryForm.vue'
import CalculationSettings from '../components/settings/CalculationSettings.vue'
import MapPreview from '../components/results/MapPreview.vue'
import Summary from '../components/results/Summary.vue'

// Composables & Utils
import { useCalculator } from '../composables/useCalculator'
import { parseCalculatorState } from '../utils/sharing'

const props = defineProps<{ mode: string }>()
const route = useRoute()



// Initialisation du calculateur et injection globale
const sharedState = parseCalculatorState(window.location.search)
const routeCalcParam = route.params.calculationMode
const routeCalculationMode = ['bareme', 'reels'].includes(routeCalcParam as string)
  ? (routeCalcParam as 'bareme' | 'reels')
  : null

const calculator = useCalculator(props.mode, sharedState, routeCalculationMode)
provide('calculator', calculator)

// Extraction unique du nécessaire pour le template
const { inputMode, resetData, shareTrip } = calculator
inputMode.value = props.mode

// Gestion des modes de calcul via la route (simplifiée)
const applyRouteCalculationMode = (mode: unknown) => {
  if (mode === 'bareme' || mode === 'reels') {
    calculator.calcMode.value = mode
    // Le chargement du carburant est maintenant géré directement dans CalculationSettings via le watch sur calcMode
  }
}

applyRouteCalculationMode(route.params.calculationMode)

// Watchers
watch(
  () => props.mode,
  (newMode) => {
    inputMode.value = newMode
  },
  { immediate: true }
)

watch(() => route.params.calculationMode, applyRouteCalculationMode)
</script>