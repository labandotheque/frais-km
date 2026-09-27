<template>
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

</template>

<script setup lang="ts">
import { inject } from 'vue'

const calculator = inject('calculator') as any
const { participants, meetingPoints, draggedIndex, onDragStart, onDragOver, onDrop, onDragEnd, removeParticipant, getParticipantColor, getParticipantColorByName } = calculator
</script>
