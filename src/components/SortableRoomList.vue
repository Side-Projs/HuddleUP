<script setup lang="ts">
// Sidebar room list the user can reorder to prioritize rooms.
// - Drag the dotted grip with a mouse, pen or finger (pointer events, so touch works too)
// - Or focus the grip and press ↑ / ↓
// The parent owns the order: we only emit `move(from, to)`.
import { ref, nextTick } from 'vue'
import type { RoomData } from '@/composables/useRooms'

const props = defineProps<{
  rooms: RoomData[]
  icon: string
  label: string
}>()

const emit = defineEmits<{ (e: 'move', from: number, to: number): void }>()

const listEl = ref<HTMLElement | null>(null)
const draggingId = ref<string | null>(null)
const announcement = ref('')

const announce = (room: RoomData, index: number) => {
  announcement.value = `${room.title} moved to position ${index + 1} of ${props.rooms.length}`
}

// ── Pointer drag ────────────────────────────────────────────────────────────
const onPointerDown = (e: PointerEvent, room: RoomData) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  draggingId.value = room.room_id
  // Listen on window, not the grip: the grip's row is moved in the DOM while
  // reordering, and a moved element loses pointer capture mid-drag.
  const pointerId = e.pointerId

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    const rows = Array.from(listEl.value?.querySelectorAll<HTMLElement>('[data-room-row]') ?? [])
    const from = props.rooms.findIndex((r) => r.room_id === draggingId.value)
    if (from < 0) return

    // Target = first row whose vertical middle is below the pointer
    let to = rows.length - 1
    for (let i = 0; i < rows.length; i++) {
      const box = rows[i]!.getBoundingClientRect()
      if (ev.clientY < box.top + box.height / 2) {
        to = i
        break
      }
    }
    if (to !== from) emit('move', from, to)
  }

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    const index = props.rooms.findIndex((r) => r.room_id === draggingId.value)
    if (index >= 0) announce(props.rooms[index]!, index)
    draggingId.value = null
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

// ── Keyboard ────────────────────────────────────────────────────────────────
const onKeydown = async (e: KeyboardEvent, index: number) => {
  const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
  if (to < 0 || to >= props.rooms.length) return
  e.preventDefault()
  const room = props.rooms[index]!
  emit('move', index, to)
  await nextTick()
  // Keep focus on the same room's grip after it moves
  listEl.value?.querySelector<HTMLElement>(`[data-grip="${room.room_id}"]`)?.focus()
  announce(room, to)
}
</script>

<template>
  <div ref="listEl">
  <TransitionGroup name="room-row" tag="div" class="room-list" role="list" :aria-label="label">
    <div
      v-for="(room, index) in rooms"
      :key="room.room_id"
      data-room-row
      role="listitem"
      class="room-row"
      :class="{ 'is-dragging': draggingId === room.room_id }"
    >
      <RouterLink :to="`/main/rooms/${room.room_code}`" class="nav-item" active-class="active">
        <i :class="icon" />
        <span>{{ room.title }}</span>
      </RouterLink>

      <button
        v-if="rooms.length > 1"
        type="button"
        class="grip"
        :data-grip="room.room_id"
        :aria-label="`Reorder ${room.title}. Use the up and down arrow keys.`"
        title="Drag to reorder"
        @pointerdown="onPointerDown($event, room)"
        @keydown="onKeydown($event, index)"
        @click.prevent
      >
        <span class="grip__dots" aria-hidden="true" />
      </button>
    </div>
  </TransitionGroup>
  <span class="sr-only" aria-live="polite">{{ announcement }}</span>
  </div>
</template>

<style scoped>
.room-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.room-row {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: 10px;
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.room-row .nav-item {
  flex: 1;
  min-width: 0;
  /* leave room for the grip on the right */
  padding-right: 2rem;
}

/* The row being dragged lifts off the sidebar */
.room-row.is-dragging {
  z-index: 2;
  background: rgba(255, 255, 255, 0.22);
  box-shadow: 0 8px 20px rgba(10, 30, 70, 0.3);
  transform: scale(1.02);
}

.room-row-move {
  transition: transform 0.18s ease;
}

/* ── Grip: a 2×3 dot grid, matching the site's dot pattern ── */
.grip {
  position: absolute;
  right: 0.3rem;
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.9rem;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  cursor: grab;
  touch-action: none; /* let the finger drag instead of scrolling the sidebar */
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.room-row:hover .grip,
.grip:focus-visible,
.room-row.is-dragging .grip {
  opacity: 1;
}

/* Touch screens have no hover: always show the grip */
@media (hover: none) {
  .grip {
    opacity: 0.75;
  }
}

.grip:hover {
  background: rgba(255, 255, 255, 0.16);
}

.grip:active,
.room-row.is-dragging .grip {
  cursor: grabbing;
}

.grip:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: -2px;
}

.grip__dots {
  width: 8px;
  height: 14px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 1.3px, transparent 1.6px) 0 0 / 4px 5px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .room-row,
  .room-row-move {
    transition: none;
  }
}
</style>
