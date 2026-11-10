<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '../../utils/supabase'
import { AVATAR_GROUPS } from '@/lib/avatars'

import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import UserAvatar from '@/components/UserAvatar.vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', val: boolean): void }>()

const { user } = useAuth()

const username = ref('')
const avatar = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const successMsg = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    username.value = user.value?.user_metadata?.username || user.value?.email?.split('@')[0] || ''
    avatar.value = user.value?.user_metadata?.avatar ?? null
    error.value = null
    successMsg.value = ''
  }
}, { immediate: true })

const handleSave = async () => {
  error.value = null
  successMsg.value = ''

  if (!username.value.trim()) {
    error.value = 'Username cannot be empty.'
    return
  }

  loading.value = true

  try {
    // Your own copy (shown in the sidebar right away)
    const { error: authErr } = await supabase.auth.updateUser({
      data: { username: username.value.trim(), avatar: avatar.value }
    })
    if (authErr) throw authErr

    // Public copy (what other members see in rooms)
    const { error: dbErr } = await supabase
      .from('User')
      .update({ username: username.value.trim(), avatar: avatar.value })
      .eq('user_id', user.value?.id)

    if (dbErr) {
      if (/avatar/i.test(dbErr.message)) {
        throw new Error(
          "Saved for you, but teammates can't see your icon yet: the database is missing the \"avatar\" column."
        )
      }
      throw dbErr
    }

    successMsg.value = 'Profile updated!'
    setTimeout(() => emit('update:visible', false), 900)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    @update:visible="emit('update:visible', $event)"
    modal
    header="Edit Profile"
    :style="{ width: '560px' }"
    :breakpoints="{ '620px': '94vw' }"
    :draggable="false"
  >
    <div class="modal-body">
      <!-- Current pick, big, like a profile screen -->
      <div class="profile-preview">
        <UserAvatar :avatar="avatar" :name="username" :size="88" />
        <div class="profile-preview__text">
          <span class="profile-preview__name">{{ username || 'Your name' }}</span>
          <span class="profile-preview__hint">This is how teammates see you in rooms.</span>
        </div>
      </div>

      <fieldset class="avatar-picker">
        <legend class="field-label">Choose your icon</legend>

        <div v-for="group in AVATAR_GROUPS" :key="group.label" class="avatar-group">
          <span v-if="AVATAR_GROUPS.length > 1" class="avatar-group__label">{{ group.label }}</span>
          <div class="avatar-grid">
            <button
              v-for="a in group.avatars"
              :key="a.id"
              type="button"
              class="avatar-tile"
              :class="{ 'is-selected': avatar === a.id }"
              :aria-pressed="avatar === a.id"
              :aria-label="`Icon ${a.id.split('-')[1]}`"
              @click="avatar = a.id"
            >
              <img :src="a.src" alt="" loading="lazy" />
              <span v-if="avatar === a.id" class="avatar-tile__check"><i class="pi pi-check" /></span>
            </button>
          </div>
        </div>

        <button v-if="avatar" type="button" class="link-btn" @click="avatar = null">
          Use my initials instead
        </button>
      </fieldset>

      <div class="field">
        <label class="field-label" for="profile-username">Username</label>
        <InputText
          id="profile-username"
          v-model="username"
          class="field-input"
          placeholder="Enter a username"
          @keyup.enter="handleSave"
        />
      </div>

      <div class="field">
        <label class="field-label" for="profile-email">
          Email <span class="readonly-tag">read-only</span>
        </label>
        <InputText id="profile-email" :value="user?.email || ''" class="field-input" disabled />
      </div>

      <p v-if="error" class="msg error" role="alert">{{ error }}</p>
      <p v-if="successMsg" class="msg success" role="status">{{ successMsg }}</p>
    </div>

    <template #footer>
      <Button label="Cancel" text severity="secondary" @click="emit('update:visible', false)" />
      <Button label="Save" :loading="loading" class="btn-save" @click="handleSave" />
    </template>
  </Dialog>
</template>

<style scoped>
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.25rem 0;
}

/* Preview */
.profile-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 14px;
  background:
    conic-gradient(at 3px 3px, transparent 75%, rgba(255, 255, 255, 0.14) 0) 0 0 / 22px 22px,
    var(--hu-blue);
  color: #ffffff;
}

.profile-preview :deep(.user-avatar) {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.85);
}

.profile-preview__text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.profile-preview__name {
  font-size: 1.25rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.profile-preview__hint {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.85);
}

/* Picker */
.avatar-picker {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin: 0;
  padding: 0;
  border: none;
}

.avatar-picker > legend {
  margin-bottom: 0.6rem;
  padding: 0;
  font-size: 0.95rem;
}

.avatar-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.avatar-group__label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hu-text-muted);
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.5rem;
}

.avatar-tile {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: none;
  cursor: pointer;
  outline: 3px solid transparent;
  outline-offset: 2px;
  transition: transform 0.15s ease, outline-color 0.15s ease;
}

.avatar-tile img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.avatar-tile:hover {
  transform: scale(1.08);
}

.avatar-tile:focus-visible {
  outline-color: var(--hu-blue);
}

.avatar-tile.is-selected {
  outline-color: var(--hu-green);
  transform: scale(1.04);
}

.avatar-tile__check {
  position: absolute;
  top: -6px;
  right: -6px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: var(--hu-green);
  color: #ffffff;
  font-size: 0.55rem;
}

.link-btn {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--hu-blue);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #374151;
}

.readonly-tag {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 500;
}

.field-input {
  width: 100%;
  border-radius: 10px;
}

.msg {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.83rem;
  text-align: center;
}

.error { background: #fef2f2; color: #b91c1c; }
.success { background: #f0fdf4; color: #15803d; }

.btn-save.p-button {
  border-radius: 999px;
  font-weight: 700;
  padding-inline: 1.5rem;
}

@media (max-width: 480px) {
  .avatar-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
