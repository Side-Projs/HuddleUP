<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useRooms } from '@/composables/useRooms'

import EditProfile from '@/pages/EditProfile.vue'

import 'primeicons/primeicons.css'
import UserAvatar from '@/components/UserAvatar.vue'
import SortableRoomList from '@/components/SortableRoomList.vue'
import Button from 'primevue/button'

const router = useRouter()
const route = useRoute()
const { user, signOut } = useAuth()
const { createdRooms, joinedRooms, fetchCreatedRooms, fetchJoinedRooms, subscribeToRooms, unsubscribeFromRooms, moveRoom } = useRooms()

const showEditProfile = ref(false)
const showSettingsMenu = ref(false)
const settingsMenuRef = ref<HTMLElement | null>(null)

// Mobile: the sidebar becomes a slide-in drawer, closed on every navigation
const sidebarOpen = ref(false)
watch(() => route.fullPath, () => { sidebarOpen.value = false })

onMounted(async () => {
  subscribeToRooms()
  await fetchCreatedRooms()
  await fetchJoinedRooms()
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
  unsubscribeFromRooms()
})

const handleOutsideClick = (e: MouseEvent) => {
  if (settingsMenuRef.value && !settingsMenuRef.value.contains(e.target as Node)) {
    showSettingsMenu.value = false
  }
}

const handleSignOut = async () => {
  try {
    await signOut()
  } catch (e) {
    console.error('Sign out failed:', e)
  }
  router.push('/login')
}

const openEditProfile = () => {
  showSettingsMenu.value = false
  showEditProfile.value = true
}

const username = computed(() => {
  return user.value?.user_metadata?.username || user.value?.email?.split('@')[0] || 'User'
})
</script>

<template>
  <div class="main-layout" :class="{ 'sidebar-open': sidebarOpen }">
    <EditProfile v-model:visible="showEditProfile" />

    <div class="sidebar-backdrop" @click="sidebarOpen = false" />

    <aside class="sidebar" aria-label="Sidebar">
      <RouterLink to="/main/dashboard" class="sidebar-logo">
        <span class="logo-chip"><img src="/HuddleUP Logo.svg" alt="" class="logo-icon" /></span>
        <span class="logo-text">HuddleUP</span>
      </RouterLink>

      <div class="user-card">
        <UserAvatar :avatar="user?.user_metadata?.avatar" :name="username" :size="44" class="user-avatar" />
        <div class="user-info">
          <span class="user-name">{{ username }}</span>
          <span class="user-email">{{ user?.email || 'Loading...' }}</span>
        </div>
      </div>

      <div class="sidebar-scroll">
        <nav class="sidebar-nav" aria-label="Navigation">
          <p class="nav-section-label">Navigation</p>
          <RouterLink to="/main/dashboard" class="nav-item" active-class="active">
            <i class="pi pi-home" />
            <span>Dashboard</span>
          </RouterLink>
        </nav>

        <nav class="sidebar-nav" aria-label="Joined rooms">
          <p class="nav-section-label">Joined Rooms</p>
          <p v-if="!joinedRooms.length" class="nav-empty">Join a room and start huddling!</p>
          <SortableRoomList
            :rooms="joinedRooms"
            icon="pi pi-users"
            label="Joined rooms, drag to reorder"
            @move="(from, to) => moveRoom('joined', from, to)"
          />
        </nav>

        <nav class="sidebar-nav" aria-label="Created rooms">
          <p class="nav-section-label">Created Rooms</p>
          <p v-if="!createdRooms.length" class="nav-empty">Create a room and start the huddle!</p>
          <SortableRoomList
            :rooms="createdRooms"
            icon="pi pi-folder"
            label="Created rooms, drag to reorder"
            @move="(from, to) => moveRoom('created', from, to)"
          />
        </nav>
      </div>

      <div class="sidebar-bottom">
        <Button
          label="Create Room"
          class="btn-create"
          @click="router.push('/main/dashboard?action=create')"
        />
        <Button
          label="Join Room"
          class="btn-join"
          @click="router.push('/main/dashboard?action=join')"
        />
      </div>
    </aside>

    <div class="content-container">
      <header class="topbar">
        <button
          class="icon-btn menu-btn"
          aria-label="Open menu"
          :aria-expanded="sidebarOpen"
          @click="sidebarOpen = true"
        >
          <i class="pi pi-bars" />
        </button>

        <RouterLink to="/main/dashboard" class="topbar-brand">
          <img src="/HuddleUP Logo.svg" alt="" />
          <span>HuddleUP</span>
        </RouterLink>

        <div class="topbar-right" ref="settingsMenuRef">
          <button
            class="icon-btn"
            aria-label="Settings"
            aria-haspopup="menu"
            :aria-expanded="showSettingsMenu"
            @click.stop="showSettingsMenu = !showSettingsMenu"
          >
            <i class="pi pi-cog" />
          </button>

          <transition name="menu-fade">
            <div v-if="showSettingsMenu" class="settings-menu" role="menu">
              <button class="menu-item" role="menuitem" @click="openEditProfile">
                <i class="pi pi-user-edit" />
                <span>Edit Profile</span>
              </button>
              <div class="menu-divider" />
              <button class="menu-item danger" role="menuitem" @click="handleSignOut">
                <i class="pi pi-sign-out" />
                <span>Log Out</span>
              </button>
            </div>
          </transition>
        </div>
      </header>

      <main class="content-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
}

/* ── Sidebar ── */
.sidebar {
  position: sticky;
  top: 0;
  width: 280px;
  height: 100vh;
  height: 100dvh;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1rem;
  color: #ffffff;
  /* Same square dot grid as the login/signup panel */
  background:
    conic-gradient(at 3px 3px, transparent 75%, var(--hu-dot-on-blue) 0) 0 0 / 22px 22px,
    var(--hu-blue);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.25rem 0.5rem;
  text-decoration: none;
}

.logo-chip {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.6rem;
  background: #ffffff;
}

.logo-icon {
  width: 1.7rem;
  height: 1.7rem;
  object-fit: contain;
}

.logo-text {
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
}

/* User card */
.user-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.user-avatar {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7);
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name,
.user-email {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.user-email {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.8);
}

/* Nav (scrolls on its own when there are many rooms) */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 -0.25rem;
  padding: 0 0.25rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 0.75rem;
}

.nav-section-label {
  margin: 0.5rem 0.75rem 0.35rem;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.nav-empty {
  margin: 0 0.75rem 0.25rem;
  font-size: 0.8rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.7);
}

.sidebar-nav :deep(.nav-item) {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s ease;
}

.sidebar-nav :deep(.nav-item span) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sidebar-nav :deep(.nav-item:hover) {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.sidebar-nav :deep(.nav-item:focus-visible) {
  outline: 2px solid #ffffff;
  outline-offset: -2px;
}

.sidebar-nav :deep(.nav-item.active) {
  background: rgba(255, 255, 255, 0.24);
  color: #ffffff;
  font-weight: 700;
}

.sidebar-nav :deep(.nav-item i) {
  font-size: 0.9rem;
  flex-shrink: 0;
}

/* Bottom buttons */
.sidebar-bottom {
  display: flex;
  gap: 0.5rem;
}

.btn-create.p-button,
.btn-join.p-button {
  flex: 1;
  padding: 0.6rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 700;
  border-radius: 999px;
}

.btn-create.p-button {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.45);
  color: #ffffff;
}

.btn-create.p-button:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.24);
  border-color: #ffffff;
  color: #ffffff;
}

.btn-join.p-button {
  background: var(--hu-green);
  border: 1px solid var(--hu-green);
  color: #ffffff;
}

.btn-join.p-button:not(:disabled):hover {
  background: var(--hu-green-700);
  border-color: var(--hu-green-700);
  color: #ffffff;
}

/* ── Content ── */
.content-container {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--hu-bg);
}

.content-main {
  flex: 1;
}

/* ── Topbar ── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--hu-border);
}

.topbar-right {
  position: relative;
  margin-left: auto;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--hu-border);
  background: #ffffff;
  color: var(--hu-text-muted);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.icon-btn:hover {
  background: var(--hu-blue-soft);
  color: var(--hu-blue);
}

.menu-btn,
.topbar-brand {
  display: none;
}

.topbar-brand {
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--hu-text);
  text-decoration: none;
}

.topbar-brand img {
  width: 1.75rem;
  height: 1.75rem;
}

/* Dropdown menu */
.settings-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 170px;
  padding: 0.4rem;
  background: #ffffff;
  border: 1px solid var(--hu-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover {
  background: var(--hu-blue-soft);
  color: var(--hu-blue);
}

.menu-item.danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

.menu-divider {
  height: 1px;
  margin: 0.3rem 0;
  background: var(--hu-border);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.sidebar-backdrop {
  display: none;
}

/* ── Tablet & phone: sidebar becomes a drawer ── */
@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    left: 0;
    z-index: 60;
    width: min(300px, 85vw);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.2);
  }

  .sidebar-open .sidebar {
    transform: none;
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(15, 23, 42, 0.45);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }

  .sidebar-open .sidebar-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .menu-btn {
    display: grid;
  }

  .topbar-brand {
    display: flex;
  }

  .topbar {
    padding: 0.6rem 1rem;
  }
}
</style>
