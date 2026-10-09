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


            <!-- Trajet façon ligne de métro : arrêts (villes) + voiture utilisée sur chaque tronçon -->
            <div v-if="res.journey" class="flex pt-1 pb-0.5">
                <div v-for="(node, i) in res.journey.nodes" :key="i" 
                     :class="[i < res.journey.nodes.length - 1 ? 'flex-1 min-w-0' : 'shrink-0 max-w-[32%]', res.journey.segments[i]?.carOf === res.name ? '' : 'opacity-50']">

                    <!-- voiture utilisée sur le tronçon qui suit -->
                    <div class="h-3 pl-3 text-[9px] leading-3 truncate"
                         :style="{ color: res.journey.segments[i] ? getParticipantColorByName(res.journey.segments[i].carOf) : 'transparent' }">
                        <template v-if="res.journey.segments[i]">
                            🚗 {{ res.journey.segments[i].carOf === res.name ? 'sa voiture' : res.journey.segments[i].carOf }}
                        </template>
                    </div>

                    <!-- station + tronçon -->
                    <div class="flex items-center h-3" >
                        <span class="relative z-10 shrink-0 rounded-full border-2 w-3 h-3"
                              :class="node.type === 'dest' ? 'bg-slate-100 border-slate-100' : (node.type === 'home' ? '' : 'bg-slate-900')"
                              :style="node.type === 'home'
                                  ? { backgroundColor: res.color, borderColor: res.color }
                                  : (node.type === 'stop' ? { borderColor: getParticipantColorByName(res.journey.segments[i].carOf) } : {})">
                        </span>
                        
                        <span v-if="res.journey.segments[i]"
                              class="flex-1 -ml-0.5 -mr-0.5 rounded-full"
                              :style="{ backgroundColor: getParticipantColorByName(res.journey.segments[i].carOf) }"
                              :class="[res.journey.segments[i]?.carOf === res.name ? 'h-1' : 'h-0.25']">
                        </span>
                    </div>

                    <!-- ville -->
                    <div class="mt-1 text-[10px] leading-tight text-slate-300 truncate"
                         :class="i === res.journey.nodes.length - 1 ? 'text-right' : ''"
                         :title="node.label">
                        {{ node.city }}
                    </div>
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
                        · {{ Number(res.liters).toFixed(1) }} L · {{ Number(res.fuelPrice).toFixed(2) }} €/L
                        <span class="text-slate-600">
                            ({{ res.consumption }} L/100km)
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