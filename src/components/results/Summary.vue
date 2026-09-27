<template>
<div class="bg-slate-900 text-white rounded-xl p-5 space-y-4">

    <!-- En-tête -->
    <div class="flex justify-between items-center border-b border-slate-800 pb-3">

        <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Synthèse
            </h3>
        </div>

        <div class="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-lg">

            <button @click="isRoundTrip = false"
                    :class="!isRoundTrip
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'"
                    class="px-2.5 py-1.5 rounded-md text-[10px] font-medium transition">
                Aller simple
            </button>

            <button @click="isRoundTrip = true"
                    :class="isRoundTrip
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'"
                    class="px-2.5 py-1.5 rounded-md text-[10px] font-medium transition">
                Aller-retour
            </button>

        </div>

    </div>


    <!-- ========================================================= -->
    <!-- Résultat classique -->
    <!-- ========================================================= -->

    <div v-if="inputMode !== 'carpool'" class="space-y-3">

        <!-- Distance totale -->
        <div class="flex justify-between items-center text-xs border-b border-slate-800 pb-2.5">

            <span class="text-slate-300">
                Distance totale
            </span>

            <span class="font-semibold text-slate-100">
                {{ totalDistanceKm }} km
            </span>

        </div>


        <!-- ===================================================== -->
        <!-- Base du calcul -->
        <!-- ===================================================== -->

        <div v-if="totalDistanceAmount> 0" class="border-b border-slate-800 pb-2.5">



            <!-- ================================================= -->
            <!-- BARÈME KILOMÉTRIQUE -->
            <!-- ================================================= -->

            <div v-if="calcMode === 'bareme'"
                 class="flex items-center justify-between gap-3">

                <div class="flex items-center gap-2 min-w-0">


                    <span class="text-[11px] text-slate-400">
                        Barème kilométrique
                    </span>

                </div>

                <span class="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                    {{ Number(baremeRate).toFixed(2) }} €/km
                </span>

            </div>


            <!-- ================================================= -->
            <!-- FRAIS RÉELS -->
            <!-- ================================================= -->

            <div v-else-if="calcMode === 'reels'"
                 class="space-y-1">

                <!-- Prix carburant -->
                <div class="flex items-center justify-between gap-3">

                    <div class="flex items-center gap-2 min-w-0">


                        <span class="text-[11px] text-slate-400">
                            Prix du carburant
                        </span>

                    </div>

                    <span class="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                        {{ Number(fuelPrice).toFixed(2) }} €/L
                    </span>

                </div>


                <!-- Consommation -->
                <div class="flex items-center justify-between gap-3">

                    <div class="flex items-center gap-2 min-w-0">


                        <span class="text-[11px] text-slate-400">
                            Consommation
                        </span>

                    </div>

                    <span class="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                        {{ Number(fuelConsumption).toFixed(1) }} L/100 km
                    </span>

                </div>

            </div>


            <!-- ================================================= -->
            <!-- Sécurité si autre mode -->
            <!-- ================================================= -->

            <div v-else
                 class="flex items-center justify-between gap-3">

                <div class="flex items-center gap-2 min-w-0">

                    <span class="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>

                    <span class="text-[11px] text-slate-400">
                        Mode de calcul
                    </span>

                </div>

                <span class="text-[11px] font-medium text-slate-300">
                    {{ calcMode }}
                </span>

            </div>

        </div>


        <div v-if="totalDistanceAmount> 0"
             class="flex justify-between items-center text-xs border-b border-slate-800 pb-2.5">

            <span class="text-slate-300">
                Total carburant
            </span>

            <span class="font-semibold text-indigo-300">
                {{ Number(totalDistanceAmount).toFixed(2) }} €
            </span>

        </div>

        <!-- ===================================================== -->
        <!-- Frais de péage -->
        <!-- ===================================================== -->

        <div v-if="globalToll > 0"
             class="flex justify-between items-center text-xs border-b border-slate-800 pb-2.5">

            <span class="text-slate-300">
                Frais de péage
            </span>

            <span class="font-semibold text-indigo-300">
                + {{ Number(globalToll).toFixed(2) }} €
            </span>

        </div>


        <!-- ===================================================== -->
        <!-- Total -->
        <!-- ===================================================== -->

        <div class="flex justify-between items-end pt-1">

            <div>

                <span class="text-[9px] text-slate-500 uppercase tracking-wider block">
                    Total estimé
                </span>

                <span class="text-3xl font-bold tracking-tight text-white">
                    {{ finalAmount.toFixed(2) }} €
                </span>

            </div>

        </div>

    </div>


    <!-- ========================================================= -->
    <!-- Résultat covoiturage -->
    <!-- ========================================================= -->

<CarpoolResults v-if="inputMode === 'carpool'" />

</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'
import CarpoolResults from './CarpoolResults.vue'

const {
    inputMode,
    isRoundTrip,
    calcMode,
    baremeRate,
    fuelPrice,
    fuelConsumption,
    globalToll,
    totalDistanceKm,
    totalDistanceAmount,
    finalAmount,
    visualCarpoolResults
} = inject('calculator') as any
</script>
