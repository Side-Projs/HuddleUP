<script setup lang="ts">
import { useAuth } from './composables/useAuth';
const { initAuth } = useAuth();
initAuth()
</script>

<template>
  <div class="app-shell">
    <div class="app-background" />
    <div class="app-content">
      <RouterView />
    </div>
  </div>
</template>

<style>
:root {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color-scheme: light;
  --surface-bg: white;
  --surface-panel: #ffffff;
  --surface-border: rgba(15, 23, 42, 0.1);
  --surface-muted: #64748b;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --accent: #0f766e;
  --accent-soft: rgba(15, 118, 110, 0.12);
  --shadow-soft: 0 20px 48px rgba(15, 23, 42, 0.08);
  --radius-lg: 24px;
}

html,
body,
#app {
  min-height: 100%;
  margin: 0;
  background: var(--surface-bg);
  color: var(--text-primary);
}

body {
  background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 25%),
              linear-gradient(180deg, #f7fdff 0%, #eff6ff 100%);
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

.app-background {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.14), transparent 28%),
              radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.12), transparent 30%);
  pointer-events: none;
  z-index: -1;
}

.app-content {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
