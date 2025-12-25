import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSpace } from './contexts/SpaceContext';
import { AuthModal } from './components/AuthModal';
import { SpaceSelector } from './components/SpaceSelector';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, BarChart2, X, Check, ChevronLeft, ChevronRight, Plus, List, Clock, ArrowRight, ArrowLeft, Calendar, HelpCircle } from 'lucide-react';
import { supabase } from './supabase';

// --- 데이터 타입 ---

type Task = {
  id: number;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'icebox';
  indent: number;
  parent: number | null;
  note?: string;
  due?: string;
  total_time?: number;
  space_id: string;
  created_at?: string;
  updated_at?: string;
  start_time?: number;
  end_time?: number;
  is_active?: boolean;
  text?: string;
  done?: boolean; 
  percent?: number;      
  planTime?: number; 
  actTime?: number; 
  isTimerOn?: boolean;
  timerStartTime?: number;
  parentId?: number;
  subtasks?: Task[];
  depth?: number;
  isSecond?: boolean;
};

type DailyLog = {
  date: string;
  tasks: Task[];
  memo?: string;
};

// --- 유틸리티: 시간 포맷 ---
const formatTimeFull = (seconds: number) => {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTimeShort = (seconds: number) => {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

const parseTimeToSeconds = (timeStr: string) => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

// --- [컴포넌트] 자동 높이 조절 Textarea ---
const AutoResizeTextarea = React.memo(({ value, onChange, onKeyDown, onFocus, onBlur, placeholder, autoFocus, className, inputRef }: any) => {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const combinedRef = inputRef || localRef;

  // 높이 조절
  useLayoutEffect(() => {
    if (combinedRef.current) {
      combinedRef.current.style.height = 'auto';
      combinedRef.current.style.height = combinedRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // 포커스 관리 (초기 마운트 시에만)
  // 화면을 그리기 전에(paint 이전에) 포커스를 고정하여 키보드 내려감을 방지
  useLayoutEffect(() => {
    if (autoFocus && combinedRef.current) {
        combinedRef.current.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={combinedRef}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`resize-none overflow-hidden bg-transparent outline-none ${className}`}
      style={{ minHeight: '18px' }}
    />
  );
});

// --- [컴포넌트] 태스크 히스토리 모달 ---
const TaskHistoryModal = React.memo(({ taskName, logs, onClose }: { taskName: string, logs: DailyLog[], onClose: () => void }) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date());
  const historyMap = useMemo(() => {
    const map = new Map();
    logs.forEach(log => {
      const found = log.tasks.find(t => {
        const tName = t.name || t.text || '';
        return tName.trim() === taskName.trim();
      });
      if (found) map.set(log.date, { task: found });
    });
    return map;
  }, [logs, taskName]);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: firstDay }).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)));
  return (
    <div className="fixed inset-0 z-[700] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div><h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase mb-1">TASK HISTORY</h2><h1 className="text-xl font-black text-white">"{taskName}"</h1></div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X /></button>
        </div>
        <div className="flex justify-between items-center mb-4 px-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button>
          <span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['S','M','T','W','T','F','S'].map((d, idx) => <div key={`weekday-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}
          {days.map((d: any, i) => {
            if (!d) return <div key={i} />;
            const dateStr = d.toDateString();
            const record = historyMap.get(dateStr);
            return <div key={i} className={`aspect-square rounded-lg border flex items-center justify-center relative ${record ? 'bg-blue-900/20 border-blue-500/50' : 'bg-red-900/20 border-red-500/50'} ${dateStr === today.toDateString() ? 'ring-1 ring-white' : ''}`}><span className="text-xs font-medium">{d.getDate()}</span></div>;
          })}
        </div>
      </div>
    </div>
  );
});

// --- [컴포넌트] 통합 할 일 아이템 ---
// 중요: React.memo를 사용하여 props가 변경되지 않으면 리렌더링되지 않도록 함
// updateTask 등의 핸들러는 useCallback으로 감싸진 안정적인 함수여야 함
const UnifiedTaskItem = React.memo(({ 
  task, 
  index,
  updateTask, 
  setFocusedTaskId, 
  focusedTaskId,
  selectedTaskIds,
  onTaskClick,
  logs, 
  onAddTaskAtCursor,
  onMergeWithPrevious,
  onMergeWithNext,
  onIndent, 
  onOutdent
}: { 
  task: Task, 
  index: number,
  updateTask: (taskId: number, updates: Partial<Task>) => void, 
  setFocusedTaskId: (id: number | null) => void, 
  focusedTaskId: number | null, 
  selectedTaskIds: Set<number>,
  onTaskClick: (e: React.MouseEvent, taskId: number, index: number) => void,
  logs: DailyLog[], 
  onAddTaskAtCursor: (taskId: number, textBefore: string, textAfter: string) => void,
  onMergeWithPrevious: (taskId: number, currentText: string) => void,
  onMergeWithNext: (taskId: number, currentText: string) => void,
  onIndent: (taskId: number) => void, 
  onOutdent: (taskId: number) => void
}) => {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const isFocused = focusedTaskId === task.id;
  const isSelected = selectedTaskIds.has(task.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // 검색 제안 로직
  useEffect(() => {
    const taskName = task.name || task.text || '';
    if (!isFocused || !taskName.startsWith('/')) { setSuggestions([]); return; }
    const query = taskName.slice(1).toLowerCase();
    const matches: Task[] = [];
    const seen = new Set();
    [...logs].reverse().forEach(log => log.tasks.forEach(t => { 
      const tName = t.name || t.text || '';
      if (tName.toLowerCase().includes(query) && !seen.has(tName)) { 
        matches.push(t); 
        seen.add(tName); 
      } 
    }));
    setSuggestions(matches.slice(0, 5));
    setSelectedSuggestionIndex(-1);
  }, [task.name, task.text, isFocused, logs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const taskName = task.name || task.text || '';
    
    // 제안 목록 네비게이션
    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1); return; }
        if (e.key === 'Enter') {
            if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                e.preventDefault();
                const selectedName = suggestions[selectedSuggestionIndex].name || suggestions[selectedSuggestionIndex].text || '';
                updateTask(task.id, { name: selectedName, text: selectedName });
                setSuggestions([]);
                return;
            }
        }
    }

    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        const cursorPos = textareaRef.current?.selectionStart || 0;
        onAddTaskAtCursor(task.id, taskName.substring(0, cursorPos), taskName.substring(cursorPos));
      }
      return;
    }
    
    if (e.key === 'Backspace' && textareaRef.current?.selectionStart === 0 && textareaRef.current?.selectionEnd === 0) {
      e.preventDefault();
      onMergeWithPrevious(task.id, taskName);
      return;
    }
    
    if (e.key === 'Delete' && textareaRef.current?.selectionStart === taskName.length && textareaRef.current?.selectionEnd === taskName.length) {
      e.preventDefault();
      onMergeWithNext(task.id, taskName);
      return;
    }
    
    if (e.key === 'Tab') { 
      e.preventDefault(); 
      if (e.shiftKey) onOutdent(task.id); else onIndent(task.id); 
      return; 
    }
    
    // 커서 이동 대신 포커스 이동 (리스트 네비게이션)
    // 주의: 텍스트 에리어 내에서 상하 이동은 커서 이동이 우선이어야 할 수 있음.
    // 여기서는 alt 키 조합이나 텍스트 처음/끝일 때만 이동하는 로직이 더 자연스러울 수 있으나,
    // 기존 로직(ArrowUp/Down으로 태스크 이동)을 유지.
    if (e.key === 'ArrowUp' && !e.altKey) { 
        // 상위 컴포넌트에서 인덱스 처리가 필요하므로 여기서는 이벤트 버블링을 허용하거나 별도 처리가 필요.
        // 하지만 UnifiedTaskItem은 index를 알고 있음.
        // 단, allTasks에 접근 권한이 제한적이므로 부모에게 위임하는 것이 좋으나
        // 여기서는 간단히 구현하지 않고 패스 (기존 로직이 index 의존적이었음).
        // *수정*: 부모에서 키보드 센서를 사용하므로 dnd-kit의 네비게이션을 따를 수도 있음.
        // 여기서는 커스텀 네비게이션을 위해 이벤트를 전파하지 않거나, 별도 핸들러 필요.
        // -> 기존 코드의 index 기반 로직은 allTasks 의존성을 가지므로 제거하고,
        // 필요하다면 부모 레벨에서 KeyboardSensor로 처리하는 것이 옳음.
    }
    
    if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) { 
        e.preventDefault(); 
        updateTask(task.id, { isTimerOn: !task.isTimerOn, timerStartTime: !task.isTimerOn ? Date.now() : undefined }); 
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { 
        e.preventDefault(); 
        const newStatus = task.status === 'completed' ? 'pending' : 'completed'; 
        updateTask(task.id, { status: newStatus, isTimerOn: false }); 
    }
  };

  const swipeTouchStart = useRef<number | null>(null);
  const handleItemTouchStart = (e: React.TouchEvent) => { if (document.activeElement?.tagName === 'TEXTAREA') return; swipeTouchStart.current = e.touches[0].clientX; };
  const handleItemTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStart.current === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchEnd - swipeTouchStart.current;
    if (Math.abs(diff) > 60) { if (diff > 0) onIndent(task.id); else onOutdent(task.id); }
    swipeTouchStart.current = null;
  };

  const getStatusColor = () => {
    if (task.isTimerOn) return 'bg-[#7c4dff] border-[#7c4dff] shadow-[0_0_8px_rgba(124,77,255,0.6)]';
    if (task.status === 'completed') return 'bg-[#4caf50] border-[#4caf50]';
    return 'bg-transparent border-gray-600 hover:border-gray-400';
  };

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    if (newVal === undefined) return;
    if (newVal.includes('\n')) {
      const lines = newVal.split('\n');
      onAddTaskAtCursor(task.id, lines[0], lines.slice(1).join('\n'));
    } else {
      updateTask(task.id, { name: newVal, text: newVal });
    }
  }, [task.id, onAddTaskAtCursor, updateTask]);

  return (
    <div ref={setNodeRef} style={style} onClick={(e) => onTaskClick(e, task.id, index)} className={`relative group flex items-start gap-2 py-0 px-4 transition-colors ${isFocused ? 'bg-white/[0.04]' : ''} ${isSelected ? 'bg-[#7c4dff]/10 border-l-2 border-[#7c4dff]' : ''}`} onTouchStart={handleItemTouchStart} onTouchEnd={handleItemTouchEnd}>
      <div className="flex flex-shrink-0" style={{ width: `${currentDepth * 24}px` }}>
        {Array.from({ length: currentDepth }).map((_, i) => (
          <div key={i} className="h-full border-r border-white/10" style={{ width: '24px' }} />
        ))}
      </div>
      <div className="flex flex-col items-center justify-start mt-[7px]">
        <button onClick={() => { const newStatus = task.status === 'completed' ? 'pending' : 'completed'; updateTask(task.id, { status: newStatus, isTimerOn: false }); }} className={`flex-shrink-0 w-[15px] h-[15px] border-[1.2px] rounded-[3px] flex items-center justify-center transition-all ${getStatusColor()}`}>
          {task.status === 'completed' && <Check size={11} className="text-white stroke-[3]" />}
          {task.isTimerOn && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
        </button>
      </div>
      <div className="flex-1 relative">
        <AutoResizeTextarea 
            inputRef={textareaRef} 
            value={task.name || task.text || ''} 
            autoFocus={isFocused} 
            onFocus={() => setFocusedTaskId(task.id)} 
            onChange={handleTextChange} 
            onKeyDown={handleKeyDown} 
            className={`w-full text-[15px] font-medium leading-[1.2] py-1 ${task.status === 'completed' ? 'text-gray-500 line-through decoration-[1.5px]' : 'text-[#e0e0e0]'}`} 
            placeholder="" 
        />
        {isFocused && (task.name || task.text || '') === '' && <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] font-black text-gray-700 tracking-widest uppercase opacity-40">/ history</div>}
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-[110] mt-0 bg-[#1a1a1f] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[180px]">
            {suggestions.map((s, idx) => <button key={idx} onClick={() => { updateTask(task.id, { name: s.name || s.text || '', text: s.name || s.text || '' }); setSuggestions([]); }} className={`w-full px-3 py-1.5 text-left text-sm ${selectedSuggestionIndex === idx ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{s.name || s.text || ''}</button>)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity mt-[4px]">
        {task.actTime && task.actTime > 0 && <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap">{formatTimeShort(task.actTime)}</span>}
      </div>
    </div>
  );
});

// --- 유틸리티: 데이터 마이그레이션 ---
const migrateTasks = (tasks: any[]): Task[] => {
  if (!Array.isArray(tasks)) {
    console.warn('migrateTasks: tasks is not an array', tasks);
    return [];
  }
  const seenIds = new Set();
  return tasks.map(t => {
      // 필수 필드 체크 및 기본값 보장
      if (!t || typeof t !== 'object') return null;
      
      let id = t.id;
      if (!id) {
          id = Date.now() + Math.random();
          console.log('[DEBUG] migrateTasks: Generated new ID for task', t.name, id);
      }
      
      // ID 중복 방지 (데이터 오염 시 복구)
      if (seenIds.has(id)) {
          const newId = Date.now() + Math.random();
          console.warn('[DEBUG] migrateTasks: Found duplicate ID', id, 'replacing with', newId, 'for task', t.name);
          id = newId;
      }
      seenIds.add(id);

      return {
        ...t,
        id: id,
        name: t.name || t.text || '', // 이름 유실 방지
        status: t.status || (t.done ? 'completed' : 'pending'),
        depth: typeof t.depth === 'number' ? t.depth : 0,
        isSecond: t.isSecond === true, // 명시적 불리언 변환
        actTime: Number(t.actTime) || 0,
        planTime: Number(t.planTime) || 0,
        percent: Number(t.percent) || 0,
        space_id: t.space_id || '' // space_id 보장
      };
  }).filter(Boolean) as Task[]; // null 제거
};

// --- 메인 앱 ---
export default function App() {
  const { user, signOut } = useAuth();
  const { currentSpace, spaces, setCurrentSpace } = useSpace();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [localLogsLoaded, setLocalLogsLoaded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Debug: Monitor tasks for duplicates
  useEffect(() => {
      const ids = tasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
          console.error('[CRITICAL] Duplicate IDs detected in tasks state!', ids);
          // 긴급 복구: 중복 제거
          const seen = new Set();
          const deduped: Task[] = [];
          tasks.forEach(t => {
              if (!seen.has(t.id)) {
                  seen.add(t.id);
                  deduped.push(t);
              } else {
                  console.warn('[CRITICAL] Removing duplicate task:', t);
                  // 혹은 ID를 재생성해서 유지할 수도 있음
              }
          });
          // 무한 루프 방지를 위해 바로 set하지 않고, 다음 렌더링 사이클에 영향주거나
          // 여기서 강제로 고치면 또 useEffect 트리거 되므로 주의.
          // 일단 로그만 찍고, 심각하면 고치는 로직 추가.
      }
      console.log(`[DEBUG] tasks updated. Count: ${tasks.length}, ViewDate: ${viewDate.toDateString()}`);
  }, [tasks, viewDate]);

  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);

  const [showHistoryTarget, setShowHistoryTarget] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);
  const [isSecondVisible, setIsSecondVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const logsRef = useRef(logs);

  useEffect(() => { logsRef.current = logs; }, [logs]);
  
  // History 관리
  const [history, setHistory] = useState<Task[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUpdate = useRef(false);
  const lastLocalChange = useRef(Date.now()); 
  const swipeTouchStart = useRef<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // --- Explicit Save Function ---
  const saveToSupabase = useCallback(async (tasksToSave: Task[]) => {
    if (!user || !currentSpace) return;
    const dateStr = viewDate.toDateString();
    const currentMemo = logsRef.current.find(l => l.date === dateStr)?.memo || '';
    
    try {
      await supabase.from('task_logs').upsert({ 
          user_id: user.id, 
          space_id: currentSpace.id, 
          date: dateStr, 
          tasks: JSON.stringify(tasksToSave), 
          memo: currentMemo
      }, { onConflict: 'user_id,space_id,date' });
    } catch (error) {
      console.error("Failed to save to Supabase:", error);
    }
  }, [user, currentSpace, viewDate]);

  // --- 핵심: 안정적인 데이터 저장 로직 ---
  // tasks 상태가 변경되면 이 useEffect가 감지하여 로그를 업데이트하고 로컬 스토리지에만 저장한다.
  // 서버 저장은 명시적인 핸들러에서 수행한다.
  useEffect(() => {
    if (!localLogsLoaded || !currentSpace) return;
    
    const dateStr = viewDate.toDateString();
    
    // 로그 상태 동기화 및 로컬 저장
    setLogs(prevLogs => {
        const existingLogIndex = prevLogs.findIndex(l => l.date === dateStr);
        const currentTasks = tasks;
        
        if (existingLogIndex >= 0 && prevLogs[existingLogIndex].tasks === currentTasks) {
            return prevLogs;
        }

        const newLogs = [...prevLogs];
        if (existingLogIndex >= 0) {
            newLogs[existingLogIndex] = { ...newLogs[existingLogIndex], tasks: currentTasks };
        } else {
            newLogs.push({ date: dateStr, tasks: currentTasks, memo: '' });
        }

        // 로컬 스토리지 저장 (동기)
        localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(newLogs));
        return newLogs;
    });

    // 히스토리 추가 (Undo/Redo를 위한)
    if (!isInternalUpdate.current) {
        setHistory(prev => {
            const newHistory = [...prev.slice(0, historyIndex + 1), tasks];
            // 히스토리 너무 길어지면 자르기
            if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }

    lastLocalChange.current = Date.now();

  }, [tasks, viewDate, currentSpace, localLogsLoaded]); // user 의존성 제거, saveToSupabase 호출 제거

  // --- 안정적인 핸들러 정의 (App 리렌더링 시에도 재생성되지 않도록 useCallback + 함수형 업데이트 사용) ---

  const handleUpdateTask = useCallback((taskId: number, updates: Partial<Task>) => {
    setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, ...updates } : t);
        // 서버 저장 (디바운싱 없이 즉시 저장하거나, 필요시 디바운스 적용 가능)
        // 여기서는 중요 업데이트(완료 등)가 많으므로 즉시 저장을 시도하되, 
        // 잦은 입력(텍스트)에 대해서는 상위에서 처리하거나 디바운스가 필요할 수 있음.
        // 현재 구조상 모든 업데이트에 대해 저장을 수행.
        saveToSupabase(next);
        return next;
    });
  }, [saveToSupabase]);

  const handleAddTaskAtCursor = useCallback((taskId: number, textBefore: string, textAfter: string) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      const current = prev[idx];
      const newTasksToAdd: Task[] = textAfter.split('\n').map((line, i) => ({
        id: Date.now() + i, name: line.trim(), status: 'pending', indent: current.indent, parent: current.parent, text: line.trim(),
        percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: current.depth || 0, isSecond: current.isSecond, space_id: String(currentSpace?.id || ''),
      }));
      const next = [...prev];
      next[idx] = { ...current, name: textBefore, text: textBefore };
      next.splice(idx + 1, 0, ...newTasksToAdd);
      
      if (newTasksToAdd.length > 0) {
        requestAnimationFrame(() => setFocusedTaskId(newTasksToAdd[0].id));
      }
      saveToSupabase(next);
      return next;
    });
  }, [currentSpace, saveToSupabase]);

  const handleMergeWithPrevious = useCallback((taskId: number, currentText: string) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      const current = prev[idx];
      const sameSectionTasks = prev.filter(t => t.isSecond === current.isSecond);
      const inSectionIdx = sameSectionTasks.findIndex(t => t.id === taskId);
      
      if (inSectionIdx > 0) {
        const prevTask = sameSectionTasks[inSectionIdx - 1];
        const overallPrevIdx = prev.findIndex(t => t.id === prevTask.id);
        const next = [...prev];
        const newPos = (prevTask.name || '').length;
        
        next[overallPrevIdx] = { 
            ...prevTask, 
            name: (prevTask.name || '') + (currentText || ''), 
            text: (prevTask.text || '') + (currentText || '') 
        };
        next.splice(idx, 1);
        
        setFocusedTaskId(prevTask.id);
        
        requestAnimationFrame(() => {
            const el = document.activeElement as HTMLTextAreaElement;
            if (el && el.tagName === 'TEXTAREA') {
                el.setSelectionRange(newPos, newPos);
            }
        });
        
        saveToSupabase(next);
        return next;
      } else {
        setFocusedTaskId(null);
        const next = prev.filter(t => t.id !== taskId);
        saveToSupabase(next);
        return next;
      }
    });
  }, [saveToSupabase]);

  const handleMergeWithNext = useCallback((taskId: number) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      const current = prev[idx];
      const sameSectionTasks = prev.filter(t => t.isSecond === current.isSecond);
      const inSectionIdx = sameSectionTasks.findIndex(t => t.id === taskId);
      
      if (inSectionIdx < sameSectionTasks.length - 1) {
        const nextTask = sameSectionTasks[inSectionIdx + 1];
        const overallNextIdx = prev.findIndex(t => t.id === nextTask.id);
        const next = [...prev];
        next[idx] = { ...current, name: (current.name || '') + (nextTask.name || ''), text: (current.text || '') + (nextTask.text || '') };
        next.splice(overallNextIdx, 1);
        saveToSupabase(next);
        return next;
      }
      return prev;
    });
  }, [saveToSupabase]);

  const handleIndent = useCallback((taskId: number) => {
    setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, depth: (t.depth || 0) + 1 } : t);
        saveToSupabase(next);
        return next;
    });
  }, [saveToSupabase]);

  const handleOutdent = useCallback((taskId: number) => {
    setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, depth: Math.max(0, (t.depth || 0) - 1) } : t);
        saveToSupabase(next);
        return next;
    });
  }, [saveToSupabase]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isInternalUpdate.current = true;
      const prevTasks = history[historyIndex - 1];
      setTasks(prevTasks);
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => isInternalUpdate.current = false, 100);
      saveToSupabase(prevTasks);
    }
  }, [history, historyIndex, saveToSupabase]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isInternalUpdate.current = true;
      const nextTasks = history[historyIndex + 1];
      setTasks(nextTasks);
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => isInternalUpdate.current = false, 100);
      saveToSupabase(nextTasks);
    }
  }, [history, historyIndex, saveToSupabase]);

  // --- 초기 로딩 및 데이터 동기화 ---

  useEffect(() => {
    if (currentSpace && user) {
      const fetchVisibility = async () => {
        const { data } = await supabase.from('task_logs').select('memo').eq('user_id', user.id).eq('space_id', currentSpace.id).eq('date', 'SETTINGS');
        if (data && data.length > 0) { try { const settings = JSON.parse(data[0].memo); if (settings && typeof settings.isSecondVisible === 'boolean') setIsSecondVisible(settings.isSecondVisible); } catch(e) {} }
      };
      fetchVisibility();
    }
  }, [currentSpace, user]);

  useEffect(() => {
    if (currentSpace) {
      console.log('[DEBUG] Initial local load started');
      setIsLoading(true);
      setLocalLogsLoaded(false);
      const saved = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
      let currentLogs: DailyLog[] = [];
      if (saved) { 
          try { 
              currentLogs = JSON.parse(saved).map((log: any) => ({ ...log, tasks: migrateTasks(log.tasks) })); 
              console.log(`[DEBUG] Loaded ${currentLogs.length} logs from localStorage`);
          } catch (e) {
              console.error('[DEBUG] Failed to parse localStorage', e);
          } 
      }
      const dateStr = viewDate.toDateString();
      let log = currentLogs.find(l => l.date === dateStr);
      if (!log) {
        console.log(`[DEBUG] No log found for ${dateStr}, creating new or carrying over`);
        // 날짜 변경 시 태스크 이월 등의 로직
        const isNotFuture = new Date(viewDate.toDateString()).getTime() <= new Date(new Date().toDateString()).getTime();
        let carryOverTasks: Task[] = [];
        if (isNotFuture) {
          const sortedLogs = [...currentLogs].filter(l => l.tasks.some(t => t.isSecond)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastLogWithSeconds = sortedLogs[0];
          carryOverTasks = lastLogWithSeconds ? lastLogWithSeconds.tasks.filter(t => t.isSecond).map(t => ({ ...t, id: Date.now() + Math.random(), status: 'pending' as const, actTime: 0, isTimerOn: false })) : [];
          console.log(`[DEBUG] Carried over ${carryOverTasks.length} second tasks`);
        }
        log = { date: dateStr, tasks: carryOverTasks, memo: '' };
        currentLogs.push(log);
        localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(currentLogs));
      }
      setLogs(currentLogs);
      if (log) { 
          console.log(`[DEBUG] Setting initial tasks from log: ${log.tasks.length} tasks`);
          isInternalUpdate.current = true; // 초기 로딩 시 히스토리 중복 방지
          setTasks(log.tasks); 
          setHistory([log.tasks]); 
          setHistoryIndex(0); 
          setTimeout(() => isInternalUpdate.current = false, 100);
      }
      const savedVisible = localStorage.getItem(`ultra_tasks_is_second_visible_${currentSpace.id}`);
      setIsSecondVisible(savedVisible !== null ? JSON.parse(savedVisible) : true);
      setLocalLogsLoaded(true);
      
      // 로컬 로딩 완료 후 잠시 대기 후 로딩 해제 (깜빡임 방지)
      setTimeout(() => setIsLoading(false), 50);
    }
  }, [currentSpace, viewDate]); // user 의존성 제거 (로컬 우선)

  // Supabase 실시간 동기화 및 데이터 복구
  useEffect(() => {
    if (!user || !currentSpace) return;
    
    // 데이터 복구 및 초기 로드 로직
    const loadFromSupabase = async () => {
      console.log(`[DEBUG] loadFromSupabase started for date: ${viewDate.toDateString()}`);
      // 이미 로컬에서 로딩 중이거나 막 로딩된 상태라면 로딩 표시를 유지할 수도 있음
      // 여기서는 백그라운드 동기화 개념이므로 isLoading을 true로 강제하지 않고 조용히 업데이트
      try {
        const { data, error } = await supabase
          .from('task_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('space_id', currentSpace.id);

        if (error) {
          console.error('[DEBUG] Error loading from Supabase:', error);
          return;
        }

        console.log(`[DEBUG] loadFromSupabase: fetched ${data?.length} logs`);

        if (data && data.length > 0) {
          const serverLogs = data.map((row: any) => ({
            date: row.date,
            tasks: migrateTasks(typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks),
            memo: row.memo
          }));

          setLogs(prevLogs => {
            const logMap = new Map(prevLogs.map(l => [l.date, l]));
            let hasChanges = false;

            serverLogs.forEach(serverLog => {
              if (serverLog.date === 'SETTINGS') return;

              const localLog = logMap.get(serverLog.date);
              
              // 1. 로컬에 없는 데이터면 추가
              if (!localLog) {
                console.log(`[DEBUG] Adding new log from server for date: ${serverLog.date}`);
                logMap.set(serverLog.date, serverLog);
                hasChanges = true;
              } 
              // 2. 로컬 데이터가 비어있는데 서버 데이터는 있다면 복구 (유실 방지)
              else if (localLog.tasks.length === 0 && serverLog.tasks.length > 0) {
                console.log(`[DEBUG] Restoring empty local log from server for date: ${serverLog.date}`);
                logMap.set(serverLog.date, serverLog);
                hasChanges = true;
              }
              // 3. (옵션) 병합 로직 - 지금은 단순 덮어쓰기/복구만 수행하고 있음. 
              // 필요하다면 여기서 ID 기반 병합을 수행해야 함.
            });

            if (!hasChanges) {
                console.log('[DEBUG] No changes from server logs');
                return prevLogs;
            }

            const mergedLogs = Array.from(logMap.values());
            
            // 로컬 스토리지도 최신화
            localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(mergedLogs));
            
            // 현재 보고 있는 날짜의 데이터가 복구되었다면 화면에도 반영
            const currentViewLog = mergedLogs.find(l => l.date === viewDate.toDateString());
            if (currentViewLog) {
               // 현재 tasks가 비어있고 복구된 데이터가 있다면 적용
               setTasks(currentTasks => {
                   // ID 중복 방지 및 병합 로직 강화
                   if (currentTasks.length === 0 && currentViewLog.tasks.length > 0) {
                       console.log('[DEBUG] Updating current tasks from server log (local was empty)');
                       isInternalUpdate.current = true;
                       setTimeout(() => isInternalUpdate.current = false, 100);
                       return currentViewLog.tasks;
                   }
                   
                   // 만약 이미 데이터가 있는데 서버 데이터와 다르다면? 
                   // 지금은 사용자 경험을 해치지 않기 위해(입력 중 날라가는 것 방지)
                   // 로컬에 데이터가 있으면 서버 데이터로 덮어쓰지 않음.
                   // 다만, "동기화" 관점에서는 서버 데이터가 우선순위일 수도 있음.
                   // 여기서는 "데이터 유실 방지"에 초점을 맞춤.
                   return currentTasks;
               });
            }

            return mergedLogs;
          });
        }
      } catch (e) {
        console.error("[DEBUG] Supabase load failed:", e);
      }
    };

    loadFromSupabase();
    
    // ... (realtime subscription logic remains similar)
    const channel = supabase.channel(`realtime_tasks_${currentSpace.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_logs', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (Date.now() - lastLocalChange.current < 2000) {
            console.log('[DEBUG] Realtime update ignored (local change recently)');
            return; // 내가 방금 수정했으면 무시
        }

        console.log('[DEBUG] Realtime update received:', payload);

        if (payload.new && payload.new.space_id === currentSpace.id) {
          const serverLog = { date: payload.new.date, tasks: migrateTasks(JSON.parse(payload.new.tasks)), memo: payload.new.memo };
          if (serverLog.date === 'SETTINGS') return;
          
          // 현재 보고 있는 날짜면 tasks 상태 업데이트
          if (serverLog.date === viewDate.toDateString()) {
              console.log('[DEBUG] Realtime update matches current view date');
              isInternalUpdate.current = true;
              
              setTasks(prev => {
                  // 중복 ID 방지: 서버에서 온 데이터의 ID들이 기존과 겹치는지 확인하고,
                  // 완전히 새로운 세트라면 교체.
                  // 단순 교체 시 기존 로컬 변경사항이 날아갈 수 있으므로 주의.
                  // 여기서는 서버 데이터가 "최신 진실"이라고 가정하고 교체하되 로그 남김.
                  console.log(`[DEBUG] Replacing tasks with server data. Prev count: ${prev.length}, New count: ${serverLog.tasks.length}`);
                  return serverLog.tasks;
              });
              
              setTimeout(() => isInternalUpdate.current = false, 100);
          }
          
          setLogs(prev => {
             const idx = prev.findIndex(l => l.date === serverLog.date);
             if (idx >= 0) {
                 const newLogs = [...prev];
                 newLogs[idx] = serverLog;
                 localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(newLogs));
                 return newLogs;
             }
             const newLogs = [...prev, serverLog];
             localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(newLogs));
             return newLogs;
          });
        }
      }).subscribe();
      
    return () => { 
        console.log('[DEBUG] Unsubscribing channel');
        supabase.removeChannel(channel); 
    };
  }, [user, currentSpace, viewDate]);

  // 타이머 틱
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        const now = Date.now();
        let changed = false;
        const next = prev.map(t => { 
            if (t.isTimerOn && t.timerStartTime) { 
                const elapsed = (now - t.timerStartTime) / 1000; 
                changed = true; 
                return { ...t, actTime: (t.actTime || 0) + elapsed, timerStartTime: now }; 
            } 
            return t; 
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 의존성 없음 (tasks는 함수형 업데이트로 처리)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setTasks(prev => {
          const oldIndex = prev.findIndex((t) => t.id === active.id);
          const newIndex = prev.findIndex((t) => t.id === over.id);
          const next = arrayMove(prev, oldIndex, newIndex);
          saveToSupabase(next);
          return next;
      });
    }
  };

  const onTaskClick = useCallback((e: React.MouseEvent, taskId: number, index: number) => {
    if (e.shiftKey && lastClickedIndex.current !== null) {
      // Shift Click 로직 (단순화: 현재 보이는 리스트 기준)
      // 정확한 구현을 위해 tasks 상태 참조 필요하나, 여기서는 selectedTaskIds 갱신만 수행
      // 전체 tasks 접근을 위해 함수형 업데이트 사용 불가 (tasks 필요)
      // -> useCallback 의존성에 tasks 추가 불가피, but 클릭은 빈번하지 않으므로 OK
      // 다만 최적화를 위해 여기서는 로직을 단순화하거나 생략
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedTaskIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(taskId)) newSet.delete(taskId); else newSet.add(taskId);
          return newSet;
      });
      lastClickedIndex.current = index;
    } else { 
        setSelectedTaskIds(new Set([taskId])); 
        lastClickedIndex.current = index; 
    }
  }, []);

  const handleSpaceChange = useCallback((space: any) => { setCurrentSpace(space); }, [setCurrentSpace]);

  // 키보드 단축키
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTaskIds.size > 0 && !isInput) {
        e.preventDefault();
        const nextTasks = tasks.filter(t => !selectedTaskIds.has(t.id));
        setTasks(nextTasks);
        saveToSupabase(nextTasks);
        setFocusedTaskId(null);
        setSelectedTaskIds(new Set());
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); handleRedo(); }
      if (e.key === '?' && !isInput) { e.preventDefault(); setShowShortcuts(true); }
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (spaces[index]) setCurrentSpace(spaces[index]);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [tasks, selectedTaskIds, handleUndo, handleRedo, spaces, setCurrentSpace]);

  const activeTask = useMemo(() => tasks.find(t => t.id === focusedTaskId), [tasks, focusedTaskId]);
  const planTasks = useMemo(() => tasks.filter(t => !t.isSecond), [tasks]);
  const secondTasks = useMemo(() => tasks.filter(t => t.isSecond), [tasks]);
  const getStats = (list: Task[]) => { const total = list.length; const done = list.filter(t => t.status === 'completed').length; return { total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 }; };
  const secondStats = useMemo(() => getStats(secondTasks), [secondTasks]);
  const flowStats = useMemo(() => getStats(planTasks), [planTasks]);
  const currentLog = logs.find(l => l.date === viewDate.toDateString());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-x-hidden">
      {tasks.find(t => t.isTimerOn) && (
        <div className="fixed inset-0 z-[200] bg-gray-950 flex flex-col items-center justify-center">
          <div className="z-10 text-center space-y-12">
            <h2 className="text-xl text-gray-400 font-light tracking-widest">FOCUS MODE</h2>
            <h1 className="text-4xl md:text-6xl font-bold text-white">{tasks.find(t => t.isTimerOn)?.name || 'Untitled'}</h1>
            <div className="font-mono text-6xl text-gray-500">{formatTimeFull(tasks.find(t => t.isTimerOn)?.actTime || 0)}</div>
            <button onClick={() => handleUpdateTask(tasks.find(t => t.isTimerOn)!.id, { isTimerOn: false })} className="px-8 py-3 border border-white/20 rounded-full text-white hover:bg-white/10 transition-all uppercase tracking-widest text-xs">Complete</button>
          </div>
        </div>
      )}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <div className="max-w-xl mx-auto min-h-screen flex flex-col p-4">
        <div className="mb-4 flex justify-between items-center">
            <SpaceSelector onSpaceChange={handleSpaceChange} />
            <div className="flex gap-3 items-center">
                {isLoading && <div className="text-xs text-blue-500 animate-pulse font-bold">LOADING...</div>}
                <button onClick={() => setIsSecondVisible(!isSecondVisible)} className="text-gray-500 hover:text-white p-1"><Clock size={18} /></button>
                <button onClick={() => setShowShortcuts(!showShortcuts)} className="text-gray-500 hover:text-white p-1"><HelpCircle size={18} /></button>
                <button onClick={() => user ? signOut() : setShowAuthModal(true)} className="text-xs text-gray-500 hover:text-white">{user ? 'Logout' : 'Login'}</button>
            </div>
        </div>
        
        {/* 달력 영역 */}
        <div className={`calendar-area mb-4 bg-[#0f0f14] p-5 rounded-3xl border border-white/5 shadow-2xl transition-opacity duration-200 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`} onTouchStart={(e) => swipeTouchStart.current = e.touches[0].clientX} onTouchEnd={(e) => { if (swipeTouchStart.current === null) return; const diff = swipeTouchStart.current - e.changedTouches[0].clientX; if (Math.abs(diff) > 100) setViewDate(new Date(year, month + (diff > 0 ? 1 : -1), 1)); swipeTouchStart.current = null; }}>
           <div className="flex justify-between items-center mb-5 px-1"><button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronLeft size={22} /></button><div className="text-center cursor-pointer" onClick={() => setViewDate(new Date())}><div className="text-[11px] text-gray-500 uppercase tracking-widest font-bold">{year}</div><div className="font-black text-xl text-white">{viewDate.toLocaleString('default', { month: 'long' })}</div></div><button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronRight size={22} /></button></div>
           <div className="grid grid-cols-7 gap-1">{['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[10px] text-gray-600 font-black py-1">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { const d = new Date(year, month, 1); d.setDate(d.getDate() + (i - d.getDay())); const l = logs.find(log => log.date === d.toDateString()); return <button key={i} onClick={() => setViewDate(d)} className={`h-11 rounded-xl text-xs flex flex-col items-center justify-center transition-all ${d.toDateString() === viewDate.toDateString() ? 'bg-[#7c4dff] text-white' : d.getMonth() === month ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700'}`}><span className="font-black text-[14px]">{d.getDate()}</span>{l && l.tasks.length > 0 && <div className={`mt-0.5 text-[9px] font-black ${d.toDateString() === viewDate.toDateString() ? 'text-white/80' : 'text-[#7c4dff]'}`}>{Math.round((l.tasks.filter(t => t.status === 'completed').length / l.tasks.length) * 100)}%</div>}</button>; })}</div>
        </div>

        <div className="mb-6 flex justify-around items-center px-4">
          {isSecondVisible && <div className="text-center"><div className="text-[28px] font-black text-white leading-none">{secondStats.done}<span className="text-[16px] text-gray-600 font-light mx-1">/</span>{secondStats.total}</div><div className="text-[14px] text-pink-500 font-black mt-1">{secondStats.rate}%</div></div>}
          <div className="text-center"><div className="text-[28px] font-black text-white leading-none">{flowStats.done}<span className="text-[16px] text-gray-600 font-light mx-1">/</span>{flowStats.total}</div><div className="text-[14px] text-[#7c4dff] font-black mt-1">{flowStats.rate}%</div></div>
        </div>
        
        <div className="px-6 mb-6">
            <AutoResizeTextarea value={currentLog?.memo || ''} onChange={(e: any) => { const newMemo = e.target.value; setLogs(prev => prev.map(l => l.date === viewDate.toDateString() ? { ...l, memo: newMemo } : l)); }} placeholder="M E M O" className="w-full bg-transparent text-[16px] text-[#7c4dff]/80 font-bold text-center outline-none" />
        </div>

        <div className={`flex-1 space-y-8 pb-32 transition-opacity duration-200 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {isSecondVisible && (
            <div>
                <div className="flex items-center justify-between mb-2 px-3">
                    <div className="flex items-center gap-3"><h2 className="text-[11px] font-black tracking-[0.2em] text-pink-500 uppercase flex items-center gap-2"><Clock size={16} /> A SECOND</h2><button onClick={() => { const n: Task = { id: Date.now(), name: '', status: 'pending', indent: 0, parent: null, space_id: String(currentSpace?.id || ''), text: '', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0, isSecond: true }; setTasks(prev => [...prev, n]); setFocusedTaskId(n.id); }} className="text-gray-500 hover:text-pink-500"><Plus size={18} /></button></div>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={secondTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {secondTasks.map((t, i) => (
                            <UnifiedTaskItem 
                                key={t.id} 
                                task={t} 
                                index={i} 
                                updateTask={handleUpdateTask} 
                                setFocusedTaskId={setFocusedTaskId} 
                                focusedTaskId={focusedTaskId} 
                                selectedTaskIds={selectedTaskIds} 
                                onTaskClick={onTaskClick} 
                                logs={logs} 
                                onAddTaskAtCursor={handleAddTaskAtCursor} 
                                onMergeWithPrevious={handleMergeWithPrevious} 
                                onMergeWithNext={handleMergeWithNext} 
                                onIndent={handleIndent} 
                                onOutdent={handleOutdent} 
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
          )}
          <div>
              <div className="flex items-center justify-between mb-2 px-3">
                  <div className="flex items-center gap-3"><h2 className="text-[11px] font-black tracking-[0.2em] text-[#7c4dff] uppercase flex items-center gap-2"><List size={16} /> FLOW</h2><button onClick={() => { const n: Task = { id: Date.now(), name: '', status: 'pending', indent: 0, parent: null, space_id: String(currentSpace?.id || ''), text: '', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0, isSecond: false }; setTasks(prev => [...prev, n]); setFocusedTaskId(n.id); }} className="text-gray-500 hover:text-[#7c4dff]"><Plus size={18} /></button></div>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={planTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {planTasks.map((t, i) => (
                          <UnifiedTaskItem 
                              key={t.id} 
                              task={t} 
                              index={i} 
                              updateTask={handleUpdateTask} 
                              setFocusedTaskId={setFocusedTaskId} 
                              focusedTaskId={focusedTaskId} 
                              selectedTaskIds={selectedTaskIds} 
                              onTaskClick={onTaskClick} 
                              logs={logs} 
                              onAddTaskAtCursor={handleAddTaskAtCursor} 
                              onMergeWithPrevious={handleMergeWithPrevious} 
                              onMergeWithNext={handleMergeWithNext} 
                              onIndent={handleIndent} 
                              onOutdent={handleOutdent} 
                          />
                      ))}
                  </SortableContext>
              </DndContext>
          </div>
        </div>

        {activeTask && (
          <div className="fixed bottom-6 left-0 right-0 z-[500] flex justify-center px-4">
              <div className="bg-[#121216]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 flex items-center justify-start gap-2 max-w-full overflow-x-auto no-scrollbar scroll-smooth">
                  <div className="flex items-center gap-2 flex-shrink-0 pl-1">
                      <button onClick={() => handleUpdateTask(activeTask.id, { isTimerOn: !activeTask.isTimerOn, timerStartTime: !activeTask.isTimerOn ? Date.now() : undefined })} className={`p-3.5 rounded-2xl transition-all ${activeTask.isTimerOn ? 'bg-[#7c4dff] text-white' : 'bg-white/5 text-gray-400'}`}>{activeTask.isTimerOn ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button>
                      <div className="flex flex-col ml-1"><span className="text-[9px] text-gray-500 font-black uppercase text-center">Execution</span><input type="text" value={formatTimeFull(activeTask.actTime || 0)} onChange={(e) => handleUpdateTask(activeTask.id, { actTime: parseTimeToSeconds(e.target.value) })} className="bg-transparent text-[18px] font-black font-mono text-[#7c4dff] outline-none w-24 text-center" /></div>
                  </div>
                  <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                  <div className="flex items-center gap-0.5 flex-shrink-0"><button onClick={() => handleOutdent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowLeft size={18} /></button><button onClick={() => handleIndent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowRight size={18} /></button></div>
                  <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                  <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
                      <button onClick={() => { setTasks(prev => prev.filter(t => t.id !== activeTask.id)); setFocusedTaskId(null); }} className="p-2.5 rounded-xl hover:bg-white/5 text-red-500"><X size={18} /></button>
                      <button onClick={() => setShowDatePicker(true)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><Calendar size={18} /></button>
                      <button onClick={() => setShowHistoryTarget(activeTask.name || '')} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><BarChart2 size={18} /></button>
                      <button onClick={() => setFocusedTaskId(null)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white"><Check size={18} /></button>
                  </div>
              </div>
          </div>
        )}
        
        {/* 모달 및 기타 UI들 */}
        {showDatePicker && activeTask && <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowDatePicker(false)}><div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button><span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button></div><div className="grid grid-cols-7 gap-2">{['S','M','T','W','T','F','S'].map((d, idx) => <div key={`day-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1); d.setDate(d.getDate() + (i - d.getDay())); return <button key={i} onClick={() => { const targetDate = d.toDateString(); if (targetDate !== viewDate.toDateString()) { const taskToMove = activeTask; setTasks(prev => prev.filter(t => t.id !== activeTask.id)); setLogs(prev => { const newLogs = [...prev]; const targetLogIndex = newLogs.findIndex(l => l.date === targetDate); if (targetLogIndex >= 0) { newLogs[targetLogIndex].tasks.push(taskToMove); } else { newLogs.push({ date: targetDate, tasks: [taskToMove], memo: '' }); } return newLogs; }); setFocusedTaskId(null); } setShowDatePicker(false); }} className={`aspect-square rounded-lg border flex items-center justify-center ${d.toDateString() === new Date().toDateString() ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}`}><span className="text-sm">{d.getDate()}</span></button>; })}</div></div></div>}
        {showHistoryTarget && <TaskHistoryModal taskName={showHistoryTarget} logs={logs} onClose={() => setShowHistoryTarget(null)} />}
        {showShortcuts && (
          <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}><div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-start mb-6"><h2 className="text-xl font-bold text-white">Shortcuts</h2><button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-white"><X /></button></div><div className="space-y-3 text-sm"><div className="flex justify-between items-center"><span className="text-gray-400">타이머</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Space</kbd></div><div className="flex justify-between items-center"><span className="text-gray-400">완료</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Enter</kbd></div><div className="flex justify-between items-center"><span className="text-gray-400">Undo/Redo</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl+Z / Y</kbd></div><div className="flex justify-between items-center"><span className="text-gray-400">공간 전환</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Alt + 1~9</kbd></div><div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center"><span className="text-gray-400">Undo/Redo (Direct)</span><div className="flex gap-2"><button onClick={handleUndo} className="p-2 bg-white/5 rounded hover:bg-white/10"><ArrowLeft size={16} /></button><button onClick={handleRedo} className="p-2 bg-white/5 rounded hover:bg-white/10"><ArrowRight size={16} /></button></div></div></div></div></div>
        )}
      </div>
    </div>
  );
}
