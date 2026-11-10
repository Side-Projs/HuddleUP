import { ref } from 'vue'
import { supabase } from '../../utils/supabase'
import { useAuth } from './useAuth'

export interface RoomData {
  room_id: string
  room_code: string
  title: string
  status_room: string
  room_creator_id: string
  closed_at: string | null
  room_created_at: string
  description?: string | null
  // NEW: Added this so TypeScript knows rooms can have members
  members?: { user_id: string }[]
}

const { user } = useAuth()

// 6 characters, no look-alikes (0/O, 1/I) so codes are easy to read out loud.
// Exactly 32 symbols, which divides 256 evenly, so every character is equally likely.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeRoomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % 32]).join('')

let roomsChannel: ReturnType<typeof supabase.channel> | null = null

// ── Personal room order ("prioritize" by dragging in the sidebar) ──────────
// Saved per user in auth user_metadata.room_order = { created: [ids], joined: [ids] },
// so it follows you across devices without any database changes.
export type RoomListKind = 'created' | 'joined'

// Order changed in this session but maybe not saved yet (wins over user_metadata)
let localOrder: { userId?: string; created?: string[]; joined?: string[] } = {}
let saveTimer: ReturnType<typeof setTimeout> | undefined

const savedOrder = (kind: RoomListKind): string[] => {
  if (localOrder.userId === user.value?.id && localOrder[kind]) return localOrder[kind]!
  const stored = user.value?.user_metadata?.room_order?.[kind]
  return Array.isArray(stored) ? stored : []
}

/** Sort rooms by the user's saved order; rooms not in it (new ones) go to the bottom. */
const applySavedOrder = (rooms: RoomData[], kind: RoomListKind): RoomData[] => {
  const rank = new Map(savedOrder(kind).map((id, i) => [id, i]))
  return rooms
    .map((room, i) => ({ room, r: rank.get(room.room_id) ?? rank.size + i }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.room)
}

const createdRooms = ref<RoomData[]>([])
const joinedRooms = ref<RoomData[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

export function useRooms() {
  type JoinRoomData = Pick<RoomData, 'room_id' | 'title' | 'status_room' | 'room_code'>

  interface JoinRoomResult {
    room: JoinRoomData
    alreadyJoined: boolean
  }

  // Fetch rooms the user created
  const fetchCreatedRooms = async () => {
    if (!user.value) return
    isLoading.value = true
    error.value = null

    const { data, error: sbError } = await supabase
      .from('Room')
      // NEW: We now ask for the members via the Joins table
      .select('*, members:Joins(user_id)')
      .eq('room_creator_id', user.value.id)
      .eq('status_room', 'active')

    if (sbError) error.value = sbError.message
    else createdRooms.value = applySavedOrder(data || [], 'created')

    isLoading.value = false
  }

  // Fetch rooms the user joined via the Joins table
  const fetchJoinedRooms = async () => {
    if (!user.value) return
    isLoading.value = true
    error.value = null

    const { data, error: sbError } = await supabase
      .from('Joins')
      .select(`
        room_id,
        Room ( 
          *,
          members:Joins(user_id) 
        )
      `) // NEW: Added members to the nested Room query
      .eq('user_id', user.value.id)

    if (sbError) {
      error.value = sbError.message
    } else if (data) {
      joinedRooms.value = applySavedOrder(
        data
          .map((item: any) => item.Room)
          .filter(
            (room: RoomData) =>
              room.status_room === 'active' && room.room_creator_id !== user.value?.id,
          ),
        'joined',
      )
    }

    isLoading.value = false
  }

  // Create new room
  const createRoom = async (title: string, description = '') => {
    if (!user.value) return null
    isLoading.value = true
    error.value = null

    const insertRoom = () =>
      supabase
        .from('Room')
        .insert([
          {
            title: title,
            ...(description.trim() ? { description: description.trim() } : {}),
            room_code: makeRoomCode(),
            room_creator_id: user.value!.id,
            status_room: 'active',
          },
        ])
        .select()
        .single()

    // Retry with a fresh code if it collides with an existing one (23505 = unique violation)
    let { data: roomData, error: roomError } = await insertRoom()
    for (let i = 0; i < 3 && roomError?.code === '23505'; i++) {
      ;({ data: roomData, error: roomError } = await insertRoom())
    }

    if (roomError || !roomData) {
      error.value = roomError?.message || 'Could not create the room.'
      isLoading.value = false
      return null
    }

    const { error: joinError } = await supabase.from('Joins').insert([
      {
        room_id: roomData.room_id,
        user_id: user.value.id,
        role: 'admin',
      },
    ])

    if (joinError) {
      error.value = joinError.message
    } else {
      await fetchCreatedRooms()
    }

    isLoading.value = false
    return roomData
  }

  const joinRoom = async (roomCode: string): Promise<JoinRoomResult | null> => {
    if (!user.value) return null
    isLoading.value = true
    error.value = null

    const code = roomCode.trim().toUpperCase()
    const { data: room, error: roomError } = await supabase
      .from('Room')
      .select('room_id, title, status_room, room_code')
      .eq('room_code', code)
      .maybeSingle()

    if (roomError || !room) {
      error.value = roomError?.message || 'No room found with that code.'
      isLoading.value = false
      return null
    }

    if (room.status_room !== 'active') {
      error.value = 'This room is no longer active.'
      isLoading.value = false
      return null
    }

    const { data: existing, error: existingError } = await supabase
      .from('Joins')
      .select('room_id')
      .eq('room_id', room.room_id)
      .eq('user_id', user.value.id)
      .maybeSingle()

    if (existingError) {
      error.value = existingError.message
      isLoading.value = false
      return null
    }

    if (existing) {
      isLoading.value = false
      return { room, alreadyJoined: true }
    }

    const { error: joinError } = await supabase
      .from('Joins')
      .insert([{ room_id: room.room_id, user_id: user.value.id, role: 'member' }])

    if (joinError) {
      error.value = joinError.message
      isLoading.value = false
      return null
    }

    const { data: existingTasks } = await supabase
      .from('Task')
      .select('task_id')
      .eq('task_room_id', room.room_id)

    if (existingTasks && existingTasks.length > 0) {
      const assignments = existingTasks.map((task: any) => ({
        task_id: task.task_id,
        user_id: user.value!.id,
        marked_done: false,
        assigned_at: new Date().toISOString(),
      }))

      await supabase.from('Assigned_To').insert(assignments)
    }

    await fetchJoinedRooms()
    isLoading.value = false
    return { room, alreadyJoined: false }
  }

  const leaveRoom = async (roomId: string): Promise<boolean> => {
    if (!user.value) return false
    error.value = null

    const { data: roomTasks } = await supabase
      .from('Task')
      .select('task_id')
      .eq('task_room_id', roomId)

    if (roomTasks && roomTasks.length > 0) {
      const taskIds = roomTasks.map((task: any) => task.task_id)

      await supabase
        .from('Assigned_To')
        .delete()
        .eq('user_id', user.value.id)
        .in('task_id', taskIds)
    }

    const { error: leaveError } = await supabase
      .from('Joins')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.value.id)

    if (leaveError) {
      error.value = leaveError.message
      return false
    }

    await fetchCreatedRooms()
    await fetchJoinedRooms()
    return true
  }

  const deleteRoom = async (roomId: string): Promise<boolean> => {
    if (!user.value) return false
    error.value = null

    const { data: roomTasks, error: tasksError } = await supabase
      .from('Task')
      .select('task_id')
      .eq('task_room_id', roomId)

    if (tasksError) {
      error.value = tasksError.message
      return false
    }

    if (roomTasks && roomTasks.length > 0) {
      const taskIds = roomTasks.map((task: any) => task.task_id)

      const { error: assignedError } = await supabase
        .from('Assigned_To')
        .delete()
        .in('task_id', taskIds)

      if (assignedError) {
        error.value = assignedError.message
        return false
      }

      const { error: deleteTasksError } = await supabase
        .from('Task')
        .delete()
        .eq('task_room_id', roomId)

      if (deleteTasksError) {
        error.value = deleteTasksError.message
        return false
      }
    }

    const { error: joinError } = await supabase.from('Joins').delete().eq('room_id', roomId)

    if (joinError) {
      error.value = joinError.message
      return false
    }

    const { error: roomError } = await supabase.from('Room').delete().eq('room_id', roomId)

    if (roomError) {
      error.value = roomError.message
      return false
    }

    await fetchCreatedRooms()
    await fetchJoinedRooms()
    return true
  }

  /** Move a room within its list (instant), then save the new order shortly after. */
  const moveRoom = (kind: RoomListKind, from: number, to: number) => {
    const list = kind === 'created' ? createdRooms : joinedRooms
    if (from === to || from < 0 || to < 0 || from >= list.value.length || to >= list.value.length) return
    const next = [...list.value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    list.value = next

    localOrder = {
      userId: user.value?.id,
      created: createdRooms.value.map((r) => r.room_id),
      joined: joinedRooms.value.map((r) => r.room_id),
    }

    // Debounced: dragging past several rooms makes one save, not many
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const { error: saveError } = await supabase.auth.updateUser({
        data: { room_order: { created: localOrder.created, joined: localOrder.joined } },
      })
      if (saveError) console.error('Could not save room order:', saveError.message)
    }, 700)
  }

  const unsubscribeFromRooms = () => {
    if (roomsChannel) {
      supabase.removeChannel(roomsChannel)
      roomsChannel = null
    }
  }

  const subscribeToRooms = () => {
    unsubscribeFromRooms()
    roomsChannel = supabase
      .channel('room-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Room' }, () => {
        fetchCreatedRooms()
        fetchJoinedRooms()
      })
      .subscribe()
  }

  return {
    createdRooms,
    joinedRooms,
    isLoading,
    error,
    fetchCreatedRooms,
    fetchJoinedRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    subscribeToRooms,
    unsubscribeFromRooms,
    moveRoom,
  }
}