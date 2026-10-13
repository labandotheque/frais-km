<template>
<div v-if="inputMode === 'carpool'"
     class="space-y-2.5 pt-3 border-t border-slate-100">

    <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
        Paramètres individuels
    </label>

    <div class=" rounded-xl border border-slate-200 bg-slate-50">
        <table class="w-full text-left border-collapse text-xs">
            <thead>
                <tr class="border-b border-slate-200 text-[9px] text-slate-400 uppercase font-semibold bg-slate-100/70">
                    <th class="py-2 px-3">Participant</th>
                    <th class="py-2 px-3">Péage</th>
                    <template v-if="calcMode === 'reels'">
                        <th class="py-2 px-3">Conso</th>
                        <th class="py-2 px-3">Litre</th>
                    </template>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
                <tr v-for="(p, idx) in participants"
                    :key="'ref-'+p.id"
                    class="hover:bg-white/60 transition">

                    <!-- Participant -->
                    <td class="py-2 px-3">
                        <div class="flex items-center gap-1.5">
                            <span class="w-6 h-6 rounded-full text-white text-[10px] font-semibold flex items-center justify-center shrink-0"
                                  :style="{ backgroundColor: getParticipantColor(p.id) }">
                                {{ initials(p.name) }}
                            </span>
                            <span class="font-semibold text-slate-700 truncate max-w-[110px] lg:max-w-none">
                                {{ p.name || ('Pers ' + (Number(idx) + 1)) }}
                            </span>
                        </div>
                    </td>

                    <!-- Péage -->
                    <td class="py-2 px-3">
                        <input type="number"
                               step="0.01"
                               v-model.number="p.toll"
                               class="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition"
                               placeholder="0">
                    </td>

                    <!-- Conso (si mode reels) -->
                    <td v-if="calcMode === 'reels'" class="py-2 px-3">
                        <input type="number"
                               step="0.1"
                               v-model.number="p.consumption"
                               class="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition"
                               placeholder="0">
                    </td>

                    <!-- Litre / FuelPricePicker (si mode reels) -->
                    <td v-if="calcMode === 'reels'" class="py-2 px-3">
                        <FuelPricePicker v-model="p.fuelPrice"
                                         :fuel-type="p.fuelType || 'gazole'"
                                         compact
                                         @fetch="fetchParticipantFuel(p, $event)" />
                    </td>

                </tr>
            </tbody>
        </table>
    </div>

</div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import FuelPricePicker from '../common/FuelPricePicker.vue'

const calculator = inject('calculator') as any
const { inputMode, calcMode, participants, getParticipantColor, fetchParticipantFuelPrice } = calculator

// Mêmes initiales que sur la carte et dans les arrêts
const initials = (name: string) => (name || '').trim().substring(0, 2).toUpperCase() || '?'

const fetchParticipantFuel = async (participant: any, fuelType: string) => {
    await fetchParticipantFuelPrice(participant, fuelType)
}
</script>