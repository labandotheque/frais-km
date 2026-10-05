<template>
<div class="relative flex items-center gap-2">

    <span class="absolute left-3 w-5 h-5 rounded-full text-white font-semibold flex items-center justify-center text-[9px] z-10 pointer-events-none transition-colors"
          :class="validated ? 'bg-indigo-600' : 'bg-indigo-400'">
        {{ String.fromCharCode(65 + index) }}
    </span>

    <input type="text"
           :value="wp.query"
           @input="onInput"
           @keydown.down.prevent="navigateSuggestions(index, 1)"
           @keydown.up.prevent="navigateSuggestions(index, -1)"
           @keydown.enter.prevent="handleWaypointEnter(index)"
           @keydown.esc="handleFieldEscape(wp)"
           @blur="handleWaypointBlur(index)"
           :placeholder="index === 0 ? 'Départ (ex: Paris)' : (index === waypoints.length - 1 ? 'Arrivée (ex: Lyon)' : 'Étape intermédiaire')"
           autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
           class="w-full pl-10 pr-20 py-2.5 rounded-lg bg-white border text-sm focus:outline-none focus:ring-2 focus:border-indigo-500 focus:ring-indigo-100 transition"
           :class="validated ? 'border-indigo-300' : 'border-slate-200'">

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
        <!-- <svg class="w-3.5 h-3.5 text-emerald-500 transition duration-200"
             :class="validated ? 'opacity-100 scale-100' : 'opacity-0 scale-50'"
             fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Lieu validé" :aria-hidden="!validated">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
        </svg> -->

        <button v-if="waypoints.length > 2 && index > 0 && index < waypoints.length - 1"
                type="button"
                @click="removeWaypoint(index)"
                class="text-slate-300 hover:text-red-500 p-1 transition"
                title="Supprimer l'étape">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
        </button>

        <div class="drag-handle cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1 touch-none"
             title="Glisser pour réorganiser">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 8h16M4 16h16"/>
            </svg>
        </div>
    </div>
</div>

</template>

<script setup lang="ts">
import { inject, computed } from 'vue'

const props = defineProps<{ index: number }>()
const calculator = inject('calculator') as any
const {
    waypoints, searchLocation, selectLocation, handleWaypointEnter, handleWaypointBlur,
    navigateSuggestions, removeWaypoint, handleFieldEscape,
    formatAddressMain, formatAddressSecondary, addressTypeIcon
} = calculator

const wp = computed(() => waypoints.value[props.index])
const validated = computed(() => !!wp.value.coords)

// :value + @input (et pas v-model) : v-model ignore les événements pendant la composition
// du clavier mobile, ce qui retardait l'autocomplete jusqu'à l'espace.
function onInput(e: Event) {
    wp.value.query = (e.target as HTMLInputElement).value
    searchLocation(props.index)
}
</script>