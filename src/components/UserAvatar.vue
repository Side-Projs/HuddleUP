<script setup lang="ts">
import { computed } from 'vue'
import { avatarSrc } from '@/lib/avatars'

const props = withDefaults(
  defineProps<{
    /** Stored avatar id, e.g. "pixel-3" */
    avatar?: string | null
    name?: string | null
    /** Pixel size of the circle */
    size?: number
    /** Show a small green check badge (e.g. "finished this task") */
    done?: boolean
    /** Fade out (e.g. "hasn't finished yet") */
    muted?: boolean
  }>(),
  { avatar: null, name: '', size: 40, done: false, muted: false },
)

const src = computed(() => avatarSrc(props.avatar))

const initials = computed(() => {
  const parts = (props.name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
})

// Stable pastel color per name for the initials fallback
const fallbackBg = computed(() => {
  let h = 0
  for (const ch of props.name || '') h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 55% 85%)`
})
</script>

<template>
  <span
    class="user-avatar"
    :class="{ 'is-muted': muted }"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` }"
    :title="name || undefined"
  >
    <img v-if="src" :src="src" :alt="name ? `${name}'s avatar` : ''" class="user-avatar__img" />
    <span v-else class="user-avatar__initials" :style="{ background: fallbackBg }" aria-hidden="true">
      {{ initials }}
    </span>
    <span v-if="done" class="user-avatar__badge" aria-hidden="true"><i class="pi pi-check" /></span>
  </span>
</template>

<style scoped>
.user-avatar {
  position: relative;
  display: inline-grid;
  flex-shrink: 0;
  border-radius: 50%;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.user-avatar.is-muted {
  opacity: 0.45;
  filter: grayscale(0.6);
}

.user-avatar__img,
.user-avatar__initials {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.user-avatar__img {
  object-fit: cover;
  background: #ffffff;
}

.user-avatar__initials {
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #1c2430;
}

.user-avatar__badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  place-items: center;
  width: 42%;
  height: 42%;
  min-width: 14px;
  min-height: 14px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: var(--hu-green, #6a9c39);
  color: #ffffff;
}

.user-avatar__badge i {
  font-size: 0.5em;
  font-weight: 900;
}
</style>
