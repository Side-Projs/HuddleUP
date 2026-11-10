<script setup lang="ts">
// Animated, self-playing mini room that shows how HuddleUP works:
// teammates check off a shared task → "the team is waiting on you" → you finish →
// the task is delivered to the Completed inbox. Loops. Decorative only (aria-hidden).
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { avatarSrc } from '@/lib/avatars'

const people = [
  { name: 'Mila', avatar: 'character-3' },
  { name: 'Leo', avatar: 'character-4' },
  { name: 'Jasmine', avatar: 'character-11' },
  { name: 'You', avatar: 'character-6' },
]

// step: 0 = nobody done, 1..4 = that many people done, 5 = delivered to inbox, 6 = hold
const STEPS = 7
const step = ref(0)
const doneCount = computed(() => Math.min(step.value, 4))
const isWaitingOnYou = computed(() => step.value === 3)
const delivered = computed(() => step.value >= 5)
const progress = computed(() => (doneCount.value / 4) * 100)

let timer: ReturnType<typeof setInterval> | undefined
const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const tick = () => {
  if (document.hidden) return
  step.value = (step.value + 1) % STEPS
}

onMounted(() => {
  if (reduceMotion) {
    step.value = 5 // show the finished state, no animation
    return
  }
  timer = setInterval(tick, 1400)
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="demo" aria-hidden="true">
    <div class="demo-window">
      <div class="demo-bar">
        <span /><span /><span />
        <div class="demo-code">ABC123 <i class="pi pi-copy" /></div>
      </div>

      <div class="demo-body">
        <div class="demo-room">
          <div class="demo-room__title">Capstone Sprint</div>
          <div class="demo-progress"><div class="demo-progress__fill" :style="{ width: progress + '%' }" /></div>
        </div>

        <!-- The shared task -->
        <Transition name="deliver" mode="out-in">
          <div v-if="!delivered" class="demo-task" :class="{ 'is-waiting': isWaitingOnYou }">
            <Transition name="flag">
              <div v-if="isWaitingOnYou" class="demo-flag">
                <img :src="avatarSrc('character-6')!" alt="" /> The team is waiting on you
              </div>
            </Transition>
            <div class="demo-task__row">
              <span class="demo-check" :class="{ 'is-on': step >= 4 }"><i class="pi pi-check" /></span>
              <span class="demo-task__title">Test the app on your phone</span>
            </div>
            <div class="demo-task__meta">
              <div class="demo-stack">
                <span
                  v-for="(p, i) in people"
                  :key="p.name"
                  class="demo-face"
                  :class="{ 'is-done': i < doneCount, 'is-pop': i === doneCount - 1 }"
                >
                  <img :src="avatarSrc(p.avatar)!" alt="" />
                  <span class="demo-face__badge"><i class="pi pi-check" /></span>
                </span>
              </div>
              <span class="demo-count"><strong>{{ doneCount }} of 4</strong> done</span>
            </div>
          </div>
          <div v-else class="demo-done">
            <i class="pi pi-sparkles" /> All caught up! The whole team finished.
          </div>
        </Transition>

        <!-- The inbox -->
        <div class="demo-inbox">
          <div class="demo-inbox__head">
            <span class="demo-inbox__icon"><i class="pi pi-inbox" /><span v-if="delivered" class="demo-inbox__dot" /></span>
            Completed
            <span class="demo-inbox__count">{{ delivered ? 2 : 1 }}</span>
          </div>
          <TransitionGroup name="letter" tag="div" class="demo-letters">
            <div v-if="delivered" key="new" class="demo-letter is-new">
              <span class="demo-stamp"><i class="pi pi-check" /></span>
              <span class="demo-letter__title">Test the app on your phone</span>
              <span class="demo-new">New</span>
            </div>
            <div key="old" class="demo-letter">
              <span class="demo-stamp demo-stamp--blue"><i class="pi pi-check" /></span>
              <span class="demo-letter__title">Write the project proposal</span>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo {
  width: 100%;
  max-width: 440px;
}

.demo-window {
  overflow: hidden;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 30px 60px rgba(15, 35, 80, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.4);
}

.demo-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.7rem 0.9rem;
  background: #f1f4f9;
  border-bottom: 1px solid var(--hu-border);
}

.demo-bar > span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d5dbe5;
}

.demo-code {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  padding: 0.2rem 0.55rem;
  border-radius: 7px;
  background: var(--hu-blue);
  color: #ffffff;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.demo-code .pi {
  font-size: 0.65rem;
}

.demo-body {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  min-height: 360px;
  padding: 1rem;
}

.demo-room__title {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--hu-green);
}

.demo-progress {
  height: 8px;
  margin-top: 0.45rem;
  border-radius: 999px;
  background: var(--hu-blue-soft);
  overflow: hidden;
}

.demo-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: var(--hu-blue);
  transition: width 0.6s ease;
}

/* Task */
.demo-task {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem 0.95rem;
  border: 1.5px solid var(--hu-border);
  border-radius: 14px;
  background: #ffffff;
  transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
}

.demo-task.is-waiting {
  border-color: var(--hu-amber);
  background: linear-gradient(90deg, var(--hu-amber-soft), #ffffff 60%);
  box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.18);
}

.demo-flag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  align-self: flex-start;
  padding: 0.15rem 0.55rem 0.15rem 0.15rem;
  border-radius: 999px;
  background: #fde7b0;
  color: var(--hu-amber-text);
  font-size: 0.7rem;
  font-weight: 800;
}

.demo-flag img {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.demo-task__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.demo-check {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: 2px solid #cbd2dc;
  border-radius: 6px;
  color: transparent;
  font-size: 0.6rem;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.demo-check.is-on {
  border-color: var(--hu-green);
  background: var(--hu-green);
  color: #ffffff;
  transform: scale(1.1);
}

.demo-task__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--hu-text);
}

.demo-task__meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-left: 1.75rem;
}

.demo-stack {
  display: flex;
}

.demo-face {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px #ffffff;
  opacity: 0.45;
  filter: grayscale(0.7);
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.demo-face + .demo-face {
  margin-left: -8px;
}

.demo-face img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.demo-face.is-done {
  opacity: 1;
  filter: none;
}

.demo-face.is-pop {
  animation: face-pop 0.45s ease;
}

@keyframes face-pop {
  0% { transform: scale(1); }
  45% { transform: scale(1.25) translateY(-3px); }
  100% { transform: scale(1); }
}

.demo-face__badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: var(--hu-green);
  color: #ffffff;
  font-size: 0.4rem;
  transform: scale(0);
  transition: transform 0.25s ease;
}

.demo-face.is-done .demo-face__badge {
  transform: scale(1);
}

.demo-count {
  font-size: 0.78rem;
  color: var(--hu-text-muted);
}

.demo-count strong {
  color: var(--hu-text);
}

/* Inbox */
.demo-inbox {
  margin-top: auto;
  overflow: hidden;
  border: 1px solid var(--hu-border);
  border-radius: 14px;
}

.demo-inbox__head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 0.8rem;
  color: #ffffff;
  font-weight: 800;
  background:
    conic-gradient(at 3px 3px, transparent 75%, var(--hu-dot-on-blue) 0) 0 0 / 22px 22px,
    var(--hu-blue);
}

.demo-inbox__icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #ffffff;
  color: var(--hu-blue);
  font-size: 0.8rem;
}

.demo-inbox__dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--hu-blue);
  border-radius: 50%;
  background: #f59e0b;
}

.demo-inbox__count {
  margin-left: auto;
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 0.8rem;
}

.demo-letters {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.6rem;
}

.demo-letter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.65rem 0.5rem 0.95rem;
  border: 1px solid var(--hu-border);
  border-radius: 10px;
  background: #fcfdfb;
  overflow: hidden;
}

.demo-letter::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: repeating-linear-gradient(-45deg, var(--hu-blue) 0 5px, #fff 5px 8px, var(--hu-green) 8px 13px, #fff 13px 16px);
}

.demo-letter.is-new {
  border-color: var(--hu-green);
}

.demo-stamp {
  display: grid;
  place-items: center;
  width: 26px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 3px;
  background: var(--hu-green);
  color: #ffffff;
  font-size: 0.7rem;
  outline: 2px dashed rgba(255, 255, 255, 0.9);
  outline-offset: -4px;
  transform: rotate(-5deg);
}

.demo-stamp--blue {
  background: var(--hu-blue);
  transform: rotate(4deg);
}

.demo-letter__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--hu-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-new {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
}

.demo-done {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 1.4rem 1rem;
  border: 1.5px dashed #cfe3bb;
  border-radius: 14px;
  background: var(--hu-green-soft);
  color: var(--hu-green-700);
  font-size: 0.88rem;
  font-weight: 700;
}

/* Transitions */
.deliver-leave-active {
  transition: transform 0.6s cubic-bezier(0.5, 0, 0.75, 0), opacity 0.6s ease;
}

.deliver-leave-to {
  opacity: 0;
  transform: translateY(140px) scale(0.6) rotate(-4deg);
}

.deliver-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.deliver-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.flag-enter-active,
.flag-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.flag-enter-from,
.flag-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.letter-enter-active {
  transition: transform 0.5s 0.35s ease, opacity 0.5s 0.35s ease;
}

.letter-enter-from {
  opacity: 0;
  transform: translateY(-18px) rotate(-2deg);
}

.letter-leave-active {
  transition: opacity 0.3s ease;
}

.letter-leave-to {
  opacity: 0;
}

.letter-move {
  transition: transform 0.4s ease;
}
</style>
