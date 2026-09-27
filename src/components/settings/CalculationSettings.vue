<template>
<div class="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">

                    <h2 class="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        </svg>
                        2. Mode de calcul
                    </h2>

                    <div class="grid grid-cols-2 gap-2">
                        <button @click="setCalculationMode('bareme')"
                                :class="calcMode === 'bareme'
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
                                class="p-3 rounded-lg border text-left transition">

                            <span class="font-semibold text-xs">
                                Barème kilométrique
                            </span>
                        </button>

                        <button @click="setCalculationMode('reels')"
                                :class="calcMode === 'reels'
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
                                class="p-3 rounded-lg border text-left transition">

                            <span class="font-semibold text-xs">
                                Frais réels
                            </span>
                        </button>
                    </div>

                    <div v-if="calcMode === 'bareme'">
                        <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Taux du barème · € / km
                        </label>

                        <div class="relative">
                        <input type="number"
                               step="0.01"
                               v-model.number="baremeRate"
                               class="w-full px-3 pr-6 py-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-400 focus:outline-none">

                               <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                €
                            </span>
                        </div>
                    </div>

                    <div v-if="calcMode === 'reels' && inputMode !== 'carpool'"
                         class="grid grid-cols-2 gap-2">

                        <div>
                            <div>
    <!-- Label classique au-dessus -->
    <div class="flex items-center justify-between mb-1.5">
        <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Prix du litre
        </label>
    </div>

    <FuelPricePicker v-model="fuelPrice"
                     :fuel-type="selectedFuelType"
                     @fetch="fetchFuelFromApi" />
</div>

                        </div>

                        <div>
                            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Consommation
                            </label>

                            <input type="number"
                                   step="0.1"
                                   v-model.number="fuelConsumption"
                                   class="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-400 focus:outline-none">
                        </div>
                    </div>

                    <div v-if="inputMode !== 'carpool'"
                         class="pt-3 border-t border-slate-100">

                        <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Frais de péage
                        </label>

                        <div class="relative">
                            <input type="number"
                                   step="0.01"
                                   v-model.number="calculator.globalToll"
                                   min="0"
                                   placeholder="0.00"
                                   class="w-full px-3 pr-6 py-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-400 focus:outline-none">

                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                €
                            </span>
                        </div>
                    </div>

<ParticipantParameters />
                </div>

</template>

<script setup lang="ts">
import { inject, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ParticipantParameters from '../carpool/ParticipantParameters.vue'
import FuelPricePicker from '../common/FuelPricePicker.vue'

const route = useRoute()
const router = useRouter()
const calculator = inject('calculator') as any
const { 
    calcMode, 
    fuelPrice, 
    fuelConsumption, 
    baremeRate, 
    fetchFuelFromApi, 
    selectedFuelType, 
    inputMode,
    ensureFuelPrice // <-- Récupération de la méthode
} = calculator

const setCalculationMode = (mode: string) => {
    router.replace({
        name: route.name as string,
        params: { ...route.params, calculationMode: mode }
    })
}

// Déclenchement automatique de ensureFuelPrice dès que le mode change pour 'reels'
watch(calcMode, (newMode) => {
    if (newMode === 'reels') {
        console.log("coucouc")
        ensureFuelPrice()
    }
}, { immediate: true }) // immediate: true gère aussi l'état initial au chargement
</script>