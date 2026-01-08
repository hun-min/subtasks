import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Task, DailyLog } from '../types';
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

export const useTasks = ({ currentDate, userId, spaceId }: UseTasksProps) => {
  const queryClient = useQueryClient();
  const dateStr = currentDate.toDateString();
  
  // Local state for immediate UI updates
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [localMemo, setLocalMemo] = useState<string>('');
  const [isLocalDirty, setIsLocalDirty] = useState(false);
  // 서버 데이터가 최초로 로드되어 로컬에 반영되었는지를 추적하는 플래그
  const [isInitialized, setIsInitialized] = useState(false);

  const lastServerDataRef = useRef<{ tasks: Task[], memo: string } | null>(null);
  const isInitialLoad = useRef(true);

  // Debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetching (Single Date)
  const { data: serverData, isLoading } = useQuery({
    queryKey: ['tasks', dateStr, userId, spaceId],
    queryFn: async () => {
      // 비로그인 상태일 경우 로컬 스토리지 사용
      if (!userId || !spaceId) {
        try {
          const localKey = `tasks_${dateStr}`;
          const saved = localStorage.getItem(localKey);
          if (!saved) return { tasks: [], memo: '' };
          const parsed = JSON.parse(saved);
          return {
             ...parsed,
             tasks: migrateTasks(parsed.tasks)
          } as DailyLog;
        } catch (e) {
          console.error("Local storage read error", e);
          return { tasks: [], memo: '' };
        }
      }

      const { data, error } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('space_id', spaceId)
        .eq('date', dateStr)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
        throw error;
      }

      if (!data) return { tasks: [], memo: '' };

      return {
        ...data,
        tasks: migrateTasks(typeof data.tasks === 'string' ? JSON.parse(data.tasks) : data.tasks),
      } as DailyLog;
    },
    enabled: true, 
    staleTime: 1000 * 60 * 5, // 5분
    refetchOnMount: true,
  });

  // Reset local state when date/space changes
  useEffect(() => {
    setIsInitialized(false);
    setIsLocalDirty(false);
    isInitialLoad.current = true;
    setLocalTasks([]);
    setLocalMemo('');
  }, [dateStr, spaceId, userId]);

  // 2. Sync Server Data to Local State (Only when safe)
  useEffect(() => {
    if (!serverData) return;
    
    // 1. 아직 초기화되지 않았다면(최초 로딩), 서버 데이터가 있으면 무조건 반영 (Local Dirty 무시)
    //    이는 "앱 켜자마자" 데이터를 보여주기 위함.
    if (!isInitialized) {
        setLocalTasks(serverData.tasks || []);
        setLocalMemo(serverData.memo || '');
        lastServerDataRef.current = { tasks: serverData.tasks || [], memo: serverData.memo || '' };
        setIsInitialized(true);
        if (isInitialLoad.current) isInitialLoad.current = false;
        return; 
    }

    // 2. 이미 초기화된 이후에는 기존 로직(충돌 방지) 따름
    // 초기 로딩이거나, 로컬 변경사항이 없는 경우에만 서버 데이터로 덮어씌움
    // 즉, 사용자가 입력 중(isLocalDirty)일 때는 서버 데이터가 와도 무시함 (충돌 방지 우선)
    const isEmptyLocal = localTasks.length === 0 && localMemo === '';
    
    if (isInitialLoad.current || !isLocalDirty || isEmptyLocal) {
        setLocalTasks(serverData.tasks || []);
        setLocalMemo(serverData.memo || '');
        lastServerDataRef.current = { tasks: serverData.tasks || [], memo: serverData.memo || '' };
        if (isInitialLoad.current) isInitialLoad.current = false;
    }
  }, [serverData, isLocalDirty, isInitialized]);




  // 3. Mutation (Actual Save)
  const saveToSupabase = async (tasks: Task[], memo: string) => {
      if (!userId || !spaceId) {
          const localKey = `tasks_${dateStr}`;
          const dataToSave = { tasks, memo, date: dateStr };
          localStorage.setItem(localKey, JSON.stringify(dataToSave));
          return;
      }

      const { error } = await supabase.from('task_logs').upsert({
        user_id: userId,
        space_id: spaceId,
        date: dateStr,
        tasks: JSON.stringify(tasks),
        memo: memo,
      }, { onConflict: 'user_id,space_id,date' });

      if (error) throw error;
  };

  // 4. Update Handler (Local First + Debounced Save)
  const updateTasks = useCallback((newTasks: Task[], newMemo?: string) => {
      // 1. Update Local State Immediately
      setLocalTasks(newTasks);
      if (newMemo !== undefined) setLocalMemo(newMemo);
      setIsLocalDirty(true);

      // 2. Clear existing timeout
      if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
      }

      // 3. Set new timeout for server save (Debounce 1.5s)
      saveTimeoutRef.current = setTimeout(async () => {
          try {
              const memoToSave = newMemo !== undefined ? newMemo : localMemo;
              await saveToSupabase(newTasks, memoToSave);
              
              // 저장 성공 시 Dirty 상태 해제하지 않음 (서버 응답이 돌아와서 useQuery가 갱신될 때 처리하거나, 
              // 복잡성을 줄이기 위해 그냥 Dirty 유지하다가 다른 날짜 이동 시 초기화)
              // 여기서는 "서버 데이터가 로컬보다 최신이라고 확신할 수 없으므로" 
              // 로컬이 Dirty인 상태를 계속 유지하여 서버 데이터가 와도 덮어쓰지 않도록 하는 전략이 안전함.
              // 단, 오랫동안 켜두면 서버의 타인 변경사항을 영원히 못 받을 수 있음.
              // Local-First는 "내 변경사항이 우선"이므로 이게 맞음.
              // 리프레시하거나 날짜 이동해야 서버 데이터 다시 받음.
              
              // console.log("Auto-saved to server");
          } catch (err) {
              console.error("Failed to auto-save", err);
              // Retry logic could go here
          }
      }, 1500); 

  }, [localMemo, userId, spaceId, dateStr]);

  // 5. Realtime Subscription (Optional: Only warn or update if not dirty)
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
           console.debug('Realtime update received', payload);
           // 내가 쓴 글이 아닌 경우(다른 기기/사람)에만 반응해야 하는데 구분 어려움.
           // 간단히: 로컬이 Dirty(입력중)가 아닐 때만 invalidate
           if (!isLocalDirty) {
               queryClient.invalidateQueries({ queryKey: ['tasks', dateStr, userId, spaceId] });
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, spaceId, dateStr, queryClient, isLocalDirty]);


  return {
    tasks: localTasks,     // 항상 로컬 상태 반환
    memo: localMemo,
    isLoading: isInitialLoad.current && isLoading, // 초기 로딩만 로딩으로 취급
    updateTasks: { mutate: ({ tasks, memo }: { tasks: Task[], memo: string }) => updateTasks(tasks, memo) }, // 인터페이스 유지
  };
};

// --- 전체 로그 조회 훅 (캘린더, FlowView용) ---
export const useAllTaskLogs = (userId?: string, spaceId?: string) => {
  return useQuery({
    queryKey: ['tasks', 'all', userId, spaceId], // Unified key: 'tasks' is the root
    queryFn: async () => {
      if (!userId || !spaceId) return [];
      
      const { data, error } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('space_id', spaceId);
        
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        ...row,
        tasks: migrateTasks(typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks),
      })) as DailyLog[];
    },
    enabled: !!userId && !!spaceId,
    staleTime: 1000 * 60 * 10, // 10분
  });
};
