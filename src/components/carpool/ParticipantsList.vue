<template>
<div ref="root" class="relative z-20 bg-white border border-slate-200 rounded-2xl">

    <div class="px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <div class="min-w-0">
            <h3 class="text-sm font-semibold text-slate-900">Participants</h3>
            <p class="text-xs text-slate-500">
                <template v-if="placedCount === participants.length">Tous les domiciles sont placés</template>
                <template v-else>{{ placedCount }}/{{ participants.length }} domiciles placés</template>
            </p>
        </div>

        <button type="button" @click="onAdd" :disabled="participants.length >= MAX_PARTICIPANTS"
                :title="participants.length >= MAX_PARTICIPANTS ? `${MAX_PARTICIPANTS} participants maximum` : ''"
                class="shrink-0 h-9 px-3 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition">
            + Participant
        </button>
    </div>

    <div class="px-4 sm:px-5 pb-4 space-y-2">
        <div v-for="(p, idx) in participants" :key="p.id" data-row>
            <div class="flex items-center gap-2">

                <!-- Champ composé : pastille · nom | adresse (une seule ligne, un seul cadre) -->
                <div class="relative flex-1 min-w-0">
                    <div class="flex items-center h-10 rounded-xl border transition focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100"
                         :class="isDuplicate(p) ? 'border-red-300 bg-white' : isValidated(p) ? 'bg-white border-indigo-200' : 'bg-slate-50 border-slate-200'">

                        <span class="ml-2 w-6 h-6 rounded-full text-white font-semibold flex items-center justify-center text-[10px] shrink-0 pointer-events-none transition-opacity"
                              :class="isValidated(p) ? 'opacity-100' : 'opacity-60'"
                              :style="{ backgroundColor: getParticipantColor(p.id) }">{{ initials(p.name) }}</span>

                        <input type="text"
                               v-model="p.name"
                               data-name
                               placeholder="Nom"
                               aria-label="Nom du participant"
                               @keydown.enter.prevent="focusAddress($event)"
                               class="w-[4.75rem] sm:w-28 shrink-0 h-full pl-2 pr-1 bg-transparent text-[13px] font-semibold placeholder:font-normal placeholder:text-slate-400 focus:outline-none truncate"
                               :class="isDuplicate(p) ? 'text-red-600' : 'text-slate-900'">

                        <span class="w-px h-5 bg-slate-200 shrink-0" aria-hidden="true"></span>

                        <input type="text"
                               :value="p.query"
                               data-addr
                               @input="onParticipantInput(p, idx, $event)"
                               @keydown.down.prevent="navigateParticipant(idx, 1)"
                               @keydown.up.prevent="navigateParticipant(idx, -1)"
                               @keydown.enter.prevent="handleParticipantEnter(idx)"
                               @keydown.esc="handleFieldEscape(p)"
                               @blur="handleParticipantBlur(idx)"
                               placeholder="Adresse du domicile"
                               aria-label="Adresse du domicile"
                               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
                               class="flex-1 min-w-0 h-full pl-3 pr-3 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none truncate">
                    </div>

                    <ul v-if="p.suggestions.length > 0"
                        class="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1">
                        <li v-for="(item, sIdx) in p.suggestions" :key="sIdx"
                            @mousedown.prevent="selectParticipant(idx, item)"
                            @mouseenter="p.selectedIndex = sIdx"
                            :class="sIdx === p.selectedIndex ? 'bg-slate-100' : ''"
                            class="px-3 py-2 text-sm cursor-pointer">
                            <span class="block truncate text-slate-800">{{ formatAddressMain(item) }}</span>
                            <span v-if="formatAddressSecondary(item)" class="block truncate text-[11px] text-slate-400">{{ formatAddressSecondary(item) }}</span>
                        </li>
                    </ul>
                </div>

                <button v-if="participants.length > 1" type="button"
                        @click="removeParticipant(idx)"
                        class="shrink-0 w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition"
                        :aria-label="`Supprimer ${p.name || 'ce participant'}`">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"/>
                    </svg>
                </button>
            </div>

            <p v-if="isDuplicate(p)" class="mt-1 pl-1 text-[11px] text-red-600">Ce nom est déjà utilisé : choisissez-en un autre.</p>
        </div>
    </div>
</div>

</template>

<script setup lang="ts">
import { inject, computed, ref, nextTick } from 'vue'

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
    formatAddressMain,
    formatAddressSecondary
} = calculator

const MAX_PARTICIPANTS = 12            // limite de l'optimisation exacte du covoiturage
const root = ref<HTMLElement | null>(null)

const isValidated = (p: any) => !!p.coords && !p.edited
const placedCount = computed(() => participants.value.filter(isValidated).length)

// Les noms servent d'identifiants dans le scénario : deux participants ne peuvent pas porter le même
const isDuplicate = (p: any) => {
    const name = (p.name || '').trim().toLowerCase()
    return !!name && participants.value.some((o: any) => o !== p && (o.name || '').trim().toLowerCase() === name)
}

// Mêmes initiales que sur la carte et dans les arrêts
const initials = (name: string) => (name || '').trim().substring(0, 2).toUpperCase() || '?'

// :value + @input (pas v-model) : v-model ignore les événements pendant la composition du clavier mobile
function onParticipantInput(p: any, idx: number, e: Event) {
    p.query = (e.target as HTMLInputElement).value
    searchParticipant(idx)
}

// Entrée dans le nom -> on passe à l'adresse de la même ligne
function focusAddress(e: Event) {
    const row = (e.target as HTMLElement).closest('[data-row]')
    ;(row?.querySelector('input[data-addr]') as HTMLInputElement | null)?.focus()
}

// Ajout : le nouveau participant reçoit le focus sur son nom
async function onAdd() {
    await addParticipant()
    await nextTick()
    const names = root.value?.querySelectorAll('input[data-name]')
    ;(names?.[names.length - 1] as HTMLInputElement | undefined)?.focus()
}
</script>