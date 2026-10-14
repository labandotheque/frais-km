<template>
<div class="relative z-10 bg-white border border-slate-200 rounded-2xl text-slate-800" @click="menu = null">

    <!-- En-tête : titre + choix du mode sur une seule ligne (les arrêts sont conservés d'un mode à l'autre) -->
    <div class="px-4 sm:px-5 pt-4 pb-2.5">
        <h3 class="text-sm font-semibold text-slate-900">Trajets</h3>
    </div>

    <div class="px-4 sm:px-5 pb-3">
        <div class="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl" role="radiogroup" aria-label="Mode de trajet">
            <button v-for="t in modeTabs" :key="t.id" type="button" role="radio"
                    :aria-checked="tripMode === t.id" @click.stop="setTripMode(t.id)"
                    class="rounded-lg px-3 py-2 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                    :class="tripMode === t.id ? 'bg-white shadow-sm' : 'hover:bg-slate-50/60'">
                <span class="block text-[11px] font-medium" :class="tripMode === t.id ? 'text-indigo-600' : 'text-slate-500'">{{ t.label }}</span>
                <span class="block tabular-nums leading-snug">
                    <span class="text-sm font-bold" :class="tripMode === t.id ? 'text-slate-900' : 'text-slate-600'">{{ totalLabel(t.id) }}</span>
                    <span class="text-[11px] text-slate-400"> · {{ kmLabel(t.id) }}</span>
                </span>
            </button>
        </div>
        <p v-if="deltaLine" class="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 5v14m0 0l-6-6m6 6l6-6"/></svg>
            {{ deltaLine }}
        </p>
    </div>

    <!-- Arrêts : une seule ligne fine, titre à gauche, actions à droite (covoiturage uniquement) -->
    <div v-if="tripMode === 'carpool'" class="px-4 sm:px-5 pb-2 flex items-center justify-between gap-2">
        <div class="min-w-0 flex items-center gap-1.5">
            <h4 class="text-sm font-semibold text-slate-900">Arrêts</h4>
            <button type="button" @click.stop="showLegend = !showLegend" :aria-expanded="showLegend" aria-label="Afficher la légende"
                    class="w-5 h-5 rounded-full border text-[10px] font-bold leading-none transition"
                    :class="showLegend ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'">?</button>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" @click.stop="onSuggest"
                    :disabled="suggesting || !!suggestHint"
                    :title="suggestHint || 'Propose des points de rendez-vous'"
                    class="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition">
                <svg v-if="suggesting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" class="opacity-25"/>
                    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                {{ suggesting ? 'Calcul…' : 'Suggérer' }}
            </button>
            <button type="button" @click.stop="addMeetingPoint"
                    class="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition">
                + Arrêt
            </button>
        </div>
    </div>

    <!-- Légende des ronds (à la demande) -->
    <div v-if="tripMode === 'carpool' && showLegend" class="mx-4 sm:mx-5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded-full bg-slate-400 ring-2 ring-offset-1 ring-slate-900"></span>voiture qui repart (son essence)</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded-full bg-slate-400"></span>à bord</span>
        <span class="inline-flex items-center gap-1.5"><span class="relative w-4 h-4 rounded-full bg-slate-400"><span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white ring-1 ring-slate-300"><span class="absolute inset-0 m-auto w-1 h-px bg-emerald-600"></span><span class="absolute inset-0 m-auto h-1 w-px bg-emerald-600"></span></span></span>monte ici</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded-full border-2 border-dashed border-slate-400"></span>peut monter</span>
        <span class="inline-flex items-center gap-1.5"><span class="w-4 h-4 rounded-full bg-slate-400 opacity-40"></span>dans une autre voiture</span>
    </div>

    <!-- Scénario impossible (anciennes données, suppression d'une personne...) -->
    <div v-if="tripMode === 'carpool' && sim.issues.length > 0" class="mx-4 sm:mx-5 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
        <p class="font-semibold">Ce scénario est impossible</p>
        <ul class="mt-1 space-y-0.5">
            <li v-for="(issue, i) in sim.issues" :key="i">Arrêt {{ issue.stop + 1 }} : {{ issue.message }}</li>
        </ul>
        <button type="button" @click.stop="onFix" class="mt-1.5 font-semibold underline underline-offset-2 hover:text-red-900">Corriger automatiquement</button>
    </div>

    <!-- Ce que l'application a ajusté suite au dernier changement -->
    <div v-if="notice.length > 0" class="mx-4 sm:mx-5 mb-2 flex items-start justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
        <p>{{ notice.join(' ') }}</p>
        <button type="button" @click.stop="notice = []" class="shrink-0 w-5 h-5 -my-0.5 rounded-full text-slate-400 hover:text-slate-700" aria-label="Fermer">✕</button>
    </div>

    <p v-if="tripMode === 'carpool' && suggestHint && !suggesting && participants.length > 0"
       class="mx-4 sm:mx-5 mb-2 text-[11px] text-amber-700">
        {{ suggestHint }}
    </p>

    <div v-if="participants.length === 0" class="px-5 pb-8 pt-4 text-center text-xs text-slate-500">
        Ajoutez des participants pour voir leurs trajets.
    </div>

    <!-- ───────── Graphe (même rail en covoiturage et en solo : en solo, chacun va droit à l'arrivée) ───────── -->
    <div v-else class="px-4 sm:px-5 pb-5">

        <!-- Départs -->
        <div class="flex gap-3">
            <div class="relative shrink-0" :style="{ width: railWidth + 'px', minHeight: '60px' }">
                <template v-for="(p, i) in participants" :key="p.id">
                    <span class="absolute"
                          :style="{ top: '22px', bottom: startBottom(i) + 'px', left: laneX(i) - 1.5 + 'px', width: '3px', backgroundColor: color(p) }"></span>
                    <span class="absolute top-[12px] w-2.5 h-2.5 rounded-full ring-2 ring-white"
                          :style="{ left: laneX(i) - 5 + 'px', backgroundColor: color(p) }"></span>
                </template>
            </div>
            <!-- Covoiturage : puces des départs (nom · ville) -->
            <div v-if="tripMode !== 'solo'" class="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
                <span v-for="p in participants" :key="p.id" class="inline-flex items-center gap-1.5 min-w-0 max-w-full text-[11px] text-slate-500"
                      :title="p.query || undefined">
                    <span class="w-4 h-4 rounded-full text-white text-[8px] font-semibold flex items-center justify-center shrink-0"
                          :style="{ backgroundColor: color(p) }">{{ initials(p.name) }}</span>
                    <span class="shrink-0">{{ p.name }}</span>
                    <span v-if="originOf(p)" class="min-w-0 max-w-[9rem] truncate text-slate-400">· {{ originOf(p) }}</span>
                </span>
            </div>

            <!-- Solo : un trajet direct par personne, la longueur de la barre = les km (comparaison immédiate) -->
            <ul v-else class="flex-1 min-w-0 space-y-3 pt-0.5 pb-2">
                <li v-for="row in soloRows" :key="row.p.id" :title="row.p.query || undefined">
                    <div class="flex items-center gap-2 text-xs">
                        <span class="w-5 h-5 rounded-full text-white text-[9px] font-semibold flex items-center justify-center shrink-0"
                              :style="{ backgroundColor: color(row.p) }">{{ initials(row.p.name) }}</span>
                        <span class="min-w-0 flex-1 truncate">
                            <span class="font-semibold text-slate-800">{{ row.p.name }}</span><span v-if="originOf(row.p)" class="text-slate-400"> · depuis {{ originOf(row.p) }}</span>
                        </span>
                        <span class="shrink-0 tabular-nums font-semibold text-slate-700">{{ row.label }}</span>
                    </div>
                    <div class="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                        <div class="h-full rounded-full transition-[width] duration-300" :style="{ width: row.pct + '%', backgroundColor: color(row.p) }"></div>
                    </div>
                </li>
            </ul>
        </div>

        <!-- Aucun arrêt (ou mode solo) : chacun roule seul -->
        <div v-if="rows.length === 0" class="flex gap-3">
            <div class="relative shrink-0" :style="{ width: railWidth + 'px' }">
                <span v-for="(p, i) in participants" :key="p.id" class="absolute top-0"
                      :style="{ bottom: PRE + 'px', left: laneX(i) - 1.5 + 'px', width: '3px', backgroundColor: color(p) }"></span>
            </div>
            <div class="flex-1 min-w-0 pb-6 pt-1">
                <p v-if="tripMode === 'solo'" class="text-[11px] text-slate-400">
                    Trajet direct jusqu'à la destination
                    <template v-if="meetingPoints.length === 1"> · votre arrêt est conservé</template>
                    <template v-else-if="meetingPoints.length > 1"> · vos {{ meetingPoints.length }} arrêts sont conservés</template>
                    · <button type="button" @click.stop="setTripMode('carpool')" class="font-semibold text-indigo-600 hover:text-indigo-800">Voir en covoiturage</button>
                </p>
                <div v-else class="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
                    Personne ne partage la route : chacun roule seul.
                    <button type="button" @click.stop="addMeetingPoint" class="font-semibold text-indigo-600 hover:text-indigo-800">Ajouter un arrêt</button>
                </div>
            </div>
        </div>

        <!-- Arrêts -->
        <div v-for="row in rows" :key="row.key" class="flex gap-3">

            <!-- Rail -->
            <div class="relative shrink-0" :style="{ width: railWidth + 'px' }">
                <template v-for="lane in row.lanes" :key="lane.p.id">
                    <template v-if="lane.state === 'active'">
                        <span class="absolute top-0"
                              :style="{ height: NODE_Y + 'px', left: laneX(lane.i) - lane.widthTop / 2 + 'px', width: lane.widthTop + 'px', backgroundColor: color(lane.p) }"></span>
                        <span class="absolute"
                              :style="{ top: NODE_Y + 'px', bottom: lane.bottom + 'px', left: laneX(lane.i) - lane.widthBottom / 2 + 'px', width: lane.widthBottom + 'px', backgroundColor: color(lane.p) }"></span>
                    </template>
                </template>

                <svg class="absolute left-0 pointer-events-none overflow-visible"
                     :style="{ top: -PRE + 'px' }"
                     :width="railWidth" :height="PRE + NODE_Y * 2" :viewBox="`0 0 ${railWidth} ${PRE + NODE_Y * 2}`" aria-hidden="true">
                    <!-- fusions : la voie du passager rejoint celle du conducteur -->
                    <template v-for="lane in row.lanes" :key="lane.p.id">
                        <path v-if="lane.state === 'merge'"
                              :d="mergePath(lane.i, lane.merge.to)"
                              :stroke="color(lane.p)" stroke-width="3" stroke-linecap="round" fill="none"/>
                    </template>
                    <!-- nœud -->
                    <circle :cx="row.nodeX" :cy="PRE + NODE_Y" r="11"
                            :fill="row.driverIdx >= 0 ? color(participants[row.driverIdx]) : '#ffffff'"
                            :stroke="row.invalid ? '#ef4444' : (row.driverIdx >= 0 ? '#ffffff' : '#cbd5e1')"
                            :stroke-width="row.invalid ? 3 : (row.driverIdx >= 0 ? 3 : 2)"
                            :stroke-dasharray="row.driverIdx >= 0 || row.invalid ? '' : '3 3'"/>
                    <text :x="row.nodeX" :y="PRE + NODE_Y + 4" text-anchor="middle" font-size="11" font-weight="700"
                          :fill="row.driverIdx >= 0 ? '#ffffff' : '#94a3b8'">{{ row.r + 1 }}</text>
                </svg>
            </div>

            <!-- Contenu -->
            <div class="flex-1 min-w-0 pb-5">
                <div class="flex items-center gap-1.5">
                    <div class="relative flex-1 min-w-0">
                        <!-- Champ composé : ville | adresse (la ville se lit juste à côté du rond numéroté du rail) -->
                        <div class="flex items-center h-10 rounded-xl border transition focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100"
                             :class="isValidated(row.mp) ? 'bg-white border-indigo-200' : 'bg-slate-50 border-slate-200'">
                            <template v-if="row.city && isValidated(row.mp)">
                                <span class="pl-3 pr-2.5 max-w-[42%] shrink-0 truncate text-[13px] font-semibold text-slate-700" :title="row.city">{{ row.city }}</span>
                                <span class="w-px h-5 bg-slate-200 shrink-0" aria-hidden="true"></span>
                            </template>
                            <input type="text"
                                   :value="row.mp.query" :title="row.mp.query"
                                   @input="onMeetingPointInput(row.mp, row.r, $event)"
                                   @keydown.down.prevent="navigateMeetingPoint(row.r, 1)"
                                   @keydown.up.prevent="navigateMeetingPoint(row.r, -1)"
                                   @keydown.enter.prevent="handleMeetingPointEnter(row.r)"
                                   @keydown.esc="handleFieldEscape(row.mp)"
                                   @blur="handleMeetingPointBlur(row.r)"
                                   placeholder="Adresse du rendez-vous"
                                   autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
                                   class="flex-1 min-w-0 h-full pr-3 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none truncate"
                                   :class="row.city && isValidated(row.mp) ? 'pl-2.5' : 'pl-3'">
                        </div>

                        <ul v-if="row.mp.suggestions.length > 0"
                            class="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
                            <li v-for="(item, sIdx) in row.mp.suggestions" :key="sIdx"
                                @mousedown.prevent="selectMeetingPoint(row.r, item)"
                                @mouseenter="row.mp.selectedIndex = sIdx"
                                :class="sIdx === row.mp.selectedIndex ? 'bg-slate-100' : ''"
                                class="px-3 py-2 text-sm cursor-pointer">
                                <span class="block truncate text-slate-800">{{ formatAddressMain(item) }}</span>
                                <span v-if="formatAddressSecondary(item)" class="block truncate text-[11px] text-slate-400">{{ formatAddressSecondary(item) }}</span>
                            </li>
                        </ul>
                    </div>

                    <button type="button" @click.stop="removeStop(row.r)"
                            class="shrink-0 w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition"
                            :aria-label="`Supprimer l'arrêt ${row.r + 1}`">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </div>

                <!-- Équipage : ceux qui sont dans la voiture (dans un « habitacle »), puis ceux qui ont encore le choix -->
                <div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <template v-for="(g, gi) in row.groups" :key="g.id">
                    <span v-if="gi > 0" class="w-px h-5 bg-slate-200" aria-hidden="true"></span>
                    <div :class="groupClass(g)" :style="groupStyle(row, g)">
                        <svg v-if="g.id === 'car'" class="w-4 h-4 shrink-0" :style="{ color: color(participants[row.driverIdx]) }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 14l1.6-5A2 2 0 017.5 7.5h9a2 2 0 011.9 1.5L20 14v4h-3v-2H7v2H4v-4z"/>
                        </svg>

                        <div v-for="m in g.people" :key="m.p.id" class="relative">
                            <button type="button"
                                    @click.stop="toggleMenu(row.r, m.p.id)"
                                    :disabled="m.role === 'aboard'"
                                    :aria-label="`${m.p.name}${originSuffix(m.p)} — ${roleText(m)}`"
                                    :title="`${m.p.name}${originSuffix(m.p)} — ${roleText(m)}`"
                                    class="relative w-7 h-7 rounded-full text-[10px] font-semibold flex items-center justify-center transition disabled:cursor-default"
                                    :class="avatarClass(m)"
                                    :style="m.role === 'none' ? { borderColor: color(m.p), color: color(m.p) } : { backgroundColor: color(m.p) }">
                                {{ initials(m.p.name) }}
                                <!-- sa voiture repart d'ici -->
                                <span v-if="m.role === 'car'"
                                      class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center ring-2 ring-white">
                                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 14l1.6-5A2 2 0 017.5 7.5h9a2 2 0 011.9 1.5L20 14v4h-3v-2H7v2H4v-4z"/>
                                    </svg>
                                </span>
                                <!-- monte à bord à cet arrêt -->
                                <span v-else-if="m.role === 'passenger'"
                                      class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white text-emerald-600 flex items-center justify-center ring-1 ring-slate-300 shadow-sm" aria-hidden="true">
                                    <svg class="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="4" d="M12 5v14M5 12h14"/></svg>
                                </span>
                            </button>

                            <div v-if="menu && menu.r === row.r && menu.id === m.p.id"
                                 :class="m.flat >= 3 ? 'right-0' : 'left-0'"
                                 class="absolute top-full mt-2 z-40 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-xs" role="menu" @click.stop>
                                <p class="px-3 pt-1.5 pb-1 text-[11px] font-semibold text-slate-400 truncate">{{ m.p.name }}<template v-if="originOf(m.p)"> · {{ originOf(m.p) }}</template></p>
                                <button v-for="opt in optionsFor(row.r, m)" :key="opt.id" type="button" role="menuitemradio"
                                        :aria-checked="opt.current" :disabled="!opt.ok"
                                        @click="setRole(row.r, m.p, opt.id)"
                                        class="w-full text-left px-3 py-2 transition disabled:cursor-not-allowed"
                                        :class="opt.ok ? 'hover:bg-slate-50' : ''">
                                    <span class="flex items-center justify-between gap-2" :class="!opt.ok ? 'text-slate-300' : opt.id === 'none' ? 'text-slate-500' : 'text-slate-800'">
                                        {{ opt.label }}
                                        <svg v-if="opt.current" class="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                                    </span>
                                    <span v-if="!opt.ok && opt.reason" class="block text-[11px] text-slate-400 mt-0.5">{{ opt.reason }}</span>
                                    <span v-else-if="opt.note" class="block text-[11px] text-slate-400 mt-0.5">{{ opt.note }}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    </template>
                </div>

                <!-- Légende de l'arrêt : de qui est la voiture, combien à bord -->
                <div v-if="row.driverIdx >= 0" class="mt-1.5">
                    <button type="button" @click="toggleDetails(row.key)"
                            :aria-expanded="isOpen(row.key)" :aria-controls="`stop-details-${row.key}`"
                            class="w-full flex items-center justify-between gap-2 text-left text-[11px] text-slate-500 hover:text-slate-800 transition">
                        <span class="min-w-0">
                            Voiture de <span class="font-semibold" :style="{ color: color(participants[row.driverIdx]) }">{{ participants[row.driverIdx].name }}</span>
                            · {{ row.aboardCount }} à bord<template v-if="row.boardingCount > 0">
                            · <span class="font-semibold text-emerald-700">{{ row.boardingCount }} monte{{ row.boardingCount > 1 ? 'nt' : '' }} ici</span></template>
                        </span>
                        <span class="shrink-0 inline-flex items-center gap-1 font-semibold text-slate-500">
                            Détails
                            <svg class="w-3 h-3 text-slate-400 transition-transform" :class="isOpen(row.key) ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </span>
                    </button>

                    <!-- Dans la voiture après cet arrêt : un filet à la couleur de la voiture, sans boîte ni pastilles -->
                    <ul v-if="isOpen(row.key)" :id="`stop-details-${row.key}`"
                        class="mt-2 ml-1 pl-3 border-l-2 space-y-2"
                        :style="{ borderColor: alpha(color(participants[row.driverIdx]), 0.4) }">
                        <li v-for="d in row.details" :key="d.p.id" class="flex items-center gap-2.5">
                            <span class="w-5 h-5 rounded-full text-white text-[9px] font-semibold flex items-center justify-center shrink-0"
                                  :style="{ backgroundColor: color(d.p) }">{{ initials(d.p.name) }}</span>
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-xs text-slate-800">
                                    <span class="font-semibold">{{ d.p.name }}</span><span v-if="originOf(d.p)" class="text-slate-400"> · depuis {{ originOf(d.p) }}</span>
                                </span>
                                <span v-if="d.note" class="block truncate text-[11px] text-slate-400">{{ d.note }}</span>
                            </span>
                            <span class="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold"
                                  :class="d.role === 'car' ? 'text-slate-700' : d.role === 'passenger' ? 'text-emerald-600' : 'text-slate-400'">
                                <svg v-if="d.role === 'car'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 14l1.6-5A2 2 0 017.5 7.5h9a2 2 0 011.9 1.5L20 14v4h-3v-2H7v2H4v-4z"/></svg>
                                <svg v-else-if="d.role === 'passenger'" class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-width="4" d="M12 5v14M5 12h14"/></svg>
                                {{ d.role === 'car' ? 'Sa voiture' : d.role === 'passenger' ? 'Monte ici' : 'À bord' }}
                            </span>
                        </li>
                    </ul>
                </div>
                <p v-else class="mt-2 text-[11px] text-amber-700">Touchez une personne pour choisir la voiture qui repart d'ici.</p>
            </div>
        </div>

        <!-- Arrivée -->
        <div class="flex gap-3">
            <div class="relative shrink-0" :style="{ width: railWidth + 'px', height: '40px' }">
                <svg class="absolute left-0 pointer-events-none overflow-visible"
                     :style="{ top: -PRE + 'px' }"
                     :width="railWidth" :height="PRE + NODE_Y * 2" :viewBox="`0 0 ${railWidth} ${PRE + NODE_Y * 2}`" aria-hidden="true">
                    <path v-for="i in endLanes" :key="i"
                          :d="endPath(i)" :stroke="color(participants[i])" :stroke-width="laneWidth(i, rows.length - 1)" stroke-linecap="round" fill="none"/>
                    <circle :cx="endX" :cy="PRE + NODE_Y" r="12" fill="#dc2626" stroke="#ffffff" stroke-width="3"/>
                    <circle :cx="endX" :cy="PRE + NODE_Y" r="5.5" stroke="#ffffff" stroke-width="1.8" fill="none"/>
                    <circle :cx="endX" :cy="PRE + NODE_Y" r="1.8" fill="#ffffff"/>
                </svg>
            </div>
            <div class="flex-1 min-w-0 pt-0.5">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-red-700">Arrivée</p>
                <p class="text-sm text-slate-900 truncate">{{ carpoolDestination?.query || 'Destination à renseigner' }}</p>
            </div>
        </div>

    </div>
</div>
</template>

<script setup lang="ts">
import { inject, computed, ref, toRaw } from 'vue'

const calculator = inject('calculator') as any
const {
    meetingPoints, participants, carpoolDestination, selectedParticipantToAdd, suggestionSummary,
    searchMeetingPoint, selectMeetingPoint, handleMeetingPointEnter, handleMeetingPointBlur, navigateMeetingPoint,
    removeMeetingPoint, addMeetingPoint, autoDetectMeetingPoints,
    getParticipantColor, labelOf, simulateAll, roleOptions, changeRole, fixScenario,
    handleFieldEscape, formatAddressMain, formatAddressSecondary,
    tripMode, tripTotals, cityOf, visualCarpoolResults
} = calculator

// ───────── Géométrie du rail (en pixels : aucune déformation)
const PRE = 30          // les courbes démarrent 30 px au-dessus de la ligne de l'arrêt
const NODE_Y = 20       // hauteur du nœud dans la ligne
const n = computed(() => participants.value.length)
const laneGap = computed(() => Math.min(24, Math.max(13, Math.floor(84 / Math.max(1, n.value)))))
const railWidth = computed(() => n.value * laneGap.value + 10)
const laneX = (i: number) => 5 + laneGap.value * (i + 0.5)
const color = (p: any) => getParticipantColor(p.id)
const initials = (name: string) => (name || '').trim().substring(0, 2).toUpperCase() || '?'
// Ville du domicile (« Quimperlé »), vide si l'adresse n'est pas encore saisie
const originOf = (p: any) => {
    const c = p?.query ? cityOf(p.query) : ''
    return c && c !== '—' ? c : ''
}
const originSuffix = (p: any) => (originOf(p) ? ` · ${originOf(p)}` : '')
const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0')

// ───────── Le scénario, simulé selon les règles physiques (une voiture garée ne repart plus, etc.)
const sim = computed(() => simulateAll())
// libellés uniques utilisés par le scénario (les noms sont libres, les ids stables)
const names = computed<string[]>(() => participants.value.map((p: any) => labelOf(p)))
const idxOf = (name: string | null) => (name ? names.value.indexOf(name) : -1)

// À quel arrêt la voiture de chacun est laissée, et dans la voiture de qui il continue
type Merge = { row: number; to: number } | null
const merges = computed<Merge[]>(() =>
    names.value.map((name: string) => {
        if (tripMode.value === 'solo') return null                    // solo : les voies vont droit à l'arrivée
        const k = sim.value.parkedAt[name]
        if (k === undefined) return null
        const to = idxOf(sim.value.stops[k]?.owner)
        return to >= 0 ? { row: k, to } : null
    })
)

type LaneState = 'active' | 'merge' | 'gone'
function laneState(r: number, i: number): LaneState {
    const m = merges.value[i]
    if (!m || r < m.row) return 'active'
    return r === m.row ? 'merge' : 'gone'
}

// épaisseur de la voie = nombre de personnes dans la voiture après l'arrêt r (3 → 7,5 px)
function loadAt(i: number, r: number) {
    if (r < 0) return 0
    const snap = sim.value.carOfAfter[r]
    if (!snap) return 0
    const me = names.value[i]
    return names.value.filter((x: string) => x !== me && snap[x] === me).length
}
const laneWidth = (i: number, r: number) => 3 + Math.min(3, loadAt(i, r)) * 1.5

const mergePath = (from: number, to: number) => {
    const x1 = laneX(from), x2 = laneX(to), y2 = PRE + NODE_Y
    return `M ${x1} 0 C ${x1} ${PRE * 0.9}, ${x2} ${y2 - 24}, ${x2} ${y2}`
}

// une voie s'arrête PRE px avant la fin de la ligne si une courbe (fusion ou arrivée) prend le relais
function leavesAfter(r: number, i: number) {
    return r === meetingPoints.value.length - 1 ? !merges.value[i] : laneState(r + 1, i) === 'merge'
}
const startBottom = (i: number) =>
    meetingPoints.value.length > 0 && laneState(0, i) === 'merge' ? PRE : 0

// voies encore en route à l'arrivée
const endLanes = computed(() => participants.value.map((_: any, i: number) => i).filter((i: number) => !merges.value[i]))
const endX = computed(() => endLanes.value.length === 1 ? laneX(endLanes.value[0]) : railWidth.value / 2)
const endPath = (i: number) => {
    const x1 = laneX(i), y2 = PRE + NODE_Y
    return `M ${x1} 0 C ${x1} ${PRE * 0.9}, ${endX.value} ${y2 - 24}, ${endX.value} ${y2}`
}

// ───────── Équipage par arrêt
type Role = 'car' | 'passenger' | 'aboard' | 'away' | 'none'
function roleAtStop(r: number, name: string): { role: Role; inCarOf?: string } {
    const rec = sim.value.stops[r]
    if (!rec) return { role: 'none' }
    if (rec.owner === name) return { role: 'car' }
    if (rec.boarding.includes(name)) return { role: 'passenger' }
    if (rec.aboardBefore.includes(name)) return { role: 'aboard' }
    const c = sim.value.carOfBefore[r]?.[name]
    if (c && c !== name) return { role: 'away', inCarOf: c }
    return { role: 'none' }
}

const roleText = (m: { role: Role; inCarOf?: string }) => ({
    car: "sa voiture repart d'ici",
    passenger: 'monte à bord ici',
    aboard: 'déjà à bord',
    away: `dans la voiture de ${m.inCarOf}`,
    none: 'ne monte pas ici'
}[m.role])

const stopKeys = new WeakMap<object, number>()
let nextStopKey = 1
const stopKey = (mp: any) => {
    const raw = toRaw(mp)
    if (!stopKeys.has(raw)) stopKeys.set(raw, nextStopKey++)
    return stopKeys.get(raw) as number
}

// « Bob (Lorient) », ou seulement les noms au-delà de 2 pour ne pas surcharger la légende
const boardersText = (list: any[]) =>
    list.map(p => (list.length <= 2 && originOf(p) ? `${p.name} (${originOf(p)})` : p.name)).join(', ')

// ───────── Détails dépliables d'un arrêt
const showLegend = ref(false)
// Détails dépliés par défaut : on retient seulement ce que l'utilisateur a replié
const closedDetails = ref<Record<string | number, boolean>>({})
const isOpen = (key: string | number) => !closedDetails.value[key]
const toggleDetails = (key: string | number) => { closedDetails.value = { ...closedDetails.value, [key]: !closedDetails.value[key] } }

// Ce que fait la personne à cet arrêt, en une phrase courte
function detailNote(r: number, m: { p: any; role: Role }): string {
    const rec = sim.value.stops[r]
    const label = labelOf(m.p)
    if (!rec) return ''
    if (m.role === 'passenger') {
        if (rec.arriving.includes(label) || rec.carArriving.includes(label)) return 'laisse sa voiture ici'
        if (rec.transferring.includes(label)) {
            const from = sim.value.carOfBefore[r]?.[label]
            return from ? `descend de la voiture de ${from}` : 'change de voiture'
        }
        return ''
    }
    if (m.role === 'aboard') {
        for (let j = r - 1; j >= 0; j--) if (sim.value.stops[j]?.boarding.includes(label)) return `monté à l'arrêt ${j + 1}`
    }
    return ''
}

const rows = computed(() =>
    (tripMode.value === 'solo' ? [] : meetingPoints.value).map((mp: any, r: number) => {
        const rec = sim.value.stops[r]
        const driverIdx = rec?.owner ? idxOf(rec.owner) : -1
        // dans la voiture : le propriétaire, ceux déjà à bord, puis ceux qui montent ici
        const order: Record<Role, number> = { car: 0, aboard: 1, passenger: 2, none: 3, away: 4 }
        const people = participants.value
            .map((p: any, i: number) => ({ p, i, ...roleAtStop(r, labelOf(p)) }))
            .sort((a: any, b: any) => order[a.role as Role] - order[b.role as Role])
            .map((m: any, flat: number) => ({ ...m, flat }))
        const hasCar = driverIdx >= 0
        const groups = [
            { id: 'car', label: '', people: hasCar ? people.filter((m: any) => m.role === 'car' || m.role === 'aboard' || m.role === 'passenger') : [] },
            { id: 'free', label: hasCar ? 'Peut monter' : '', people: people.filter((m: any) => m.role === 'none' || (!hasCar && m.role === 'passenger')) },
            { id: 'away', label: 'Autre voiture', people: people.filter((m: any) => m.role === 'away') }
        ].filter(g => g.people.length > 0)
        const issue = sim.value.issues.find((x: any) => x.stop === r)
        return {
            mp, r, key: stopKey(mp), driverIdx, people, groups,
            details: hasCar
                ? people.filter((x: any) => x.role === 'car' || x.role === 'aboard' || x.role === 'passenger')
                        .map((x: any) => ({ p: x.p, role: x.role as Role, note: detailNote(r, x) }))
                : [],
            boardingCount: people.filter((x: any) => x.role === 'passenger').length,
            boardersText: boardersText(people.filter((x: any) => x.role === 'passenger').map((x: any) => x.p)),
            city: mp.query ? cityOf(mp.query) : '',
            invalid: issue ? issue.message : '',
            aboardCount: rec?.valid && rec.owner ? rec.occupantsAfter.length : people.filter((x: any) => x.role === 'car' || x.role === 'passenger' || x.role === 'aboard').length,
            nodeX: driverIdx >= 0 ? laneX(driverIdx) : railWidth.value / 2,
            lanes: participants.value.map((p: any, i: number) => ({
                p, i, state: laneState(r, i), merge: merges.value[i] as Merge,
                widthTop: laneWidth(i, r - 1), widthBottom: laneWidth(i, r),
                bottom: leavesAfter(r, i) ? PRE : 0
            }))
        }
    })
)

// Habillage des groupes et des ronds
const groupClass = (g: { id: string }) =>
    g.id === 'car' ? 'inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5' : 'inline-flex items-center gap-1.5'
const groupStyle = (row: any, g: { id: string }) =>
    g.id === 'car' && row.driverIdx >= 0
        ? { backgroundColor: alpha(color(participants.value[row.driverIdx]), 0.1), borderColor: alpha(color(participants.value[row.driverIdx]), 0.35) }
        : {}
const avatarClass = (m: { role: Role }) => ({
    car: 'text-white ring-2 ring-offset-1 ring-slate-900',
    aboard: 'text-white',
    passenger: 'text-white',
    away: 'text-white opacity-40',
    none: 'bg-white border-2 border-dashed hover:bg-slate-50'
}[m.role])

// ───────── Menu d'une personne : seuls les choix possibles sont proposés
const menu = ref<{ r: number; id: any } | null>(null)
const notice = ref<string[]>([])      // ce que l'application a ajusté pour garder un scénario possible
const toggleMenu = (r: number, id: any) => {
    menu.value = menu.value && menu.value.r === r && menu.value.id === id ? null : { r, id }
}

function optionsFor(r: number, m: { p: any; role: Role }) {
    const av = roleOptions(r, labelOf(m.p))
    const cur = m.role === 'car' ? 'car' : m.role === 'passenger' ? 'passenger' : 'none'
    return [
        { id: 'car', label: `Voiture de ${m.p.name}`, current: cur === 'car', ...av.car },
        { id: 'passenger', label: 'Monte à bord', current: cur === 'passenger', ...av.passenger },
        { id: 'none', label: 'Ne monte pas ici', current: cur === 'none', ...av.none }
    ]
}

function setRole(r: number, p: any, role: 'car' | 'passenger' | 'none') {
    menu.value = null
    notice.value = changeRole(r, labelOf(p), role)
}

function onFix() {
    notice.value = fixScenario()
}

// ───────── Mode covoiturage / solo
const modeTabs = [{ id: 'carpool', label: 'Covoiturage' }, { id: 'solo', label: 'Solo' }]
const setTripMode = (mode: 'carpool' | 'solo') => { menu.value = null; tripMode.value = mode }
const totalLabel = (mode: 'carpool' | 'solo') => {
    const v = tripTotals.value?.[mode]
    return v === null || v === undefined ? '…' : `${v.toFixed(2)} €`
}
// Solo : une ligne par personne (km + longueur de barre relative au plus long trajet)
const soloRows = computed(() => {
    const rows = participants.value.map((p: any) => {
        const res = (visualCarpoolResults.value || []).find((x: any) => x.id === p.id && x.role === 'solo')
        return { p, km: res ? Number(res.km) : null, label: res ? `${Number(res.km).toFixed(1)} km` : '…' }
    })
    const max = Math.max(1, ...rows.map(r => r.km ?? 0))
    return rows.map(r => ({ ...r, pct: r.km === null ? 0 : Math.max(4, Math.round((r.km / max) * 100)) }))
})
const kmLabel = (mode: 'carpool' | 'solo') => {
    const v = tripTotals.value?.[mode === 'carpool' ? 'carpoolKm' : 'soloKm']
    return v === null || v === undefined ? '… km' : `${Math.round(v)} km`
}
// Écart entre les deux modes : pastille verte sur la carte la moins chère
const compare = computed(() => {
    const t = tripTotals.value
    if (!t || t.carpool == null || t.solo == null) return null
    const diff = t.solo - t.carpool                          // > 0 : le covoiturage coûte moins cher
    if (Math.abs(diff) <= 0.005) return null
    const best = diff > 0 ? 'carpool' : 'solo'
    const bestKm = best === 'carpool' ? t.carpoolKm : t.soloKm
    const otherKm = best === 'carpool' ? t.soloKm : t.carpoolKm
    const otherTotal = best === 'carpool' ? t.solo : t.carpool
    return {
        best: best as 'carpool' | 'solo',
        euros: Math.abs(diff),
        pct: otherTotal > 0 ? Math.round((Math.abs(diff) / otherTotal) * 100) : null,
        km: bestKm != null && otherKm != null ? Math.round(bestKm - otherKm) : null
    }
})
// « Le covoiturage économise 92.50 € (−68 %) · −462 km » : tout l'écart en une ligne
const deltaLine = computed(() => {
    const c = compare.value
    if (!c) return ''
    const who = c.best === 'carpool' ? 'Le covoiturage économise' : 'Rouler seul économise'
    const pct = c.pct ? ` (−${c.pct} %)` : ''
    const km = c.km ? ` · ${c.km < 0 ? '−' : '+'}${Math.abs(c.km)} km` : ''
    return `${who} ${c.euros.toFixed(2)} €${pct}${km}`
})

// ───────── Adresse, suppression, suggestion
const isValidated = (mp: any) => !!mp.coords && !mp.edited

// :value + @input (pas v-model) : v-model ignore les événements pendant la composition du clavier mobile
function onMeetingPointInput(mp: any, r: number, e: Event) {
    mp.query = (e.target as HTMLInputElement).value
    searchMeetingPoint(r)
}

function removeStop(r: number) {
    removeMeetingPoint(r)
    selectedParticipantToAdd.value = {}
    menu.value = null
    notice.value = []
}

const suggesting = ref(false)
const suggestHint = computed(() => {
    const dest = carpoolDestination.value
    const hasDest = !!dest?.coords || (dest?.query || '').trim().length >= 2
    if (!hasDest) return "Renseignez d'abord la destination."
    const located = participants.value.filter((p: any) => p.coords).length
    if (located < 2) return `Il faut au moins 2 domiciles (${located}/2).`
    return ''
})

async function onSuggest() {
    if (suggesting.value || suggestHint.value) return
    suggesting.value = true
    notice.value = []
    try { await autoDetectMeetingPoints() } finally { suggesting.value = false }
}
</script>