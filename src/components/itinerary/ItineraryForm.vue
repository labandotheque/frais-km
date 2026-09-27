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
                {{ String.fromCharCode(65 + Number(index)) }}
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
                <button v-if="waypoints.length > 2 && Number(index) > 0 && Number(index) < waypoints.length - 1"
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
    <div v-if="inputMode === 'carpool'" class="space-y-4">

        <!-- Destination -->
        <div class="relative z-20 bg-slate-50 rounded-lg border border-slate-200 p-3.5">
            <div class="flex items-center justify-between mb-1.5">
                <label class="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Destination
                </label>
                <span class="text-[10px] text-slate-400">Spectacle</span>
            </div>

            <input type="text"
                   v-model="carpoolDestination.query"
                   @input="searchCarpoolDest"
                   @keydown.down.prevent="navigateCarpoolDest(1)"
                   @keydown.up.prevent="navigateCarpoolDest(-1)"
                   @keydown.enter.prevent="handleCarpoolDestEnter"
                   @keydown.esc="handleFieldEscape(carpoolDestination)"
                   @blur="handleFieldBlur(carpoolDestination)"
                   placeholder="Ex : Zénith de Nantes"
                   autocomplete="off"
                   class="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none">

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
        <div class="relative z-10 rounded-lg border border-slate-200 overflow-visible">

            <div class="px-3.5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
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
                     class="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center gap-2">

                    <span class="w-2.5 h-2.5 rounded-full shrink-0"
                          :style="{ backgroundColor: getParticipantColor(p.id) }"></span>

                    <input type="text"
                           v-model="p.name"
                           placeholder="Nom"
                           class="w-24 px-2 py-1.5 rounded-md border border-slate-200 text-xs font-semibold focus:border-indigo-400 focus:outline-none">

                    <div class="relative flex-1">
                        <input type="text"
                               v-model="p.query"
                               @input="searchParticipant(idx)"
                               @keydown.down.prevent="navigateParticipant(idx, 1)"
                               @keydown.up.prevent="navigateParticipant(idx, -1)"
                               @keydown.enter.prevent="handleParticipantEnter(idx)"
                               @keydown.esc="handleFieldEscape(p)"
                               @blur="handleFieldBlur(p)"
                               placeholder="Adresse du domicile"
                               autocomplete="off"
                               class="w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-xs focus:border-indigo-400 focus:outline-none">

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

        <!-- Points de rendez-vous -->
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

                <div class="flex items-center gap-1.5">
                    <button @click="autoDetectMeetingPoints"
                            class="text-[11px] font-medium text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition">
                        Suggestion automatique
                    </button>

                    <button @click="addMeetingPoint"
                            class="text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-md transition">
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
                                {{ Number(mIdx) + 1 }}
                            </span>
                            <span class="text-xs font-semibold text-slate-800">
                                Arrêt #{{ Number(mIdx) + 1 }}
                            </span>
                        </div>

                        <button @click="removeMeetingPoint(mIdx)"
                                class="text-[10px] text-slate-400 hover:text-red-600 transition">
                            Supprimer
                        </button>
                    </div>

                    <!-- Adresse -->
                    <div class="relative">
                        <input type="text"
                               v-model="mp.query"
                               @input="searchMeetingPoint(mIdx)"
                               @keydown.down.prevent="navigateMeetingPoint(mIdx, 1)"
                               @keydown.up.prevent="navigateMeetingPoint(mIdx, -1)"
                               @keydown.enter.prevent="handleMeetingPointEnter(mIdx)"
                               @keydown.esc="handleFieldEscape(mp)"
                               @blur="handleFieldBlur(mp)"
                               placeholder="Adresse du point de rendez-vous..."
                               autocomplete="off"
                               class="w-full px-2.5 py-2 rounded-md border border-slate-200 bg-white text-xs focus:border-indigo-400 focus:outline-none">

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
                                    @change="setDriverFromEvent(mIdx, $event)"
                                    class="w-full px-2.5 py-2 rounded-md border border-slate-200 bg-white text-xs text-slate-600 focus:outline-none focus:border-slate-400">

                                <option value="">Désigner un conducteur...</option>

                                <template v-for="p in participants" :key="p.id">
                                    <option :value="p.name">{{ p.name }}</option>
                                </template>
                            </select>

                            <div v-if="Number(mIdx) > 0 && getPassengersFromPreviousSteps(mIdx).length > 0"
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

    </div>

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

const calculator = inject('calculator') as any
const router = useRouter()
const { inputMode } = calculator

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
    waypoints, manualKm, isRoundTrip, globalToll, carpoolDestination, participants, meetingPoints,
    visualCarpoolResults, calcMode, fuelPrice, fuelConsumption, baremeRate, loading, error, selectedParticipantToAdd, draggedIndex,
    showFuelModal, toggleFuelModal, fetchFuelFromApi, selectedFuelType, debouncedRunVisualCarpool,
    formatAddress, formatAddressMain, formatAddressSecondary, addressTypeIcon,
    addWaypoint, removeWaypoint, addParticipant, removeParticipant, addMeetingPoint, removeMeetingPoint,
    searchLocation, selectLocation, handleWaypointEnter, navigateSuggestions,
    searchCarpoolDest, selectCarpoolDest, handleCarpoolDestEnter, navigateCarpoolDest,
    searchParticipant, selectParticipant, handleParticipantEnter, navigateParticipant,
    searchMeetingPoint, selectMeetingPoint, handleMeetingPointEnter, navigateMeetingPoint,
    handleFieldBlur, handleFieldEscape, onDragStart, onDragOver, onDrop, onDragEnd,
    getParticipantsAtMp, addParticipantToMp, removeParticipantFromMp, setDriver, autoDetectMeetingPoints,
    getParticipantColor, getParticipantColorByName, resetData,
    totalDistanceKm, totalDistanceAmount, finalAmount, totalVisualCarpoolAmount, getPassengersFromPreviousSteps, getPassengersBoardingHere
} = calculator

const setDriverFromEvent = (index: string | number, event: Event) => {
    const target = event.target as HTMLSelectElement
    setDriver(Number(index), target.value)
    target.value = ''
}
</script>
