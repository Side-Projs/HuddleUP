import { createRouter, createWebHistory } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { supabase } from '../../utils/supabase.ts'
import MainLayout from '@/layouts/MainLayout.vue'



const routes = [
  // Public landing page. Listed before the auth layout so it wins the '/' match.
  { path: '/', component: () => import('../pages/LandingPage.vue'), meta: { guestOnly: true } },
  {
    path: '/',
    component: AuthLayout,        // ← layout wraps the children
    children: [
      {
        path: 'login',
        component: () => import('../pages/LoginPage.vue'),
        meta: { guestOnly: true, illustration: '/login.png', illustrationAlt: 'Team collaborating around a table' }
      },
      {
        path: 'signup',
        component: () => import('../pages/SignupPage.vue'),
        meta: { guestOnly: true, illustration: '/signup.png', illustrationAlt: 'Team sharing a creative idea' }
      },
    ]
  },
  {
    path: '/main',
    component: MainLayout,
    meta: { requiresAuth: true }, 
    children: [
      { path: '', redirect: '/main/dashboard' },
      { path: 'dashboard', component: () => import('../pages/DashboardPage.vue'), meta: { requiresAuth: true }},
      { path: 'rooms/:roomCode', component: () => import('../pages/RoomPage.vue'), meta: { requiresAuth: true }}
    ]
  },

  // Any unknown URL used to render a blank page; send it home instead
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()

  if (to.meta.requiresAuth && !session) {
    next('/login')
  } else if (to.meta.guestOnly && session) {
    next('/main') // logged-in users skip the landing, login and signup pages
  } else {
    next()
  }
})


export default router
