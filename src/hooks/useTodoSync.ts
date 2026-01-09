import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Task } from '../types';
import { useEffect, useState, useRef, useCallback } from 'react';

// 유틸: 데이터 평탄화
export const migrateTasks = (tasks: any[]): Task[] => {
  if (!Array.isArray(tasks)) return [];
  const flattened: Task[] = [];
  const processTask = (t: any, depth: number = 0) => {
      if (!t || typeof t !== 'object') return;
      const currentTask: Task = {
          ...t,
          id: t.id || Date.now() + Math.random(),
          name: t.name || t.text || '',
          text: t.name || t.text || '', // text 필드 보장
          status: t.status || (t.done ? 'completed' : 'pending'),
          depth: depth,
          space_id: t.space_id || '',
      };
      flattened.push(currentTask);
      if (Array.isArray(t.subtasks)) t.subtasks.forEach((sub: any) => processTask(sub, depth + 1));
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

export const useTodoSync = ({ currentDate, userId, spaceId, isAutoSaveEnabled = true }: UseTasksProps) => {
  const queryClient = useQueryClient();
  const dateKey = currentDate.toDateString();
  const serverDate = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
  const localKey = `tasks_${dateKey}_${spaceId || 'default'}`;
  
  // 1. 초기 로드 (로컬 스토리지)
  const [initialData] = useState(() => {
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { tasks: [], memo: '', updatedAt: undefined };
  });

  const [localTasks, setLocalTasks] = useState<Task[]>(initialData.tasks || []);
  const [localMemo, setLocalMemo] = useState<string>(initialData.memo || '');
  const isEditing = useRef(false);
  const isServerUpdate = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 2. 서버 데이터 가져오기 (Check-Head)
  const { data: serverData, isLoading } = useQuery({
    queryKey: ['tasks', dateKey, userId, spaceId], // dateKey 변경 시 즉시 재요청
    queryFn: async () => {
      if (!userId || !spaceId) return null;

      // A. 메타데이터 확인 (Updated At)
      const { data: meta } = await supabase
        .from('task_logs')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('space_id', spaceId)
        .eq('date', serverDate)
        .single();
      
      // 로컬 스토리지 시간 비교
      let localUpdatedAt = initialData.updatedAt;
      const saved = localStorage.getItem(localKey);
      if (saved) localUpdatedAt = JSON.parse(saved).updatedAt;

      // 시간 같으면 다운로드 안 함
      if (meta && localUpdatedAt === meta.updated_at) {
          return { notModified: true, updated_at: meta.updated_at };
      }

      // B. 전체 다운로드
      const { data, error } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('space_id', spaceId)
        .eq('date', serverDate)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // 데이터 없음 에러 제외
      if (!data) return { tasks: [], memo: '', updated_at: null };

      return {
        ...data,
        tasks: migrateTasks(typeof data.tasks === 'string' ? JSON.parse(data.tasks) : data.tasks),
        notModified: false
      };
    },
    initialData: initialData.tasks.length > 0 ? { ...initialData, notModified: true } : undefined,
    staleTime: 0, // 날짜 바꾸면 바로바로 확인하도록 0으로 설정 (모바일 이슈 해결)
  });

  // 3. 서버 -> 로컬 동기화
  useEffect(() => {
    if (!serverData || serverData.notModified) return;
    if (isEditing.current) return; // 내가 수정 중이면 무시

    isServerUpdate.current = true;
    setLocalTasks(serverData.tasks || []);
    setLocalMemo(serverData.memo || '');
    
    // 로컬 스토리지 최신화
    localStorage.setItem(localKey, JSON.stringify({ 
        tasks: serverData.tasks || [], 
        memo: serverData.memo || '',
        updatedAt: serverData.updated_at 
    }));
    setTimeout(() => isServerUpdate.current = false, 100);
  }, [serverData, localKey]);

  // 4. 저장 (업데이트)
  const saveToSupabase = async (tasks: Task[], memo: string) => {
      const now = new Date().toISOString();
      const payload = { tasks, memo, updatedAt: now };
      
      // 로컬 즉시 저장
      localStorage.setItem(localKey, JSON.stringify(payload));
      
      // React Query 캐시 갱신
      queryClient.setQueryData(['tasks', dateKey, userId, spaceId], (old: any) => ({
          ...old, ...payload, notModified: true
      }));

      if (!userId || !spaceId) return;

      // 서버 저장
      await supabase.from('task_logs').upsert({
        user_id: userId,
        space_id: spaceId,
        date: serverDate,
        tasks: JSON.stringify(tasks),
        memo: memo,
        updated_at: now
      }, { onConflict: 'user_id,space_id,date' });
  };

  const updateTasks = useCallback((newTasks: Task[], newMemo?: string) => {
      if (isServerUpdate.current) {
          setLocalTasks(newTasks);
          return;
      }
      
      // [낙관적 업데이트] 즉시 반영
      setLocalTasks(newTasks);
      if (newMemo !== undefined) setLocalMemo(newMemo);
      
      isEditing.current = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      if (!isAutoSaveEnabled) return;

      // 디바운스 저장
      saveTimeoutRef.current = setTimeout(async () => {
          try {
              await saveToSupabase(newTasks, newMemo !== undefined ? newMemo : localMemo);
              isEditing.current = false;
          } catch (err) { console.error(err); }
      }, 1000);
  }, [localMemo, userId, spaceId, dateKey, localKey]);

  // 날짜/스페이스 변경 시 리셋
  useEffect(() => {
     // 상태 초기화 로직 (여기선 useQuery가 처리하므로 생략 가능하나 안전장치)
     isEditing.current = false;
  }, [dateKey, spaceId]);

  return {
    tasks: localTasks,
    memo: localMemo,
    isLoading: isLoading && localTasks.length === 0,
    updateTasks: { mutate: ({ tasks, memo }: { tasks: Task[], memo: string }) => updateTasks(tasks, memo) }
  };
};