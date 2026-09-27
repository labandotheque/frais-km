<template>
    <div ref="pickerRef" class="relative" :class="isOpen ? 'z-[100]' : 'z-10'">
        <input type="number"
               step="0.01"
               :value="props.modelValue"
               @input="updatePrice"
               :class="props.compact ? 'w-full px-2 pr-0 py-1.5' : 'w-full pl-3 pr-24 py-2'"
               class="rounded-lg border border-slate-200 bg-white text-xs focus:border-indigo-400 focus:outline-none">

        <div class="absolute right-1.5 top-1/2 -translate-y-1/2 -mt-[2px]">
            <button type="button"
                    @click="isOpen = !isOpen"
                    class="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-800 mt-1"
                    title="Récupérer le prix du carburant">
                <span :class="props.compact ? 'inline lg:hidden' : ''">⛽</span><span :class="props.compact ? 'hidden lg:inline' : ''">Récupérer</span>
            </button>

            <div v-if="isOpen"
                 class="absolute right-0 top-full z-[110] mt-1 w-44 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg">
                <div class="flex items-center justify-between border-b border-slate-100 px-2 py-1 font-semibold text-slate-700">
                    <span>Type de carburant</span>
                    <button type="button"
                            @click="isOpen = false"
                            class="text-slate-400 hover:text-slate-600">
                        ✕
                    </button>
                </div>

                <button v-for="fuel in fuelTypes"
                        :key="fuel.value"
                        type="button"
                        @click="selectFuel(fuel.value)"
                        class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-indigo-50">
                    <span>{{ fuel.label }}</span>
                    <span v-if="props.fuelType === fuel.value" class="text-[10px] font-medium text-indigo-600">Actif</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
    'update:modelValue': [value: number]
    fetch: [fuelType: string]
}>()

const props = defineProps<{
    modelValue: number
    fuelType: string
    compact?: boolean
}>()

const isOpen = ref(false)
const pickerRef = ref<HTMLElement | null>(null)
const fuelTypes = [
    { value: 'gazole', label: 'Gazole (B7)' },
    { value: 'sp95', label: 'SP95' },
    { value: 'sp98', label: 'SP98' },
    { value: 'e10', label: 'SP95-E10' },
    { value: 'e85', label: 'E85' },
    { value: 'gplc', label: 'GPLc' }
]

const updatePrice = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value)
    emit('update:modelValue', value)
}

const selectFuel = (fuelType: string) => {
    isOpen.value = false
    emit('fetch', fuelType)
}

const handleOutsideClick = (event: MouseEvent) => {
    if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
        isOpen.value = false
    }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))
</script>
