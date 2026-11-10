<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter, useRoute } from 'vue-router'

import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const router = useRouter()
const route = useRoute()
const { signIn } = useAuth()

const email = ref('')
const pass = ref('')
const error = ref('')
const valid = ref(
  route.query.registered
    ? 'Account created! If we sent you a confirmation email, confirm it first, then log in.'
    : ''
)

const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())

const handleSignin = async () => {
  error.value = ''
  valid.value = ''

  if (!email.value.trim() || !pass.value.trim()) {
    error.value = 'Please enter both email and password.'
    return
  }

  if (!isValidEmail(email.value)) {
    error.value = 'Please enter a valid email address.'
    return
  }

  try {
    await signIn(email.value, pass.value)
    valid.value = 'Logged in successfully! Redirecting...'
    router.replace('/main')
  } catch (e: any) {
    error.value = e.message || 'Unable to sign in. Please check your credentials.'
  }
}
</script>

<template>
  <Card class="auth-card">
    <template #title>
      <h1 class="auth-title">Log In</h1>
    </template>

    <template #content>
      <form class="auth-form" @submit.prevent="handleSignin">
        <div class="auth-field">
          <label for="email">Email</label>
          <InputText id="email" v-model="email" type="email" autocomplete="email" placeholder="user@gmail.com" />
        </div>

        <div class="auth-field">
          <label for="password">Password</label>
          <InputText id="password" v-model="pass" type="password" autocomplete="current-password" placeholder="password" />
        </div>

        <div class="auth-actions">
          <Button type="submit" label="Log In" />
        </div>

        <p class="auth-message is-error" v-if="error" role="alert">{{ error }}</p>
        <p class="auth-message is-success" v-if="valid" role="status">{{ valid }}</p>

        <p class="auth-helper">
          Don't have an account?
          <RouterLink to="/signup" class="auth-link">Sign Up</RouterLink>
        </p>
      </form>
    </template>
  </Card>
</template>
