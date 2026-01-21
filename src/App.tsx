import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './contexts/AuthContext';
import { useSpace } from './contexts/SpaceContext';
import { AuthModal } from './components/AuthModal';
import { SpaceSelector } from './components/SpaceSelector';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Play, Pause, BarChart2, X, ChevronLeft, ChevronRight, Plus, ArrowRight, ArrowLeft, Calendar, HelpCircle, ChevronDown, ChevronUp, Trash2, Copy, Flame, RotateCcw, RotateCw } from 'lucide-react';
import { Task, DailyLog } from './types';
import { UnifiedTaskItem } from './components/UnifiedTaskItem';
import { FlowView } from './components/FlowView';

import { AutoResizeTextarea } from './components/AutoResizeTextarea';
import { useTasks, useAllTaskLogs } from './hooks/useTasks';

// --- [컴포넌트] 태스크 히스토리 모달 ---
const TaskHistoryModal = React.memo(({ taskName, logs, onClose }: { taskName: string, logs: DailyLog[], onClose: () => void }) => {
  const historyList = useMemo(() => {
    const list: { date: string, task: Task, subTasks: Task[] }[] = [];
    logs.forEach(log => {
      const found = log.tasks.find(t => {
        const tName = t.name || t.text || '';
        return tName.trim() === taskName.trim();
      });
      if (found) {
        // Include sub-tasks (tasks with parent === found.id or depth > 0)
        const subTasks = log.tasks.filter((st: Task) => st.parent === found.id || (st.depth && st.depth > 0));
        list.push({ date: log.date, task: found, subTasks });
      }
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, taskName]);

  return (
    <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div><h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase mb-1">TASK HISTORY</h2><h1 className="text-xl font-black text-white">"{taskName}"</h1></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
        </div>
        {historyList.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No history found.</div>
        ) : (
          <div className="space-y-4">
            {historyList.map(record => {
              const d = new Date(record.date);
              const dateLabel = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
              return (
                <div key={record.date} className="bg-[#1a1a1f] border border-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">{dateLabel}</div>
                  <div className="text-white font-bold mb-2">{record.task.name || record.task.text || ''}</div>
                  {record.subTasks && record.subTasks.length > 0 && (
                    <div className="space-y-1">
                      {record.subTasks.map(st => (
                        <div key={st.id} className="text-gray-400 text-sm ml-4">- {st.name || st.text || ''}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// --- [컴포넌트] 날짜 선택 모달 ---
const DatePickerModal = React.memo(({ currentDate, onDateSelect, onClose }: { currentDate: Date, onDateSelect: (date: Date) => void, onClose: () => void }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSubmit = () => {
    onDateSelect(selectedDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div><h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase mb-1">DATE SELECTION</h2><h1 className="text-xl font-black text-white">Select a Date</h1></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
        </div>
        <div className="mb-4">
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split('-').map(Number);
              handleDateChange(new Date(y, m - 1, d));
            }}
            className="w-full p-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Select</button>
        </div>
      </div>
    </div>
  );
});

// --- [컴포넌트] 메모 모아보기 모달 ---
const MemoCollectionModal = React.memo(({ logs, onClose }: { logs: DailyLog[], onClose: () => void }) => {
  const memoList = useMemo(() => {
    return logs
      .filter(log => log.memo && log.memo.trim())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs]);

  return (
    <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div><h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase mb-1">MEMO COLLECTION</h2><h1 className="text-xl font-black text-white">All Memos</h1></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
        </div>
        {memoList.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No memos found.</div>
        ) : (
          <div className="space-y-4">
            {memoList.map(log => {
              const d = new Date(log.date);
              const dateLabel = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
              return (
                <div key={log.date} className="bg-[#1a1a1f] border border-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">{dateLabel}</div>
                  <div className="text-white whitespace-pre-wrap">{log.memo}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// --- 메인 앱 ---

export default function App() {
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { currentSpace, spaces, setCurrentSpace } = useSpace();

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isInternalUpdate = useRef(false);

  // React Query Hooks
  const { tasks, memo: currentMemo, updateTasks, isLoading } = useTasks({
      currentDate: viewDate,
      userId: user?.id,
      spaceId: currentSpace?.id ? String(currentSpace.id) : undefined
  });

  const { data: allLogs } = useAllTaskLogs(user?.id, currentSpace?.id ? String(currentSpace.id) : undefined);
  const logs = allLogs || [];

  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);

  const [showHistoryTarget, setShowHistoryTarget] = useState<string | null>(null);
  // Removed duplicate state declarations
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMemoCollection, setShowMemoCollection] = useState(false);
  const timeInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  
  const [history, setHistory] = useState<Task[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const swipeTouchStart = useRef<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Memo state and debouncing
  const [localMemo, setLocalMemo] = useState(currentMemo || '');
  const memoTimeoutRef = useRef<any>(null);

  // Update local memo when currentMemo changes
  useEffect(() => {
    if (currentMemo !== localMemo) {
      setLocalMemo(currentMemo || '');
    }
  }, [currentMemo]);

  // New State: View Mode
  const [viewMode, setViewMode] = useState<'day' | 'flow' | 'project'>('day');

  const activeTask = useMemo(() => {
    if (!focusedTaskId) return undefined;
    const currentTasks = tasks.find(t => t.id === focusedTaskId);
    if (currentTasks) return currentTasks;
    for (const log of logs) {
      const found = log.tasks.find(t => t.id === focusedTaskId);
      if (found) return found;
    }
    return undefined;
  }, [tasks, logs, focusedTaskId]);

  // 플로팅 바 타이머 UI 업데이트를 위한 로컬 상태
  const [activeTimerElapsed, setActiveTimerElapsed] = useState(0);

  useEffect(() => {
    let interval: any;
    if (activeTask?.isTimerOn && activeTask.timerStartTime) {
        const update = () => {
             const now = Date.now();
             const seconds = Math.floor((now - activeTask.timerStartTime!) / 1000);
             setActiveTimerElapsed(seconds);
        };
        update();
        interval = setInterval(update, 1000);
    } else {
        setActiveTimerElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeTask?.isTimerOn, activeTask?.timerStartTime, activeTask?.id]);

  // Floating bar timer input real-time update
  useEffect(() => {
    if (activeTask?.isTimerOn && activeTask.timerStartTime) {
      const update = () => {
        const now = Date.now();
        const seconds = Math.floor((now - activeTask.timerStartTime!) / 1000);
        const total = (activeTask.actTime || 0) + seconds;
        const h = Math.floor(total / 3600).toString().padStart(2, '0');
        const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
        const s = (total % 60).toString().padStart(2, '0');
        if (timeInputRefs.current[0]) timeInputRefs.current[0].value = h;
        if (timeInputRefs.current[1]) timeInputRefs.current[1].value = m;
        if (timeInputRefs.current[2]) timeInputRefs.current[2].value = s;
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTask?.isTimerOn, activeTask?.timerStartTime, activeTask?.actTime]);

  useEffect(() => {
    // 1. dvh 지원 여부 확인 및 폴백 설정
    const setAppHeight = () => {
      const doc = document.documentElement;
      // dvh를 지원하는지 체크하는 간단한 방법은 없지만, vh를 100 * 0.01로 설정하여 커스텀 속성 사용
      doc.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    const handleVisualViewportResize = () => {
      if (!window.visualViewport) return;
      // 키보드가 올라왔을 때 스크롤 가능한 영역 확보를 위해 padding-bottom 동적 조정
      // 과거 백업에서 성공했던 로직 복원: visualViewport 높이를 기반으로 오프셋 계산
      const currentVisualHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      
      // 키보드 높이 계산 (오차가 있을 수 있으므로 여유값 추가)
      const keyboardHeight = windowHeight - currentVisualHeight;
      
      if (keyboardHeight > 100) { // 키보드가 올라온 것으로 간주
          document.documentElement.style.setProperty('--keyboard-offset', `${keyboardHeight}px`);
          
          // 포커스된 요소가 가려지지 않도록 스크롤 조정 (옵션)
          if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
             setTimeout(() => {
                 document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }, 100);
          }
      } else {
          document.documentElement.style.setProperty('--keyboard-offset', '0px');
      }
    };
    
    window.addEventListener('resize', setAppHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }
    setAppHeight();
    handleVisualViewportResize();

    return () => {
      window.removeEventListener('resize', setAppHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
    };
  }, []);

  // History management
  useEffect(() => {
    if (isLoading || isInternalUpdate.current) return;
    
    setHistory(prev => {
        const newHistory = [...prev.slice(0, historyIndex + 1), tasks];
        if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
        return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [tasks]); // tasks 변경 시 히스토리 추가 (isLoading 제외)


  const handleUpdateTask = useCallback((taskId: number, updates: Partial<Task>) => {
    const isStatusUpdate = 'status' in updates;
    const isSelectionUpdate = selectedTaskIds.has(taskId) && isStatusUpdate;

    // If updating a project's percentage or time, we might want to sync it across all instances of that project name
    const taskToUpdate = tasks.find(t => t.id === taskId);
    const isProjectUpdate = taskToUpdate && typeof taskToUpdate.percent === 'number' && ('percent' in updates || 'actTime' in updates || 'planTime' in updates);
    const projectName = taskToUpdate ? (taskToUpdate.name || taskToUpdate.text || '').trim() : '';

    const nextTasks = tasks.map(t => {
        const isSameProject = isProjectUpdate && projectName && (t.name || t.text || '').trim() === projectName;
        
        if (t.id === taskId || (isSelectionUpdate && selectedTaskIds.has(t.id)) || isSameProject) {
            let updatedTask = { ...t, ...updates };
            
            // If this is a project sync, ensure we copy all relevant metadata
            if (isSameProject && !selectedTaskIds.has(t.id) && t.id !== taskId) {
                if ('percent' in updates) updatedTask.percent = updates.percent;
                if ('planTime' in updates) updatedTask.planTime = updates.planTime;
                if ('actTime' in updates) updatedTask.actTime = updates.actTime;
                if ('act_time' in updates) updatedTask.act_time = updates.act_time;
            }

            // Set end_time when status changes to completed
            if (isStatusUpdate && updates.status === 'completed' && t.status !== 'completed') {
                updatedTask.end_time = Date.now();
            }
            return updatedTask;
        }
        return t;
    });
    updateTasks.mutate({ tasks: nextTasks, memo: currentMemo });
  }, [tasks, currentMemo, updateTasks, selectedTaskIds]);

  const handleAddTaskAtCursor = useCallback((taskId: number, textBefore: string, textAfter: string) => {
      // 1. 현재 리스트 복사 및 인덱스 찾기
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return;

      const current = tasks[idx];
      
      // 2. 새 항목 생성 (아랫줄)
      const newTasksToAdd: Task[] = textAfter.split('\n').map((line, i) => ({
        id: Date.now() + i + Math.random(), // 유니크 ID
        name: line,
        status: 'pending', 
        indent: current.indent, 
        parent: current.parent, 
        text: line,
        percent: undefined, 
        planTime: 0, 
        actTime: 0, 
        isTimerOn: false, 
        depth: current.depth || 0, 
        space_id: String(currentSpace?.id || ''),
      }));

      // 3. 리스트 재구성: [이전 항목들] + [수정된 현재 항목] + [새 항목들] + [이후 항목들]
      const nextTasks = [...tasks];
      // 현재 항목 수정 (윗줄 자르기)
      nextTasks[idx] = { ...current, name: textBefore, text: textBefore };
      // 새 항목 삽입
      nextTasks.splice(idx + 1, 0, ...newTasksToAdd);

      // 4. 포커스 이동 타겟 설정
      const nextFocusId = newTasksToAdd.length > 0 ? newTasksToAdd[0].id : null;
      if (nextFocusId) {
        setFocusedTaskId(nextFocusId);
      }

      // [CRITICAL FIX] 엔터 키 데이터 유실 방지를 위한 즉시 캐시 업데이트
      // 서버 응답 대기 중 입력값 증발 방지 (낙관적 업데이트)
      const queryKey = ['tasks', viewDate.toDateString(), user?.id, currentSpace?.id ? String(currentSpace.id) : undefined];
      queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return { tasks: nextTasks, memo: currentMemo };
          return {
              ...old,
              tasks: nextTasks,
              memo: currentMemo
          };
      });

      // 5. 서버 동기화 요청
      updateTasks.mutate({ tasks: nextTasks, memo: currentMemo });
      
  }, [tasks, currentMemo, updateTasks, currentSpace, queryClient, viewDate, user]);



  const handleIndent = useCallback((taskId: number) => {
    if (selectedTaskIds.has(taskId)) {
        const next = tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, depth: (t.depth || 0) + 1 } : t);
        updateTasks.mutate({ tasks: next, memo: currentMemo });
    } else {
        const taskToIndent = activeTask || tasks.find(t => t.id === taskId);
        if (taskToIndent) {
          handleUpdateTask(taskId, { depth: (taskToIndent.depth || 0) + 1 });
        }
    }
    setFocusedTaskId(taskId);
  }, [handleUpdateTask, activeTask, tasks, selectedTaskIds, updateTasks, currentMemo]);

  const handleOutdent = useCallback((taskId: number) => {
    if (selectedTaskIds.has(taskId)) {
        const next = tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, depth: Math.max(0, (t.depth || 0) - 1) } : t);
        updateTasks.mutate({ tasks: next, memo: currentMemo });
    } else {
        const taskToOutdent = activeTask || tasks.find(t => t.id === taskId);
        if (taskToOutdent) {
          handleUpdateTask(taskId, { depth: Math.max(0, (taskToOutdent.depth || 0) - 1) });
        }
    }
    setFocusedTaskId(taskId);
  }, [handleUpdateTask, activeTask, tasks, selectedTaskIds, updateTasks, currentMemo]);

  const handleFocusPrev = useCallback((taskId: number, cursorIndex: number | 'start' | 'end' = 'end') => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx > 0) {
      setFocusedTaskId(tasks[idx - 1].id);
      (window as any).__cursorPosition = cursorIndex;
    }
  }, [tasks]);

  const handleFocusNext = useCallback((taskId: number, cursorIndex: number | 'start' | 'end' = 'start') => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1 && idx < tasks.length - 1) {
      setFocusedTaskId(tasks[idx + 1].id);
      (window as any).__cursorPosition = cursorIndex;
    }
  }, [tasks]);

  const handleMergeWithPrevious = useCallback((_taskId: number, _currentText: string) => {
    // Placeholder - merge logic is handled in handleDeleteTask
  }, []);

  const handleMergeWithNext = useCallback((_taskId: number, _currentText: string) => {
    // Placeholder - merge logic is handled in handleDeleteTask
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isInternalUpdate.current = true;
      const prevTasks = history[historyIndex - 1];
      updateTasks.mutate({ tasks: prevTasks, memo: currentMemo });
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => isInternalUpdate.current = false, 100);
    }
  }, [history, historyIndex, updateTasks, currentMemo]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isInternalUpdate.current = true;
      const nextTasks = history[historyIndex + 1];
      updateTasks.mutate({ tasks: nextTasks, memo: currentMemo });
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => isInternalUpdate.current = false, 100);
    }
  }, [history, historyIndex, updateTasks, currentMemo]);

  const handleMoveUp = useCallback((taskId: number) => {
    if (selectedTaskIds.has(taskId)) {
            const sortedSelectedIndices = Array.from(selectedTaskIds)
                .map(id => tasks.findIndex(t => t.id === id))
                .filter(idx => idx !== -1)
                .sort((a, b) => a - b);
            
            if (sortedSelectedIndices.length === 0 || sortedSelectedIndices[0] <= 0) return;
            
            const next = [...tasks];
            for (const idx of sortedSelectedIndices) {
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            }
            updateTasks.mutate({ tasks: next, memo: currentMemo });
        return;
    }

      const index = tasks.findIndex(t => t.id === taskId);
      if (index > 0) {
        const newTasks = [...tasks];
        [newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]];
        updateTasks.mutate({ tasks: newTasks, memo: currentMemo });
      }
  }, [tasks, selectedTaskIds, updateTasks, currentMemo]);

  const handleMoveDown = useCallback((taskId: number) => {
    if (selectedTaskIds.has(taskId)) {
            const sortedSelectedIndices = Array.from(selectedTaskIds)
                .map(id => tasks.findIndex(t => t.id === id))
                .filter(idx => idx !== -1)
                .sort((a, b) => b - a); // Reverse sort for moving down
            
            if (sortedSelectedIndices.length === 0 || sortedSelectedIndices[0] >= tasks.length - 1) return;
            
            const next = [...tasks];
            for (const idx of sortedSelectedIndices) {
                if (idx < next.length - 1) {
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                }
            }
            updateTasks.mutate({ tasks: next, memo: currentMemo });
        return;
    }

      const index = tasks.findIndex(t => t.id === taskId);
      if (index !== -1 && index < tasks.length - 1) {
        const newTasks = [...tasks];
        [newTasks[index], newTasks[index + 1]] = [newTasks[index + 1], newTasks[index]];
        updateTasks.mutate({ tasks: newTasks, memo: currentMemo });
      }
  }, [tasks, selectedTaskIds, updateTasks, currentMemo]);

  const handleDeleteTask = useCallback((taskId: number, options?: { mergeDirection?: 'prev' | 'next', currentText?: string, deleteNext?: boolean }) => {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const taskToDelete = tasks[taskIndex];
    const isEmpty = !(taskToDelete.name || taskToDelete.text || '').trim();

    if (options?.deleteNext) {
      const nextTaskIndex = taskIndex + 1;
      if (nextTaskIndex < tasks.length) {
        const nextTask = tasks[nextTaskIndex];
        const nextTaskContent = (nextTask.name || nextTask.text || '').trim();

        if (nextTaskContent === '') {
          // 빈 줄이면 확인 없이 삭제
          const nextTasks = tasks.filter((_, i) => i !== nextTaskIndex);
          updateTasks.mutate({ tasks: nextTasks, memo: currentMemo });
        } else {
          // 내용이 있으면 확인 창
          if (window.confirm("Delete the next line?")) {
            const nextTasks = tasks.filter((_, i) => i !== nextTaskIndex);
            updateTasks.mutate({ tasks: nextTasks, memo: currentMemo });
          }
        }
      }
      return;
    }

    if (isEmpty) {
      // For empty tasks, merge with adjacent line instead of deleting
      if (options?.mergeDirection === 'prev' && taskIndex > 0) {
        // Backspace: merge with previous line
        const prevTask = tasks[taskIndex - 1];
        const mergedText = (prevTask.name || '') + '';
        const next = tasks.filter((_, i) => i !== taskIndex).map((t, i) =>
          i === taskIndex - 1 ? { ...t, name: mergedText, text: mergedText } : t
        );
        updateTasks.mutate({ tasks: next, memo: currentMemo });
        setFocusedTaskId(prevTask.id);
        (window as any).__restoreCursorPos = (prevTask.name || '').length;
  } else if (options?.mergeDirection === 'next' && taskIndex < tasks.length - 1) {
        // Delete: merge with next line
        const nextTask = tasks[taskIndex + 1];
        const nextTaskContent = (nextTask.name || nextTask.text || '').trim();

        // If next task has content, ask for confirmation
        if (nextTaskContent && !window.confirm("Delete this task?")) {
          return; // Don't merge if user cancels
        }

        const currentTaskContent = options?.currentText || (tasks[taskIndex].name || tasks[taskIndex].text || '');
        const mergedText = currentTaskContent + (nextTask.name || nextTask.text || '');
        const next = tasks.filter((_, i) => i !== taskIndex + 1).map((t, i) =>
          i === taskIndex ? { ...t, name: mergedText, text: mergedText } : t
        );
        updateTasks.mutate({ tasks: next, memo: currentMemo });
      } else {
        // No adjacent line to merge with, just delete normally
        const next = tasks.filter(t => t.id !== taskId);
        updateTasks.mutate({ tasks: next, memo: currentMemo });
        setFocusedTaskId(null);
      }
    } else if (window.confirm("Delete this task?")) {
      // For non-empty tasks, show confirmation
      const next = tasks.filter(t => t.id !== taskId);
      updateTasks.mutate({ tasks: next, memo: currentMemo });
      setFocusedTaskId(null);
    }
  }, [tasks, updateTasks, currentMemo]);

  const handleCopyTask = useCallback((task: Task) => {
    const text = task.name || task.text || '';
    navigator.clipboard.writeText(text);
  }, []);

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
        const now = Date.now();
        let changed = false;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const next = tasks.map(t => { 
            if (t.isTimerOn && t.timerStartTime) { 
                const elapsed = (now - t.timerStartTime) / 1000; 
                changed = true; 
                return { ...t, actTime: (t.actTime || 0) + elapsed, timerStartTime: now }; 
            } 
            return t; 
        });
        // 타이머 업데이트는 로컬 상태 변경으로 처리할 수 있지만, 
        // 여기서는 useTasks 훅 구조상 tasks 상태가 훅 내부에서 오므로
        // 매 초마다 mutation을 호출하는 것은 너무 비효율적입니다.
        // 따라서 타이머 업데이트는 UI에서만 반영되거나, 
        // 일정 주기로만 저장되도록 수정하는 것이 좋으나,
        // 기존 로직 유지를 위해 여기서는 setTasks 대신 updateTasks를 호출하되,
        // 너무 잦은 호출 방지가 필요합니다. (TODO: Debounce or Local State for Timer)
        // 일단은 1초마다 저장은 너무 잦으므로, 타이머 틱은 별도 로컬 state로 관리하거나
        // updateTasks를 호출하되 서버 부하를 고려해야 합니다.
        // 현재 구조상 setTasks가 없으므로 updateTasks를 호출해야 합니다.
        if (changed) {
             console.debug('Timer tick', next);
            // updateTasks.mutate({ tasks: next, memo: currentMemo }); // 너무 잦은 호출 위험
            // 임시 방편: 타이머는 실시간 저장을 하지 않고, 
            // 멈출 때나 다른 액션 시에 저장되도록 하는 것이 일반적입니다.
            // 하지만 사용자 경험을 위해 여기서는 생략하고, 
            // Play/Pause 토글 시에만 시간이 저장되도록 수정하는 것이 좋습니다.
            // (기존 코드에서도 setTasks만 하고 saveToSupabase는 안했을 수도 있음 - 확인 필요)
            // 기존 코드: setTasks 호출 -> useEffect에 의해 saveToSupabase 호출될 수도 있음.
            // 확인 결과 기존 코드는 setTasks 후 saveToSupabase를 호출하지 않음 (useEffect가 tasks 변경 감지 안함? 아님)
            // 기존 useEffect[tasks] 가 없었고, handleUpdateTask 등에서만 saveToSupabase 호출함.
            // Timer useEffect에서는 setTasks만 호출했음.
            // 따라서 여기서는 UI 업데이트만 필요함. 하지만 tasks는 이제 prop으로 옴.
            // 결론: 타이머 기능은 React Query와 같은 서버 상태 동기화 구조에서는 
            // 로컬 상태로 분리하거나, 별도 처리가 필요함.
            // 여기서는 일단 주석 처리하고, 타이머 토글 시에만 저장되도록 함.
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [tasks, currentMemo, updateTasks]); 
  // TODO: 타이머 실시간 UI 업데이트 로직 구현 필요 (서버 저장 없이)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
          const oldIndex = tasks.findIndex((t) => t.id === active.id);
          const newIndex = tasks.findIndex((t) => t.id === over.id);
          const next = arrayMove(tasks, oldIndex, newIndex);
          updateTasks.mutate({ tasks: next, memo: currentMemo });
    }
  };

  const onTaskClickWithRange = useCallback((e: React.MouseEvent, taskId: number, index: number) => {
      e.stopPropagation(); // Prevent global click handler from deselecting
      
      if (e.shiftKey && lastClickedIndex.current !== null) {
          const allIds = tasks.map(t => t.id);
          const startIdx = lastClickedIndex.current;
          const endIdx = index;
          
          const min = Math.min(startIdx, endIdx);
          const max = Math.max(startIdx, endIdx);
          
          const rangeIds = allIds.slice(min, max + 1);
          setSelectedTaskIds(new Set(rangeIds));
      } else if (e.ctrlKey || e.metaKey) {
          setSelectedTaskIds(prev => {
              const newSet = new Set(prev);
              if (newSet.has(taskId)) newSet.delete(taskId); else newSet.add(taskId);
              return newSet;
          });
          lastClickedIndex.current = index;
      } else {
          // Clear selection on single click and set as new starting point for shift-click
          setSelectedTaskIds(new Set([taskId]));
          lastClickedIndex.current = index;
      }
  }, [tasks]);

  const handleSpaceChange = useCallback((space: any) => {
    setCurrentSpace(space);
    localStorage.setItem('lastSpaceId', String(space.id));
  }, [setCurrentSpace]);

  // Load last space on mount
  useEffect(() => {
    const lastSpaceId = localStorage.getItem('lastSpaceId');
    if (lastSpaceId && spaces && spaces.length > 0) {
      const lastSpace = spaces.find(s => String(s.id) === lastSpaceId);
      if (lastSpace) {
        setCurrentSpace(lastSpace);
      }
    }
  }, [spaces, setCurrentSpace]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Alt + 숫자 단축키 (스페이스 이동)
      if (e.altKey && !isNaN(Number(e.key)) && Number(e.key) >= 1 && Number(e.key) <= 9) {
        e.preventDefault(); // 기본 동작 방지 (브라우저 탭 이동 등)
        const index = Number(e.key) - 1;
        if (spaces && spaces[index]) {
          setCurrentSpace(spaces[index]);
        }
        return;
      }

      if (selectedTaskIds.size > 0 && !isInput) {
          if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            const anyPending = tasks.some(t => selectedTaskIds.has(t.id) && t.status !== 'completed');
            const newStatus: Task['status'] = anyPending ? 'completed' : 'pending';
            const nextTasks: Task[] = tasks.map(t => selectedTaskIds.has(t.id) ? { ...t, status: newStatus, isTimerOn: false } : t);
            updateTasks.mutate({ tasks: nextTasks, memo: currentMemo });
            return;
          }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); handleRedo(); }
      if (e.shiftKey && e.key === 'M') { e.preventDefault(); setShowMemoCollection(true); }
      if (e.key === '?' && !isInput) { e.preventDefault(); setShowShortcuts(true); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [tasks, selectedTaskIds, handleUndo, handleRedo, spaces, setCurrentSpace, updateTasks, currentMemo]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const _currentLog = logs.find(l => l.date === viewDate.toDateString());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const getStreakAtDate = useCallback((currentDate: Date) => {
      const hasCompletedAtDate = (date: Date) => logs.find(log => log.date === date.toDateString())?.tasks.some(t => t.status === 'completed');
      if (!hasCompletedAtDate(currentDate)) return 0;
      let streak = 1;
      let checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - 1);
      for(let k=0; k<365; k++) { 
          if (hasCompletedAtDate(checkDate)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else break;
      }
      return streak;
  }, [logs]);

  const currentStreak = getStreakAtDate(viewDate);
  const showBulkActions = selectedTaskIds.size > 1;

  const handleMoveSelectedToDate = useCallback((targetDate: string) => {
    const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
    if (selectedTasks.length === 0) return;
    
    // 1. Remove from current date
    const next = tasks.filter(t => !selectedTaskIds.has(t.id));
    updateTasks.mutate({ tasks: next, memo: currentMemo });

    // 2. Add to target date (Not implemented in single-date hook, need global mutation or separate call)
    // NOTE: This requires a way to update another date's data. 
    // Since useTasks is bound to viewDate, we can't easily update another date using its mutation.
    // For now, let's just log a warning or implement a direct Supabase call for move.
    console.warn(`Moving tasks to ${targetDate} is not fully supported with single-date useTasks hook yet without refetching.`);
    // In a real app, you'd have a mutation that accepts a date.
    
    setSelectedTaskIds(new Set());
    setShowDatePicker(false);
  }, [tasks, selectedTaskIds, updateTasks, currentMemo]);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);

  const projects = useMemo(() => {
    // A project is a task that has a percent value (not undefined/null) and has a name/text.
    const projectMap = new Map<string, Task>();

    // 1. Iterate through every log in logs (from allLogs)
    // Sort logs by date ascending so that more recent logs overwrite older ones in the map
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedLogs.forEach(log => {
      if (log.tasks && Array.isArray(log.tasks)) {
        log.tasks.forEach(t => {
          const name = (t.name || t.text || '').trim();
          // Only include tasks that have a percent value (project requirement)
          if (name && t.percent !== undefined && t.percent !== null) {
            // We want to keep a unique list by name.
            // By sorting logs ascending, the latest date's task will be the final value in the map.
            projectMap.set(name, t);
          }
        });
      }
    });

    // 2. Also include projects from the current tasks state (most recent)
    if (tasks && Array.isArray(tasks)) {
      tasks.forEach(t => {
        const name = (t.name || t.text || '').trim();
        // Only include tasks that have a percent value (project requirement)
        if (name && t.percent !== undefined && t.percent !== null) {
          projectMap.set(name, t);
        }
      });
    }

    const result = Array.from(projectMap.values());
    // Sort projects by 'updated_at' in descending order (most recently updated first)
    result.sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA; // Descending sort
    });

    console.log('Global Projects List (filtered by percent):', result.map(p => p.name || p.text));
    return result;
  }, [logs, tasks]);

  const selectedProject = useMemo(() => {
    if (selectedProjectName) {
      const found = projects.find(p => (p.name || p.text || '').trim() === selectedProjectName);
      if (found) return found;
    }
    if (selectedProjectId) {
      const found = projects.find(p => p.id === selectedProjectId);
      if (found) return found;
    }
    return projects[0];
  }, [projects, selectedProjectId, selectedProjectName]);

  // Log viewDate changes to verify project list persistence
  useEffect(() => {
    console.log('viewDate changed to:', viewDate.toDateString());
    console.log('Current projects count:', projects.length);
  }, [viewDate, projects.length]);

  const projectSubtasks = useMemo(() => {
    if (!selectedProject) return [];
    const projectName = (selectedProject.name || selectedProject.text || '').trim();
    
    const allSubtasks: (Task & { date?: string })[] = [];

    // 1. Aggregate from allLogs
    logs.forEach(log => {
      const sourceTasks = log.tasks || [];
      const projectInLog = sourceTasks.find((t: Task) => (t.name || t.text || '').trim() === projectName);
      
      if (projectInLog) {
        const idx = sourceTasks.findIndex((t: Task) => t.id === projectInLog.id);
        for (let i = idx + 1; i < sourceTasks.length; i++) {
          if ((sourceTasks[i].depth || 0) > (projectInLog.depth || 0)) {
            allSubtasks.push({ ...sourceTasks[i], date: log.date });
          } else {
            break;
          }
        }
      }
    });

    // 2. Aggregate from current tasks (if not already in logs for today)
    const todayStr = viewDate.toDateString();
    const projectInTasks = tasks.find((t: Task) => (t.name || t.text || '').trim() === projectName);
    if (projectInTasks) {
      const idx = tasks.findIndex((t: Task) => t.id === projectInTasks.id);
      for (let i = idx + 1; i < tasks.length; i++) {
        if ((tasks[i].depth || 0) > (projectInTasks.depth || 0)) {
          // Avoid duplicates if the same subtask is already in allSubtasks for today
          const exists = allSubtasks.some(st => st.id === tasks[i].id);
          if (!exists) {
            allSubtasks.push({ ...tasks[i], date: todayStr });
          }
        } else {
          break;
        }
      }
    }

    // Sort by date descending
    return allSubtasks.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [logs, tasks, selectedProject, viewDate]);

  // --- Flow View Handlers ---
  // Flow view updates multiple dates, which isn't directly supported by the single-date useTasks hook.
  // Ideally, FlowView should use its own data management or useTasks should support multi-date.
  // For now, these are placeholders or need to be implemented via direct Supabase calls or a more global hook.
  
  const handleUpdateTaskInFlow = useCallback((date: string, taskId: number, updates: Partial<Task>) => {
      // Direct mutation for flow view
      // This is a bit of a hack since we are bypassing the hook's cache management for other dates
      // But for the current view date, we should probably check if it matches.
      if (date === viewDate.toDateString()) {
          handleUpdateTask(taskId, updates);
      } else {
          console.warn("Updating tasks in other dates from Flow View not fully implemented via hook.");
      }
  }, [viewDate, handleUpdateTask]);

  const handleAddTaskInFlow = useCallback((date: string, taskId: number, textBefore: string, textAfter: string) => {
     if (date === viewDate.toDateString()) {
         handleAddTaskAtCursor(taskId, textBefore, textAfter);
     }
  }, [viewDate, handleAddTaskAtCursor]);



  const handleIndentTaskInFlow = useCallback((date: string, taskId: number, direction: 'in' | 'out') => {
      if (date === viewDate.toDateString()) {
          if (direction === 'in') handleIndent(taskId);
          else handleOutdent(taskId);
      }
  }, [viewDate, handleIndent, handleOutdent]);
  
  const handleMoveTaskInFlow = useCallback((date: string, taskId: number, direction: 'up' | 'down') => {
      if (date === viewDate.toDateString()) {
          if (direction === 'up') handleMoveUp(taskId);
          else handleMoveDown(taskId);
      }
  }, [viewDate, handleMoveUp, handleMoveDown]);

  useEffect(() => {
    const handleOpenHistory = (e: any) => {
      const taskName = e.detail.taskName;
      if (taskName) {
        setShowHistoryTarget(taskName);
      }
    };
    window.addEventListener('open-history', handleOpenHistory);
    return () => window.removeEventListener('open-history', handleOpenHistory);
  }, []);

  return (
    <div 
      className="flex flex-col h-full bg-[#050505] text-[#e0e0e0] font-sans overflow-hidden" 
      style={{ height: 'var(--app-height, 100vh)' }}
      onClick={(e) => {
        // Only deselect if clicking directly on the background container
        if (e.target === e.currentTarget) {
          setSelectedTaskIds(new Set());
          setFocusedTaskId(null);
        }
      }}
    >
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <nav 
        className="flex-none flex items-center justify-between px-2 py-3 md:p-4 max-w-xl mx-auto w-full flex-nowrap overflow-x-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <SpaceSelector onSpaceChange={handleSpaceChange} />
        <div className="flex gap-2 md:gap-3 items-center flex-nowrap flex-shrink-0">
          <div className="flex bg-[#1a1a1f] rounded-lg p-0.5 border border-white/10 flex-shrink-0">
              <button onClick={() => setViewMode('day')} className={`px-2 md:px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === 'day' ? 'bg-[#7c4dff] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>DAY</button>
              <button onClick={() => setViewMode('project')} className={`px-2 md:px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === 'project' ? 'bg-[#7c4dff] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>PROJECT</button>
              <button onClick={() => setViewMode('flow')} className={`px-2 md:px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === 'flow' ? 'bg-[#7c4dff] text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>FLOW</button>
          </div>

          <button onClick={() => setShowShortcuts(!showShortcuts)} className="text-gray-500 hover:text-white p-1 flex-shrink-0"><HelpCircle size={18} /></button>
          <button onClick={() => user ? signOut() : setShowAuthModal(true)} className="text-xs text-gray-500 hover:text-white whitespace-nowrap flex-shrink-0">{user ? 'Logout' : 'Login'}</button>
        </div>
      </nav>
      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        <div
          className="max-w-2xl mx-auto flex flex-col px-2 md:px-4 pb-4"
          onClick={(e) => e.stopPropagation()}
        >
        {viewMode === 'day' ? (
            <>
                <div className={`calendar-area mb-4 bg-[#0f0f14] p-5 rounded-3xl border border-white/5 shadow-2xl transition-opacity duration-200 ${isLoading ? 'opacity-50' : ''}`} onTouchStart={(e) => swipeTouchStart.current = e.touches[0].clientX} onTouchEnd={(e) => { if (swipeTouchStart.current === null) return; const diff = swipeTouchStart.current - e.changedTouches[0].clientX; if (Math.abs(diff) > 100) setViewDate(new Date(year, month + (diff > 0 ? 1 : -1), 1)); swipeTouchStart.current = null; }}>
                   <div className="relative flex justify-between items-center mb-5 px-1">
                     <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronLeft size={22} /></button>
                     <div className="text-center cursor-pointer" onClick={() => {
                       const now = new Date();
                       setViewDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
                     }}>
                       <div className="text-[11px] text-gray-500 uppercase tracking-widest font-bold">{year}</div>
                       <div className="font-black text-xl text-white">{viewDate.toLocaleString('default', { month: 'long' })}</div>
                     </div>
                     <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronRight size={22} /></button>
                     <button onClick={() => {
                       const now = new Date();
                       setViewDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
                     }} className="absolute top-3 right-12 p-2 hover:bg-white/5 rounded-full text-gray-400 transition-colors flex items-center justify-center">
                       <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                     </button>
                   </div>
                   <div className="grid grid-cols-7 gap-1">{['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-center text-[10px] text-gray-600 font-black py-1">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { 
                       const d = new Date(year, month, 1); 
                       d.setDate(d.getDate() + (i - d.getDay())); 
                       // Check logs for completion status
                       const l = logs.find(log => log.date === d.toDateString());
                       const hasCompleted = l?.tasks.some(t => t.status === 'completed');
                       const now = new Date();
                       const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();
                       const isToday = d.toDateString() === todayStr;
                       const isSelected = d.toDateString() === viewDate.toDateString();
                       
                        const streakCount = getStreakAtDate(d);
                        const isOtherMonth = d.getMonth() !== month;
                        let btnClass = "h-11 rounded-xl text-xs flex flex-col items-center justify-center relative transition-all border-2 w-full ";
                        if (isSelected) btnClass += "border-[#7c4dff] z-10 "; else btnClass += "border-transparent ";
                        if (isToday) btnClass += "ring-2 ring-inset ring-blue-500 ";
                        if (hasCompleted) {
                          const opacityClass = streakCount <= 1 ? "bg-[#39ff14]/20" : streakCount === 2 ? "bg-[#39ff14]/30" : streakCount === 3 ? "bg-[#39ff14]/40" : streakCount === 4 ? "bg-[#39ff14]/50" : "bg-[#39ff14]/60";
                          btnClass += `${opacityClass} `; 
                          if (isOtherMonth) btnClass += "opacity-20 ";
                          btnClass += isSelected ? "text-white shadow-[0_0_15px_rgba(124,77,255,0.3)] " : "text-white font-bold "; 
                        } else {
                          if (isSelected) btnClass += "text-white ";
                          else if (isToday) btnClass += "bg-blue-500/20 text-blue-400 font-bold ";
                          else if (isOtherMonth) btnClass += "text-gray-700 opacity-30 ";
                          else btnClass += "text-gray-400 hover:bg-white/5 ";
                        }
                        return (
                         <div key={i} className="relative">
                           <button onClick={() => setViewDate(d)} className={btnClass}>
                             <span className="font-black text-[14px]">{d.getDate()}</span>
                             {hasCompleted && streakCount > 1 && (
                                 <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
                                      <Flame size={10} className="text-orange-500 fill-orange-500" />
                                      <span className="text-[9px] font-black text-white hidden md:inline">{streakCount}</span>
                                 </div>
                             )}
                             {l && l.tasks.length > 0 && <div className={`mt-0.5 text-[9px] font-black ${isSelected ? 'text-white/80' : hasCompleted ? 'text-white/90' : 'text-gray-500'}`}>{Math.round((l.tasks.filter(t => t.status === 'completed').length / l.tasks.length) * 100)}%</div>}
                           </button>
                         </div>
                        );
                   })}</div>
                </div>
                <div className="px-6 mb-6">
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <span className="text-4xl font-black text-white leading-none tracking-tight">{completedTasks} <span className="text-gray-600">/</span> <span className="text-gray-500">{totalTasks}</span></span>
                        </div>
                        <div className="text-right flex items-end gap-2">
                            {currentStreak > 1 && (
                                <div className="flex items-center gap-0.5 mb-0.5">
                                    <Flame size={14} className="text-orange-500 fill-orange-500" />
                                    <span className="text-sm font-black text-white">{currentStreak}</span>
                                </div>
                            )}
                            <div className="text-xs font-bold text-[#7c4dff] mb-0.5">{progressPercent}% DONE</div>
                        </div>
                    </div>
                    <div className="h-1.5 w-full bg-[#1a1a1f] rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-[#7c4dff] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <AutoResizeTextarea
                      value={localMemo}
                      onChange={(e: any) => {
                        const newValue = e.target.value;
                        setLocalMemo(newValue);
                        if (memoTimeoutRef.current) clearTimeout(memoTimeoutRef.current);
                        memoTimeoutRef.current = setTimeout(() => {
                          updateTasks.mutate({ tasks, memo: newValue });
                        }, 300);
                      }}
                      onCompositionStart={() => {}}
                      onCompositionEnd={() => {}}
                      placeholder="M E M O"
                      className="w-full bg-transparent text-[16px] text-[#7c4dff]/80 font-bold text-center outline-none"
                    />
                </div>
                <div className={`flex-1 space-y-8 pb-48 transition-opacity duration-200 ${isLoading ? 'opacity-50' : ''}`}>
                  <div>
                      <div className="flex items-center justify-between mb-2 px-2">
                          <div className="flex items-center gap-3">
                            <button onClick={() => { const n: Task = { id: Date.now(), name: '', status: 'pending', indent: 0, parent: null, space_id: String(currentSpace?.id || ''), text: '', percent: undefined, planTime: 0, actTime: 0, isTimerOn: false, depth: 0 }; setFocusedTaskId(n.id); updateTasks.mutate({ tasks: [...tasks, n], memo: currentMemo }); }} className="text-gray-500 hover:text-[#7c4dff]"><Plus size={18} /></button>
                          </div>
                      </div>
                      <div className="-ml-7">
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                              <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                  {tasks.map((t, i) => {
                                      return (
                                          <UnifiedTaskItem
                                              key={t.id}
                                              task={t}
                                              index={i}
                                              updateTask={handleUpdateTask}
                                              setFocusedTaskId={setFocusedTaskId}
                                              focusedTaskId={focusedTaskId}
                                              onTaskClick={onTaskClickWithRange}
                                              isSelected={selectedTaskIds.has(t.id)}
                                              logs={logs}
                                              onAddTaskAtCursor={handleAddTaskAtCursor}
                                              onMergeWithPrevious={handleMergeWithPrevious}
                                              onMergeWithNext={handleMergeWithNext}
                                              onIndent={handleIndent}
                                              onOutdent={handleOutdent}
                                              onMoveUp={handleMoveUp}
                                              onMoveDown={handleMoveDown}
                                              onDelete={handleDeleteTask}
                                              onCopy={handleCopyTask}
                                              onFocusPrev={handleFocusPrev}
                                              onFocusNext={handleFocusNext}
                                          />
                                      );
                                  })}
                              </SortableContext>
                          </DndContext>
                      </div>
                  </div>
                </div>
            </>
        ) : viewMode === 'flow' ? (
            <div className="flex flex-col h-[calc(100vh-120px)] gap-4 p-4 max-w-4xl mx-auto">
                <FlowView
                    logs={logs}
                    currentSpaceId={String(currentSpace?.id || '')}
                    onUpdateTask={handleUpdateTaskInFlow}
                    onAddTask={handleAddTaskInFlow}
                    onIndentTask={handleIndentTaskInFlow}
                    onMoveTask={handleMoveTaskInFlow}
                    setFocusedTaskId={setFocusedTaskId}
                    focusedTaskId={focusedTaskId}
                    onViewDateChange={setViewDate}
                />
            </div>
        ) : (
            <div className="flex flex-col h-[calc(100vh-120px)] gap-4 p-4">
                {/* Project List & Details Combined */}
                <div className="bg-[#0f0f14] rounded-3xl border border-white/5 p-6 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Projects</h2>
                        <button
                            onClick={() => {
                                const n: Task = { id: Date.now(), name: 'New Project', status: 'pending', indent: 0, parent: null, space_id: String(currentSpace?.id || ''), text: 'New Project', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0 };
                                updateTasks.mutate({ tasks: [...tasks, n], memo: currentMemo });
                                setSelectedProjectId(n.id);
                            }}
                            className="p-2 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-all flex items-center gap-2 text-sm font-bold"
                        >
                            <Plus size={16} /> Add Project
                        </button>
                    </div>
                    
                    {projects.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                            <BarChart2 size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">No projects yet. Create your first project!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Project List */}
                            <div className="lg:col-span-1 space-y-3 overflow-y-auto max-h-[calc(100vh-200px)]">
                                {projects.map(project => (
                                    <button
                                        key={`${project.id}-${project.name || project.text}`}
                                        onClick={() => {
                                            setSelectedProjectId(project.id);
                                        }}
                                        className={`w-full text-left p-4 rounded-2xl transition-all border ${selectedProjectId === project.id || (selectedProject && (selectedProject.name || selectedProject.text) === (project.name || project.text)) ? 'bg-[#7c4dff]/10 border-[#7c4dff]/30' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`font-bold text-sm truncate ${selectedProjectId === project.id || (selectedProject && (selectedProject.name || selectedProject.text) === (project.name || project.text)) ? 'text-white' : 'text-gray-400'}`}>{project.name || project.text || 'Untitled Project'}</span>
                                            {project.percent !== undefined && project.percent !== null && project.percent > 0 && (
                                                <span className="text-xs font-bold text-blue-400">
                                                    {project.percent}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="h-1 w-full bg-black/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#7c4dff] transition-all" style={{ width: `${project.percent || 0}%` }} />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Project Details */}
                            <div className="lg:col-span-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                                {selectedProject ? (
                                    <>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex-1">
                                                <input
                                                    value={selectedProject.name || selectedProject.text || ''}
                                                    onChange={(e) => handleUpdateTask(selectedProject.id, { name: e.target.value, text: e.target.value })}
                                                    className="bg-transparent text-2xl font-black text-white outline-none w-full"
                                                    placeholder="Project Name"
                                                />
                                                <div className="flex items-center gap-4 mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <BarChart2 size={14} className="text-gray-500" />
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={selectedProject.percent || 0}
                                                                onChange={(e) => handleUpdateTask(selectedProject.id, { percent: parseInt(e.target.value) || 0 })}
                                                                className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs font-bold text-blue-400 outline-none w-[4ch] text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                            />
                                                            <span className="text-xs font-bold text-gray-400">% Complete</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        <button
                                            onClick={() => {
                                                if (window.confirm("Delete this project?")) {
                                                    const next = tasks.filter(t => t.id !== selectedProject.id);
                                                    updateTasks.mutate({ tasks: next, memo: currentMemo });
                                                    setSelectedProjectId(null);
                                                }
                                            }}
                                            className="ml-4 p-2 rounded-xl hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Subtasks</h3>
                                            {(() => {
                                                const grouped = projectSubtasks.reduce((acc, task) => {
                                                    const date = task.date || 'Unknown Date';
                                                    if (!acc[date]) acc[date] = [];
                                                    acc[date].push(task);
                                                    return acc;
                                                }, {} as Record<string, any[]>);

                                                return Object.entries(grouped).map(([date, subtasks]) => (
                                                    <div key={date} className="space-y-1">
                                                        <div className="text-[10px] font-bold text-[#7c4dff]/50 uppercase tracking-tighter px-2 mb-1">{date}</div>
                                                        <div className="-ml-7">
                                                            {subtasks.map((t, i) => (
                                                                <div key={t.id}>
                                                                    <UnifiedTaskItem
                                                                        task={{...t, depth: Math.max(0, (t.depth || 0) - (selectedProject.depth || 0))}}
                                                                        index={i}
                                                                        updateTask={handleUpdateTask}
                                                                        setFocusedTaskId={setFocusedTaskId}
                                                                        focusedTaskId={focusedTaskId}
                                                                        onTaskClick={onTaskClickWithRange}
                                                                        logs={logs}
                                                                        onAddTaskAtCursor={handleAddTaskAtCursor}
                                                                        onMergeWithPrevious={handleMergeWithPrevious}
                                                                        onMergeWithNext={handleMergeWithNext}
                                                                        isSelected={selectedTaskIds.has(t.id)}
                                                                        onIndent={handleIndent}
                                                                        onOutdent={handleOutdent}
                                                                        onMoveUp={handleMoveUp}
                                                                        onMoveDown={handleMoveDown}
                                                                        onDelete={handleDeleteTask}
                                                                        onCopy={handleCopyTask}
                                                                        onFocusPrev={handleFocusPrev}
                                                                        onFocusNext={handleFocusNext}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                                <button
                                                    onClick={() => {
                                                        const projectName = (selectedProject.name || selectedProject.text || '').trim();

                                                        const now = new Date();
                                                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                                                        if (viewDate.toDateString() !== today.toDateString()) {
                                                            setViewDate(today);
                                                        }

                                                        let currentTasks = [...tasks];

                                                        let projectInDateIdx = currentTasks.findIndex(t => (t.name || t.text || '').trim() === projectName);

                                                        if (projectInDateIdx === -1) {
                                                            const newProjectTask: Task = {
                                                                ...selectedProject,
                                                                id: Date.now(),
                                                                space_id: String(currentSpace?.id || ''),
                                                                depth: 0
                                                            };
                                                            currentTasks.push(newProjectTask);
                                                            projectInDateIdx = currentTasks.length - 1;
                                                        }

                                                        const projectInDate = currentTasks[projectInDateIdx];
                                                        let lastSubtaskIdx = projectInDateIdx;
                                                        for (let j = projectInDateIdx + 1; j < currentTasks.length; j++) {
                                                            if ((currentTasks[j].depth || 0) > (projectInDate.depth || 0)) {
                                                                lastSubtaskIdx = j;
                                                            } else {
                                                                break;
                                                            }
                                                        }
                                                        const insertIdx = lastSubtaskIdx + 1;

                                                        const n: Task = {
                                                            id: Date.now() + 1,
                                                            name: '',
                                                            status: 'pending',
                                                            indent: 0,
                                                            parent: projectInDate.id,
                                                            space_id: String(currentSpace?.id || ''),
                                                            text: '',
                                                            percent: undefined,
                                                            planTime: 0,
                                                            actTime: 0,
                                                            isTimerOn: false,
                                                            depth: (projectInDate.depth || 0) + 1
                                                        };
                                                        currentTasks.splice(insertIdx, 0, n);
                                                        updateTasks.mutate({ tasks: currentTasks, memo: currentMemo });
                                                        setFocusedTaskId(n.id);
                                                    }}
                                                    className="w-full py-2 text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-2 text-sm font-bold"
                                                >
                                                    <Plus size={14} /> Add Subtask
                                                </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                                        <BarChart2 size={48} className="mb-4 opacity-20" />
                                        <p className="font-bold">Select a project to view details</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
        </div>
        {(activeTask || showBulkActions) && (
          <div className="fixed left-0 right-0 z-[500] flex justify-center px-4 transition-all duration-200 pointer-events-none" style={{ bottom: 'calc(24px + var(--keyboard-offset, 0px))' }}>
              <div 
                  className="bg-[#121216]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 flex items-center justify-start gap-1 max-w-full overflow-x-auto no-scrollbar scroll-smooth shadow-2xl pointer-events-auto floating-bar"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
              >
                  {showBulkActions ? (
                     <>
                        <div className="px-4 font-bold text-white whitespace-nowrap flex items-center gap-2">
                           <div className="bg-[#7c4dff] text-white text-[10px] font-black px-1.5 py-0.5 rounded">{selectedTaskIds.size}</div>
                           <span className="text-sm">Selected</span>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-1" />
                        <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => {
                            const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
                            navigator.clipboard.writeText(selectedTasks.map(t => t.name || t.text || '').join('\n'));
                            alert(`Copied ${selectedTasks.length} tasks`);
                            setSelectedTaskIds(new Set());
                        }} className="p-3 hover:bg-white/10 rounded-2xl text-gray-300 font-bold text-sm px-4 flex items-center gap-2"><Copy size={16} /> Copy</button>
                        <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => setShowDatePicker(true)} className="p-3 hover:bg-white/10 rounded-2xl text-gray-300 font-bold text-sm px-4 flex items-center gap-2"><Calendar size={16} /> Move</button>
                        <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => { if(confirm(`Delete ${selectedTaskIds.size} tasks?`)) { const next = tasks.filter(t => !selectedTaskIds.has(t.id)); updateTasks.mutate({ tasks: next, memo: currentMemo }); setSelectedTaskIds(new Set()); } }} className="p-3 hover:bg-white/10 rounded-2xl text-red-500 font-bold text-sm px-4 flex items-center gap-2"><Trash2 size={16} /> Delete</button>
                        <div className="h-8 w-px bg-white/10 mx-1" />
                        <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => setSelectedTaskIds(new Set())} className="p-3 hover:bg-white/10 rounded-2xl text-gray-400"><X size={20} /></button>
                     </>
                  ) : (
                    activeTask && (
                      <>
                        <div className="flex items-center gap-2 flex-shrink-0 pl-1">
                            <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => {
                                if (activeTask.isTimerOn) {
                                    // Stop Timer: Calculate elapsed and save
                                    const elapsed = activeTask.timerStartTime ? Math.floor((Date.now() - activeTask.timerStartTime) / 1000) : 0;
                                    const newActTime = (activeTask.actTime || 0) + elapsed;
                                    handleUpdateTask(activeTask.id, {
                                        isTimerOn: false,
                                        timerStartTime: undefined,
                                        actTime: newActTime,
                                        act_time: newActTime
                                    });
                                    console.log('Timer Stopped & Saved:', newActTime);
                                } else {
                                    // Start Timer
                                    handleUpdateTask(activeTask.id, {
                                        isTimerOn: true,
                                        timerStartTime: Date.now()
                                    });
                                }
                            }} className={`p-3.5 rounded-2xl transition-all ${activeTask.isTimerOn ? 'bg-[#7c4dff] text-white' : 'bg-white/5 text-gray-400'}`}>{activeTask.isTimerOn ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button>
                            <div className="flex flex-col ml-1"><span className="text-[9px] text-gray-500 font-black uppercase text-center">Execution</span><div className="flex items-center justify-center"><input ref={(el) => timeInputRefs.current[0] = el} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onBlur={(e) => { const h = parseInt(e.target.value) || 0; const m = parseInt((e.target.nextElementSibling?.nextElementSibling as HTMLInputElement)?.value || '0') || 0; const s = parseInt((e.target.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling as HTMLInputElement)?.value || '0') || 0; const secs = h * 3600 + m * 60 + s; handleUpdateTask(activeTask.id, { actTime: secs, act_time: secs }); }} defaultValue={String(Math.floor(((activeTask.actTime || 0) + activeTimerElapsed) / 3600)).padStart(2, '0')} className="bg-transparent text-[18px] font-black font-mono text-[#7c4dff] outline-none w-[2.2ch] text-center" maxLength={2} /><span className="text-[18px] font-black font-mono text-[#7c4dff]">:</span><input ref={(el) => timeInputRefs.current[1] = el} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onBlur={(e) => { const h = parseInt((e.target.previousElementSibling?.previousElementSibling as HTMLInputElement)?.value || '0') || 0; const m = parseInt(e.target.value) || 0; const s = parseInt((e.target.nextElementSibling?.nextElementSibling as HTMLInputElement)?.value || '0') || 0; const secs = h * 3600 + m * 60 + s; handleUpdateTask(activeTask.id, { actTime: secs, act_time: secs }); }} defaultValue={String(Math.floor((((activeTask.actTime || 0) + activeTimerElapsed) % 3600) / 60)).padStart(2, '0')} className="bg-transparent text-[18px] font-black font-mono text-[#7c4dff] outline-none w-[2.2ch] text-center" maxLength={2} /><span className="text-[18px] font-black font-mono text-[#7c4dff]">:</span><input ref={(el) => timeInputRefs.current[2] = el} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onFocus={(e) => e.target.select()} onBlur={(e) => { const h = parseInt((e.target.previousElementSibling?.previousElementSibling?.previousElementSibling?.previousElementSibling as HTMLInputElement)?.value || '0') || 0; const m = parseInt((e.target.previousElementSibling?.previousElementSibling as HTMLInputElement)?.value || '0') || 0; const s = parseInt(e.target.value) || 0; const secs = h * 3600 + m * 60 + s; handleUpdateTask(activeTask.id, { actTime: secs, act_time: secs }); }} defaultValue={String(((activeTask.actTime || 0) + activeTimerElapsed) % 60).padStart(2, '0')} className="bg-transparent text-[18px] font-black font-mono text-[#7c4dff] outline-none w-[2.2ch] text-center" maxLength={2} /></div></div>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] text-gray-500 font-black uppercase">Progress</span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={activeTask.percent !== undefined ? activeTask.percent : ''}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleUpdateTask(activeTask.id, { percent: parseInt(e.target.value) || 0 })}
                                        className="bg-transparent text-[18px] font-black font-mono text-blue-400 outline-none w-[3ch] text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <span className="text-[14px] font-black text-blue-400">%</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => handleOutdent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowLeft size={18} /></button>
                            <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => handleIndent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowRight size={18} /></button>
                            <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => handleMoveUp(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ChevronUp size={18} /></button>
                            <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => handleMoveDown(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ChevronDown size={18} /></button>
                        </div>
                      <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => setShowDatePicker(true)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400" title="Move to Date"><Calendar size={18} /></button>
                          <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => { navigator.clipboard.writeText(activeTask.name || activeTask.text || ''); alert("Copied to clipboard"); }} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400" title="Copy Text"><Copy size={18} /></button>
                          <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => {
                              if (activeTask) {
                                  const name = (activeTask.name || activeTask.text || '').trim();
                                  if (typeof activeTask.percent === 'undefined') {
                                      handleUpdateTask(activeTask.id, { percent: 0 });
                                  }
                                  setSelectedProjectName(name);
                                  setViewMode('project');
                              } else {
                                  setShowMemoCollection(true);
                              }
                          }} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400" title="Memo Collection"><BarChart2 size={18} /></button>
                          <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={() => { if (window.confirm("Delete this task?")) { const next = tasks.filter(t => t.id !== activeTask.id); updateTasks.mutate({ tasks: next, memo: currentMemo }); setFocusedTaskId(null); } }} className="p-2.5 rounded-xl hover:bg-white/5 text-red-500" title="Delete"><Trash2 size={18} /></button>
                      </div>
                        <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                        <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
                            <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={handleUndo} disabled={historyIndex <= 0} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 disabled:opacity-20"><RotateCcw size={18} /></button>
                            <button onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 disabled:opacity-20"><RotateCw size={18} /></button>
                        </div>
                      </>
                    )
                  )}
              </div>
          </div>
        )}
        {showDatePicker && (activeTask || selectedTaskIds.size > 0) && (
          <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowDatePicker(false)}>
            <div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button>
                <span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {['S','M','T','W','T','F','S'].map((d, idx) => <div key={`day-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}
                {Array.from({ length: 35 }).map((_, i) => {
                   const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
                   d.setDate(d.getDate() + (i - d.getDay()));
                   const now = new Date();
                   const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();
                   return (
                    <button key={i} onClick={() => { handleMoveSelectedToDate(d.toDateString()); setShowDatePicker(false); }} className={`aspect-square rounded-lg border flex items-center justify-center ${d.toDateString() === todayStr ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}`}><span className="text-sm">{d.getDate()}</span></button>
                   );
                })}
              </div>
            </div>
          </div>
        )}
        {showHistoryTarget && <TaskHistoryModal taskName={showHistoryTarget} logs={logs} onClose={() => setShowHistoryTarget(null)} />}
        {showDatePicker && (
          <DatePickerModal 
            currentDate={viewDate} 
            onDateSelect={(date) => {
              if (selectedTaskIds.size > 0) {
                handleMoveSelectedToDate(date.toDateString());
              } else {
                setViewDate(date);
              }
            }} 
            onClose={() => setShowDatePicker(false)} 
          />
        )}
        {showMemoCollection && <MemoCollectionModal logs={logs} onClose={() => setShowMemoCollection(false)} />}
        {showShortcuts && (
          <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
            <div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6"><h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2><button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-white"><X /></button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">General</h3>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Add Task</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Enter</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Toggle Status</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Enter</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Undo / Redo</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Z / Y</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Help</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">?</kbd></div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Navigation</h3>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Switch Space</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Alt + 1-9</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Indent</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Tab</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Outdent</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Shift + Tab</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Move Up/Down</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Alt + ↑ / ↓</kbd></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
