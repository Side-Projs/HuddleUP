<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const router = useRouter()
const { signUp } = useAuth()

const email = ref('')
const username = ref('')
const pass = ref('')
const verify = ref('')
const error = ref('')
const success = ref('')

const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())

const handleSignup = async () => {
  error.value = ''
  success.value = ''

  if (!email.value.trim() || !pass.value.trim() || !verify.value.trim() || !username.value.trim()) {
    error.value = 'Please complete all fields.'
    return
  }

  if (!isValidEmail(email.value)) {
    error.value = 'Please enter a valid email address.'
    return
  }

  if (pass.value !== verify.value) {
    error.value = 'Passwords do not match.'
    return
  }

  try {
    await signUp(email.value, pass.value, username.value)
    router.replace({ path: '/login', query: { registered: '1' } })
  } catch (e: any) {
    error.value = e.message || 'Unable to sign up. Please try again.'
  }
}
</script>

<template>
  <Card class="auth-card">
    <template #title>
      <h1 class="auth-title">Sign Up</h1>
    </template>

    <template #content>
      <form class="auth-form" @submit.prevent="handleSignup">
        <div class="auth-field">
          <label for="email">Email</label>
          <InputText id="email" v-model="email" type="email" autocomplete="email" placeholder="user@gmail.com" />
        </div>

        <div class="auth-field">
          <label for="password">Password</label>
          <InputText id="password" v-model="pass" type="password" autocomplete="new-password" placeholder="password" />
        </div>

        <div class="auth-field">
          <label for="verify">Verify Password</label>
          <InputText id="verify" v-model="verify" type="password" autocomplete="new-password" placeholder="password" />
        </div>

        <div class="auth-field">
          <label for="username">Username</label>
          <InputText id="username" v-model="username" type="text" autocomplete="username" placeholder="username" />
        </div>

        <div class="auth-actions">
          <Button type="submit" label="Create Account" />
        </div>

        <p class="auth-message is-error" v-if="error" role="alert">{{ error }}</p>
        <p class="auth-message is-success" v-if="success" role="status">{{ success }}</p>

        <p class="auth-helper">
          Already have an account?
          <RouterLink to="/login" class="auth-link">Log In</RouterLink>
        </p>
      </form>
    </template>
  </Card>
</template>
