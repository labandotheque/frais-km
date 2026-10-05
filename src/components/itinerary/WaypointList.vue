<template>
<div v-if="inputMode === 'cities'" class="space-y-2.5">

    <div class="relative">
        <VueDraggable v-model="waypoints"
                      handle=".drag-handle"
                      :animation="150"
                      ghost-class="opacity-40"
                      class="space-y-2.5"
                      @update="handleCalculate">
            <WaypointItem v-for="(wp, index) in waypoints"
                          :key="wp.id"
                          :index="index" />
        </VueDraggable>

        <!-- Départ ⇅ Arrivée : seulement sans étape, centré sur l'espace entre les deux champs -->
        <button v-if="waypoints.length === 2"
                type="button"
                @click="reverseWaypoints"
                class="absolute right-12 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-indigo-600 hover:border-indigo-300 active:bg-indigo-50 transition"
                title="Inverser départ et arrivée"
                aria-label="Inverser départ et arrivée">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
        </button>
    </div>

    <button @click="addWaypoint"
            class="w-full border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-500 hover:text-indigo-600 font-medium py-2 rounded-lg transition text-xs">
        + Ajouter une étape intermédiaire
    </button>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import WaypointItem from './WaypointItem.vue'

const calculator = inject('calculator') as any
const { inputMode, waypoints, addWaypoint, reverseWaypoints, handleCalculate } = calculator
</script>