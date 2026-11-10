<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTasks, type TaskData, type MemberData } from '@/composables/useTasks'
import { useRooms } from '@/composables/useRooms'
import { useAuth } from '@/composables/useAuth'
import { useToast } from 'primevue/usetoast'

import Toast from 'primevue/toast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import UserAvatar from '@/components/UserAvatar.vue'

const showCreateTask = ref(false)
const newTaskTitle = ref('')
const isSubmitting = ref(false)

const showEditTask = ref(false)
const editingTaskId = ref<string | null>(null)
const editingTaskTitle = ref('')

const {
  assignedTasks,
  isLoading,
  error,
  loadRoom,
  createTask: createTaskAction,
  deleteTask,
  toggleTask,
  updateTask,
  room,
  isAdmin,
  canCreateTasks,
  canManageTask,
  setMemberRole,
  updateRoomDescription,
  members,
  subscribeToTasks,
  unsubscribeFromTasks
} = useTasks()

const toast = useToast()
const router = useRouter()
const route = useRoute()
const { user } = useAuth()
const { leaveRoom, deleteRoom } = useRooms()
const roomCode = route.params.roomCode as string

// ─── Overall Room Progress ──────────────────────────────────────────────────
// Total possible = tasks × members (every member must complete every task)
// Total done     = sum of all marked_done=true records across all tasks
const overallProgress = computed(() => {
  const taskCount = assignedTasks.value.length
  const memberCount = members.value.length
  if (taskCount === 0 || memberCount === 0) return 0

  const totalPossible = taskCount * memberCount
  const totalDone = assignedTasks.value.reduce(
    (sum, task) => sum + (task.assignments?.filter(a => a.marked_done).length ?? 0),
    0
  )

  return Math.round((totalDone / totalPossible) * 100)
})

// ─── Per-Member Progress ────────────────────────────────────────────────────
function getMemberProgress(userId: string): number {
  const taskCount = assignedTasks.value.length
  if (taskCount === 0) return 0

  const memberDone = assignedTasks.value.filter(
    task => task.assignments?.find(a => a.user_id === userId)?.marked_done === true
  ).length

  return Math.round((memberDone / taskCount) * 100)
}

// ─── Who did what ───────────────────────────────────────────────────────────
const memberById = computed(() => new Map(members.value.map(m => [m.user_id, m])))

interface TaskPerson {
  user_id: string
  marked_done: boolean
  member: MemberData | undefined
  isMe: boolean
}

/** Everyone assigned to a task, finished people first. */
function taskPeople(task: TaskData): TaskPerson[] {
  return (task.assignments ?? [])
    .map(a => ({
      user_id: a.user_id,
      marked_done: a.marked_done,
      member: memberById.value.get(a.user_id),
      isMe: a.user_id === user.value?.id,
    }))
    .sort((a, b) => Number(b.marked_done) - Number(a.marked_done))
}

const personName = (p: TaskPerson) => (p.isMe ? 'you' : p.member?.username || 'a teammate')

function listNames(names: string[], max = 2): string {
  if (names.length <= max) return names.join(' and ')
  return `${names.slice(0, max).join(', ')} +${names.length - max}`
}

function waitingText(task: TaskData): string {
  const waiting = taskPeople(task).filter(p => !p.marked_done)
  if (waiting.length === 0) return 'Everyone is done'
  // Put "you" first so it's obvious when the task is waiting on you
  waiting.sort((a, b) => Number(b.isMe) - Number(a.isMe))
  return `Waiting on ${listNames(waiting.map(personName))}`
}

function signedOffText(task: TaskData): string {
  const names = taskPeople(task).map(p => (p.isMe ? 'You' : p.member?.username || 'Teammate'))
  return `Signed off by ${listNames(names, 3)}`
}

const isAssigned = (task: TaskData) => task.assignments?.some(a => a.user_id === user.value?.id) ?? false

// ─── Active vs Completed ────────────────────────────────────────────────────
// A task is "completed" only when EVERY assigned member has checked it.
const isFullyDone = (task: TaskData) =>
  (task.assignments?.length ?? 0) > 0 && task.assignments.every(a => a.marked_done)

// "The team is waiting on you": everyone else on the task is done, only you are left.
const isWaitingOnMe = (task: TaskData) => {
  const people = task.assignments ?? []
  if (people.length < 2 || task.marked_done || !isAssigned(task)) return false
  return people.filter(a => !a.marked_done).length === 1
}

const myAvatar = computed(() => user.value?.user_metadata?.avatar ?? null)
const myName = computed(() => user.value?.user_metadata?.username || user.value?.email?.split('@')[0] || 'You')

// Tasks waiting on you float to the top
const activeTasks = computed(() =>
  assignedTasks.value
    .filter(t => !isFullyDone(t))
    .sort((a, b) => Number(isWaitingOnMe(b)) - Number(isWaitingOnMe(a)))
)
const completedTasks = computed(() => assignedTasks.value.filter(isFullyDone))

// Highlight tasks that land in the inbox while you're on the page (yours or a teammate's)
const newlyCompleted = ref(new Set<string>())
let seenCompleted: Set<string> | null = null
watch(
  () => completedTasks.value.map(t => t.task_id),
  (ids) => {
    if (seenCompleted) {
      for (const id of ids) if (!seenCompleted.has(id)) newlyCompleted.value.add(id)
    }
    seenCompleted = new Set(ids)
  }
)

const inboxOpen = ref(true)

// ─── Toggling, with protection against accidental clicks ────────────────────
// 1. Only the checkbox toggles (clicking the card does nothing).
// 2. A checkbox is locked while its save is in flight, so double-clicks can't flip it twice.
// 3. If your click finishes the task for everyone, an Undo bar appears for a few seconds.
// 4. Anyone can "Reopen" a task from the Completed inbox.
const pendingIds = ref(new Set<string>())
const undoState = ref<{ taskId: string; title: string } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined

const dismissUndo = () => {
  clearTimeout(undoTimer)
  undoState.value = null
}

const setMyCheck = async (task: TaskData) => {
  if (pendingIds.value.has(task.task_id)) return false
  pendingIds.value.add(task.task_id)
  try {
    const ok = await toggleTask(task)
    if (!ok) {
      toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Could not update the task.', life: 3000 })
    }
    return ok
  } finally {
    pendingIds.value.delete(task.task_id)
  }
}

const handleToggle = async (task: TaskData) => {
  const wasChecked = task.marked_done
  const ok = await setMyCheck(task)
  if (!ok) return

  if (!wasChecked && isFullyDone(task)) {
    clearTimeout(undoTimer)
    undoState.value = { taskId: task.task_id, title: task.title }
    undoTimer = setTimeout(dismissUndo, 7000)
  }
}

const handleUndo = async () => {
  const state = undoState.value
  dismissUndo()
  if (!state) return
  const task = assignedTasks.value.find(t => t.task_id === state.taskId)
  if (task?.marked_done) {
    const ok = await setMyCheck(task)
    if (ok) newlyCompleted.value.delete(task.task_id)
  }
}

const handleReopen = async (task: TaskData) => {
  if (!task.marked_done) return
  const ok = await setMyCheck(task)
  if (ok) {
    newlyCompleted.value.delete(task.task_id)
    toast.add({ severity: 'info', summary: 'Reopened', detail: `"${task.title}" is back in Tasks.`, life: 3000 })
  }
}

// ─── Room code: copy to clipboard (everyone) ───────────────────────────────
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const copyRoomCode = async () => {
  const code = String(route.params.roomCode || '')
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    // Fallback for browsers/contexts without the async clipboard API
    const ta = document.createElement('textarea')
    ta.value = code
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2000)
}

// ─── Room description (owner, optional) ─────────────────────────────────────
const showEditDescription = ref(false)
const descriptionDraft = ref('')

const openEditDescription = () => {
  descriptionDraft.value = room.value?.description ?? ''
  showEditDescription.value = true
}

const handleSaveDescription = async () => {
  isSubmitting.value = true
  const ok = await updateRoomDescription(descriptionDraft.value)
  isSubmitting.value = false
  if (!ok) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Could not save the description.', life: 4000 })
    return
  }
  showEditDescription.value = false
  toast.add({ severity: 'success', summary: 'Saved', detail: 'Room description updated.', life: 2500 })
}

// ─── Task permissions (owner lets members create tasks) ─────────────────────
const roleBusy = ref(new Set<string>())

const toggleContributor = async (member: MemberData) => {
  const next = member.role === 'contributor' ? 'member' : 'contributor'
  roleBusy.value.add(member.user_id)
  const ok = await setMemberRole(member.user_id, next)
  roleBusy.value.delete(member.user_id)
  if (!ok) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Could not change permissions.', life: 4000 })
    return
  }
  toast.add({
    severity: 'success',
    summary: 'Permissions updated',
    detail: next === 'contributor' ? `${member.username} can now add tasks.` : `${member.username} can no longer add tasks.`,
    life: 2500,
  })
}

// ─── Task Actions ───────────────────────────────────────────────────────────
const createTask = async () => {
  if (!newTaskTitle.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Task title is required.', life: 3000 })
    return
  }

  isSubmitting.value = true
  const task = await createTaskAction(newTaskTitle.value.trim())

  if (!task) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Failed to create task.', life: 3000 })
    isSubmitting.value = false
    return
  }

  toast.add({ severity: 'success', summary: 'Done', detail: 'Task created and assigned!', life: 3000 })
  newTaskTitle.value = ''
  showCreateTask.value = false
  isSubmitting.value = false
}

const handleDeleteTask = async (task: TaskData) => {
  if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
  const success = await deleteTask(task.task_id)
  if (!success) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Failed to delete task.', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Deleted', detail: 'Task deleted.', life: 3000 })
}

const notFound = ref(false)

const loadRoomData = async (roomCodeID: string) => {
  dismissUndo()
  seenCompleted = null
  newlyCompleted.value.clear()
  const roomResult = await loadRoom(roomCodeID)
  notFound.value = !roomResult
  if (!roomResult) {
    toast.add({ severity: 'error', summary: 'Not Found', detail: error.value || 'No room found.', life: 3000 })
  }
  return roomResult
}

const handleLeaveRoom = async () => {
  if (!room.value) return
  const success = await leaveRoom(room.value.room_id)
  if (!success) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Failed to leave room.', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Left Room', detail: 'You have left the room.', life: 3000 })
  router.push('/main')
}

const handleDeleteRoom = async () => {
  if (!room.value) return
  const confirmed = window.confirm('Delete this room and all tasks permanently? This cannot be undone.')
  if (!confirmed) return

  const success = await deleteRoom(room.value.room_id)
  if (!success) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Failed to delete room.', life: 3000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Deleted', detail: 'Room and all tasks were removed.', life: 3000 })
  router.push('/main')
}

const openEditTask = (task: TaskData) => {
  editingTaskId.value = task.task_id
  editingTaskTitle.value = task.title
  showEditTask.value = true
}

const handleEditTask = async () => {
  if (!editingTaskId.value || !editingTaskTitle.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Task title is required.', life: 3000 })
    return
  }

  isSubmitting.value = true
  try {
    const success = await updateTask(editingTaskId.value, editingTaskTitle.value.trim())

    if (!success) {
      toast.add({ severity: 'error', summary: 'Error', detail: error.value || 'Failed to update task.', life: 3000 })
      return
    }

    toast.add({ severity: 'success', summary: 'Done', detail: 'Task updated!', life: 3000 })
    showEditTask.value = false
    editingTaskId.value = null
    editingTaskTitle.value = ''
  } catch (err) {
    console.error('Update error:', err)
    toast.add({ severity: 'error', summary: 'Error', detail: 'An error occurred while updating.', life: 3000 })
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  await loadRoomData(roomCode)
  subscribeToTasks()
})

onUnmounted(() => {
  unsubscribeFromTasks()
  clearTimeout(undoTimer)
  clearTimeout(copiedTimer)
})

watch(
  () => route.params.roomCode as string,
  async (newRoomCode: string) => {
    if (!newRoomCode) return
    await loadRoomData(newRoomCode)
    subscribeToTasks()
  }
)
</script>

<template>
  <Toast />

  <div v-if="notFound" class="room-page">
    <div class="room-not-found">
      <i class="pi pi-search" />
      <h1>Room not found</h1>
      <p>We couldn't find a room with the code <strong>{{ route.params.roomCode }}</strong>. Check the code with your team.</p>
      <Button label="Back to Dashboard" icon="pi pi-arrow-left" @click="router.push('/main/dashboard')" />
    </div>
  </div>

  <div v-else class="room-page">

    <div class="room-header-card">
      <div class="header-top-row">
        <div class="room-heading">
          <h1 class="room-title">{{ room?.title || 'Loading Room...' }}</h1>

          <p v-if="room?.description" class="room-description">
            {{ room.description }}
            <button v-if="isAdmin" type="button" class="inline-link" @click="openEditDescription">Edit</button>
          </p>
          <button v-else-if="isAdmin && room" type="button" class="add-description" @click="openEditDescription">
            <i class="pi pi-plus" /> Add a description <span class="optional-tag">optional</span>
          </button>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="code-badge"
            :class="{ 'is-copied': copied }"
            :title="copied ? 'Copied!' : 'Copy room code'"
            :aria-label="`Copy room code ${route.params.roomCode}`"
            @click="copyRoomCode"
          >
            <span class="code-badge__code">{{ route.params.roomCode }}</span>
            <i :class="copied ? 'pi pi-check' : 'pi pi-copy'" aria-hidden="true" />
            <span class="code-badge__label">{{ copied ? 'Copied!' : 'Copy' }}</span>
          </button>
          <span class="sr-only" aria-live="polite">{{ copied ? 'Room code copied to clipboard' : '' }}</span>

          <Button v-if="isAdmin" icon="pi pi-trash" severity="danger" text rounded @click="handleDeleteRoom" title="Delete Room" aria-label="Delete Room" />
          <Button v-else icon="pi pi-sign-out" severity="secondary" text rounded @click="handleLeaveRoom" title="Leave Room" aria-label="Leave Room" />
        </div>
      </div>

      <div class="room-progress-section">
        <span class="progress-text">{{ overallProgress }}%</span>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: overallProgress + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="room-content-grid">

      <div class="tasks-column">
        <div class="column-header column-header--tasks">
          <div>
            <h2 class="section-title">Team Tasks ({{ activeTasks.length }})</h2>
            <p class="section-sub">
              <i class="pi pi-users" /> Everyone does every task. It's done when the whole team checks it off.
            </p>
          </div>
          <Button
            v-if="canCreateTasks"
            label="Add New Task"
            icon="pi pi-plus-circle"
            class="btn-add-task"
            @click="showCreateTask = true"
          />
        </div>

        <!-- Only show the spinner on first load, not on every realtime refresh -->
        <div v-if="isLoading && assignedTasks.length === 0" class="loading-state">
          <i class="pi pi-spin pi-spinner" /> Loading tasks...
        </div>

        <div v-else-if="assignedTasks.length === 0" class="empty-state">
          No tasks yet.{{ canCreateTasks ? ' Add one for the whole team to tackle together!' : ' The room owner will add some soon.' }}
        </div>

        <div v-else-if="activeTasks.length === 0" class="empty-state empty-state--done">
          <i class="pi pi-sparkles" /> All caught up! Every task has been delivered to Completed.
        </div>

        <TransitionGroup v-else name="task" tag="div" class="task-list">
          <article
            v-for="task in activeTasks"
            :key="task.task_id"
            class="task-card"
            :class="{ 'is-mine-done': task.marked_done, 'is-waiting-on-me': isWaitingOnMe(task) }"
          >
            <div class="task-card-left">
              <Checkbox
                v-if="isAssigned(task)"
                :modelValue="task.marked_done"
                :binary="true"
                variant="filled"
                class="task-checkbox"
                :disabled="pendingIds.has(task.task_id)"
                :ariaLabel="task.marked_done ? `Mark '${task.title}' as not done` : `Mark '${task.title}' as done`"
                @update:modelValue="handleToggle(task)"
              />
              <span v-else class="task-unassigned" title="This task was created before you joined">
                <i class="pi pi-minus" />
              </span>

              <div class="task-info">
                <div v-if="isWaitingOnMe(task)" class="waiting-flag">
                  <UserAvatar :avatar="myAvatar" :name="myName" :size="22" />
                  <strong>The team is waiting on you</strong>
                  <span class="waiting-flag__sub">Everyone else is done</span>
                </div>
                <span class="task-title">{{ task.title }}</span>

                <div class="task-meta">
                  <div class="people-stack" aria-hidden="true">
                    <UserAvatar
                      v-for="p in taskPeople(task).slice(0, 5)"
                      :key="p.user_id"
                      :avatar="p.member?.avatar"
                      :name="p.isMe ? 'You' : p.member?.username"
                      :size="28"
                      :done="p.marked_done"
                      :muted="!p.marked_done"
                    />
                    <span v-if="taskPeople(task).length > 5" class="people-more">
                      +{{ taskPeople(task).length - 5 }}
                    </span>
                  </div>
                  <span class="task-status">
                    Team effort ·
                    <strong>{{ task.done_count ?? 0 }} of {{ task.total_count ?? task.assignments.length }}</strong> done
                    · {{ waitingText(task) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="task-card-right">
              <Button v-if="canManageTask(task)" icon="pi pi-pencil" severity="secondary" text rounded @click="openEditTask(task)" title="Edit Task" aria-label="Edit Task" />
              <Button v-if="canManageTask(task)" icon="pi pi-trash" severity="danger" text rounded @click="handleDeleteTask(task)" title="Delete Task" aria-label="Delete Task" />
            </div>
          </article>
        </TransitionGroup>

        <!-- ── Completed inbox ── -->
        <section v-if="assignedTasks.length > 0" class="inbox" aria-labelledby="inbox-title">
          <button
            type="button"
            class="inbox-header"
            :aria-expanded="inboxOpen"
            aria-controls="inbox-body"
            @click="inboxOpen = !inboxOpen"
          >
            <span class="inbox-icon">
              <i class="pi pi-inbox" />
              <span v-if="newlyCompleted.size" class="inbox-icon__dot" />
            </span>
            <span class="inbox-heading">
              <span id="inbox-title" class="inbox-title">Completed</span>
              <span class="inbox-sub">Tasks land here once everyone has checked them off</span>
            </span>
            <span class="inbox-count">{{ completedTasks.length }}</span>
            <i class="pi pi-chevron-down inbox-chevron" :class="{ 'is-open': inboxOpen }" />
          </button>

          <div v-show="inboxOpen" id="inbox-body" class="inbox-body">
            <div v-if="completedTasks.length === 0" class="inbox-empty">
              <span class="inbox-empty__envelope" aria-hidden="true"><i class="pi pi-envelope" /></span>
              <span>No mail yet. When the whole team finishes a task, it gets delivered here.</span>
            </div>

            <TransitionGroup v-else name="letter" tag="ul" class="letters">
              <li
                v-for="task in completedTasks"
                :key="task.task_id"
                class="letter"
                :class="{ 'is-new': newlyCompleted.has(task.task_id) }"
              >
                <span class="letter-stamp" aria-hidden="true"><i class="pi pi-check" /></span>

                <div class="letter-body">
                  <div class="letter-subject">
                    <span class="letter-title">{{ task.title }}</span>
                    <span v-if="newlyCompleted.has(task.task_id)" class="letter-new">New</span>
                  </div>
                  <div class="letter-from">
                    <div class="people-stack people-stack--sm" aria-hidden="true">
                      <UserAvatar
                        v-for="p in taskPeople(task).slice(0, 5)"
                        :key="p.user_id"
                        :avatar="p.member?.avatar"
                        :name="p.isMe ? 'You' : p.member?.username"
                        :size="22"
                      />
                    </div>
                    <span>{{ signedOffText(task) }}</span>
                  </div>
                </div>

                <Button
                  v-if="isAssigned(task)"
                  label="Reopen"
                  icon="pi pi-replay"
                  text
                  size="small"
                  severity="secondary"
                  class="letter-reopen"
                  :disabled="pendingIds.has(task.task_id)"
                  :aria-label="`Reopen '${task.title}'`"
                  @click="handleReopen(task)"
                />
              </li>
            </TransitionGroup>
          </div>
        </section>
      </div>

      <div class="members-column">
        <div class="column-header">
          <h2 class="section-title">Members ({{ members.length }})</h2>
        </div>
        <p v-if="isAdmin && members.length > 1" class="members-hint">
          Use <strong>Allow tasks</strong> to let a member add tasks too.
        </p>
        <hr class="section-divider" />

        <div class="members-list">
          <div v-for="member in members" :key="member.user_id" class="member-item">
            <UserAvatar :avatar="member.avatar" :name="member.username" :size="44" />

            <div class="member-info">
              <span class="member-name">
                {{ member.username }}
                <span v-if="member.user_id === room?.room_creator_id" class="owner-badge">(Owner)</span>
                <span v-else-if="member.role === 'contributor' && !isAdmin" class="perm-badge">
                  <i class="pi pi-pencil" /> Can add tasks
                </span>
              </span>
              <div class="member-progress-track">
                <div
                  class="member-progress-fill"
                  :style="{ width: getMemberProgress(member.user_id) + '%' }"
                />
              </div>

              <!-- Owner only: allow / revoke task creation -->
              <button
                v-if="isAdmin && member.user_id !== room?.room_creator_id"
                type="button"
                class="perm-toggle"
                :class="{ 'is-on': member.role === 'contributor' }"
                :aria-pressed="member.role === 'contributor'"
                :disabled="roleBusy.has(member.user_id)"
                :title="member.role === 'contributor' ? 'Click to stop this member from adding tasks' : 'Click to let this member add tasks'"
                @click="toggleContributor(member)"
              >
                <span class="perm-toggle__switch" aria-hidden="true" />
                {{ member.role === 'contributor' ? 'Can add tasks' : 'Allow tasks' }}
              </button>
            </div>

            <span class="member-percent">{{ getMemberProgress(member.user_id) }}%</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Undo bar: appears when YOUR click finished a task for everyone -->
    <Transition name="snack">
      <div v-if="undoState" class="snackbar" role="status">
        <i class="pi pi-inbox" />
        <span class="snackbar__text">
          <strong>"{{ undoState.title }}"</strong> moved to Completed
        </span>
        <button type="button" class="snackbar__undo" @click="handleUndo">Undo</button>
        <button type="button" class="snackbar__close" aria-label="Dismiss" @click="dismissUndo">
          <i class="pi pi-times" />
        </button>
      </div>
    </Transition>

    <Dialog v-model:visible="showCreateTask" header="Create New Task" modal :style="{ width: '400px' }" :breakpoints="{ '480px': '92vw' }">
      <div class="dialog-content">
        <InputText v-model="newTaskTitle" placeholder="What does the team need to do?" class="w-full" @keyup.enter="createTask" autofocus />
        <p class="dialog-hint">
          <i class="pi pi-users" /> Everyone in the room gets this task. It moves to Completed once the whole team has checked it off.
        </p>
        <div class="dialog-actions mt-3 flex justify-end">
          <Button label="Cancel" text severity="secondary" @click="showCreateTask = false" />
          <Button label="Add Task" :loading="isSubmitting" @click="createTask" />
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="showEditTask" header="Edit Task" modal :style="{ width: '400px' }" :breakpoints="{ '480px': '92vw' }">
      <div class="dialog-content">
        <InputText v-model="editingTaskTitle" placeholder="Update task..." class="w-full" @keyup.enter="handleEditTask" autofocus />
        <div class="dialog-actions mt-3 flex justify-end">
          <Button label="Cancel" text severity="secondary" @click="showEditTask = false" />
          <Button label="Save Changes" :loading="isSubmitting" @click="handleEditTask" />
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="showEditDescription" header="Room Description" modal :style="{ width: '440px' }" :breakpoints="{ '480px': '92vw' }">
      <div class="dialog-content">
        <Textarea
          v-model="descriptionDraft"
          rows="4"
          auto-resize
          maxlength="280"
          placeholder="What is this huddle about? (optional)"
          class="w-full"
          autofocus
        />
        <p class="dialog-hint">{{ descriptionDraft.length }}/280 · Leave it empty to remove the description.</p>
        <div class="dialog-actions mt-3 flex justify-end">
          <Button label="Cancel" text severity="secondary" @click="showEditDescription = false" />
          <Button label="Save" :loading="isSubmitting" @click="handleSaveDescription" />
        </div>
      </div>
    </Dialog>

  </div>
</template>

<style scoped>
/* ── Layout & Page ── */
.room-page {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(1.25rem, 3vw, 2.5rem) clamp(1rem, 3.5vw, 3.5rem) 3rem;
}

/* ── Header card ── */
.room-header-card {
  margin-bottom: 2rem;
  padding: clamp(1.25rem, 2.5vw, 1.75rem) clamp(1.25rem, 3vw, 2.25rem);
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
}

.header-top-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem 1rem;
  margin-bottom: 1.25rem;
}

.room-title {
  margin: 0;
  min-width: 0;
  font-size: clamp(1.75rem, 4vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--hu-green);
  overflow-wrap: anywhere;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.code-badge {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  background: var(--hu-blue);
  color: #ffffff;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.room-progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.progress-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--hu-text-muted);
}

.progress-track {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: var(--hu-blue-soft);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--hu-blue);
  transition: width 0.4s ease;
}

/* ── Content grid ── */
.room-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr);
  gap: 2.5rem;
  align-items: start;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.section-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--hu-text);
}

.section-divider {
  margin: 0 0 1.25rem;
  border: none;
  border-bottom: 1px solid var(--hu-border);
}

.loading-state,
.empty-state {
  padding: 1.25rem;
  font-size: 0.9rem;
  color: var(--hu-text-muted);
  background: var(--hu-surface);
  border: 1px dashed var(--hu-border);
  border-radius: var(--hu-radius);
}

/* ── Tasks ── */
.btn-add-task.p-button {
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  font-weight: 700;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.task-card:hover {
  border-color: var(--hu-green);
  box-shadow: 0 6px 16px rgba(106, 156, 57, 0.12);
}

.task-card-left {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.task-checkbox {
  margin-top: 0.15rem;
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.task-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--hu-text);
  overflow-wrap: anywhere;
}



.task-card-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}




/* ── Members ── */
.members-column {
  padding: 1.25rem;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
}

.members-column .column-header {
  margin-bottom: 0.75rem;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}


.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.member-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--hu-text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.owner-badge {
  margin-left: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--hu-green-700);
}

.member-progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--hu-blue-soft);
  overflow: hidden;
}

.member-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--hu-blue);
  transition: width 0.4s ease;
}

.member-percent {
  min-width: 40px;
  font-size: 0.85rem;
  font-weight: 700;
  text-align: right;
  color: var(--hu-text-muted);
}

/* ── Not found ── */
.room-not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  max-width: 28rem;
  margin: 3rem auto;
  padding: 2.5rem 2rem;
  text-align: center;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
}

.room-not-found > i {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--hu-blue-soft);
  color: var(--hu-blue);
  font-size: 1.2rem;
}

.room-not-found h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--hu-text);
}

.room-not-found p {
  margin: 0 0 0.5rem;
  line-height: 1.5;
  color: var(--hu-text-muted);
}

/* ── Utilities used in dialogs ── */
.w-full { width: 100%; }
.mt-3 { margin-top: 1rem; }
.flex { display: flex; }
.justify-end { justify-content: flex-end; }

/* ── Narrow screens: one column ── */
@media (max-width: 1100px) {
  .room-content-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

@media (max-width: 600px) {
  .task-card {
    align-items: flex-start;
    padding: 1rem;
  }

}

/* ══ Task card details ══════════════════════════════════════════════════════ */
.task-card {
  cursor: default;
}

/* You've done your part, waiting on others */
.task-card.is-mine-done {
  border-left: 4px solid var(--hu-green);
  background: linear-gradient(90deg, var(--hu-green-soft), var(--hu-surface) 40%);
}

.task-unassigned {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-top: 0.15rem;
  flex-shrink: 0;
  border: 2px dashed var(--hu-border);
  border-radius: 6px;
  color: var(--hu-text-muted);
  font-size: 0.6rem;
}

.task-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.65rem;
  margin-top: 0.15rem;
}

.task-status {
  font-size: 0.82rem;
  color: var(--hu-text-muted);
}

.task-status strong {
  color: var(--hu-text);
}

.people-stack {
  display: flex;
  align-items: center;
}

.people-stack > * + * {
  margin-left: -8px;
}

.people-stack :deep(.user-avatar) {
  box-shadow: 0 0 0 2px var(--hu-surface);
}

.people-stack--sm > * + * {
  margin-left: -6px;
}

.people-more {
  display: grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 0.3rem;
  border: 2px solid var(--hu-surface);
  border-radius: 999px;
  background: var(--hu-bg);
  color: var(--hu-text-muted);
  font-size: 0.7rem;
  font-weight: 700;
}

.empty-state--done {
  border-style: solid;
  border-color: var(--hu-green-soft);
  background: var(--hu-green-soft);
  color: var(--hu-green-700);
  font-weight: 600;
}

/* Task list animations (task leaves when it's delivered to Completed) */
.task-move,
.task-enter-active,
.task-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.task-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.task-leave-to {
  opacity: 0;
  transform: translateY(24px) scale(0.97);
}

.task-leave-active {
  position: absolute;
  width: 100%;
}

.task-list {
  position: relative;
}

/* ══ Completed inbox ════════════════════════════════════════════════════════ */
.inbox {
  margin-top: 2rem;
  overflow: hidden;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
}

.inbox-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 1rem 1.25rem;
  border: none;
  color: #ffffff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  /* Same dot grid as the sidebar */
  background:
    conic-gradient(at 3px 3px, transparent 75%, var(--hu-dot-on-blue) 0) 0 0 / 22px 22px,
    var(--hu-blue);
}

.inbox-header:focus-visible {
  outline: 3px solid var(--hu-green);
  outline-offset: -3px;
}

.inbox-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 12px;
  background: #ffffff;
  color: var(--hu-blue);
  font-size: 1.15rem;
}

.inbox-icon__dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 12px;
  height: 12px;
  border: 2px solid var(--hu-blue);
  border-radius: 50%;
  background: #f59e0b;
}

.inbox-heading {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.inbox-title {
  font-size: 1.15rem;
  font-weight: 800;
}

.inbox-sub {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
}

.inbox-count {
  min-width: 2rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-weight: 800;
  text-align: center;
}

.inbox-chevron {
  transition: transform 0.2s ease;
}

.inbox-chevron.is-open {
  transform: rotate(180deg);
}

.inbox-body {
  padding: 0.75rem;
}

.inbox-empty {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0.5rem;
  font-size: 0.9rem;
  color: var(--hu-text-muted);
}

.inbox-empty__envelope {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border: 2px dashed var(--hu-border);
  border-radius: 10px;
  font-size: 1.1rem;
}

.letters {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Each completed task is an airmail letter */
.letter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1rem 0.85rem 1.35rem;
  background: #fcfdfb;
  border: 1px solid var(--hu-border);
  border-radius: 12px;
  overflow: hidden;
}

/* Airmail stripes down the left edge, in brand colors */
.letter::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 6px;
  background: repeating-linear-gradient(
    -45deg,
    var(--hu-blue) 0 6px,
    #ffffff 6px 9px,
    var(--hu-green) 9px 15px,
    #ffffff 15px 18px
  );
}

.letter.is-new {
  border-color: var(--hu-green);
  animation: letter-arrive 1.2s ease;
}

@keyframes letter-arrive {
  0% { background: var(--hu-green-soft); }
  100% { background: #fcfdfb; }
}

/* Postage stamp with a perforated edge */
.letter-stamp {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.6rem;
  flex-shrink: 0;
  border-radius: 3px;
  background: var(--hu-green);
  color: #ffffff;
  font-size: 0.95rem;
  outline: 2px dashed rgba(255, 255, 255, 0.9);
  outline-offset: -5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  transform: rotate(-5deg);
}

.letter:nth-child(even) .letter-stamp {
  background: var(--hu-blue);
  transform: rotate(4deg);
}

.letter-body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.letter-subject {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.letter-title {
  font-weight: 700;
  color: var(--hu-text);
  overflow-wrap: anywhere;
}

.letter-new {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.letter-from {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--hu-text-muted);
}

.letter-reopen.p-button {
  flex-shrink: 0;
  font-weight: 600;
}

/* Letter arrives: drop in from above */
.letter-move,
.letter-enter-active,
.letter-leave-active {
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.letter-enter-from {
  opacity: 0;
  transform: translateY(-16px) rotate(-1deg);
}

.letter-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

/* ══ Undo bar ═══════════════════════════════════════════════════════════════ */
.snackbar {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: calc(100vw - 2rem);
  padding: 0.75rem 0.75rem 0.75rem 1.1rem;
  border-radius: 14px;
  background: #1c2430;
  color: #ffffff;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  transform: translateX(-50%);
}

.snackbar__text {
  min-width: 0;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snackbar__undo {
  padding: 0.4rem 0.9rem;
  border: none;
  border-radius: 999px;
  background: var(--hu-green);
  color: #ffffff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.snackbar__undo:hover {
  background: var(--hu-green-700);
}

.snackbar__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.snackbar__close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.snack-enter-active,
.snack-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.snack-enter-from,
.snack-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}

@media (max-width: 600px) {
  .inbox-sub {
    display: none;
  }

  /* Stamp | text, with Reopen tucked under the text */
  .letter {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    column-gap: 0.8rem;
    row-gap: 0.25rem;
  }

  .letter-subject,
  .letter-from {
    flex-wrap: wrap;
  }

  .letter-title {
    overflow-wrap: break-word;
  }

  .letter-reopen.p-button {
    grid-column: 2;
    justify-self: start;
    margin-left: -0.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .task-move, .task-enter-active, .task-leave-active,
  .letter-move, .letter-enter-active, .letter-leave-active,
  .snack-enter-active, .snack-leave-active {
    transition: none;
  }

  .letter.is-new {
    animation: none;
  }
}

/* ══ Room heading: description ══════════════════════════════════════════════ */
.room-heading {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  flex: 1;
}

.room-description {
  margin: 0;
  max-width: 48rem;
  font-size: 0.98rem;
  line-height: 1.5;
  color: var(--hu-text-muted);
  white-space: pre-line;
}

.inline-link,
.add-description {
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
}

.inline-link {
  margin-left: 0.35rem;
  padding: 0;
  color: var(--hu-blue);
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.add-description {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  padding: 0.3rem 0.7rem;
  border: 1px dashed var(--hu-border);
  border-radius: 999px;
  color: var(--hu-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.add-description:hover {
  border-color: var(--hu-blue);
  color: var(--hu-blue);
}

.optional-tag {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--hu-bg);
  font-size: 0.7rem;
  font-weight: 600;
}

/* ══ Copyable room code ═════════════════════════════════════════════════════ */
.code-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.code-badge:hover {
  background: var(--hu-blue-600);
}

.code-badge:active {
  transform: scale(0.97);
}

.code-badge:focus-visible {
  outline: 3px solid var(--hu-green);
  outline-offset: 2px;
}

.code-badge .pi {
  font-size: 0.85rem;
}

.code-badge__label {
  padding-left: 0.55rem;
  border-left: 1px solid rgba(255, 255, 255, 0.35);
  font-family: Inter, system-ui, sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0;
}

.code-badge.is-copied {
  background: var(--hu-green);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ══ Team-effort copy ═══════════════════════════════════════════════════════ */
.column-header--tasks {
  align-items: flex-start;
}

.column-header--tasks .btn-add-task {
  flex-shrink: 0;
  white-space: nowrap;
}

.section-sub {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  color: var(--hu-text-muted);
}

.section-sub .pi,
.dialog-hint .pi {
  color: var(--hu-blue);
  font-size: 0.85rem;
}

.dialog-hint {
  margin: 0.6rem 0 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--hu-text-muted);
}

/* ══ Task permissions ═══════════════════════════════════════════════════════ */
.members-hint {
  margin: -0.4rem 0 0.75rem;
  font-size: 0.8rem;
  color: var(--hu-text-muted);
}

.perm-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.35rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--hu-blue-soft);
  color: var(--hu-blue-600);
  font-size: 0.68rem;
  font-weight: 700;
  vertical-align: middle;
}

.perm-badge .pi {
  font-size: 0.6rem;
}

.perm-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  align-self: flex-start;
  margin-top: 0.2rem;
  padding: 0.2rem 0.6rem 0.2rem 0.25rem;
  border: 1px solid var(--hu-border);
  border-radius: 999px;
  background: var(--hu-surface);
  color: var(--hu-text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.perm-toggle:hover:not(:disabled) {
  border-color: var(--hu-blue);
}

.perm-toggle:disabled {
  opacity: 0.6;
  cursor: progress;
}

.perm-toggle__switch {
  position: relative;
  width: 26px;
  height: 15px;
  border-radius: 999px;
  background: #cbd2dc;
  transition: background 0.15s ease;
}

.perm-toggle__switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease;
}

.perm-toggle.is-on {
  border-color: var(--hu-blue);
  background: var(--hu-blue-soft);
  color: var(--hu-blue-600);
}

.perm-toggle.is-on .perm-toggle__switch {
  background: var(--hu-blue);
}

.perm-toggle.is-on .perm-toggle__switch::after {
  transform: translateX(11px);
}

@media (max-width: 600px) {
  .code-badge__label {
    display: none;
  }
}

/* ══ "The team is waiting on you" ═══════════════════════════════════════════ */
.task-card.is-waiting-on-me {
  border: 1.5px solid var(--hu-amber);
  border-left-width: 4px;
  background: linear-gradient(90deg, var(--hu-amber-soft), var(--hu-surface) 55%);
  animation: waiting-glow 2.4s ease-in-out infinite;
}

@keyframes waiting-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.0), var(--hu-shadow); }
  50% { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.18), var(--hu-shadow); }
}

.waiting-flag {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-self: flex-start;
  margin-bottom: 0.2rem;
  padding: 0.2rem 0.65rem 0.2rem 0.2rem;
  border-radius: 999px;
  background: #fde7b0;
  color: var(--hu-amber-text);
  font-size: 0.78rem;
}

.waiting-flag strong {
  font-weight: 800;
}

.waiting-flag__sub {
  font-weight: 500;
  opacity: 0.85;
}

.waiting-flag__sub::before {
  content: '·';
  margin-right: 0.4rem;
}

@media (prefers-reduced-motion: reduce) {
  .task-card.is-waiting-on-me {
    animation: none;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18), var(--hu-shadow);
  }
}
</style>
