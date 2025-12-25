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

  useLayoutEffect(() => {
    if (combinedRef.current) {
      combinedRef.current.style.height = 'auto';
      combinedRef.current.style.height = combinedRef.current.scrollHeight + 'px';
    }
  }, [value]);

  useLayoutEffect(() => {
    if (autoFocus && combinedRef.current) {
      // 포커스를 강제로 잃지 않도록 preventScroll 옵션 사용 가능성 고려
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
const UnifiedTaskItem = React.memo(({ 
  task, 
  index,
  allTasks,
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
  allTasks: Task[],
  updateTask: (task: Task) => void, 
  setFocusedTaskId: (id: number | null) => void, 
  focusedTaskId: number | null, 
  selectedTaskIds: Set<number>,
  onTaskClick: (e: React.MouseEvent, taskId: number, index: number) => void,
  logs: DailyLog[], 
  onAddTaskAtCursor: (taskId: number, textBefore: string, textAfter: string) => void,
  onMergeWithPrevious: (taskId: number, currentText: string) => void,
  onMergeWithNext: (taskId: number, currentText: string) => void,
  onIndent?: () => void, 
  onOutdent?: () => void
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
    if (e.key === 'ArrowDown' && suggestions.length > 0) { e.preventDefault(); setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); return; }
    if (e.key === 'ArrowUp' && suggestions.length > 0) { e.preventDefault(); setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1); return; }
    if (e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        e.preventDefault();
        const selectedName = suggestions[selectedSuggestionIndex].name || suggestions[selectedSuggestionIndex].text || '';
        updateTask({ ...task, name: selectedName });
        setSuggestions([]);
      } else if (!e.shiftKey) {
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
      if (e.shiftKey) onOutdent?.(); else onIndent?.(); 
      return; 
    }
    if (e.key === 'ArrowUp' && !e.altKey) { if (index > 0) { e.preventDefault(); setFocusedTaskId(allTasks[index-1].id); } }
    if (e.key === 'ArrowDown' && !e.altKey) { if (index < allTasks.length - 1) { e.preventDefault(); setFocusedTaskId(allTasks[index+1].id); } }
    if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); updateTask({ ...task, isTimerOn: !task.isTimerOn, timerStartTime: !task.isTimerOn ? Date.now() : undefined }); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); const newStatus = task.status === 'completed' ? 'pending' : 'completed'; updateTask({ ...task, status: newStatus, isTimerOn: false }); }
  };

  const swipeTouchStart = useRef<number | null>(null);
  const handleItemTouchStart = (e: React.TouchEvent) => { if (document.activeElement?.tagName === 'TEXTAREA') return; swipeTouchStart.current = e.touches[0].clientX; };
  const handleItemTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStart.current === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchEnd - swipeTouchStart.current;
    if (Math.abs(diff) > 60) { if (diff > 0) onIndent?.(); else onOutdent?.(); }
    swipeTouchStart.current = null;
  };

  const getStatusColor = () => {
    if (task.isTimerOn) return 'bg-[#7c4dff] border-[#7c4dff] shadow-[0_0_8px_rgba(124,77,255,0.6)]';
    if (task.status === 'completed') return 'bg-[#4caf50] border-[#4caf50]';
    return 'bg-transparent border-gray-600 hover:border-gray-400';
  };

  const handleTextChange = (e: any) => {
    const newVal = e.target.value;
    if (newVal === undefined) return;
    if (newVal.includes('\n')) {
      const lines = newVal.split('\n');
      onAddTaskAtCursor(task.id, lines[0], lines.slice(1).join('\n'));
    } else {
      updateTask({ ...task, name: newVal, text: newVal });
    }
  };

  return (
    <div ref={setNodeRef} style={style} onClick={(e) => onTaskClick(e, task.id, index)} className={`relative group flex items-start gap-2 py-0 px-4 transition-colors ${isFocused ? 'bg-white/[0.04]' : ''} ${isSelected ? 'bg-[#7c4dff]/10 border-l-2 border-[#7c4dff]' : ''}`} onTouchStart={handleItemTouchStart} onTouchEnd={handleItemTouchEnd}>
      <div className="flex flex-shrink-0" style={{ width: `${currentDepth * 24}px` }}>
        {Array.from({ length: currentDepth }).map((_, i) => (
          <div key={i} className="h-full border-r border-white/10" style={{ width: '24px' }} />
        ))}
      </div>
      <div className="flex flex-col items-center justify-start mt-[7px]">
        <button onClick={() => { const newStatus = task.status === 'completed' ? 'pending' : 'completed'; updateTask({ ...task, status: newStatus, isTimerOn: false }); }} className={`flex-shrink-0 w-[15px] h-[15px] border-[1.2px] rounded-[3px] flex items-center justify-center transition-all ${getStatusColor()}`}>
          {task.status === 'completed' && <Check size={11} className="text-white stroke-[3]" />}
          {task.isTimerOn && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
        </button>
      </div>
      <div className="flex-1 relative">
        <AutoResizeTextarea inputRef={textareaRef} value={task.name || task.text || ''} autoFocus={isFocused} onFocus={() => setFocusedTaskId(task.id)} onChange={handleTextChange} onKeyDown={handleKeyDown} className={`w-full text-[15px] font-medium leading-[1.2] py-1 ${task.status === 'completed' ? 'text-gray-500 line-through decoration-[1.5px]' : 'text-[#e0e0e0]'}`} placeholder="" />
        {isFocused && (task.name || task.text || '') === '' && <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] font-black text-gray-700 tracking-widest uppercase opacity-40">/ history</div>}
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-[110] mt-0 bg-[#1a1a1f] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[180px]">
            {suggestions.map((s, idx) => <button key={idx} onClick={() => { updateTask({ ...task, name: s.name || s.text || '' }); setSuggestions([]); }} className={`w-full px-3 py-1.5 text-left text-sm ${selectedSuggestionIndex === idx ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{s.name || s.text || ''}</button>)}
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
  if (!Array.isArray(tasks)) return [];
  return tasks.map(t => ({
    ...t,
    name: t.name || t.text || '',
    status: t.status || (t.done ? 'completed' : 'pending'),
    depth: t.depth || 0,
    isSecond: t.isSecond || false,
    actTime: t.actTime || 0,
    planTime: t.planTime || 0,
    percent: t.percent || 0
  }));
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
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
  const [showHistoryTarget, setShowHistoryTarget] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);
  const [isSecondVisible, setIsSecondVisible] = useState(true);
  const [history, setHistory] = useState<Task[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUpdate = useRef(false);
  const lastLocalChange = useRef(Date.now()); 
  const swipeTouchStart = useRef<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveTasks = useCallback((tasksToSave: Task[], memoToSave?: string) => {
    if (currentSpace) {
      const dateStr = viewDate.toDateString();
      const localData = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
      let currentLogs: DailyLog[] = [];
      if (localData) { try { currentLogs = JSON.parse(localData); } catch (e) {} }
      const logIndex = currentLogs.findIndex(l => l.date === dateStr);
      if (logIndex > -1) {
        currentLogs[logIndex].tasks = tasksToSave;
        if (memoToSave !== undefined) currentLogs[logIndex].memo = memoToSave;
      } else { currentLogs.push({ date: dateStr, tasks: tasksToSave, memo: memoToSave || '' }); }
      localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(currentLogs));
      
      if (user && currentSpace) {
        const performSync = async () => {
          const finalLogsStr = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
          if (!finalLogsStr) return;
          const finalLogs: DailyLog[] = JSON.parse(finalLogsStr);
          const finalLog = finalLogs.find(l => l.date === dateStr);
          if (finalLog) { await supabase.from('task_logs').upsert({ user_id: user.id, space_id: currentSpace.id, date: dateStr, tasks: JSON.stringify(finalLog.tasks), memo: finalLog.memo || '' }, { onConflict: 'user_id,space_id,date' }); }
        };
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(performSync, 300);
      }
    }
  }, [currentSpace, user, viewDate]);

  const updateStateAndLogs = useCallback((newTasks: Task[], updateHistory = true) => {
    lastLocalChange.current = Date.now(); 
    setTasks(newTasks);
    const dateStr = viewDate.toDateString();
    setLogs(prev => {
      const log = prev.find(l => l.date === dateStr);
      const updated = prev.map(l => l.date === dateStr ? { ...l, tasks: newTasks } : l);
      saveTasks(newTasks, log?.memo);
      return updated;
    });
    if (updateHistory && !isInternalUpdate.current) {
      setHistory(prev => [...prev.slice(0, historyIndex + 1), newTasks]);
      setHistoryIndex(prev => prev + 1);
    }
  }, [viewDate, historyIndex, saveTasks]);

  const saveToLocalStorage = useCallback((logsToSave: DailyLog[]) => {
      const today = new Date().toDateString();
      const currentLog = logsToSave.find(l => l.date === today);
      if (currentLog) saveTasks(currentLog.tasks, currentLog.memo);
  }, [saveTasks]);

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
      setLocalLogsLoaded(false);
      const saved = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
      let currentLogs: DailyLog[] = [];
      if (saved) { try { currentLogs = JSON.parse(saved).map((log: any) => ({ ...log, tasks: migrateTasks(log.tasks) })); } catch (e) {} }
      const dateStr = viewDate.toDateString();
      let log = currentLogs.find(l => l.date === dateStr);
      if (!log) {
        const isNotFuture = new Date(viewDate.toDateString()).getTime() <= new Date(new Date().toDateString()).getTime();
        let carryOverTasks: Task[] = [];
        if (isNotFuture) {
          const sortedLogs = [...currentLogs].filter(l => l.tasks.some(t => t.isSecond)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastLogWithSeconds = sortedLogs[0];
          carryOverTasks = lastLogWithSeconds ? lastLogWithSeconds.tasks.filter(t => t.isSecond).map(t => ({ ...t, id: Date.now() + Math.random(), status: 'pending' as const, actTime: 0, isTimerOn: false })) : [];
        }
        log = { date: dateStr, tasks: carryOverTasks, memo: '' };
        currentLogs.push(log);
        localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(currentLogs));
        if (user && carryOverTasks.length > 0) { supabase.from('task_logs').upsert({ user_id: user.id, space_id: currentSpace.id, date: dateStr, tasks: JSON.stringify(carryOverTasks), memo: '' }, { onConflict: 'user_id,space_id,date' }).then(); }
      }
      setLogs(currentLogs);
      if (log) { setTasks(log.tasks); setHistory([log.tasks]); setHistoryIndex(0); }
      const savedVisible = localStorage.getItem(`ultra_tasks_is_second_visible_${currentSpace.id}`);
      setIsSecondVisible(savedVisible !== null ? JSON.parse(savedVisible) : true);
      setLocalLogsLoaded(true);
    }
  }, [currentSpace, viewDate, user]);

  useEffect(() => {
    if (!user || !currentSpace || !localLogsLoaded) return;
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase.from('task_logs').select('*').eq('user_id', user.id).eq('space_id', currentSpace.id);
        if (error) return;
        if (data && data.length > 0) {
          const supabaseLogs: DailyLog[] = data.map(item => ({ date: item.date, tasks: migrateTasks(JSON.parse(item.tasks)), memo: item.memo }));
          setLogs(prev => {
            const newLogs = [...prev];
            let changed = false;
            supabaseLogs.forEach(serverLog => {
               if (serverLog.date === 'SETTINGS') return;
               const idx = newLogs.findIndex(l => l.date === serverLog.date);
               if (idx >= 0) { if (JSON.stringify(newLogs[idx].tasks) !== JSON.stringify(serverLog.tasks) || newLogs[idx].memo !== serverLog.memo) { newLogs[idx] = serverLog; changed = true; } }
               else { newLogs.push(serverLog); changed = true; }
            });
            if (changed) {
              localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(newLogs));
              if (focusedTaskId === null) { const currentViewLog = newLogs.find(l => l.date === viewDate.toDateString()); if (currentViewLog) setTasks(currentViewLog.tasks); }
              return newLogs;
            }
            return prev;
          });
        }
      } catch (e) {}
    };
    loadFromSupabase();
    const channel = supabase.channel(`realtime_tasks_${currentSpace.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_logs', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (Date.now() - lastLocalChange.current < 2000) return;

        if (payload.new && payload.new.space_id === currentSpace.id) {
          const serverLog = { date: payload.new.date, tasks: migrateTasks(JSON.parse(payload.new.tasks)), memo: payload.new.memo };
          if (serverLog.date === 'SETTINGS') return;
          setLogs(prev => {
            const dateStr = serverLog.date;
            const existingIdx = prev.findIndex(l => l.date === dateStr);
            let nextLogs = [...prev];
            if (existingIdx >= 0) {
              if (JSON.stringify(prev[existingIdx].tasks) === JSON.stringify(serverLog.tasks) && prev[existingIdx].memo === serverLog.memo) return prev;
              if (focusedTaskId !== null && dateStr === viewDate.toDateString()) return prev;
              nextLogs[existingIdx] = serverLog;
            } else { nextLogs.push(serverLog); }
            localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(nextLogs));
            if (dateStr === viewDate.toDateString() && focusedTaskId === null) setTasks(serverLog.tasks);
            return nextLogs;
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, currentSpace, localLogsLoaded, focusedTaskId, viewDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        const now = Date.now();
        let changed = false;
        const next = prev.map(t => { if (t.isTimerOn && t.timerStartTime) { const elapsed = (now - t.timerStartTime) / 1000; changed = true; return { ...t, actTime: (t.actTime || 0) + elapsed, timerStartTime: now }; } return t; });
        if (changed) { const dateStr = viewDate.toDateString(); setLogs(prevLogs => { const updated = prevLogs.map(l => l.date === dateStr ? { ...l, tasks: next } : l); const currentLog = updated.find(l => l.date === dateStr); saveTasks(next, currentLog?.memo); return updated; }); }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [viewDate, saveTasks]);

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
      if (newTasksToAdd.length > 0) setTimeout(() => setFocusedTaskId(newTasksToAdd[0].id), 0);
      updateStateAndLogs(next);
      return next;
    });
  }, [currentSpace, updateStateAndLogs]);

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
        next[overallPrevIdx] = { ...prevTask, name: (prevTask.name || '') + (currentText || ''), text: (prevTask.text || '') + (currentText || '') };
        next.splice(idx, 1);
        setTimeout(() => { setFocusedTaskId(prevTask.id); setTimeout(() => { const el = document.activeElement as HTMLTextAreaElement; if (el && el.tagName === 'TEXTAREA') el.setSelectionRange(newPos, newPos); }, 0); }, 0);
        updateStateAndLogs(next);
        return next;
      } else {
        const filtered = prev.filter(t => t.id !== taskId);
        setFocusedTaskId(null);
        updateStateAndLogs(filtered);
        return filtered;
      }
    });
  }, [updateStateAndLogs]);

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
        updateStateAndLogs(next);
        return next;
      }
      return prev;
    });
  }, [updateStateAndLogs]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) { isInternalUpdate.current = true; const h = history[historyIndex - 1]; setTasks(h); updateStateAndLogs(h, false); setHistoryIndex(historyIndex - 1); setTimeout(() => isInternalUpdate.current = false, 0); }
  }, [history, historyIndex, updateStateAndLogs]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) { isInternalUpdate.current = true; const h = history[historyIndex + 1]; setTasks(h); updateStateAndLogs(h, false); setHistoryIndex(historyIndex + 1); setTimeout(() => isInternalUpdate.current = false, 0); }
  }, [history, historyIndex, updateStateAndLogs]);

  const onIndent = useCallback((taskId: number) => { setTasks(prev => { const next = prev.map(t => t.id === taskId ? { ...t, depth: (t.depth || 0) + 1 } : t); updateStateAndLogs(next); return next; }); }, [updateStateAndLogs]);
  const onOutdent = useCallback((taskId: number) => { setTasks(prev => { const next = prev.map(t => t.id === taskId ? { ...t, depth: Math.max(0, (t.depth || 0) - 1) } : t); updateStateAndLogs(next); return next; }); }, [updateStateAndLogs]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      updateStateAndLogs(arrayMove(tasks, oldIndex, newIndex));
    }
  };

  const onTaskClick = (e: React.MouseEvent, taskId: number, index: number) => {
    if (e.shiftKey && lastClickedIndex.current !== null) {
      const isSec = tasks.find(t => t.id === taskId)?.isSecond;
      const currentList = isSec ? tasks.filter(t => t.isSecond) : tasks.filter(t => !t.isSecond);
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const newSelected = new Set(selectedTaskIds);
      for (let i = start; i <= end; i++) if (currentList[i]) newSelected.add(currentList[i].id);
      setSelectedTaskIds(newSelected);
    } else if (e.ctrlKey || e.metaKey) {
      const newSelected = new Set(selectedTaskIds);
      if (newSelected.has(taskId)) newSelected.delete(taskId); else newSelected.add(taskId);
      setSelectedTaskIds(newSelected);
      lastClickedIndex.current = index;
    } else { setSelectedTaskIds(new Set([taskId])); lastClickedIndex.current = index; }
  };

  const handleSpaceChange = useCallback((space: any) => { setCurrentSpace(space); }, [setCurrentSpace]);

  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTaskIds.size > 0 && !isInput) {
      e.preventDefault();
      const nextTasks = tasks.filter(t => !selectedTaskIds.has(t.id));
      updateStateAndLogs(nextTasks);
      setSelectedTaskIds(new Set());
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && selectedTaskIds.size > 0 && !isInput) {
      navigator.clipboard.readText().then(text => {
        if (!text) return;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return;
        const sortedSelectedIds = Array.from(selectedTaskIds).sort((a, b) => tasks.findIndex(t => t.id === a) - tasks.findIndex(t => t.id === b));
        const lastId = sortedSelectedIds[sortedSelectedIds.length - 1];
        const insertIdx = tasks.findIndex(t => t.id === lastId);
        if (insertIdx === -1) return;
        const ref = tasks[insertIdx];
        const newTasksFromPaste: Task[] = lines.map((line, i) => ({
          id: Date.now() + i, name: line.trim(), status: 'pending', indent: ref.indent, parent: ref.parent, text: line.trim(),
          percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: ref.depth || 0, isSecond: ref.isSecond, space_id: String(currentSpace?.id || ''),
        }));
        const nextTasks = [...tasks];
        nextTasks.splice(insertIdx + 1, 0, ...newTasksFromPaste);
        updateStateAndLogs(nextTasks);
        setSelectedTaskIds(new Set());
      });
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

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo, spaces, setCurrentSpace, selectedTaskIds, tasks, currentSpace, updateStateAndLogs]);

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
          <div className="z-10 text-center space-y-12"><h2 className="text-xl text-gray-400 font-light tracking-widest">FOCUS MODE</h2><h1 className="text-4xl md:text-6xl font-bold text-white">{tasks.find(t => t.isTimerOn)?.name || 'Untitled'}</h1><div className="font-mono text-6xl text-gray-500">{formatTimeFull(tasks.find(t => t.isTimerOn)?.actTime || 0)}</div><button onClick={() => updateStateAndLogs(tasks.map(t => t.isTimerOn ? { ...t, isTimerOn: false } : t))} className="px-8 py-3 border border-white/20 rounded-full text-white hover:bg-white/10 transition-all uppercase tracking-widest text-xs">Complete</button></div>
        </div>
      )}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <div className="max-w-xl mx-auto min-h-screen flex flex-col p-4">
        <div className="mb-4 flex justify-between items-center"><SpaceSelector onSpaceChange={handleSpaceChange} /><div className="flex gap-3 items-center"><button onClick={() => setIsSecondVisible(!isSecondVisible)} className="text-gray-500 hover:text-white p-1"><Clock size={18} /></button><button onClick={() => setShowShortcuts(!showShortcuts)} className="text-gray-500 hover:text-white p-1"><HelpCircle size={18} /></button><button onClick={() => user ? signOut() : setShowAuthModal(true)} className="text-xs text-gray-500 hover:text-white">{user ? 'Logout' : 'Login'}</button></div></div>
        <div className="calendar-area mb-4 bg-[#0f0f14] p-5 rounded-3xl border border-white/5 shadow-2xl" onTouchStart={(e) => swipeTouchStart.current = e.touches[0].clientX} onTouchEnd={(e) => { if (swipeTouchStart.current === null) return; const diff = swipeTouchStart.current - e.changedTouches[0].clientX; if (Math.abs(diff) > 100) setViewDate(new Date(year, month + (diff > 0 ? 1 : -1), 1)); swipeTouchStart.current = null; }}>
           <div className="flex justify-between items-center mb-5 px-1"><button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronLeft size={22} /></button><div className="text-center cursor-pointer" onClick={() => setViewDate(new Date())}><div className="text-[11px] text-gray-500 uppercase tracking-widest font-bold">{year}</div><div className="font-black text-xl text-white">{viewDate.toLocaleString('default', { month: 'long' })}</div></div><button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronRight size={22} /></button></div>
           <div className="grid grid-cols-7 gap-1">{['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[10px] text-gray-600 font-black py-1">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { const d = new Date(year, month, 1); d.setDate(d.getDate() + (i - d.getDay())); const l = logs.find(log => log.date === d.toDateString()); return <button key={i} onClick={() => setViewDate(d)} className={`h-11 rounded-xl text-xs flex flex-col items-center justify-center transition-all ${d.toDateString() === viewDate.toDateString() ? 'bg-[#7c4dff] text-white' : d.getMonth() === month ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700'}`}><span className="font-black text-[14px]">{d.getDate()}</span>{l && l.tasks.length > 0 && <div className={`mt-0.5 text-[9px] font-black ${d.toDateString() === viewDate.toDateString() ? 'text-white/80' : 'text-[#7c4dff]'}`}>{Math.round((l.tasks.filter(t => t.status === 'completed').length / l.tasks.length) * 100)}%</div>}</button>; })}</div>
        </div>
        <div className="mb-6 flex justify-around items-center px-4">
          {isSecondVisible && <div className="text-center"><div className="text-[28px] font-black text-white leading-none">{secondStats.done}<span className="text-[16px] text-gray-600 font-light mx-1">/</span>{secondStats.total}</div><div className="text-[14px] text-pink-500 font-black mt-1">{secondStats.rate}%</div></div>}
          <div className="text-center"><div className="text-[28px] font-black text-white leading-none">{flowStats.done}<span className="text-[16px] text-gray-600 font-light mx-1">/</span>{flowStats.total}</div><div className="text-[14px] text-[#7c4dff] font-black mt-1">{flowStats.rate}%</div></div>
        </div>
        <div className="px-6 mb-6"><AutoResizeTextarea value={currentLog?.memo || ''} onChange={(e: any) => { const newMemo = e.target.value; setLogs(prev => { const updated = prev.map(l => l.date === viewDate.toDateString() ? { ...l, memo: newMemo } : l); saveToLocalStorage(updated); return updated; }); }} placeholder="M E M O" className="w-full bg-transparent text-[16px] text-[#7c4dff]/80 font-bold text-center outline-none" /></div>
        <div className="flex-1 space-y-8 pb-32">
          {isSecondVisible && (
            <div><div className="flex items-center justify-between mb-2 px-3"><div className="flex items-center gap-3"><h2 className="text-[11px] font-black tracking-[0.2em] text-pink-500 uppercase flex items-center gap-2"><Clock size={16} /> A SECOND</h2><button onClick={() => { const n: Task = { id: Date.now(), name: '', status: 'pending', indent: 0, parent: null, space_id: String(currentSpace?.id || ''), text: '', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0, isSecond: true }; updateStateAndLogs([...tasks, n]); setFocusedTaskId(n.id); }} className="text-gray-500 hover:text-pink-500"><Plus size={18} /></button></div></div><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={secondTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>{secondTasks.map((t, i) => <UnifiedTaskItem key={t.id} task={t} index={i} allTasks={secondTasks} updateTask={(u) => updateStateAndLogs(tasks.map(x => x.id === u.id ? u : x))} setFocusedTaskId={setFocusedTaskId} focusedTaskId={focusedTaskId} selectedTaskIds={selectedTaskIds} onTaskClick={onTaskClick} logs={logs} onAddTaskAtCursor={handleAddTaskAtCursor} onMergeWithPrevious={handleMergeWithPrevious} onMergeWithNext={handleMergeWithNext} onIndent={() => onIndent(t.id)} onOutdent={() => onOutdent(t.id)} />)}</SortableContext></DndContext></div>
          )}
          <div><div className="flex items-center justify-between mb-2 px-3"><div className="flex items-center gap-3"><h2 className="text-[11px] font-black tracking-[0.2em] text-[#7c4dff] uppercase flex items-center gap-2"><List size={16} /> FLOW</h2><button onClick={() => { const n: Task = { id: Date.now(), name: '', status: 'pending', indent: 0, parent: null, space_id: String(currentSpace?.id || ''), text: '', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0, isSecond: false }; updateStateAndLogs([...tasks, n]); setFocusedTaskId(n.id); }} className="text-gray-500 hover:text-[#7c4dff]"><Plus size={18} /></button></div></div><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={planTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>{planTasks.map((t, i) => <UnifiedTaskItem key={t.id} task={t} index={i} allTasks={planTasks} updateTask={(u) => updateStateAndLogs(tasks.map(x => x.id === u.id ? u : x))} setFocusedTaskId={setFocusedTaskId} focusedTaskId={focusedTaskId} selectedTaskIds={selectedTaskIds} onTaskClick={onTaskClick} logs={logs} onAddTaskAtCursor={handleAddTaskAtCursor} onMergeWithPrevious={handleMergeWithPrevious} onMergeWithNext={handleMergeWithNext} onIndent={() => onIndent(t.id)} onOutdent={() => onOutdent(t.id)} />)}</SortableContext></DndContext></div>
        </div>
        {activeTask && (
          <div className="fixed bottom-6 left-0 right-0 z-[500] flex justify-center px-4"><div className="bg-[#121216]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 flex items-center justify-start gap-2 max-w-full overflow-x-auto no-scrollbar scroll-smooth"><div className="flex items-center gap-2 flex-shrink-0 pl-1"><button onClick={() => updateStateAndLogs(tasks.map(t => t.id === activeTask.id ? { ...t, isTimerOn: !t.isTimerOn, timerStartTime: !t.isTimerOn ? Date.now() : undefined } : t))} className={`p-3.5 rounded-2xl transition-all ${activeTask.isTimerOn ? 'bg-[#7c4dff] text-white' : 'bg-white/5 text-gray-400'}`}>{activeTask.isTimerOn ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button><div className="flex flex-col ml-1"><span className="text-[9px] text-gray-500 font-black uppercase text-center">Execution</span><input type="text" value={formatTimeFull(activeTask.actTime || 0)} onChange={(e) => updateStateAndLogs(tasks.map(t => t.id === activeTask.id ? { ...t, actTime: parseTimeToSeconds(e.target.value) } : t))} className="bg-transparent text-[18px] font-black font-mono text-[#7c4dff] outline-none w-24 text-center" /></div></div><div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" /><div className="flex items-center gap-0.5 flex-shrink-0"><button onClick={() => onOutdent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowLeft size={18} /></button><button onClick={() => onIndent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowRight size={18} /></button></div><div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" /><div className="flex items-center gap-0.5 pr-2 flex-shrink-0"><button onClick={() => updateStateAndLogs(tasks.filter(t => t.id !== activeTask.id))} className="p-2.5 rounded-xl hover:bg-white/5 text-red-500"><X size={18} /></button><button onClick={() => setShowDatePicker(true)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><Calendar size={18} /></button><button onClick={() => setShowHistoryTarget(activeTask.name || '')} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><BarChart2 size={18} /></button><button onClick={() => setFocusedTaskId(null)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white"><Check size={18} /></button></div></div></div>
        )}
        {showDatePicker && activeTask && <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowDatePicker(false)}><div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button><span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button></div><div className="grid grid-cols-7 gap-2">{['S','M','T','W','T','F','S'].map((d, idx) => <div key={`day-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1); d.setDate(d.getDate() + (i - d.getDay())); return <button key={i} onClick={() => { const targetDate = d.toDateString(); const currentDate = viewDate.toDateString(); if (targetDate !== currentDate) { const newLogs = logs.map(l => { if (l.date === currentDate) return { ...l, tasks: l.tasks.filter(t => t.id !== activeTask.id) }; if (l.date === targetDate) return { ...l, tasks: [...l.tasks, { ...activeTask, id: Date.now() }] }; return l; }); if (!newLogs.some(l => l.date === targetDate)) newLogs.push({ date: targetDate, tasks: [{ ...activeTask, id: Date.now() }], memo: '' }); setLogs(newLogs); saveToLocalStorage(newLogs); updateStateAndLogs(tasks.filter(t => t.id !== activeTask.id)); setFocusedTaskId(null); } setShowDatePicker(false); }} className={`aspect-square rounded-lg border flex items-center justify-center ${d.toDateString() === new Date().toDateString() ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}`}><span className="text-sm">{d.getDate()}</span></button>; })}</div></div></div>}
        {showHistoryTarget && <TaskHistoryModal taskName={showHistoryTarget} logs={logs} onClose={() => setShowHistoryTarget(null)} />}
        {showShortcuts && (
          <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}><div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-start mb-6"><h2 className="text-xl font-bold text-white">Shortcuts</h2><button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-white"><X /></button></div><div className="space-y-3 text-sm"><div className="flex justify-between items-center"><span className="text-gray-400">타이머</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Space</kbd></div><div className="flex justify-between items-center"><span className="text-gray-400">완료</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Enter</kbd></div><div className="flex justify-between items-center"><span className="text-gray-400">Undo/Redo</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl+Z / Y</kbd></div><div className="flex justify-between items-center"><span className="text-gray-400">공간 전환</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Alt + 1~9</kbd></div><div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center"><span className="text-gray-400">Undo/Redo (Direct)</span><div className="flex gap-2"><button onClick={handleUndo} className="p-2 bg-white/5 rounded hover:bg-white/10"><ArrowLeft size={16} /></button><button onClick={handleRedo} className="p-2 bg-white/5 rounded hover:bg-white/10"><ArrowRight size={16} /></button></div></div></div></div></div>
        )}
      </div>
    </div>
  );
}
