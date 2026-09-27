import { createRouter, createWebHistory } from 'vue-router'

import VillesEtapesView from './views/VillesEtapesView.vue'
import KmDirectsView from './views/KmDirectsView.vue'
import CovoiturageView from './views/CovoiturageView.vue'

export const routes = [
  { path: '/:calculationMode(bareme|reels)?', name: 'villes-etapes', component: VillesEtapesView },
  { path: '/km/:calculationMode(bareme|reels)?', name: 'km', component: KmDirectsView },
  { path: '/covoiturage/:calculationMode(bareme|reels)?', name: 'covoiturage', component: CovoiturageView }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

export default router