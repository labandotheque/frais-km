import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import VillesEtapesView from './views/VillesEtapesView.vue'
import KmDirectsView from './views/KmDirectsView.vue'
import CovoiturageView from './views/CovoiturageView.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'villes-etapes', component: VillesEtapesView },
  { path: '/km', name: 'km', component: KmDirectsView },
  { path: '/covoiturage', name: 'covoiturage', component: CovoiturageView },
  {
    path: '/:calculationMode(bareme|reels)',
    redirect: to => ({ name: 'villes-etapes', query: { ...to.query, mode: to.params.calculationMode, calculationMode: undefined } })
  },
  {
    path: '/km/:calculationMode(bareme|reels)',
    redirect: to => ({ name: 'km', query: { ...to.query, mode: to.params.calculationMode, calculationMode: undefined } })
  },
  {
    path: '/covoiturage/:calculationMode(bareme|reels)',
    redirect: to => ({ name: 'covoiturage', query: { ...to.query, mode: to.params.calculationMode, calculationMode: undefined } })
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

export default router