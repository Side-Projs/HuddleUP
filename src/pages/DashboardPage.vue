<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRooms } from '@/composables/useRooms'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '../../utils/supabase'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import UserAvatar from '@/components/UserAvatar.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const { createdRooms, joinedRooms, fetchCreatedRooms, fetchJoinedRooms, createRoom, joinRoom, isLoading, error } = useRooms()

const { user } = useAuth()

// ── Dashboard-local task state ────────────────────────
interface DashboardTask {
  task_id: string
  title: string
  task_room_id: string
  marked_done: boolean
  /** Everyone else on this task is done; only you are left */
  waiting_on_me: boolean
}

const dashboardTasks = ref<DashboardTask[]>([])

const fetchAllMyTasks = async () => {
  if (!user.value) return

  // Also pull every teammate's check-off on each task, so we can tell when you're the last one left
  const query = (taskColumns: string) =>
    supabase.from('Assigned_To').select(`marked_done, Task ( ${taskColumns} )`).eq('user_id', user.value!.id)

  let { data, error: sbError }: { data: any[] | null; error: unknown } =
    await query('task_id, title, task_room_id, Assigned_To ( user_id, marked_done )')
  if (sbError) ({ data, error: sbError } = await query('task_id, title, task_room_id'))

  if (sbError || !data) return

  dashboardTasks.value = data
    .filter((row: any) => row.Task)
    .map((row: any) => {
      const everyone: { marked_done: boolean }[] = row.Task.Assigned_To ?? []
      const notDone = everyone.filter(a => !a.marked_done).length
      return {
        task_id: row.Task.task_id,
        title: row.Task.title,
        task_room_id: row.Task.task_room_id,
        marked_done: row.marked_done,
        waiting_on_me: !row.marked_done && everyone.length > 1 && notDone === 1,
      }
    })
}

// ── "The team is waiting on you" ──────────────────────
const waitingOnMe = computed(() =>
  dashboardTasks.value
    .filter(t => t.waiting_on_me)
    .map(t => {
      const room = allRooms.value.find(r => r.room_id === t.task_room_id)
      return { ...t, room_code: room?.room_code ?? '', room_title: room?.title ?? 'a room' }
    })
    .filter(t => t.room_code)
)

// ── Stats ─────────────────────────────────────────────
const username = computed(() => {
  if (!user.value) return 'User'
  return user.value?.user_metadata?.username || user.value?.email?.split('@')[0] || 'User'
})

const totalPeopleHuddled = computed(() => {
  const uniqueTeammates = new Set()
  allRooms.value.forEach(room => {
    if (room.members && Array.isArray(room.members)) {
      room.members.forEach((member: any) => uniqueTeammates.add(member.user_id))
    }
  })
  const count = uniqueTeammates.size > 0 ? uniqueTeammates.size - 1 : 0
  return count > 0 ? count : 0
})

const totalTasks = computed(() => dashboardTasks.value.length)
const completedTasks = computed(() => dashboardTasks.value.filter(t => t.marked_done).length)
const completionPercent = computed(() =>
  totalTasks.value > 0 ? Math.round((completedTasks.value / totalTasks.value) * 100) : 0
)
const totalActiveRooms = computed(() => joinedRooms.value.length + createdRooms.value.length)

// ── Room carousel ─────────────────────────────────────
const allRooms = computed(() => [...joinedRooms.value, ...createdRooms.value])
const roomProgressIndex = ref(0)
const currentRoom = computed(() => allRooms.value[roomProgressIndex.value] ?? null)
const prevRoom = () => { if (roomProgressIndex.value > 0) roomProgressIndex.value-- }
const nextRoom = () => { if (roomProgressIndex.value < allRooms.value.length - 1) roomProgressIndex.value++ }

// ── Task group carousel ───────────────────────────────
const tasksByRoom = computed(() => {
  const groups: Record<string, {
    room_id: string
    room_code: string
    room_title: string
    tasks: DashboardTask[]
    doneCount: number
  }> = {}

  dashboardTasks.value.forEach(task => {
    const room = allRooms.value.find(r => r.room_id === task.task_room_id)
    if (!room) return

    if (!groups[task.task_room_id]) {
      groups[task.task_room_id] = {
        room_id: room.room_id,
        room_code: room.room_code,
        room_title: room.title,
        tasks: [],
        doneCount: 0,
      }
    }
    groups[task.task_room_id]!.tasks.push(task)
    if (task.marked_done) groups[task.task_room_id]!.doneCount++
  })

  return Object.values(groups)
})

const taskGroupIndex = ref(0)
const currentTaskGroup = computed(() => tasksByRoom.value[taskGroupIndex.value] ?? null)
const prevTaskGroup = () => { if (taskGroupIndex.value > 0) taskGroupIndex.value-- }
const nextTaskGroup = () => { if (taskGroupIndex.value < tasksByRoom.value.length - 1) taskGroupIndex.value++ }

// ── Dialogs ───────────────────────────────────────────
const showCreateDialog = ref(false)
const newRoomTitle = ref('')
const newRoomDescription = ref('')

const handleCreateRoom = async () => {
  if (!newRoomTitle.value.trim()) return
  const room = await createRoom(newRoomTitle.value.trim(), newRoomDescription.value)
  if (room) {
    toast.add({ severity: 'success', summary: 'Room Created', detail: `"${room.title}" is ready!`, life: 3000 })
    showCreateDialog.value = false
    newRoomTitle.value = ''
    newRoomDescription.value = ''
    await fetchJoinedRooms()
  } else {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Could not create room.', life: 3000 })
  }
}

const showJoinDialog = ref(false)
const joinCode = ref('')
const isJoining = ref(false)

const handleJoinRoom = async () => {
  if (!joinCode.value.trim()) return
  isJoining.value = true

  const result = await joinRoom(joinCode.value.trim().toUpperCase())

  if (!result) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Could not join the room.', life: 3000 })
    isJoining.value = false
    return
  }

  if (result.alreadyJoined) {
    toast.add({ severity: 'info', summary: 'Already Joined', detail: `You are already in "${result.room.title}".`, life: 3000 })
    router.push(`/main/rooms/${joinCode.value.trim().toUpperCase()}`)
    isJoining.value = false
    return
  }

  toast.add({ severity: 'success', summary: 'Joined!', detail: `Welcome to "${result.room.title}"`, life: 3000 })
  await fetchJoinedRooms()
  showJoinDialog.value = false
  const code = joinCode.value.trim().toUpperCase()
  joinCode.value = ''
  router.push(`/main/rooms/${code}`)
  isJoining.value = false
}

const goToRoom = (roomCode: string) => {
  router.push(`/main/rooms/${roomCode}`)
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Lifecycle ─────────────────────────────────────────
watch(() => route.query.action, (action) => {
  if (action === 'join') showJoinDialog.value = true
  if (action === 'create') showCreateDialog.value = true
  if (action) router.replace({ query: {} })
}, { immediate: true })

onMounted(async () => {
  await fetchCreatedRooms()
  await fetchJoinedRooms()
  await fetchAllMyTasks()

  if (route.query.action === 'join') showJoinDialog.value = true
  if (route.query.action === 'create') showCreateDialog.value = true
})
</script>

<template>
  <Toast />

  <div class="dashboard-page">

    <header class="dashboard-header">
      <div class="header-titles">
        <h1 class="dashboard-title">Dashboard</h1>
        <p class="dashboard-subtitle">Welcome back! Here's a quick overview of you and your team's progress.</p>
      </div>

      <img src="/placeholder-team.webp" alt="" class="header-img" width="440" height="330" />
    </header>

    <section class="stats-grid" aria-label="Overview">
      <div class="stat-card stat-card--welcome">
        <img src="/placeholder-huddle.png" alt="" class="welcome-illus" />
        <div class="welcome-text">
          <span>Huddle Up,</span>
          <span class="welcome-name">{{ username }}!</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__head">
          <span class="stat-card__icon"><i class="pi pi-check-square" /></span>
          <span class="stat-card__label">Tasks Completed</span>
        </div>
        <div class="stat-card__value">{{ completedTasks }}<span class="stat-card__of">/{{ totalTasks }}</span></div>
        <div class="stat-bar" role="progressbar" :aria-valuenow="completionPercent" aria-valuemin="0" aria-valuemax="100">
          <div class="stat-bar__fill" :style="{ width: completionPercent + '%' }" />
        </div>
        <div class="stat-card__sub">{{ completionPercent }}% across all rooms</div>
      </div>

      <div class="stat-card">
        <div class="stat-card__head">
          <span class="stat-card__icon stat-card__icon--blue"><i class="pi pi-th-large" /></span>
          <span class="stat-card__label">Active Rooms</span>
        </div>
        <div class="stat-card__value">{{ totalActiveRooms }}</div>
        <div class="stat-card__sub">{{ joinedRooms.length }} joined · {{ createdRooms.length }} created</div>
      </div>

      <div class="stat-card">
        <div class="stat-card__head">
          <span class="stat-card__icon stat-card__icon--blue"><i class="pi pi-users" /></span>
          <span class="stat-card__label">People Huddled</span>
        </div>
        <div class="stat-card__value">{{ totalPeopleHuddled }}</div>
        <div class="stat-card__sub">Teammates across your rooms</div>
      </div>
    </section>

    <!-- ── The team is waiting on you ────────────────── -->
    <section v-if="waitingOnMe.length" class="waiting-banner" aria-labelledby="waiting-title">
      <div class="waiting-banner__head">
        <UserAvatar :avatar="user?.user_metadata?.avatar" :name="username" :size="48" class="waiting-banner__avatar" />
        <div>
          <h2 id="waiting-title" class="waiting-banner__title">The team is waiting on you</h2>
          <p class="waiting-banner__sub">
            Everyone else has finished {{ waitingOnMe.length === 1 ? 'this task' : `these ${waitingOnMe.length} tasks` }}.
            You're the last one before {{ waitingOnMe.length === 1 ? 'it' : 'they' }} can be completed.
          </p>
        </div>
      </div>

      <ul class="waiting-banner__list">
        <li v-for="t in waitingOnMe.slice(0, 4)" :key="t.task_id">
          <button type="button" class="waiting-banner__task" @click="goToRoom(t.room_code)">
            <span class="waiting-banner__task-title">{{ t.title }}</span>
            <span class="waiting-banner__room">{{ t.room_title }}</span>
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p v-if="waitingOnMe.length > 4" class="waiting-banner__more">+{{ waitingOnMe.length - 4 }} more</p>
    </section>

    <!-- ── Room Progress ─────────────────────────────── -->
    <div class="section-block">
      <div class="section-header">
        <span class="section-title">Room Progress</span>
        <div class="carousel-nav">
          <button class="nav-btn" @click="prevRoom" :disabled="roomProgressIndex === 0 || allRooms.length === 0">
            <i class="pi pi-chevron-left" />
          </button>
          <button class="nav-btn" @click="nextRoom"
            :disabled="roomProgressIndex >= allRooms.length - 1 || allRooms.length === 0">
            <i class="pi pi-chevron-right" />
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="empty-hint">
        <i class="pi pi-spin pi-spinner" /> Loading rooms...
      </div>
      <div v-else-if="allRooms.length === 0" class="empty-hint">
        Join or create a room and huddle up with your team.
      </div>
      <div v-else-if="currentRoom" class="room-progress-card" @click="goToRoom(currentRoom.room_code)">
        <div class="rp-top">
          <span class="rp-code">{{ currentRoom.room_code }}</span>
          <span class="rp-badge"
            :class="createdRooms.find(r => r.room_code === currentRoom?.room_code) ? 'owner' : 'member'">
            {{ createdRooms.find(r => r.room_code === currentRoom?.room_code) ? 'owner' : 'member' }}
          </span>
        </div>
        <div class="rp-title">{{ currentRoom.title }}</div>
        <div class="rp-date">Created {{ formatDate(currentRoom.room_created_at) }}</div>
      </div>
    </div>

    <!-- ── Assigned Tasks ────────────────────────────── -->
    <div class="section-block">
      <div class="section-header">
        <span class="section-title">Your Assigned Tasks</span>
        <div class="section-header-right">
          <span v-if="totalTasks > 0" class="tasks-summary-pill">
            {{ completedTasks }}/{{ totalTasks }} completed
          </span>
          <div class="carousel-nav" v-if="tasksByRoom.length > 1">
            <button class="nav-btn" @click="prevTaskGroup" :disabled="taskGroupIndex === 0">
              <i class="pi pi-chevron-left" />
            </button>
            <button class="nav-btn" @click="nextTaskGroup" :disabled="taskGroupIndex >= tasksByRoom.length - 1">
              <i class="pi pi-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="dashboardTasks.length === 0" class="empty-hint">
        You don't have any assigned tasks yet.
      </div>

      <div v-else-if="currentTaskGroup" class="tasks-panel">
        <!-- Group header -->
        <div class="room-task-label">
          <span class="rp-code">{{ currentTaskGroup.room_code }}</span>
          <span class="room-task-name">{{ currentTaskGroup.room_title }}</span>
          <span class="room-task-count">{{ currentTaskGroup.doneCount }}/{{ currentTaskGroup.tasks.length }} done</span>
        </div>

        <!-- Task list -->
        <div class="task-list">
          <div
            v-for="task in currentTaskGroup.tasks"
            :key="task.task_id"
            class="task-item"
            :class="{ 'task-item--done': task.marked_done, 'task-item--waiting': task.waiting_on_me }"
          >
            <div class="task-check" :class="{ 'task-check--done': task.marked_done }">
              <i v-if="task.marked_done" class="pi pi-check" style="font-size: 0.6rem;" />
            </div>
            <span class="task-item__title">{{ task.title }}</span>
            <span
              class="task-item__status"
              :class="task.marked_done ? 'done' : task.waiting_on_me ? 'waiting' : 'pending'"
            >
              {{ task.marked_done ? 'Done' : task.waiting_on_me ? 'Waiting on you' : 'Pending' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Dialogs ────────────────────────────────────── -->
    <Dialog v-model:visible="showCreateDialog" header="Create a New Room" :style="{ width: '400px' }" :breakpoints="{ '480px': '92vw' }" modal>
      <div class="dialog-body">
        <label class="dialog-label" for="new-room-title">Room Name</label>
        <InputText id="new-room-title" v-model="newRoomTitle" placeholder="e.g. Sprint Planning, Study Group..." class="w-full"
          @keyup.enter="handleCreateRoom" autofocus />

        <label class="dialog-label" for="new-room-desc">
          Description <span class="dialog-optional">optional</span>
        </label>
        <Textarea id="new-room-desc" v-model="newRoomDescription" rows="3" auto-resize maxlength="280"
          placeholder="What is this huddle about?" class="w-full" />

        <p class="dialog-hint">A unique room code will be generated automatically.</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreateDialog = false" />
        <Button label="Create Room" icon="pi pi-plus" :loading="isLoading" :disabled="!newRoomTitle.trim()"
          @click="handleCreateRoom" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showJoinDialog" header="Join a Room" :style="{ width: '400px' }" :breakpoints="{ '480px': '92vw' }" modal>
      <div class="dialog-body">
        <label class="dialog-label">Room Code</label>
        <InputText v-model="joinCode" placeholder="e.g. AB12CD" class="w-full" style="text-transform: uppercase;"
          @keyup.enter="handleJoinRoom" autofocus />
        <p class="dialog-hint">Ask your team for the 6-character room code.</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showJoinDialog = false" />
        <Button label="Join Room" icon="pi pi-sign-in" :loading="isJoining" :disabled="!joinCode.trim()"
          @click="handleJoinRoom" />
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(1.25rem, 3vw, 2.75rem) clamp(1rem, 3.5vw, 3.5rem) 3rem;
}

/* ── Header ──────────────────────────────────────────── */
.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.dashboard-title {
  margin: 0;
  font-size: clamp(2.25rem, 5vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: var(--hu-green);
}

.dashboard-subtitle {
  margin: 0.6rem 0 0;
  max-width: 34rem;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--hu-text-muted);
}

.header-img {
  width: clamp(150px, 18vw, 220px);
  height: auto;
  flex-shrink: 0;
}

/* ── Stat cards ──────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

/* Medium widths: a clean 2×2 instead of 3 + 1 orphan */
@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  padding: 1.25rem 1.35rem;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
}

.stat-card__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.stat-card__icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.6rem;
  background: var(--hu-green-soft);
  color: var(--hu-green-700);
  font-size: 0.95rem;
}

.stat-card__icon--blue {
  background: var(--hu-blue-soft);
  color: var(--hu-blue);
}

.stat-card__label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--hu-text-muted);
}

.stat-card__value {
  margin-top: 0.25rem;
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--hu-text);
}

.stat-card__of {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--hu-text-muted);
}

.stat-card__sub {
  font-size: 0.85rem;
  color: var(--hu-text-muted);
}

.stat-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--hu-green-soft);
  overflow: hidden;
}

.stat-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: var(--hu-green);
  transition: width 0.4s ease;
}

/* Welcome card: green, illustration sits in its own column so it never covers the text */
.stat-card--welcome {
  flex-direction: row;
  align-items: flex-end;
  gap: 0.75rem;
  padding-bottom: 0;
  overflow: hidden;
  background: var(--hu-green);
  border-color: var(--hu-green);
  color: #ffffff;
}

.welcome-illus {
  align-self: flex-end;
  width: 64px;
  height: auto;
  flex-shrink: 0;
}

.welcome-text {
  display: flex;
  flex-direction: column;
  align-self: center;
  min-width: 0;
  padding-bottom: 1.25rem;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

.welcome-name {
  overflow-wrap: anywhere;
}

/* ── Sections ────────────────────────────────────────── */
.section-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.section-header-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--hu-text);
}

.empty-hint {
  padding: 1.25rem;
  font-size: 0.9rem;
  color: var(--hu-text-muted);
  background: var(--hu-surface);
  border: 1px dashed var(--hu-border);
  border-radius: var(--hu-radius);
}

/* ── Room carousel ───────────────────────────────────── */
.carousel-nav {
  display: flex;
  gap: 0.4rem;
}

.nav-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--hu-border);
  border-radius: 50%;
  background: var(--hu-surface);
  color: var(--hu-green-700);
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--hu-green-soft);
  border-color: var(--hu-green);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.room-progress-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.1rem 1.35rem;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.room-progress-card:hover {
  border-color: var(--hu-green);
  box-shadow: 0 6px 16px rgba(106, 156, 57, 0.15);
  transform: translateY(-2px);
}

.rp-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.rp-code {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--hu-green-soft);
  color: var(--hu-green-700);
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.rp-badge {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.rp-badge.member {
  background: var(--hu-blue-soft);
  color: var(--hu-blue-600);
}

.rp-badge.owner {
  background: var(--hu-green-soft);
  color: var(--hu-green-700);
}

.rp-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--hu-text);
}

.rp-date {
  font-size: 0.8rem;
  color: var(--hu-text-muted);
}

/* ── Assigned tasks ──────────────────────────────────── */
.tasks-summary-pill {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: var(--hu-green-soft);
  color: var(--hu-green-700);
  font-size: 0.75rem;
  font-weight: 700;
}

.tasks-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
}

.room-task-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.25rem 0 0.5rem;
}

.room-task-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--hu-text);
}

.room-task-count {
  margin-left: auto;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: var(--hu-bg);
  color: var(--hu-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: 12px;
  transition: border-color 0.15s;
}

.task-item:hover {
  border-color: var(--hu-green);
}

.task-item--done {
  background: #f8faf5;
}

.task-check {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 2px solid #cbd5c0;
  border-radius: 50%;
  background: #ffffff;
  color: #ffffff;
}

.task-check--done {
  background: var(--hu-green);
  border-color: var(--hu-green);
}

.task-item__title {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--hu-text);
}

.task-item--done .task-item__title {
  text-decoration: line-through;
  color: var(--hu-text-muted);
}

.task-item__status {
  flex-shrink: 0;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.task-item__status.done {
  background: var(--hu-green-soft);
  color: var(--hu-green-700);
}

.task-item__status.pending {
  background: var(--hu-bg);
  color: var(--hu-text-muted);
}

/* ── Dialogs ─────────────────────────────────────────── */
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.5rem 0;
}

.dialog-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--hu-text);
}

.dialog-optional {
  margin-left: 0.3rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--hu-bg);
  color: var(--hu-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.dialog-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--hu-text-muted);
}

.w-full {
  width: 100%;
}

/* ── Phone ───────────────────────────────────────────── */
@media (max-width: 600px) {
  .header-img {
    display: none;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  /* Welcome + tasks full width, rooms + people side by side */
  .stat-card--welcome,
  .stat-card:nth-child(2) {
    grid-column: 1 / -1;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-card__value {
    font-size: 1.85rem;
  }
}

/* ── "The team is waiting on you" ────────────────────── */
.waiting-banner {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.25rem 1.35rem;
  border: 1.5px solid var(--hu-amber);
  border-radius: var(--hu-radius);
  background: linear-gradient(120deg, var(--hu-amber-soft), #ffffff 70%);
  box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.12), var(--hu-shadow);
}

.waiting-banner__head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.waiting-banner__avatar {
  box-shadow: 0 0 0 3px var(--hu-amber);
}

.waiting-banner__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--hu-amber-text);
}

.waiting-banner__sub {
  margin: 0.15rem 0 0;
  font-size: 0.88rem;
  color: var(--hu-text-muted);
}

.waiting-banner__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.waiting-banner__task {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid #fcd9a0;
  border-radius: 12px;
  background: #ffffff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.waiting-banner__task:hover {
  border-color: var(--hu-amber);
  transform: translateY(-1px);
}

.waiting-banner__task:focus-visible {
  outline: 3px solid var(--hu-amber);
  outline-offset: 2px;
}

.waiting-banner__task-title {
  overflow: hidden;
  font-weight: 700;
  color: var(--hu-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waiting-banner__room {
  grid-column: 1;
  font-size: 0.78rem;
  color: var(--hu-text-muted);
}

.waiting-banner__task .pi {
  grid-column: 2;
  grid-row: 1 / span 2;
  color: var(--hu-amber-text);
}

.waiting-banner__more {
  margin: -0.4rem 0 0;
  font-size: 0.8rem;
  color: var(--hu-text-muted);
}

.task-item--waiting {
  border-color: var(--hu-amber);
  background: var(--hu-amber-soft);
}

.task-item__status.waiting {
  background: #fde7b0;
  color: var(--hu-amber-text);
}
</style>
