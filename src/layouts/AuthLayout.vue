<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const illustration = computed(() => (route.meta.illustration as string | undefined) ?? '/login.png')
const illustrationAlt = computed(() => (route.meta.illustrationAlt as string | undefined) ?? '')
</script>

<template>
  <div class="auth-page">
    <section class="auth-art">
      <RouterLink to="/" class="auth-brand" aria-label="HuddleUP home">
        <img src="/HuddleUP Logo.svg" alt="" class="auth-brand-logo" />
        <span class="auth-brand-name">HuddleUP</span>
      </RouterLink>

      <div class="auth-illustration-wrap">
        <img :src="illustration" :alt="illustrationAlt" class="auth-illustration" />
      </div>
    </section>

    <section class="auth-panel">
      <RouterView />
    </section>
  </div>
</template>

<!-- Not scoped: these classes are shared by LoginPage and SignupPage. All prefixed with `auth-`. -->
<style>
.auth-page {
  --auth-blue: #3571cb;
  --auth-ink: #191919;
  --auth-dot: rgba(53, 113, 203, 0.22);
  --auth-dot-on-blue: rgba(255, 255, 255, 0.16);
  --auth-edge: 144px;

  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(26rem, 40%);
  min-height: 100vh;
  min-height: 100dvh;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: #ffffff;
}

/* ---------- Left: brand + illustration on a square dot grid ---------- */
.auth-art {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 2.5rem clamp(1.5rem, 4vw, 3.5rem);
  /* Leave room for the dithered edge so the illustration never sits under it */
  padding-right: calc(var(--auth-edge) * 0.6);
  isolation: isolate;
}

.auth-art::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  /* 3px square dots every 22px */
  background: conic-gradient(at 3px 3px, transparent 75%, var(--auth-dot) 0) 0 0 / 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse 75% 70% at 45% 55%, #000 30%, transparent 100%);
  mask-image: radial-gradient(ellipse 75% 70% at 45% 55%, #000 30%, transparent 100%);
}

.auth-brand {
  display: flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.85rem;
  text-decoration: none;
}

.auth-brand-logo {
  height: clamp(3rem, 5vw, 4.5rem);
  width: auto;
}

.auth-brand-name {
  font-size: clamp(2rem, 3.2vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--auth-ink);
}

.auth-illustration-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.auth-illustration {
  width: 100%;
  max-width: 40rem;
  max-height: 65vh;
  object-fit: contain;
}

/* ---------- Right: blue panel with dithered left edge ---------- */
.auth-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem clamp(1.5rem, 4vw, 4rem);
  background:
    conic-gradient(at 3px 3px, transparent 75%, var(--auth-dot-on-blue) 0) 0 0 / 22px 22px,
    var(--auth-blue);
}

.auth-panel::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 100%;
  width: var(--auth-edge);
  background: url('/dither-edge.svg') left top / var(--auth-edge) auto repeat-y;
  pointer-events: none;
}

/* ---------- Card + form (used by the pages) ---------- */
.auth-card.p-card {
  position: relative;
  width: 100%;
  max-width: 26rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 1.75rem;
  box-shadow: 0 20px 50px rgba(10, 30, 70, 0.25);
  color: #ffffff;
}

.auth-card .p-card-body {
  padding: 2.25rem 2rem 2rem;
}

.auth-title {
  margin: 0 0 1.5rem;
  text-align: center;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #ffffff;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.auth-field label {
  margin-left: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
}

.auth-field .p-inputtext {
  width: 100%;
  border: none;
  font-size: 1rem;
}

.auth-field .p-inputtext:focus {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.55);
}

.auth-actions {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.auth-message {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
}

.auth-message.is-error { color: #ffd2d2; }
.auth-message.is-success { color: #c9f7b0; }

.auth-helper {
  margin: 0.5rem 0 0;
  text-align: center;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
}

.auth-link {
  margin-left: 0.3rem;
  font-weight: 700;
  color: #ffffff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.auth-link:hover { text-decoration: none; }

/* ---------- Tablet & phone: single column, no illustration ---------- */
@media (max-width: 900px) {
  .auth-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    background:
      conic-gradient(at 3px 3px, transparent 75%, var(--auth-dot-on-blue) 0) 0 0 / 22px 22px,
      var(--auth-blue);
  }

  .auth-art {
    padding: 1.5rem 1rem 0;
    align-items: center;
  }

  .auth-art::before,
  .auth-illustration-wrap,
  .auth-panel::before {
    display: none;
  }

  .auth-brand-name { color: #ffffff; }

  .auth-brand-logo {
    height: 2.75rem;
    padding: 0.3rem;
    border-radius: 0.75rem;
    background: #ffffff;
  }

  .auth-panel {
    align-items: flex-start;
    padding: 1.5rem 1rem 2.5rem;
    background: none;
  }

  .auth-card .p-card-body {
    padding: 1.75rem 1.25rem 1.5rem;
  }
}
</style>
