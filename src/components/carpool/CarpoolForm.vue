<template>
<div v-if="inputMode === 'carpool'" class="space-y-4">

    <!-- Destination -->
    <div class="relative z-30 bg-white border border-slate-200 rounded-2xl px-4 sm:px-5 py-4">
        <div class="mb-3">
            <h3 class="text-sm font-semibold text-slate-900">Destination</h3>
            <p class="text-xs text-slate-500">Où tout le monde se retrouve</p>
        </div>

        <div class="relative">
            <span class="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-white flex items-center justify-center text-[11px] z-10 pointer-events-none transition-opacity"
                  :class="destValidated ? 'bg-red-600 opacity-100' : 'bg-red-600 opacity-60'">🎯</span>

            <input type="text"
                   :value="carpoolDestination.query"
                   @input="onDestInput"
                   @keydown.down.prevent="navigateCarpoolDest(1)"
                   @keydown.up.prevent="navigateCarpoolDest(-1)"
                   @keydown.enter.prevent="handleCarpoolDestEnter"
                   @keydown.esc="handleFieldEscape(carpoolDestination)"
                   @blur="handleCarpoolDestBlur"
                   placeholder="Ex : Zénith de Nantes"
                   autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
                   class="w-full h-10 pl-10 pr-3 rounded-xl border text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition"
                   :class="destValidated ? 'bg-white border-indigo-200' : 'bg-slate-50 border-slate-200'">

            <ul v-if="carpoolDestination.suggestions.length > 0"
                class="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1">
                <li v-for="(item, sIdx) in carpoolDestination.suggestions" :key="sIdx"
                    @mousedown.prevent="selectCarpoolDest(item)"
                    @mouseenter="carpoolDestination.selectedIndex = sIdx"
                    :class="sIdx === carpoolDestination.selectedIndex ? 'bg-slate-100' : ''"
                    class="px-3 py-2 text-sm cursor-pointer">
                    <span class="block truncate text-slate-800">{{ formatAddressMain(item) }}</span>
                    <span v-if="formatAddressSecondary(item)" class="block truncate text-[11px] text-slate-400">{{ formatAddressSecondary(item) }}</span>
                </li>
            </ul>
        </div>
    </div>

    <!-- Participants -->
    <ParticipantsList />

    <!-- Points de rendez-vous -->
    <MeetingPoints />

</div>

</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import ParticipantsList from './ParticipantsList.vue'
import MeetingPoints from './MeetingPoints.vue'

const calculator = inject('calculator') as any
const { inputMode, carpoolDestination, formatAddressMain, formatAddressSecondary, searchCarpoolDest, selectCarpoolDest, handleCarpoolDestEnter, navigateCarpoolDest, handleCarpoolDestBlur, handleFieldEscape } = calculator

const destValidated = computed(() => !!carpoolDestination.value.coords && !carpoolDestination.value.edited)

// :value + @input (pas v-model) : v-model ignore les événements pendant la composition du clavier mobile
function onDestInput(e: Event) {
    carpoolDestination.value.query = (e.target as HTMLInputElement).value
    searchCarpoolDest()
}
</script>
