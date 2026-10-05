<template>
<div class="relative z-10 border border-slate-200 rounded-lg overflow-visible">

    <div class="px-3.5 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    03
                </span>
                <h3 class="text-xs font-semibold text-slate-900">
                    Points de rendez-vous & Équipages
                </h3>
            </div>
            <p class="text-[10px] text-slate-400 mt-1 ml-8">
                Gestion des conducteurs et passagers.
            </p>
        </div>

        <div class="flex items-center gap-2">
            <button @click="autoDetectMeetingPoints"
                    title="Propose des points de rendez-vous à partir des domiciles et de la destination"
                    class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-3 py-2 rounded-md shadow-sm transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                </svg>
                Suggestion automatique
            </button>

            <button @click="addMeetingPoint"
                    class="text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 px-2.5 py-2 rounded-md transition">
                + Ajouter
            </button>
        </div>
    </div>

    <!-- État vide -->
    <div v-if="meetingPoints.length === 0"
         class="py-7 text-center">
        <p class="text-xs text-slate-400">
            Aucun arrêt intermédiaire.
        </p>
        <button @click="addMeetingPoint"
                class="mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Créer un point de rendez-vous
        </button>
    </div>

    <!-- Liste -->
    <div v-else class="p-2.5 space-y-2.5">

        <div v-for="(mp, mIdx) in meetingPoints"
             :key="mIdx"
             class="bg-slate-50/70 rounded-lg border border-slate-200 p-3 space-y-3">

            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-slate-900 text-white text-[9px] font-semibold flex items-center justify-center">
                        {{ mIdx + 1 }}
                    </span>
                    <span class="text-xs font-semibold text-slate-800">
                        Arrêt #{{ mIdx + 1 }}
                    </span>
                </div>

                <button @click="removeMeetingPoint(mIdx)"
                        class="text-[10px] text-slate-400 hover:text-red-600 transition">
                    Supprimer
                </button>
            </div>

            <!-- Adresse -->
            <div class="relative">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-white flex items-center justify-center z-10 pointer-events-none transition-colors"
                      :class="isValidated(mp) ? 'bg-emerald-600' : 'bg-emerald-400'">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                </span>

                <input type="text"
                       :value="mp.query"
                       @input="onMeetingPointInput(mp, mIdx, $event)"
                       @keydown.down.prevent="navigateMeetingPoint(mIdx, 1)"
                       @keydown.up.prevent="navigateMeetingPoint(mIdx, -1)"
                       @keydown.enter.prevent="handleMeetingPointEnter(mIdx)"
                       @keydown.esc="handleFieldEscape(mp)"
                       @blur="handleMeetingPointBlur(mIdx)"
                       placeholder="Adresse du point de rendez-vous..."
                       autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
                       class="w-full pl-9 pr-2.5 py-2 rounded-md bg-white border text-xs focus:outline-none focus:border-indigo-400 transition"
                       :class="isValidated(mp) ? 'border-indigo-300' : 'border-slate-200'">

                <ul v-if="mp.suggestions.length > 0"
                    class="absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">

                    <li v-for="(item, sIdx) in mp.suggestions"
                        :key="sIdx"
                        @mousedown.prevent="selectMeetingPoint(mIdx, item)"
                        @mouseenter="mp.selectedIndex = sIdx"
                        :class="sIdx === mp.selectedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'"
                        class="px-3 py-2 text-xs cursor-pointer border-b border-slate-100 last:border-b-0">

                        <span class="block truncate font-medium text-slate-800">
                            {{ formatAddressMain(item) }}
                        </span>

                        <span v-if="formatAddressSecondary(item)"
                              class="block truncate text-[10px] text-slate-400">
                            {{ formatAddressSecondary(item) }}
                        </span>
                    </li>
                </ul>
            </div>

            <!-- Conducteur / Passagers -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">

                <!-- Conducteur -->
                <div class="space-y-1.5">
                    <span class="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                        Conducteur
                    </span>

                    <div v-if="mp.selectedDriver"
                         class="flex items-center justify-between bg-white border border-slate-200 px-2.5 py-2 rounded-md text-xs">

                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full"
                                  :style="{ backgroundColor: getParticipantColorByName(mp.selectedDriver) }"></span>
                            <span class="font-semibold text-slate-900">
                                {{ mp.selectedDriver }}
                            </span>
                        </div>

                        <button @click="mp.selectedDriver = null; debouncedRunVisualCarpool(true)"
                                class="text-[10px] text-slate-400 hover:text-slate-700">
                            Changer
                        </button>
                    </div>

                    <select v-else
                            @change="setDriver(mIdx, $event.target.value); $event.target.value=''"
                            class="w-full px-2.5 py-2 rounded-md border border-slate-200 bg-white text-xs text-slate-600 focus:outline-none focus:border-slate-400">

                        <option value="">Désigner un conducteur...</option>

                        <template v-for="p in participants" :key="p.id">
                            <option :value="p.name">{{ p.name }}</option>
                        </template>
                    </select>

                    <div v-if="mIdx > 0 && getPassengersFromPreviousSteps(mIdx).length > 0"
                         class="pt-1">

                        <span class="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                            Déjà à bord
                        </span>

                        <div class="flex flex-wrap gap-1 mt-1">
                            <span v-for="pName in getPassengersFromPreviousSteps(mIdx)"
                                  :key="pName"
                                  class="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md text-[10px] text-slate-600">

                                <span class="w-1.5 h-1.5 rounded-full"
                                      :style="{ backgroundColor: getParticipantColorByName(pName) }"></span>

                                {{ pName }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Passagers -->
                <div class="space-y-1.5">
                    <span class="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                        Passagers à cet arrêt
                    </span>

                    <div class="flex flex-wrap gap-1 items-center min-h-[34px] bg-white border border-slate-200 p-1.5 rounded-md">

                        <span v-for="pName in getPassengersBoardingHere(mIdx)"
                              :key="pName"
                              class="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[10px] text-slate-700">

                            <span class="w-1.5 h-1.5 rounded-full"
                                  :style="{ backgroundColor: getParticipantColorByName(pName) }"></span>

                            <span>{{ pName }}</span>

                            <button @click="removeParticipantFromMp(mIdx, pName)"
                                    class="text-slate-400 hover:text-red-500">
                                ×
                            </button>
                        </span>

                        <span v-if="getPassengersBoardingHere(mIdx).length === 0"
                              class="text-[10px] text-slate-400 italic px-1">
                            Aucun passager
                        </span>
                    </div>

                    <div class="flex gap-1">
                        <select v-model="selectedParticipantToAdd[mIdx]"
                                class="flex-1 px-2 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 focus:outline-none">

                            <option :value="null">Ajouter un passager...</option>

                            <template v-for="p in participants" :key="p.id">
                                <option v-if="p.name !== mp.selectedDriver" :value="p.name">
                                    {{ p.name }}
                                </option>
                            </template>
                        </select>

                        <button @click="addParticipantToMp(mIdx)"
                                :disabled="!selectedParticipantToAdd[mIdx]"
                                class="w-7 rounded-md bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs transition">
                            +
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'

const calculator = inject('calculator') as any
const { 
    meetingPoints, 
    participants, 
    selectedParticipantToAdd,
    searchMeetingPoint, 
    selectMeetingPoint, 
    handleMeetingPointEnter, 
    navigateMeetingPoint, 
    removeMeetingPoint, 
    addMeetingPoint, 
    autoDetectMeetingPoints,
    getParticipantColor, 
    getParticipantColorByName, 
    addParticipantToMp, 
    removeParticipantFromMp, 
    setDriver, 
    debouncedRunVisualCarpool,
    getPassengersFromPreviousSteps,
    getPassengersBoardingHere,
    handleMeetingPointBlur,
    handleFieldEscape,
    formatAddress,
    formatAddressMain,
    formatAddressSecondary
} = calculator

const isValidated = (mp: any) => !!mp.coords && !mp.edited

// :value + @input (pas v-model) : v-model ignore les événements pendant la composition du clavier mobile
function onMeetingPointInput(mp: any, mIdx: number, e: Event) {
    mp.query = (e.target as HTMLInputElement).value
    searchMeetingPoint(mIdx)
}
</script>