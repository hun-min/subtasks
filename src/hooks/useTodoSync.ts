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
  isAutoSaveEnabled?: boolean;
};

// Check-Head Pattern: Load from Local Storage first, then Sync with Server intelligently
export const useTodoSync = ({ currentDate, userId, spaceId, isAutoSaveEnabled = true }: UseTasksProps) => {
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

  // 컴포넌트 마운트 시 한 번만 초기값 로드 (useState 초기값 함수 사용)
  const [initialData] = useState(getInitialData);

  // Local state for immediate UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>(initialData.tasks);
  const [localMemo, setLocalMemo] = useState<string>(initialData.memo);
  
  // Track if we are currently editing locally (to prevent server overwrite)
  const isEditing = useRef(false);
  // Track if the current update is coming from server (to prevent echo)
  const isServerUpdate = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 서버와 동기화된 마지막 타임스탬프 추적
  const lastSyncedAt = useRef<string | undefined>(initialData.updatedAt);

  // 2. Fetch Server Data (Smart Sync: Check updated_at first)
  const { data: serverData, isLoading } = useQuery({
    queryKey: ['tasks', dateStr, userId, spaceId],
    queryFn: async () => {
      if (!userId || !spaceId) return null;

      // A. 먼저 메타데이터(updated_at)만 조회 (Head Check)
      const { data: meta, error: metaError } = await supabase
        .from('task_logs')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('space_id', spaceId)
        .eq('date', dateStr)
        .single();

      if (metaError && metaError.code !== 'PGRST116') throw metaError;
      
      // 서버에 데이터가 없는 경우
      if (!meta) return { tasks: [], memo: '', updated_at: null, notModified: false };

      // B. 로컬 타임스탬프와 비교
      // 현재 로컬 스토리지의 최신 상태를 확인 (메모리 상태보다 스토리지 기준)
      let currentLocalUpdatedAt = lastSyncedAt.current;
      try {
         const saved = localStorage.getItem(localKey);
         if (saved) {
             const parsed = JSON.parse(saved);
             currentLocalUpdatedAt = parsed.updatedAt;
         }
      } catch (e) { console.error(e); }

      // 타임스탬프가 같으면 전체 다운로드 스킵 (대역폭 절약)
      if (currentLocalUpdatedAt === meta.updated_at) {
          return { notModified: true, updated_at: meta.updated_at };
      }

      // C. 타임스탬프가 다르면 전체 데이터 다운로드 (Body Fetch)
      const { data, error } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('space_id', spaceId)
        .eq('date', dateStr)
        .single();

      if (error) throw error;
      if (!data) return { tasks: [], memo: '', updated_at: null, notModified: false };

      return {
        ...data,
        tasks: migrateTasks(typeof data.tasks === 'string' ? JSON.parse(data.tasks) : data.tasks),
        notModified: false
      };
    },
    // 초기 데이터가 있으면 로딩 상태 아님 (Instant UI)
    initialData: initialData.tasks.length > 0 ? { ...initialData, notModified: true, updated_at: initialData.updatedAt } : undefined,
    staleTime: 1000 * 60, // 1분간은 다시 체크 안 함
    refetchOnWindowFocus: true,
  });

  // 3. Sync Server -> Local (Conflict Resolution)
  useEffect(() => {
    if (!serverData) return;
    if (serverData.notModified) return; // 변경 없으면 무시
    
    // If we are editing, DO NOT overwrite with server data (Local Priority)
    if (isEditing.current) {
        // console.debug("Server update ignored due to local editing");
        return;
    }

    // Mark this update as coming from server
    isServerUpdate.current = true;
    
    setLocalTasks(serverData.tasks || []);
    setLocalMemo(serverData.memo || '');
    lastSyncedAt.current = serverData.updated_at;
    
    // Update Local Storage to keep it fresh
    localStorage.setItem(localKey, JSON.stringify({ 
        tasks: serverData.tasks || [], 
        memo: serverData.memo || '',
        updatedAt: serverData.updated_at
    }));

    // Reset flag after a short delay
    setTimeout(() => {
       isServerUpdate.current = false;
    }, 100);
  }, [serverData, localKey]);

  // 4. Save to Server (Debounced)
  const saveToSupabase = async (tasks: Task[], memo: string) => {
      const now = new Date().toISOString();
      
      // Always save to Local Storage first (Persistence)
      const dataToSave = { 
          tasks, 
          memo, 
          updatedAt: now 
      };
      
      localStorage.setItem(localKey, JSON.stringify(dataToSave));
      lastSyncedAt.current = now; // 로컬 업데이트 시점 갱신
      
      // Update React Query Cache immediately
      queryClient.setQueryData(['tasks', dateStr, userId, spaceId], (old: any) => ({
          ...old,
          tasks,
          memo,
          updated_at: now,
          notModified: true // 내가 방금 저장했으니 최신임
      }));

      if (!userId || !spaceId) return;

      const { error } = await supabase.from('task_logs').upsert({
        user_id: userId,
        space_id: spaceId,
        date: dateStr,
        tasks: JSON.stringify(tasks),
        memo: memo,
        updated_at: now
      }, { onConflict: 'user_id,space_id,date' });

      if (error) throw error;

      // Invalidate other queries if needed (e.g. flow view)
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'tasks' && query.queryKey[1] !== dateStr 
      });
  };

    // Exposed immediate save (bypass debounce / auto-save flag)
    const forceSave = async (tasks: Task[], memo?: string) => {
      try {
        const memoToSave = memo !== undefined ? memo : localMemo;
        await saveToSupabase(tasks, memoToSave);
      } catch (err) {
        console.error('forceSave failed', err);
        throw err;
      }
    };

  const updateTasks = useCallback((newTasks: Task[], newMemo?: string) => {
      // If this update is triggered by server sync, do not save back!
      if (isServerUpdate.current) {
          setLocalTasks(newTasks);
          if (newMemo !== undefined) setLocalMemo(newMemo);
          return;
      }

      setLocalTasks(newTasks);
      if (newMemo !== undefined) setLocalMemo(newMemo);
      
      isEditing.current = true; // Mark as editing

      // Debounce Server Save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      if (!isAutoSaveEnabled) {
          return;
      }

      saveTimeoutRef.current = setTimeout(async () => {
          try {
              const memoToSave = newMemo !== undefined ? newMemo : localMemo;
              await saveToSupabase(newTasks, memoToSave);
              isEditing.current = false; // Reset editing flag after save
          } catch (err) {
              console.error("Failed to auto-save", err);
          }
      }, 2000); // 2 seconds debounce
  }, [localMemo, userId, spaceId, dateStr, localKey, isAutoSaveEnabled]);

  // Reset state on date/space change
  useEffect(() => {
      const newData = getInitialData();
      setLocalTasks(newData.tasks);
      setLocalMemo(newData.memo);
      lastSyncedAt.current = newData.updatedAt;
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
        () => {
           // eslint-disable-next-line @typescript-eslint/no-unused-vars
           // console.debug('Realtime update', payload);
           // Ignore if we are editing
           if (isEditing.current) return;
           
           // Invalidate query to fetch latest (will trigger Check-Head logic)
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
    forceSave,
  };
};
