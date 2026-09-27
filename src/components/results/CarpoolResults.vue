<template>
<div class="space-y-3">

    <p class="text-[11px] text-slate-400">
        Synthèse par participant
    </p>


    <!-- Aucun résultat -->
    <div v-if="visualCarpoolResults.length === 0"
         class="text-[11px] text-slate-500 italic py-3 text-center border border-dashed border-slate-800 rounded-lg">

        Configurez vos adresses pour afficher les calculs.

    </div>


    <!-- Participants -->
    <div class="space-y-2">

        <div v-for="(res, idx) in visualCarpoolResults"
             :key="idx"
             class="bg-slate-800/60 border border-slate-700/70 rounded-lg p-3 space-y-2.5">


            <!-- Participant + montant -->
            <div class="flex justify-between items-center">

                <div class="flex items-center gap-2 min-w-0">

                    <span class="w-2.5 h-2.5 rounded-full shrink-0"
                          :style="{ backgroundColor: res.color }">
                    </span>

                    <span class="font-semibold text-slate-100 text-xs truncate">
                        {{ res.name }}
                    </span>

                    <span :class="res.role === 'driver'
                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20'
                        : (res.role === 'passenger'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                            : 'bg-slate-700 text-slate-400 border-slate-600')"
                          class="text-[9px] font-medium px-1.5 py-0.5 rounded border">

                        {{ res.role === 'driver'
                            ? 'Conducteur'
                            : (res.role === 'passenger'
                                ? 'Passager'
                                : 'Solo') }}

                    </span>

                </div>

                <span class="font-bold text-indigo-300 text-sm whitespace-nowrap">
                    {{ res.amount.toFixed(2) }} €
                </span>

            </div>


            <!-- Détail du calcul -->
            <div class="bg-slate-900/50 p-2 rounded-md border border-slate-800/80 space-y-1">

                <div v-for="(step, sIdx) in res.steps"
                     :key="sIdx"
                     class="flex items-center gap-2 text-[10px] text-slate-400">

                    <span class="w-1 h-1 rounded-full bg-indigo-400 shrink-0"></span>

                    <span class="truncate">
                        {{ step }}
                    </span>

                </div>

            </div>


            <!-- Infos participant -->
            <div class="flex flex-wrap justify-between items-center pt-1 text-[10px] text-slate-500 border-t border-slate-700/40">

                <div class="flex items-center gap-2">

                    <span class="text-slate-300 font-semibold">
                        {{ res.km }} km
                    </span>

                    <span v-if="calcMode === 'bareme'">
                        · {{ Number(baremeRate).toFixed(2) }} €/km
                    </span>

                    <span v-else-if="calcMode === 'reels'">
                        · {{ res.liters }} L · {{ Number(res.fuelPrice).toFixed(2) }} €/L
                        <span class="text-slate-600">
                            ({{ res.consoDisplay }})
                        </span>
                    </span>

                </div>


                <!-- Péage participant -->
                <div v-if="res.toll > 0"
                     class="text-indigo-300 font-medium">

                    Péage :
                    {{ res.toll.toFixed(2) }} €

                </div>

            </div>

        </div>

    </div>


    <!-- Total covoiturage -->
    <div class="pt-3 flex justify-between items-end border-t border-slate-800">

        <div>

            <span class="text-[9px] text-slate-500 uppercase tracking-wider block">
                Total global remboursé
            </span>

            <span class="text-2xl font-bold tracking-tight text-white">
                {{ totalVisualCarpoolAmount.toFixed(2) }} €
            </span>

        </div>

    </div>

</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'

const {
    visualCarpoolResults,
    totalVisualCarpoolAmount,
    getParticipantColorByName,
    calcMode,
    baremeRate,
    isRoundTrip
} = inject('calculator') as any
</script>
