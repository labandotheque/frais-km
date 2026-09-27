<template>
<div v-if="inputMode === 'cities'" class="space-y-2.5">

    <div v-for="(wp, index) in waypoints"
         :key="index"
         draggable="true"
         @dragstart="onDragStart(index, $event)"
         @dragover.prevent="onDragOver(index, $event)"
         @drop="onDrop(index)"
         @dragend="onDragEnd"
         class="relative flex items-center gap-2 transition-all"
         :class="{'opacity-40': draggedIndex === index}">

        <span class="absolute left-3 w-5 h-5 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-[9px] z-10 pointer-events-none">
            {{ String.fromCharCode(65 + index) }}
        </span>

        <input type="text"
               v-model="wp.query"
               @input="searchLocation(index)"
               @keydown.down.prevent="navigateSuggestions(index, 1)"
               @keydown.up.prevent="navigateSuggestions(index, -1)"
               @keydown.enter.prevent="handleWaypointEnter(index)"
               @keydown.esc="handleFieldEscape(wp)"
               @blur="handleFieldBlur(wp)"
               :placeholder="index === 0 ? 'Départ (ex: Paris)' : (index === waypoints.length - 1 ? 'Arrivée (ex: Lyon)' : 'Étape intermédiaire')"
               autocomplete="off"
               class="w-full pl-10 pr-20 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm transition">

        <ul v-if="wp.suggestions.length > 0"
            class="absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-56 overflow-y-auto top-full">

            <li v-for="(item, sIdx) in wp.suggestions"
                @mousedown.prevent="selectLocation(index, item)"
                @mouseenter="wp.selectedIndex = sIdx"
                :class="sIdx === wp.selectedIndex ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50'"
                class="px-3 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-b-0 flex items-start gap-2">

                <span class="shrink-0 leading-5">{{ addressTypeIcon(item) }}</span>

                <span class="min-w-0">
                    <span class="block truncate font-medium">{{ formatAddressMain(item) }}</span>
                    <span v-if="formatAddressSecondary(item)"
                          class="block truncate text-xs text-slate-400">
                        {{ formatAddressSecondary(item) }}
                    </span>
                </span>
            </li>
        </ul>

        <div class="absolute right-2 flex items-center gap-1">
            <button v-if="waypoints.length > 2 && index > 0 && index < waypoints.length - 1"
                    @click="removeWaypoint(index)"
                    class="text-slate-300 hover:text-red-500 p-1 transition"
                    title="Supprimer l'étape">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
            </button>

            <div class="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1"
                 title="Glisser pour réorganiser">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M4 8h16M4 16h16"/>
                </svg>
            </div>
        </div>
    </div>

    <button @click="addWaypoint"
            class="w-full border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-500 hover:text-indigo-600 font-medium py-2 rounded-lg transition text-xs">
        + Ajouter une étape intermédiaire
    </button>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'
import WaypointItem from './WaypointItem.vue'

const { waypoints, addWaypoint } = inject('calculator') as any
</script>
