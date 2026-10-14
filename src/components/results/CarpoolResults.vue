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
             :key="res.id ?? idx"
             class="bg-slate-800/60 border border-slate-700/70 rounded-lg p-3 space-y-2.5">


            <!-- Participant + montant -->
            <div class="flex justify-between items-center">

                <div class="flex items-center gap-2 min-w-0">

                    <span class="w-5 h-5 rounded-full shrink-0 text-white text-[9px] font-semibold flex items-center justify-center"
                          :style="{ backgroundColor: res.color }">{{ initials(res.name) }}</span>

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


            <!-- Trajet façon ligne de métro.
                 Gros point coloré = départ, ou endroit où l'on laisse sa voiture (début / fin de SON trajet) ;
                 point cerclé = sa voiture continue ; petit point = passager dans la voiture d'un autre.
                 La voiture n'est nommée qu'une fois tant que c'est la même. -->
            <div v-if="res.journey" class="flex pt-1 pb-0.5">
                <div v-for="(node, i) in res.journey.nodes" :key="i"
                     :class="i < res.journey.nodes.length - 1 ? 'flex-1 min-w-0' : 'shrink-0 max-w-[32%]'">

                    <!-- voiture utilisée à partir d'ici (seulement quand elle change) -->
                    <div class="h-3 pl-3 text-[9px] leading-3 truncate flex items-center gap-0.5"
                         :class="isMine(res, i) ? '' : 'opacity-70'"
                         :style="{ color: res.journey.segments[i] ? carColor(res.journey.segments[i].carOf) : 'transparent' }"
                         :title="showCar(res, i) ? carText(res, i) : ''">
                        <template v-if="showCar(res, i)">
                            <svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 14l1.6-5A2 2 0 017.5 7.5h9a2 2 0 011.9 1.5L20 14v4h-3v-2H7v2H4v-4z"/>
                            </svg>
                            <span class="truncate">{{ carText(res, i) }}</span>
                        </template>
                    </div>

                    <!-- station + tronçon -->
                    <div class="flex items-center h-3.5">
                        <span :class="dotClass(res, i)" :style="dotStyle(res, i)"
                              :title="nodeKind(res, i) === 'park' && node.type === 'stop' ? 'Laisse sa voiture ici' : ''"></span>

                        <span v-if="res.journey.segments[i]"
                              class="flex-1 -ml-0.5 -mr-0.5 rounded-full"
                              :style="{ backgroundColor: carColor(res.journey.segments[i].carOf) }"
                              :class="isMine(res, i) ? 'h-1' : 'h-0.5 opacity-60'">
                        </span>
                    </div>

                    <!-- ville -->
                    <div class="mt-1 text-[10px] leading-tight truncate"
                         :class="[i === res.journey.nodes.length - 1 ? 'text-right' : '', cityClass(res, i)]"
                         :title="node.label">
                        {{ node.city }}
                    </div>
                </div>
            </div>


            <!-- Infos participant -->
            <div class="flex flex-wrap justify-between items-center pt-1 text-[10px] text-slate-400 border-t border-slate-700/40">

                <div class="flex items-center gap-2">

                    <span class="text-slate-300 font-semibold">
                        {{ res.km }} km
                    </span>
                    <span v-if="isRoundTrip" class="text-slate-500">A/R</span>

                    <span v-if="calcMode === 'bareme'">
                        · {{ Number(baremeRate).toFixed(2) }} €/km
                    </span>

                    <span v-else-if="calcMode === 'reels'">
                        · {{ Number(res.liters).toFixed(1) }} L · {{ Number(res.fuelPrice).toFixed(2) }} €/L
                        <span class="text-slate-500">
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
    <div class="pt-3 flex justify-between border-t border-slate-800">
        <div class="">

            <span class="text-[9px] text-slate-500 uppercase tracking-wider block">
                Total global remboursé
            </span>

            <span class="text-2xl font-bold tracking-tight text-white">
                {{ totalVisualCarpoolAmount.toFixed(2) }} €
            </span>

            <span class="block text-[10px] text-slate-400">
                Total Km : {{ totalParticipantKm.toFixed(1) }} km
            </span>

        </div>

    </div>

</div>

</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

const {
    visualCarpoolResults,
    totalVisualCarpoolAmount,
    getParticipantColorByName,
    calcMode,
    baremeRate,
    isRoundTrip
} = inject('calculator') as any

const initials = (name: string) => (name || '').trim().substring(0, 2).toUpperCase() || '?'
const carColor = (label: string) => getParticipantColorByName(label)

// ───────── Lecture du trajet d'une personne
const isMine = (res: any, i: number) => res.journey.segments[i]?.carOf === res.name

// la voiture n'est nommée qu'au début d'une suite de tronçons dans la même voiture
const showCar = (res: any, i: number) => {
    const segs = res.journey.segments
    return !!segs[i] && (i === 0 || segs[i - 1].carOf !== segs[i].carOf)
}
const carText = (res: any, i: number) => (isMine(res, i) ? 'sa voiture' : res.journey.segments[i].carOf)

// home  : départ
// park  : laisse sa voiture ici (arrêt) ou arrive avec sa voiture (destination) -> fin de SON trajet
// drive : sa voiture continue (elle prend ou dépose des gens)
// ride  : passager dans la voiture d'un autre
// arrive: arrivée dans la voiture d'un autre
type Kind = 'home' | 'park' | 'drive' | 'ride' | 'arrive'
function nodeKind(res: any, i: number): Kind {
    const node = res.journey.nodes[i]
    const segs = res.journey.segments
    const prevMine = i > 0 && segs[i - 1]?.carOf === res.name
    const nextMine = segs[i]?.carOf === res.name
    if (node.type === 'home') return 'home'
    if (node.type === 'dest') return prevMine ? 'park' : 'arrive'
    if (prevMine && !nextMine) return 'park'
    if (nextMine) return 'drive'
    return 'ride'
}

const dotClass = (res: any, i: number) => {
    const base = 'relative z-10 shrink-0 rounded-full'
    return {
        home: `${base} w-3 h-3 border-2`,
        park: `${base} w-3.5 h-3.5 border-2 border-slate-100`,
        drive: `${base} w-3 h-3 border-2 bg-slate-900`,
        ride: `${base} w-2 h-2 border`,
        arrive: `${base} w-3 h-3 border-2 bg-slate-100 border-slate-100`
    }[nodeKind(res, i)]
}
const dotStyle = (res: any, i: number) => {
    const kind = nodeKind(res, i)
    const nextCar = res.journey.segments[i]?.carOf
    if (kind === 'home') return { backgroundColor: res.color, borderColor: res.color }
    if (kind === 'park') return { backgroundColor: res.color }
    if (kind === 'drive') return { borderColor: res.color }
    if (kind === 'ride') return { backgroundColor: carColor(nextCar), borderColor: carColor(nextCar), opacity: 0.8 }
    return {}
}
const cityClass = (res: any, i: number) => ({
    home: 'text-slate-200',
    park: 'font-semibold text-slate-200',
    drive: 'text-slate-400',
    ride: 'text-slate-400',
    arrive: 'text-slate-400'
}[nodeKind(res, i)])

const totalParticipantKm = computed(() =>
    visualCarpoolResults.value.reduce((total: number, participant: any) => total + Number(participant.km || 0), 0)
)
</script>