<template>
<!-- Notification -->
<div  class="max-w-6xl px-4 z-100 w-full mx-auto relative">

    <div v-if="notification.show" class=" fixed -translate-x-1/2 bottom-4 left-1/2  bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-between text-sm">
        <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>{{ notification.message }}</span>
        </div>
        <button @click="notification.show = false"
        class="text-slate-400 hover:text-white px-1 transition">✕</button>
    </div>
</div>

</template>

<script setup lang="ts">
import { inject } from 'vue'

const { notification } = inject('calculator') as any
</script>
