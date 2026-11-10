import { ref, computed } from 'vue'
import { supabase } from '../../utils/supabase'
import { useAuth } from './useAuth'

export interface AssignedToRecord {
    user_id: string
    marked_done: boolean
}

export interface TaskData {
    task_id: string
    title: string
    status_task: string
    completed_at: string | null
    task_created_at: string
    task_creator_id: string
    task_room_id: string
    marked_done?: boolean
    done_count?: number
    total_count?: number
    // ✅ Raw per-user completion records, used for member progress
    assignments: AssignedToRecord[]
}

interface RoomInfo {
    room_id: string
    room_code?: string
    title: string
    room_creator_id: string
    /** Optional, set by the owner. Stored in Room.description. */
    description?: string | null
}

/** Joins.role: 'admin' = owner, 'contributor' = may create tasks, 'member' = default */
export type MemberRole = 'admin' | 'contributor' | 'member'

export interface MemberData {
    user_id: string
    username: string
    email: string
    /** Avatar id from public/avatars (see src/lib/avatars.ts); null = initials */
    avatar?: string | null
    role?: MemberRole
}

const members = ref<MemberData[]>([])
const room = ref<RoomInfo | null>(null)
const assignedTasks = ref<TaskData[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let activeChannel: ReturnType<typeof supabase.channel> | null = null

// Supabase returns no error when Row Level Security blocks an update/delete — it just
// changes 0 rows. We ask for the changed rows back and treat "none" as "not allowed".
const NOT_ALLOWED = "You don't have permission to do that in this room."


const fetchMembers = async (room_id: string) => {
    const query = (userColumns: string) =>
        supabase.from('Joins').select(`user_id, role, User ( ${userColumns} )`).eq('room_id', room_id)

    let { data, error: sbError }: { data: any[] | null; error: { message: string } | null } =
        await query('user_id, username, email, avatar')

    // The `avatar` column is new. If the database hasn't been migrated yet,
    // fall back to the old query so rooms keep working (avatars show initials).
    if (sbError && /avatar/i.test(sbError.message)) {
        ;({ data, error: sbError } = await query('user_id, username, email'))
    }

    if (sbError) {
        error.value = sbError.message
    } else if (data) {
        members.value = data.map((item: any) => ({ ...item.User, role: item.role ?? 'member' }))
    }
}

export function useTasks() {
    const { user } = useAuth()

    const isAdmin = computed(() => {
        return Boolean(user.value && room.value?.room_creator_id === user.value.id)
    })

    /** Owner, or a member the owner has allowed to create tasks */
    const canCreateTasks = computed(() => {
        if (isAdmin.value) return true
        const me = members.value.find((m) => m.user_id === user.value?.id)
        return me?.role === 'contributor'
    })

    /** Owner can manage every task; contributors can manage the tasks they created */
    const canManageTask = (task: TaskData) =>
        isAdmin.value || (canCreateTasks.value && task.task_creator_id === user.value?.id)

    /** Owner only: let a member create tasks (or take it away) */
    const setMemberRole = async (userId: string, role: Exclude<MemberRole, 'admin'>) => {
        if (!room.value || !isAdmin.value) return false
        error.value = null
        const { data, error: sbError } = await supabase
            .from('Joins')
            .update({ role })
            .eq('room_id', room.value.room_id)
            .eq('user_id', userId)
            .select('user_id')
        if (sbError || !data?.length) {
            error.value = sbError?.message || NOT_ALLOWED
            return false
        }
        const member = members.value.find((m) => m.user_id === userId)
        if (member) member.role = role
        return true
    }

    /** Owner only: set or clear the room description */
    const updateRoomDescription = async (description: string) => {
        if (!room.value || !isAdmin.value) return false
        error.value = null
        const value = description.trim() || null
        const { data, error: sbError } = await supabase
            .from('Room')
            .update({ description: value })
            .eq('room_id', room.value.room_id)
            .select('room_id')
        if (!sbError && !data?.length) {
            error.value = NOT_ALLOWED
            return false
        }
        if (sbError) {
            error.value = /description/i.test(sbError.message)
                ? 'The database is missing the "description" column on the Room table.'
                : sbError.message
            return false
        }
        room.value.description = value
        return true
    }

    const fetchAssignedTasks = async (room_id: string) => {
        if (!user.value) return
        isLoading.value = true
        error.value = null

        const { data, error: sbError } = await supabase
            .from('Task')
            .select(
                `
        *,
        Assigned_To (
          user_id,
          marked_done
        )
      `,
            )
            .eq('task_room_id', room_id)

        if (sbError) {
            error.value = sbError.message
        } else if (data) {
            assignedTasks.value = data.map((task: any) => ({
                ...task,
                // Current user's own completion state
                marked_done:
                    task.Assigned_To.find((a: any) => a.user_id === user.value?.id)?.marked_done ?? false,
                done_count: task.Assigned_To.filter((a: any) => a.marked_done).length,
                total_count: task.Assigned_To.length,
                // ✅ Keep the full per-user array for member progress calculations
                assignments: task.Assigned_To as AssignedToRecord[],
            }))
        }

        isLoading.value = false
    }

    const subscribeToTasks = () => {
        if (!room.value) return
        if (activeChannel) {
            supabase.removeChannel(activeChannel)
            activeChannel = null
        }

        activeChannel = supabase
            .channel(`tasks-${room.value.room_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Assigned_To',
                },
                () => {
                    fetchAssignedTasks(room.value!.room_id)
                    fetchMembers(room.value!.room_id)
                },
            )
            // Role changes (owner lets someone create tasks) show up without a refresh.
            // Only fires if Realtime is enabled for the Joins table in Supabase.
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'Joins',
                    filter: `room_id=eq.${room.value.room_id}`,
                },
                () => fetchMembers(room.value!.room_id),
            )
            .subscribe()
    }

    const unsubscribeFromTasks = () => {
        if (activeChannel) {
            supabase.removeChannel(activeChannel)
            activeChannel = null
        }
    }

    const loadRoom = async (roomCodeID: string) => {
        if (!roomCodeID) return null
        isLoading.value = true
        error.value = null

        if (room.value?.room_code !== roomCodeID) {
            room.value = null
            assignedTasks.value = []
            members.value = []
        }

        const { data: roomData, error: roomError } = await supabase
            .from('Room')
            .select('*')
            .eq('room_code', roomCodeID)
            .single()

        if (roomError || !roomData) {
            error.value = roomError?.message || 'No room found with that code.'
            isLoading.value = false
            return null
        }

        room.value = roomData
        await fetchAssignedTasks(roomData.room_id)
        await fetchMembers(roomData.room_id)
        isLoading.value = false
        return roomData
    }

    const createTask = async (title: string) => {
        if (!user.value || !room.value || !title.trim()) return null
        isLoading.value = true
        error.value = null

        const { data: taskData, error: taskError } = await supabase
            .from('Task')
            .insert({
                title: title.trim(),
                task_creator_id: user.value.id,
                task_room_id: room.value.room_id,
                status_task: 'active',
                task_created_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (taskError || !taskData) {
            error.value = taskError?.message || 'Failed to create task.'
            isLoading.value = false
            return null
        }

        const { data: roomMembers, error: membersError } = await supabase
            .from('Joins')
            .select('user_id')
            .eq('room_id', room.value.room_id)

        if (membersError || !roomMembers) {
            error.value = membersError?.message || 'Failed to fetch room members.'
            isLoading.value = false
            return null
        }

        const assignments = roomMembers.map((member: any) => ({
            task_id: taskData.task_id,
            user_id: member.user_id,
            assigned_at: new Date().toISOString(),
        }))

        const { error: assignError } = await supabase.from('Assigned_To').insert(assignments)

        if (assignError) {
            error.value = assignError.message
            isLoading.value = false
            return null
        }

        await fetchAssignedTasks(room.value.room_id)
        isLoading.value = false
        return taskData
    }

    const deleteTask = async (taskId: string) => {
        if (!taskId) return false
        error.value = null

        const del = () => supabase.from('Task').delete().eq('task_id', taskId).select('task_id')
        let { data, error: taskError } = await del()

        // 23503 = foreign key violation: the task still has Assigned_To rows (no ON DELETE CASCADE)
        if (taskError?.code === '23503') {
            await supabase.from('Assigned_To').delete().eq('task_id', taskId)
            ;({ data, error: taskError } = await del())
        }

        if (taskError || !data?.length) {
            error.value = taskError?.message || NOT_ALLOWED
            return false
        }

        assignedTasks.value = assignedTasks.value.filter((task) => task.task_id !== taskId)
        return true
    }

    const toggleTask = async (task: TaskData) => {
        if (!task || !user.value) return false
        error.value = null

        const newMarkedDone = !task.marked_done

        const { data, error: updateError } = await supabase
            .from('Assigned_To')
            .update({ marked_done: newMarkedDone })
            .eq('task_id', task.task_id)
            .eq('user_id', user.value.id)
            .select('task_id')

        if (updateError || !data?.length) {
            error.value = updateError?.message || 'Your check-off was not saved. Try refreshing the page.'
            return false
        }

        const assignment = task.assignments?.find(a => a.user_id === user.value!.id)
        if (assignment) {
            assignment.marked_done = newMarkedDone
        }

        task.marked_done = newMarkedDone
        task.done_count = task.assignments?.filter(a => a.marked_done).length ?? 0
        return true
    }

    const updateTask = async (taskId: string, newTitle: string) => {
        const { data, error: sbError } = await supabase
            .from('Task')
            .update({ title: newTitle })
            .eq('task_id', taskId)
            .select('task_id')
        if (sbError || !data?.length) {
            error.value = sbError?.message || NOT_ALLOWED
            return false
        }
        const task = assignedTasks.value.find(t => t.task_id === taskId)
        if (task) task.title = newTitle
        return true
    }

    return {
        room,
        isAdmin,
        canCreateTasks,
        canManageTask,
        setMemberRole,
        updateRoomDescription,
        fetchAssignedTasks,
        fetchMembers,
        loadRoom,
        createTask,
        deleteTask,
        toggleTask,
        updateTask,
        subscribeToTasks,
        unsubscribeFromTasks,  // ✅ from main branch
        assignedTasks,
        isLoading,
        error,
        members,
    }
}