// Profile icons users can pick from (Edit Profile).
// Files live in /public/avatars and are CC0 (public domain) — see public/avatars/LICENSE.txt.
//
// We store only the avatar *id* (e.g. "pixel-3") in the database, never a URL,
// so a user can't make other people's browsers load an arbitrary image.

export interface AvatarOption {
  id: string
  src: string
}

export interface AvatarGroup {
  label: string
  avatars: AvatarOption[]
}

const make = (prefix: string, count: number): AvatarOption[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    src: `/avatars/${prefix}-${i + 1}.svg`,
  }))

// 16 characters: 8 feminine and 8 masculine, alternating, sharing the same background colors.
export const AVATAR_GROUPS: AvatarGroup[] = [
  { label: 'Characters', avatars: make('character', 16) },
]

const BY_ID = new Map(AVATAR_GROUPS.flatMap((g) => g.avatars).map((a) => [a.id, a.src]))

/** Image path for a stored avatar id, or null if unset/unknown. */
export function avatarSrc(id: string | null | undefined): string | null {
  return id ? BY_ID.get(id) ?? null : null
}
