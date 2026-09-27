<template>
<div v-if="inputMode === 'carpool'"
     class="space-y-2.5 pt-3 border-t border-slate-100">

    <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
        Paramètres individuels
    </label>

    <div v-for="(p, idx) in participants"
         :key="'ref-'+p.id"
         class="bg-slate-50 rounded-lg border border-slate-200 p-2.5 flex items-center gap-3 text-xs">

        <div class="flex items-center gap-1.5 w-12 lg:w-24 shrink-0">
            <span class="w-2 h-2 rounded-full shrink-0"
                  :style="{ backgroundColor: getParticipantColor(p.id) }"></span>

            <span class="font-semibold text-slate-700 truncate">
                {{ p.name || ('Pers ' + (Number(idx) + 1)) }}
            </span>
        </div>

        <div class="grid grid-cols-3 gap-2 flex-1">

            <div>
                <span class="block text-[9px] text-slate-400 uppercase font-semibold mb-1">
                    Péage
                </span>
                <input type="number"
                       step="0.01"
                       v-model.number="p.toll"
                       class="w-full px-2 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:border-indigo-400 focus:outline-none"
                       placeholder="0">
            </div>

            <div v-if="calcMode === 'reels'">
                <span class="block text-[9px] text-slate-400 uppercase font-semibold mb-1">
                    Conso
                </span>
                <input type="number"
                       step="0.1"
                       v-model.number="p.consumption"
                       class="w-full px-2 py-1.5 rounded-md border border-slate-200 text-xs bg-white focus:border-indigo-400 focus:outline-none">
            </div>

            <div v-if="calcMode === 'reels'">
                <span class="block text-[9px] text-slate-400 uppercase font-semibold mb-1">
                    Litre
                </span>
                <FuelPricePicker v-model="p.fuelPrice"
                                 :fuel-type="p.fuelType || 'gazole'"
                                 compact
                                 @fetch="fetchParticipantFuel(p, $event)" />
            </div>

        </div>
    </div>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'
import FuelPricePicker from '../common/FuelPricePicker.vue'

const calculator = inject('calculator') as any
const { inputMode, calcMode, participants, getParticipantColor, fetchParticipantFuelPrice } = calculator

const fetchParticipantFuel = async (participant: any, fuelType: string) => {
    await fetchParticipantFuelPrice(participant, fuelType)
}
</script>
