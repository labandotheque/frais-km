<template>
<div v-if="inputMode === 'carpool'" class="space-y-4">

    <!-- Destination -->
    <div class="relative z-20 ">
        <div class="flex items-center justify-between mb-1.5">
            <label class="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                Destination
            </label>
            <span class="text-[10px] text-slate-400">Spectacle</span>
        </div>

        <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] z-10 pointer-events-none transition-colors"
                  :class="destValidated ? 'bg-red-600' : 'bg-red-400'">🎯</span>

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
                   class="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white border text-sm focus:outline-none focus:ring-2 focus:border-indigo-500 focus:ring-indigo-100 transition"
                   :class="destValidated ? 'border-indigo-300' : 'border-slate-200'">
        </div>

        <ul v-if="carpoolDestination.suggestions.length > 0"
            class="absolute z-50 left-3.5 right-3.5 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-56 overflow-y-auto">

            <li v-for="(item, sIdx) in carpoolDestination.suggestions"
                @mousedown.prevent="selectCarpoolDest(item)"
                @mouseenter="carpoolDestination.selectedIndex = sIdx"
                :class="sIdx === carpoolDestination.selectedIndex ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50'"
                class="px-3 py-2 text-xs cursor-pointer border-b border-slate-100 last:border-b-0 flex items-start gap-2">

                <span class="shrink-0">{{ addressTypeIcon(item) }}</span>

                <span class="min-w-0">
                    <span class="block truncate font-medium">{{ formatAddressMain(item) }}</span>
                    <span v-if="formatAddressSecondary(item)"
                          class="block truncate text-[10px] text-slate-400">
                        {{ formatAddressSecondary(item) }}
                    </span>
                </span>
            </li>
        </ul>
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
const { inputMode, carpoolDestination, formatAddress, formatAddressMain, formatAddressSecondary, addressTypeIcon, searchCarpoolDest, selectCarpoolDest, handleCarpoolDestEnter, navigateCarpoolDest, handleCarpoolDestBlur, handleFieldEscape } = calculator

const destValidated = computed(() => !!carpoolDestination.value.coords && !carpoolDestination.value.edited)

// :value + @input (pas v-model) : v-model ignore les événements pendant la composition du clavier mobile
function onDestInput(e: Event) {
    carpoolDestination.value.query = (e.target as HTMLInputElement).value
    searchCarpoolDest()
}
</script>