<script setup lang="ts">
import { useAuth } from './composables/useAuth';
const { initAuth } = useAuth();
initAuth()
</script>

<template>
  <div class="app-shell">
    <div class="app-content">
      <RouterView />
    </div>
  </div>
</template>

<style>
/* ── HuddleUP design tokens (one blue, one green, used everywhere) ── */
:root {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color-scheme: light;

  --hu-blue: #3571cb;        /* brand blue: sidebar, auth panel, progress */
  --hu-blue-600: #2d62b3;    /* hover */
  --hu-blue-soft: #e8f0fb;
  --hu-green: #6a9c39;       /* brand green: headings, primary fills */
  --hu-green-700: #527c2a;   /* hover / text on light green */
  --hu-green-soft: #eef6e6;
  --hu-amber: #f59e0b;       /* "the team is waiting on you" */
  --hu-amber-soft: #fff7e6;
  --hu-amber-text: #92400e;

  --hu-bg: #f5f7fa;
  --hu-surface: #ffffff;
  --hu-border: #e4e8ee;
  --hu-text: #1c2430;
  --hu-text-muted: #5f6b7a;

  --hu-radius: 16px;
  --hu-shadow: 0 2px 10px rgba(16, 24, 40, 0.05);
  --hu-dot-on-blue: rgba(255, 255, 255, 0.14);
}

html,
body,
#app {
  min-height: 100%;
  margin: 0;
  background: var(--hu-bg);
  color: var(--hu-text);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

button,
input,
textarea,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  position: relative;
}

.app-content {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
