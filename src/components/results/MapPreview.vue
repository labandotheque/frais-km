<template>
<div class="bg-white rounded-none border-0 p-3.5 md:rounded-xl md:border md:border-slate-200/80">
    <div class="flex items-center justify-between mb-2.5">
        <h3 class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Aperçu des trajets
        </h3>
        <span class="text-[9px] text-slate-400">
            OpenStreetMap
        </span>
    </div>

    <div id="map"
         class="w-full h-64 rounded-lg overflow-hidden z-10 bg-slate-100">
    </div>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'

const { loading, error } = inject('calculator') as any
</script>
