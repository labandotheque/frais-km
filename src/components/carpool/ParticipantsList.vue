<template>
<div class="relative z-10 rounded-lg border border-slate-200 overflow-visible">

    <div class="px-3.5 py-3  flex items-center justify-between">
        <div>
            <span class="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                Participants
            </span>
            <span class="text-[10px] text-slate-400">
                Domiciles et paramètres
            </span>
        </div>

        <button @click="addParticipant"
                class="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition">
            + Ajouter
        </button>
    </div>

    <div class="p-2.5 space-y-2">
        <div v-for="(p, idx) in participants"
             :key="p.id"
             class="bg-white rounded-lg flex items-center gap-2">

            <input type="text"
                   v-model="p.name"
                   placeholder="Nom"
                   class="w-24 px-2 py-1.5 rounded-md border border-slate-200 text-xs font-semibold focus:border-indigo-400 focus:outline-none">

            <div class="relative flex-1">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-white font-semibold flex items-center justify-center text-[9px] z-10 pointer-events-none transition-opacity"
                      :class="isValidated(p) ? 'opacity-100' : 'opacity-60'"
                      :style="{ backgroundColor: getParticipantColor(p.id) }">{{ initials(p.name) }}</span>

                <input type="text"
                       :value="p.query"
                       @input="onParticipantInput(p, idx, $event)"
                       @keydown.down.prevent="navigateParticipant(idx, 1)"
                       @keydown.up.prevent="navigateParticipant(idx, -1)"
                       @keydown.enter.prevent="handleParticipantEnter(idx)"
                       @keydown.esc="handleFieldEscape(p)"
                       @blur="handleParticipantBlur(idx)"
                       placeholder="Adresse du domicile"
                       autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
                       class="w-full pl-9 pr-2.5 py-1.5 rounded-md bg-white border text-xs focus:outline-none focus:border-indigo-400 transition"
                       :class="isValidated(p) ? 'border-indigo-300' : 'border-slate-200'">

                <ul v-if="p.suggestions.length > 0"
                    class="absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-56 overflow-y-auto">

                    <li v-for="(item, sIdx) in p.suggestions"
                        @mousedown.prevent="selectParticipant(idx, item)"
                        @mouseenter="p.selectedIndex = sIdx"
                        :class="sIdx === p.selectedIndex ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50'"
                        class="px-3 py-2 text-xs cursor-pointer border-b border-slate-100 last:border-b-0 flex items-start gap-2">

                        <span>{{ addressTypeIcon(item) }}</span>

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

            <button v-if="participants.length > 1"
                    @click="removeParticipant(idx)"
                    class="text-slate-300 hover:text-red-500 p-1 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    </div>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'

const calculator = inject('calculator') as any
const { 
    participants, 
    addParticipant, 
    removeParticipant, 
    getParticipantColor, 
    searchParticipant, 
    selectParticipant, 
    handleParticipantEnter, 
    navigateParticipant, 
    handleParticipantBlur, 
    handleFieldEscape,
    formatAddress, 
    formatAddressMain, 
    formatAddressSecondary, 
    addressTypeIcon 
} = calculator

const isValidated = (p: any) => !!p.coords && !p.edited

// Mêmes initiales que sur le marqueur de la carte
const initials = (name: string) => (name || '').trim().substring(0, 2).toUpperCase() || '?'

// :value + @input (pas v-model) : v-model ignore les événements pendant la composition du clavier mobile
function onParticipantInput(p: any, idx: number, e: Event) {
    p.query = (e.target as HTMLInputElement).value
    searchParticipant(idx)
}
</script>