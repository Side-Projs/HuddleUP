<script setup lang="ts">
import HeroDemo from '@/components/HeroDemo.vue'

// Decorative avatars drifting around the hero
const floaters = [
  { src: '/avatars/character-1.svg', cls: 'f1' },
  { src: '/avatars/character-10.svg', cls: 'f2' },
  { src: '/avatars/character-5.svg', cls: 'f3' },
  { src: '/avatars/character-14.svg', cls: 'f4' },
]

const steps = [
  {
    icon: 'pi pi-copy',
    title: 'Create a room, share the code',
    text: 'Start a room for your group and send everyone the 6-character code. One click copies it.',
  },
  {
    icon: 'pi pi-users',
    title: 'Everyone gets every task',
    text: 'Each task goes to the whole team. Everyone does it, and everyone checks it off.',
  },
  {
    icon: 'pi pi-inbox',
    title: 'Done means everyone is done',
    text: 'A task is only finished when the last teammate checks it. Then it lands in your Completed inbox.',
  },
]

</script>

<template>
  <div class="landing">
    <!-- ── Nav ── -->
    <header class="nav">
      <RouterLink to="/" class="nav-brand">
        <img src="/HuddleUP Logo.svg" alt="" />
        <span>HuddleUP</span>
      </RouterLink>
      <nav class="nav-actions" aria-label="Account">
        <RouterLink to="/login" class="btn btn--ghost">Log In</RouterLink>
        <RouterLink to="/signup" class="btn btn--primary">Get Started</RouterLink>
      </nav>
    </header>

    <!-- ── Hero ── -->
    <section class="hero">
      <div class="hero-bg" aria-hidden="true">
        <img v-for="f in floaters" :key="f.cls" :src="f.src" alt="" class="floater" :class="f.cls" />
      </div>

      <div class="hero-inner">
        <div class="hero-copy">
          <span class="eyebrow"><i class="pi pi-users" /> For teams, study groups &amp; class projects</span>
          <h1 class="hero-title">
            Huddle up.<br />
            <span class="hero-title__accent">Finish together.</span>
          </h1>
          <p class="hero-sub">
            HuddleUP is a shared checklist where every task is a team effort.
            Everyone does it, everyone checks it off, and it's only <strong>done</strong> when the whole team is.
          </p>
          <div class="hero-ctas">
            <RouterLink to="/signup" class="btn btn--primary btn--lg">
              Create a free account <i class="pi pi-arrow-right" />
            </RouterLink>
            <RouterLink to="/login" class="btn btn--light btn--lg">I already have one</RouterLink>
          </div>
          <p class="hero-note">
            <i class="pi pi-book" />
            A project for CMSC 127: File Processing and Database Systems · UP Cebu
          </p>
        </div>

        <div class="hero-demo">
          <HeroDemo />
        </div>
      </div>
    </section>

    <!-- ── How it works ── -->
    <section class="section" aria-labelledby="how-title">
      <h2 id="how-title" class="section-title">How it works</h2>
      <p class="section-lead">Three steps, no learning curve.</p>
      <ol class="steps">
        <li v-for="(s, i) in steps" :key="s.title" class="step">
          <span class="step-num">{{ i + 1 }}</span>
          <span class="step-icon"><i :class="s.icon" /></span>
          <h3 class="step-title">{{ s.title }}</h3>
          <p class="step-text">{{ s.text }}</p>
        </li>
      </ol>
    </section>

    <!-- ── Final CTA ── -->
    <section class="cta">
      <div class="cta-inner">
        <h2 class="cta-title">Ready to huddle?</h2>
        <p class="cta-sub">Make a room, share the code, and get your team over the line together.</p>
        <RouterLink to="/signup" class="btn btn--white btn--lg">
          Get started, it's free <i class="pi pi-arrow-right" />
        </RouterLink>
      </div>
    </section>

    <footer class="footer">
      <span>© {{ new Date().getFullYear() }} HuddleUP</span>
      <span class="footer-sep">·</span>
      <a href="https://github.com/Side-Projs/HuddleUP" target="_blank" rel="noopener noreferrer" class="footer-gh">
        <i class="pi pi-github" aria-hidden="true" /> View on GitHub
      </a>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  background: var(--hu-bg);
  color: var(--hu-text);
  font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.15rem;
  border: 1.5px solid transparent;
  border-radius: 999px;
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:focus-visible {
  outline: 3px solid var(--hu-amber);
  outline-offset: 2px;
}

.btn--lg {
  padding: 0.85rem 1.5rem;
  font-size: 1rem;
}

.btn--primary {
  background: var(--hu-green);
  color: #ffffff;
}

.btn--primary:hover {
  background: var(--hu-green-700);
}

.btn--ghost {
  color: #ffffff;
}

.btn--ghost:hover {
  background: rgba(255, 255, 255, 0.14);
}

.btn--light {
  border-color: rgba(255, 255, 255, 0.55);
  color: #ffffff;
}

.btn--light:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: #ffffff;
}

.btn--white {
  background: #ffffff;
  color: var(--hu-blue);
}

.btn--white:hover {
  background: var(--hu-blue-soft);
}

/* ── Nav (sits on the blue hero) ── */
.nav {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.1rem clamp(1rem, 4vw, 2.5rem);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-decoration: none;
}

.nav-brand img {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0.25rem;
  border-radius: 0.6rem;
  background: #ffffff;
}

.nav-actions {
  display: flex;
  gap: 0.4rem;
}

/* ── Hero ── */
.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(6rem, 12vw, 8rem) clamp(1rem, 4vw, 2.5rem) clamp(5rem, 9vw, 7rem);
  color: #ffffff;
  background:
    conic-gradient(at 3px 3px, transparent 75%, var(--hu-dot-on-blue) 0) 0 0 / 22px 22px,
    var(--hu-blue);
  animation: dots-drift 30s linear infinite;
}

/* The dot grid slowly drifts */
@keyframes dots-drift {
  from { background-position: 0 0, 0 0; }
  to { background-position: 220px 110px, 0 0; }
}

/* Dithered edge into the page below, same as the login page */
.hero::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 72px;
  background: var(--hu-bg);
  -webkit-mask: url('/dither-edge-h.svg') left bottom / auto 72px repeat-x;
  mask: url('/dither-edge-h.svg') left bottom / auto 72px repeat-x;
  pointer-events: none;
}

.hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.floater {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.6), 0 10px 24px rgba(0, 0, 0, 0.18);
  opacity: 0.9;
  animation: float 9s ease-in-out infinite;
}

/* Kept to the empty space around the demo so they never sit behind the headline */
.f1 { top: 13%; left: 47%; width: 50px; height: 50px; animation-delay: 0s; }
.f2 { bottom: 15%; left: 46%; width: 44px; height: 44px; animation-delay: -3s; opacity: 0.75; }
.f3 { top: 18%; right: 2.5%; animation-delay: -5s; }
.f4 { bottom: 16%; right: 3.5%; width: 52px; height: 52px; animation-delay: -7s; }

@media (max-width: 1200px) {
  .floater { display: none; }
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(-4deg); }
  33% { transform: translate(10px, -16px) rotate(3deg); }
  66% { transform: translate(-8px, 8px) rotate(-1deg); }
}

.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(2rem, 5vw, 4rem);
  max-width: 1200px;
  margin: 0 auto;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 0.82rem;
  font-weight: 600;
}

.hero-title {
  margin: 1.1rem 0 0;
  font-size: clamp(2.6rem, 6vw, 4.4rem);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.hero-title__accent {
  color: #c9f29b;
}

.hero-sub {
  max-width: 34rem;
  margin: 1.25rem 0 0;
  font-size: clamp(1rem, 1.6vw, 1.15rem);
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.92);
}

.hero-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.75rem;
}

.hero-note {
  margin: 1.1rem 0 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
}

/* Inline so the icon stays with the text when it wraps */
.hero-note .pi {
  margin-right: 0.4rem;
  vertical-align: -1px;
}

.hero-demo {
  display: flex;
  justify-content: center;
  text-align: left;
}

/* ── Sections ── */
.section {
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(3rem, 7vw, 5rem) clamp(1rem, 4vw, 2.5rem);
  text-align: center;
}


.section-title {
  margin: 0;
  font-size: clamp(1.75rem, 3.5vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--hu-text);
}

.section-lead {
  margin: 0.6rem auto 0;
  max-width: 36rem;
  font-size: 1.02rem;
  color: var(--hu-text-muted);
}

/* Steps */
.steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  margin: 2.5rem 0 0;
  padding: 0;
  list-style: none;
  text-align: left;
}

.step {
  position: relative;
  padding: 1.5rem;
  background: var(--hu-surface);
  border: 1px solid var(--hu-border);
  border-radius: var(--hu-radius);
  box-shadow: var(--hu-shadow);
}

.step-num {
  position: absolute;
  top: 1.1rem;
  right: 1.25rem;
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  color: var(--hu-blue-soft);
}

.step-icon {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 12px;
  background: var(--hu-blue-soft);
  color: var(--hu-blue);
  font-size: 1.15rem;
}

.step-title {
  margin: 1rem 0 0.4rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--hu-text);
}

.step-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--hu-text-muted);
}


/* Final CTA */
.cta {
  position: relative;
  padding: clamp(4rem, 8vw, 6rem) clamp(1rem, 4vw, 2.5rem);
  text-align: center;
  color: #ffffff;
  background:
    conic-gradient(at 3px 3px, transparent 75%, var(--hu-dot-on-blue) 0) 0 0 / 22px 22px,
    var(--hu-blue);
}

.cta::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 72px;
  /* Same dither, flipped, fading out of the "How it works" section above */
  background: var(--hu-bg);
  -webkit-mask: url('/dither-edge-h.svg') left bottom / auto 72px repeat-x;
  mask: url('/dither-edge-h.svg') left bottom / auto 72px repeat-x;
  transform: scaleY(-1);
  pointer-events: none;
}

.cta-inner {
  position: relative;
}

.cta-title {
  margin: 0;
  font-size: clamp(2rem, 4.5vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

.cta-sub {
  margin: 0.75rem auto 1.75rem;
  max-width: 32rem;
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.9);
}

.footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem 2rem;
  font-size: 0.85rem;
  color: var(--hu-text-muted);
  background: var(--hu-blue);
}

.footer,
.footer a {
  color: rgba(255, 255, 255, 0.8);
}

.footer a:hover {
  color: #ffffff;
}

.footer-gh {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  text-decoration: none;
}

.footer-gh:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .hero-inner {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .hero-sub {
    margin-left: auto;
    margin-right: auto;
  }

  .hero-ctas,
  .hero-note {
    justify-content: center;
  }

  .steps {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 560px) {
  .nav-actions .btn--ghost {
    display: none;
  }

  .hero-ctas .btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .floater {
    animation: none;
  }

  .btn:hover {
    transform: none;
  }
}
</style>
