import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Task, DailyLog } from '../types';
import { useEffect } from 'react';

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

  // 1. Fetching (Single Date)
  const { data: log, isLoading } = useQuery({
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
    enabled: true, // 항상 활성화 (로그인 여부 상관없이)
    staleTime: 1000 * 60 * 5, // 5분
  });

  // 2. Realtime Subscription
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
          queryClient.invalidateQueries({ queryKey: ['tasks', dateStr, userId, spaceId] });
          queryClient.invalidateQueries({ queryKey: ['all_tasks', userId, spaceId] }); // 전체 로그도 갱신
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, spaceId, dateStr, queryClient]);

  // 3. Mutation (Optimistic Update)
  const saveTasksMutation = useMutation({
    mutationFn: async ({ tasks, memo }: { tasks: Task[], memo: string }) => {
      // 비로그인 상태일 경우 로컬 스토리지 사용
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
    },
    onMutate: async ({ tasks, memo }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', dateStr, userId, spaceId] });
      const previousLog = queryClient.getQueryData(['tasks', dateStr, userId, spaceId]);

      queryClient.setQueryData(['tasks', dateStr, userId, spaceId], (old: DailyLog | null) => ({
        ...old,
        tasks,
        memo,
        date: dateStr,
      }));

      // 전체 로그 캐시에도 반영 (UI 즉시 업데이트를 위해)
      queryClient.setQueryData(['all_tasks', userId, spaceId], (old: DailyLog[] | undefined) => {
        if (!old) return old;
        const index = old.findIndex(l => l.date === dateStr);
        const newLog = { date: dateStr, tasks, memo, user_id: userId, space_id: spaceId };
        if (index === -1) return [...old, newLog];
        const newLogs = [...old];
        newLogs[index] = newLog;
        return newLogs;
      });

      return { previousLog };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousLog) {
          queryClient.setQueryData(['tasks', dateStr, userId, spaceId], context.previousLog);
      }
    },
    onSettled: () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      queryClient.invalidateQueries({ queryKey: ['tasks', dateStr, userId, spaceId] });
      queryClient.invalidateQueries({ queryKey: ['all_tasks', userId, spaceId] });
    },
  });

  return {
    tasks: log?.tasks || [],
    memo: log?.memo || '',
    isLoading,
    updateTasks: saveTasksMutation, // mutation 객체 전체 반환 (isLoading 등 사용 가능)
  };
};

// --- 전체 로그 조회 훅 (캘린더, FlowView용) ---
export const useAllTaskLogs = (userId?: string, spaceId?: string) => {
  return useQuery({
    queryKey: ['all_tasks', userId, spaceId],
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

