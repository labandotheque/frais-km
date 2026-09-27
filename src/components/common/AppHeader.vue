<template>
  <!-- En-tête -->
  <header class="bg-white border border-slate-200/80 px-4 py-3.5 sm:px-6 sm:py-5 flex flex-row items-center justify-between gap-3">

    <!-- Titre et métadonnées -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 flex-wrap">
        <h1 class="text-sm sm:text-xl font-semibold tracking-tight text-slate-950 truncate sm:whitespace-normal">
          Calculateur de frais kilométriques
        </h1>

        <span class="inline-flex items-center h-5 px-1.5 sm:px-2 rounded-md bg-slate-50 border border-slate-200 text-[10px] sm:text-[11px] font-medium text-slate-600 shrink-0">
          Libre &amp; gratuit
        </span>
      </div>

      <div class="mt-1 flex items-center gap-x-2 text-xs text-slate-500 truncate">
        
        
        <span class="truncate hidden md:inline">A destination des musicien⋅nes</span>
        <span class="hidden sm:inline text-slate-300">•</span>
        <span class="">par <a href="https://labandotheque.fr" target="_blank" class="font-medium text-slate-600">La Bandothèque</a></span>
      </div>
    </div>

    <!-- Actions (Réinitialiser) -->
    <div class="flex items-center shrink-0">
      
      <!-- Bouton Réinitialiser -->
      <button
        @click="resetData"
        title="Réinitialiser"
        class="inline-flex items-center justify-center gap-2
               h-9 w-9 sm:w-auto sm:px-3.5 rounded-lg
               border border-slate-200 bg-white
               text-xs font-medium text-slate-600
               hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300
               focus:outline-none focus:ring-2 focus:ring-slate-200
               transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" class="w-4 h-4 text-slate-500">
          <path d="M4 10a6 6 0 1 0 2-4.47" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M4 4v3.5h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="hidden sm:inline">Réinitialiser</span>
      </button>

    </div>

  </header>
</template>

<script setup lang="ts">
import { inject } from 'vue'

const { resetData } = inject('calculator') as any
</script>