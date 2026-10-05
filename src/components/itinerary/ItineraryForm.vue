<template>
<div class="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">

    <h2 class="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        1. Itinéraire ou Kilomètres
    </h2>

    <!-- Sélecteur de mode -->
    <div class="flex gap-1 border-b border-slate-100 pb-3">
        <button @click="goToMode('cities')"
                :class="inputMode === 'cities'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition">
            Itinéraire
        </button>

        <button @click="goToMode('km')"
                :class="inputMode === 'km'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition">
            Kilomètres
        </button>

        <button v-if="false" @click="goToMode('carpool')"
                :class="inputMode === 'carpool'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition">
            Covoiturage (expérimental)
        </button>
    </div>

    <!-- MODE 1 : Villes & Étapes -->
    <WaypointList />

    <!-- MODE 2 : Km directs -->
    <div v-if="inputMode === 'km'">
        <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Nombre de kilomètres · aller simple
        </label>

        <div class="relative">
            <input type="number"
                   v-model.number="manualKm"
                   min="0"
                   class="w-full pl-3 pr-12 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm">

            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                km
            </span>
        </div>
    </div>

    <!-- MODE 3 : Covoiturage -->
    <CarpoolForm v-if="inputMode === 'carpool'" />

    <!-- États -->
    <div v-if="loading"
         class="flex items-center gap-2 text-indigo-600 text-xs font-medium pt-1">
        <span class="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></span>
        Calcul en cours...
    </div>

    <p v-if="error" class="text-red-500 text-xs mt-2">
        {{ error }}
    </p>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import CarpoolForm from '../carpool/CarpoolForm.vue'
import WaypointList from './WaypointList.vue'

const calculator = inject('calculator') as any
const router = useRouter()
const { inputMode, calcMode } = calculator

const goToMode = (mode: string) => {
    const routes: Record<string, string> = {
        cities: '/',
        km: '/km',
        carpool: '/covoiturage'
    }
    const targetRoute = routes[mode] || '/'
    const routeWithCalculationMode = targetRoute === '/'
        ? `/${calcMode.value}`
        : `${targetRoute}/${calcMode.value}`
    router.push(calcMode.value ? routeWithCalculationMode : targetRoute)
}

const {
    manualKm, isRoundTrip, globalToll, loading, error
} = calculator
</script>
