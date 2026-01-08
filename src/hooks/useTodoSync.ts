import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Task } from '../types';
import { useEffect, useState, useRef, useCallback } from 'react';

// --- 유틸리티: 데이터 마이그레이션 및 평탄화 ---
export const migrateTasks = (tasks: any[]): Task[] => {
  if (!Array.isArray(tasks)) {
    return [];
  }
  
  const flattened: Task[] = [];
  const seenIds = new Set();

  const processTask = (t: any, depth: number = 0) => {
      if (!t || typeof t !== 'object') return;

      let id = t.id;
      if (!id) {
          id = Date.now() + Math.random(); 
      }
      
      if (seenIds.has(id)) {
          const newId = Date.now() + Math.random();
          id = newId;
      }
      seenIds.add(id);

      let finalStatus = t.status || (t.done ? 'completed' : 'pending');
      const upperStatus = String(finalStatus).toUpperCase();
      if (upperStatus === 'DONE') finalStatus = 'completed';
      else if (upperStatus === 'LATER') finalStatus = 'icebox';
      else if (upperStatus === 'TODO') finalStatus = 'pending';

      const currentTask: Task = {
          ...t,
          id: id,
          name: t.name || t.text || '',
          status: finalStatus,
          depth: depth,
          actTime: Number(t.actTime) || 0,
          planTime: Number(t.planTime) || 0,
          percent: Number(t.percent) || 0,
          space_id: t.space_id || '',
          is_starred: t.is_starred || false,
          subtasks: undefined 
      };

      flattened.push(currentTask);

      if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
          t.subtasks.forEach((sub: any) => processTask(sub, depth + 1));
      }
  };

  tasks.forEach(task => processTask(task, task.depth || 0));

  return flattened;
};

type UseTasksProps = {
  currentDate: Date;
  userId?: string;
  spaceId?: string;
};

// Check-Head Pattern: Load from Local Storage first, then Sync with Server
export const useTodoSync = ({ currentDate, userId, spaceId }: UseTasksProps) => {
  const queryClient = useQueryClient();
  const dateStr = currentDate.toDateString();
  const localKey = `tasks_${dateStr}_${spaceId || 'default'}`;
  
  // 1. Initial Data from Local Storage (Instant Load)
  const getInitialData = (): { tasks: Task[], memo: string, updatedAt?: string } => {
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
           tasks: migrateTasks(parsed.tasks),
           memo: parsed.memo || '',
           updatedAt: parsed.updatedAt
        };
      }
    } catch (e) {
      console.error("Local storage read error", e);
    }
    return { tasks: [], memo: '', updatedAt: undefined };
  };

  const initialData = getInitialData();

  // Local state for immediate UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>(initialData.tasks);
  const [localMemo, setLocalMemo] = useState<string>(initialData.memo);
  
  // Track if we are currently editing locally (to prevent server overwrite)
  const isEditing = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 2. Fetch Server Data (Lightweight Check first?)
  // For simplicity and effectiveness, we'll fetch full data but use updated_at to merge intelligently if needed.
  // Actually, standard useQuery is fine, but we need to handle "Stale-While-Revalidate" carefully.
  const { data: serverData, isLoading } = useQuery({
    queryKey: ['tasks', dateStr, userId, spaceId],
    queryFn: async () => {
      if (!userId || !spaceId) return null;

      const { data, error } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('space_id', spaceId)
        .eq('date', dateStr)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return { tasks: [], memo: '', updated_at: null };

      return {
        ...data,
        tasks: migrateTasks(typeof data.tasks === 'string' ? JSON.parse(data.tasks) : data.tasks),
      };
    },
    // Use local initial data to prevent loading spinner
    initialData: initialData.tasks.length > 0 ? { tasks: initialData.tasks, memo: initialData.memo, updated_at: initialData.updatedAt } : undefined,
    staleTime: 1000 * 60, // 1 minute stale time
    refetchOnWindowFocus: true,
  });

  // 3. Sync Server -> Local (Conflict Resolution: Server Wins unless Local is Dirty)
  useEffect(() => {
    if (!serverData) return;
    
    // If we are editing, DO NOT overwrite with server data
    if (isEditing.current) return;

    // Compare timestamps or just check if content is different (deep compare might be expensive, so we trust updated_at if available or just overwrite if not editing)
    // Here we just overwrite if not editing, assuming server is source of truth when idle.
    const serverTasksStr = JSON.stringify(serverData.tasks);
    const localTasksStr = JSON.stringify(localTasks);
    
    if (serverTasksStr !== localTasksStr || serverData.memo !== localMemo) {
         setLocalTasks(serverData.tasks || []);
         setLocalMemo(serverData.memo || '');
         
         // Update Local Storage as well to keep it fresh
         localStorage.setItem(localKey, JSON.stringify({ 
             tasks: serverData.tasks || [], 
             memo: serverData.memo || '',
             updatedAt: new Date().toISOString() // Mark sync time
         }));
    }
  }, [serverData, localKey]); // removed localTasks dependency to avoid loop

  // 4. Save to Server (Debounced)
  const saveToSupabase = async (tasks: Task[], memo: string) => {
      // Always save to Local Storage first (Persistence)
      const dataToSave = { 
          tasks, 
          memo, 
          updatedAt: new Date().toISOString() 
      };
      
      localStorage.setItem(localKey, JSON.stringify(dataToSave));
      
      // Update React Query Cache immediately to prevent UI revert on date switch
      queryClient.setQueryData(['tasks', dateStr, userId, spaceId], (old: any) => ({
          ...old,
          tasks,
          memo,
          updated_at: dataToSave.updatedAt
      }));

      if (!userId || !spaceId) return;

      const { error } = await supabase.from('task_logs').upsert({
        user_id: userId,
        space_id: spaceId,
        date: dateStr,
        tasks: JSON.stringify(tasks),
        memo: memo,
        updated_at: new Date().toISOString() // Explicitly set updated_at
      }, { onConflict: 'user_id,space_id,date' });

      if (error) throw error;

      // Force refresh all task data across all views (Day/Flow)
      // Invalidating ['tasks'] ensures all sub-keys like ['tasks', date], ['tasks', 'all'] are refetched.
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      // Force refetch to ensure immediate update for active views
      await queryClient.refetchQueries({ queryKey: ['tasks'], type: 'active', exact: false });
  };

  const updateTasks = useCallback((newTasks: Task[], newMemo?: string) => {
      setLocalTasks(newTasks);
      if (newMemo !== undefined) setLocalMemo(newMemo);
      
      isEditing.current = true; // Mark as editing

      // Debounce Server Save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
          try {
              const memoToSave = newMemo !== undefined ? newMemo : localMemo;
              await saveToSupabase(newTasks, memoToSave);
              isEditing.current = false; // Reset editing flag after save
          } catch (err) {
              console.error("Failed to auto-save", err);
              // Retry? or Keep isEditing true?
          }
      }, 2000); // 2 seconds debounce
  }, [localMemo, userId, spaceId, dateStr, localKey]);

  // Reset state on date/space change
  useEffect(() => {
      const newData = getInitialData();
      setLocalTasks(newData.tasks);
      setLocalMemo(newData.memo);
      isEditing.current = false;
  }, [dateStr, spaceId]);

  // Realtime Subscription
  useEffect(() => {
    if (!userId || !spaceId) return;

    const channel = supabase.channel(`realtime_tasks_${spaceId}_${dateStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_logs',
          filter: `user_id=eq.${userId} and space_id=eq.${spaceId} and date=eq.${dateStr}`,
        },
        (payload) => {
           // eslint-disable-next-line @typescript-eslint/no-unused-vars
           console.debug('Realtime update', payload);
           // Ignore if we are editing
           if (isEditing.current) return;
           
           // Invalidate query to fetch latest
           queryClient.invalidateQueries({ queryKey: ['tasks', dateStr, userId, spaceId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, spaceId, dateStr, queryClient]);

  return {
    tasks: localTasks,
    memo: localMemo,
    isLoading: isLoading && localTasks.length === 0, // Only show loading if no local data
    updateTasks: { mutate: ({ tasks, memo }: { tasks: Task[], memo: string }) => updateTasks(tasks, memo) },
  };
};
