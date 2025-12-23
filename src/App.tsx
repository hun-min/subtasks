import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSpace } from './contexts/SpaceContext';
import { AuthModal } from './components/AuthModal';
import { SpaceSelector } from './components/SpaceSelector';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, BarChart2, X, Check, ChevronLeft, ChevronRight, Plus, List, Clock, ArrowRight, ArrowLeft, RotateCcw, RotateCw, Calendar, Trash2, HelpCircle, ArrowUp, ArrowDown } from 'lucide-react';

// --- 데이터 타입 ---
type TaskStatus = 'LATER' | 'NOW' | 'DONE';

type Task = {
  id: number;
  text: string;
  status: TaskStatus;
  done?: boolean; 
  percent: number;      
  planTime: number; 
  actTime: number; 
  isTimerOn: boolean;
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

// --- 유틸리티: 시간 포맷 (00:00:00) ---
const formatTimeFull = (seconds: number) => {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- 유틸리티: 시간 포맷 축약 (1s, 1m, 1h) ---
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
const AutoResizeTextarea = ({ value, onChange, onKeyDown, onFocus, onBlur, placeholder, autoFocus, className, inputRef }: any) => {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const combinedRef = inputRef || localRef;

  useEffect(() => {
    if (combinedRef.current) {
      combinedRef.current.style.height = 'auto';
      combinedRef.current.style.height = combinedRef.current.scrollHeight + 'px';
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && combinedRef.current) {
      combinedRef.current.focus();
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
};

// --- [컴포넌트] 태스크 히스토리 모달 ---
function TaskHistoryModal({ taskName, logs, onClose }: { taskName: string, logs: DailyLog[], onClose: () => void }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date());
  const historyMap = useMemo(() => {
    const map = new Map();
    logs.forEach(log => {
      const found = log.tasks.find(t => t.text.trim() === taskName.trim());
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
    <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
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
}

// --- [컴포넌트] 통합 할 일 아이템 ---
function UnifiedTaskItem({ 
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
  onOutdent, 
  onMoveUp, 
  onMoveDown 
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
  onOutdent?: () => void, 
  onMoveUp?: () => void, 
  onMoveDown?: () => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const paddingLeft = currentDepth * 24; 
  const isFocused = focusedTaskId === task.id;
  const isSelected = selectedTaskIds.has(task.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: `${paddingLeft}px`
  };

  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  useEffect(() => {
    if (!isFocused || !task.text.startsWith('/')) { setSuggestions([]); return; }
    const query = task.text.slice(1).toLowerCase();
    const matches: Task[] = [];
    const seen = new Set();
    [...logs].reverse().forEach(log => log.tasks.forEach(t => { if (t.text.toLowerCase().includes(query) && !seen.has(t.text)) { matches.push(t); seen.add(t.text); } }));
    setSuggestions(matches.slice(0, 5));
    setSelectedSuggestionIndex(-1);
  }, [task.text, isFocused, logs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) { e.preventDefault(); setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); return; }
    if (e.key === 'ArrowUp' && suggestions.length > 0) { e.preventDefault(); setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1); return; }
    
    if (e.key === 'Enter') {
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        e.preventDefault();
        updateTask({ ...task, text: suggestions[selectedSuggestionIndex].text });
        setSuggestions([]);
      } else if (!e.shiftKey) {
        e.preventDefault();
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textBefore = task.text.substring(0, cursorPos);
        const textAfter = task.text.substring(cursorPos);
        onAddTaskAtCursor(task.id, textBefore, textAfter);
      }
      return;
    }
    if (e.key === 'Backspace' && textareaRef.current?.selectionStart === 0 && textareaRef.current?.selectionEnd === 0) {
      e.preventDefault();
      onMergeWithPrevious(task.id, task.text);
      return;
    }
    if (e.key === 'Delete' && textareaRef.current?.selectionStart === task.text.length && textareaRef.current?.selectionEnd === task.text.length) {
      e.preventDefault();
      onMergeWithNext(task.id, task.text);
      return;
    }
    if (e.key === 'Tab') { e.preventDefault(); if (e.shiftKey) onOutdent?.(); else onIndent?.(); return; }
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onMoveUp?.(); return; }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onMoveDown?.(); return; }
    if (e.key === 'ArrowUp' && !e.altKey) { if (index > 0) { e.preventDefault(); setFocusedTaskId(allTasks[index-1].id); } }
    if (e.key === 'ArrowDown' && !e.altKey) { if (index < allTasks.length - 1) { e.preventDefault(); setFocusedTaskId(allTasks[index+1].id); } }
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') { e.preventDefault(); updateTask({ ...task, isTimerOn: !task.isTimerOn, timerStartTime: !task.isTimerOn ? Date.now() : undefined }); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); updateTask({ ...task, status: task.status === 'DONE' ? 'LATER' : 'DONE', isTimerOn: false }); }
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
    if (task.status === 'DONE') return 'bg-[#4caf50] border-[#4caf50]';
    return 'bg-transparent border-gray-600 hover:border-gray-400';
  };

  return (
    <div ref={setNodeRef} style={style} onClick={(e) => onTaskClick(e, task.id, index)} className={`relative group flex items-start gap-2 py-0 px-4 transition-colors ${isFocused ? 'bg-white/[0.04]' : ''} ${isSelected ? 'bg-[#7c4dff]/10 border-l-2 border-[#7c4dff]' : ''}`} onTouchStart={handleItemTouchStart} onTouchEnd={handleItemTouchEnd}>
      {currentDepth > 0 && <div className="absolute top-0 bottom-0 border-l border-white/10" style={{ left: `${paddingLeft + 6}px` }} />}
      <div className="flex flex-col items-center justify-start mt-[7px]">
        <button onClick={() => updateTask({ ...task, status: task.status === 'DONE' ? 'LATER' : 'DONE', isTimerOn: false })} className={`flex-shrink-0 w-[15px] h-[15px] border-[1.2px] rounded-[3px] flex items-center justify-center transition-all ${getStatusColor()}`}>
          {task.status === 'DONE' && <Check size={11} className="text-white stroke-[3]" />}
          {task.isTimerOn && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
        </button>
      </div>
      <div className="flex-1 relative">
        <AutoResizeTextarea inputRef={textareaRef} value={task.text} autoFocus={isFocused} onFocus={() => setFocusedTaskId(task.id)} onChange={(e: any) => updateTask({ ...task, text: e.target.value })} onKeyDown={handleKeyDown} className={`w-full text-[15px] font-medium leading-[1.2] py-1 ${task.status === 'DONE' ? 'text-gray-500 line-through decoration-[1.5px]' : 'text-[#e0e0e0]'}`} placeholder="" />
        {isFocused && task.text === '' && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] font-black text-gray-700 tracking-widest uppercase opacity-40">/ history</div>
        )}
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-[110] mt-0 bg-[#1a1a1f] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[180px]">
            {suggestions.map((s, idx) => <button key={idx} onClick={() => { updateTask({ ...task, text: s.text }); setSuggestions([]); }} className={`w-full px-3 py-1.5 text-left text-sm ${selectedSuggestionIndex === idx ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{s.text}</button>)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity mt-[4px]">
        {task.actTime > 0 && <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap">{formatTimeShort(task.actTime)}</span>}
        <div {...attributes} {...listeners} className="w-4 h-4 cursor-grab text-gray-700 flex items-center justify-center outline-none touch-none"><List size={13} /></div>
      </div>
    </div>
  );
}

// --- [컴포넌트] 날짜 선택 모달 ---
function DatePickerModal({ onSelectDate, onClose }: { onSelectDate: (date: Date) => void, onClose: () => void }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: firstDay }).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)));
  return (
    <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button>
          <span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['S','M','T','W','T','F','S'].map((d, idx) => <div key={`day-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}
          {days.map((d: any, i) => {
            if (!d) return <div key={i} />;
            return <button key={i} onClick={() => onSelectDate(d)} className={`aspect-square rounded-lg border flex items-center justify-center hover:bg-blue-600/20 transition-colors ${d.toDateString() === new Date().toDateString() ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}`}><span className="text-sm">{d.getDate()}</span></button>;
          })}
        </div>
      </div>
    </div>
  );
}

// --- 메인 앱 ---
export default function App() {
  const { user, signOut } = useAuth();
  const { currentSpace, spaces, setCurrentSpace } = useSpace();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
  const [showHistoryTarget, setShowHistoryTarget] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);
  
  // A SECOND 가리기 상태 (로컬 저장 - 공간별 분리)
  const [isSecondVisible, setIsSecondVisible] = useState(true);

  const [history, setHistory] = useState<Task[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUpdate = useRef(false);
  const swipeTouchStart = useRef<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const saveToLocalStorage = useCallback((allLogs: DailyLog[]) => {
    if (currentSpace) localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(allLogs));
  }, [currentSpace]);

  useEffect(() => {
    if (currentSpace) {
      const saved = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
      let currentLogs: DailyLog[] = saved ? JSON.parse(saved) : [];
      const dateStr = viewDate.toDateString();
      let log = currentLogs.find(l => l.date === dateStr);
      if (!log) {
        const yesterday = new Date(viewDate); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayLog = currentLogs.find(l => l.date === yesterday.toDateString());
        const secondTasks = yesterdayLog ? yesterdayLog.tasks.filter(t => t.isSecond).map(t => ({ ...t, id: Date.now() + Math.random(), status: 'LATER' as TaskStatus, actTime: 0, isTimerOn: false })) : [];
        log = { date: dateStr, tasks: secondTasks, memo: '' };
        currentLogs.push(log);
      }
      setLogs(currentLogs);
      setTasks(log.tasks);
      setHistory([log.tasks]);
      setHistoryIndex(0);

      const savedVisible = localStorage.getItem(`ultra_tasks_is_second_visible_${currentSpace.id}`);
      setIsSecondVisible(savedVisible !== null ? JSON.parse(savedVisible) : true);
    }
  }, [currentSpace, viewDate]);

  const updateStateAndLogs = useCallback((newTasks: Task[], updateHistory = true) => {
    setTasks(newTasks);
    const dateStr = viewDate.toDateString();
    setLogs(prev => {
      const updated = prev.map(l => l.date === dateStr ? { ...l, tasks: newTasks } : l);
      saveToLocalStorage(updated);
      return updated;
    });
    if (updateHistory && !isInternalUpdate.current) {
      setHistory(prev => [...prev.slice(0, historyIndex + 1), newTasks]);
      setHistoryIndex(prev => prev + 1);
    }
  }, [viewDate, historyIndex, saveToLocalStorage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        const now = Date.now();
        let changed = false;
        const next = prev.map(t => { if (t.isTimerOn && t.timerStartTime) { const elapsed = (now - t.timerStartTime) / 1000; changed = true; return { ...t, actTime: t.actTime + elapsed, timerStartTime: now }; } return t; });
        if (changed) {
          const dateStr = viewDate.toDateString();
          setLogs(prevLogs => { const updated = prevLogs.map(l => l.date === dateStr ? { ...l, tasks: next } : l); saveToLocalStorage(updated); return updated; });
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [viewDate, saveToLocalStorage]);

  const handleAddTaskAtCursor = (taskId: number, textBefore: string, textAfter: string) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const current = tasks[idx];
    const newTasks = [...tasks];
    newTasks[idx] = { ...current, text: textBefore };
    const newTask: Task = { id: Date.now(), text: textAfter, status: 'LATER', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: current.depth, isSecond: current.isSecond };
    newTasks.splice(idx + 1, 0, newTask);
    updateStateAndLogs(newTasks);
    setFocusedTaskId(newTask.id);
  };

  const handleMergeWithPrevious = (taskId: number, currentText: string) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx <= 0) return;
    const prev = tasks[idx - 1];
    const newTasks = [...tasks];
    newTasks[idx - 1] = { ...prev, text: prev.text + currentText };
    newTasks.splice(idx, 1);
    updateStateAndLogs(newTasks);
    setFocusedTaskId(prev.id);
  };

  const handleMergeWithNext = (taskId: number, currentText: string) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx >= tasks.length - 1) return;
    const next = tasks[idx + 1];
    const newTasks = [...tasks];
    newTasks[idx] = { ...tasks[idx], text: currentText + next.text };
    newTasks.splice(idx + 1, 1);
    updateStateAndLogs(newTasks);
    setFocusedTaskId(taskId);
  };

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isInternalUpdate.current = true;
      updateStateAndLogs(history[historyIndex - 1], false);
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => isInternalUpdate.current = false, 0);
    }
  }, [history, historyIndex, updateStateAndLogs]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isInternalUpdate.current = true;
      updateStateAndLogs(history[historyIndex + 1], false);
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => isInternalUpdate.current = false, 0);
    }
  }, [history, historyIndex, updateStateAndLogs]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
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
  }, [handleUndo, handleRedo, spaces, setCurrentSpace]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      updateStateAndLogs(arrayMove(tasks, oldIndex, newIndex));
    }
  };

  const onTaskClick = (e: React.MouseEvent, taskId: number, index: number) => {
    if (e.shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const newSelected = new Set(selectedTaskIds);
      for (let i = start; i <= end; i++) newSelected.add(tasks[i].id);
      setSelectedTaskIds(newSelected);
    } else if (e.ctrlKey || e.metaKey) {
      const newSelected = new Set(selectedTaskIds);
      if (newSelected.has(taskId)) newSelected.delete(taskId);
      else newSelected.add(taskId);
      setSelectedTaskIds(newSelected);
      lastClickedIndex.current = index;
    } else {
      setSelectedTaskIds(new Set());
      lastClickedIndex.current = index;
    }
  };

  const toggleSecondVisible = () => {
    if (currentSpace) {
      const newVal = !isSecondVisible;
      setIsSecondVisible(newVal);
      localStorage.setItem(`ultra_tasks_is_second_visible_${currentSpace.id}`, JSON.stringify(newVal));
    }
  };

  const activeTask = useMemo(() => tasks.find(t => t.id === focusedTaskId), [tasks, focusedTaskId]);
  const planTasks = tasks.filter(t => !t.isSecond);
  const secondTasks = tasks.filter(t => t.isSecond);
  
  const getStats = (list: Task[]) => {
    const total = list.length;
    const done = list.filter(t => t.status === 'DONE').length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, rate };
  };

  const secondStats = getStats(secondTasks);
  const flowStats = getStats(planTasks);
  const currentLog = logs.find(l => l.date === viewDate.toDateString());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] selection:bg-[#7c4dff]/30 font-sans overflow-x-hidden">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showShortcuts && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6"><h2 className="text-xl font-bold text-white">Shortcuts</h2><button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-white"><X /></button></div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center"><span className="text-gray-400">타이머</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Space</kbd></div>
              <div className="flex justify-between items-center"><span className="text-gray-400">완료</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Enter</kbd></div>
              <div className="flex justify-between items-center"><span className="text-gray-400">Undo/Redo</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl+Z / Y</kbd></div>
              <div className="flex justify-between items-center"><span className="text-gray-400">공간 전환</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Alt + 1~9</kbd></div>
              <div className="flex justify-between items-center"><span className="text-gray-400">항목 분리(Enter)</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Enter</kbd></div>
              <div className="flex justify-between items-center"><span className="text-gray-400">항목 결합</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Backspace at Start</kbd></div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto min-h-screen flex flex-col p-4">
        <div className="mb-4 flex justify-between items-center flex-shrink-0"><SpaceSelector /><div className="flex gap-3 items-center">
            <button onClick={toggleSecondVisible} className="text-gray-500 hover:text-white p-1 transition-colors"><Clock size={18} /></button>
            <button onClick={() => setShowShortcuts(true)} className="text-gray-500 hover:text-white p-1"><HelpCircle size={18} /></button>
            <button onClick={() => user ? signOut() : setShowAuthModal(true)} className="text-xs text-gray-500 hover:text-white">{user ? 'Logout' : 'Login'}</button>
        </div></div>
        
        <div className="flex-shrink-0">
          <div className="calendar-area mb-4 bg-[#0f0f14] p-5 rounded-3xl border border-white/5 shadow-2xl" onTouchStart={(e) => swipeTouchStart.current = e.touches[0].clientX} onTouchEnd={(e) => { if (swipeTouchStart.current === null) return; const diff = swipeTouchStart.current - e.changedTouches[0].clientX; if (Math.abs(diff) > 100) setViewDate(new Date(year, month + (diff > 0 ? 1 : -1), 1)); swipeTouchStart.current = null; }}>
             <div className="flex justify-between items-center mb-5 px-1"><button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronLeft size={22} /></button><div className="text-center"><div className="text-[11px] text-gray-500 uppercase tracking-widest mb-0.5 font-bold">{year}</div><div className="font-black text-xl text-white">{viewDate.toLocaleString('default', { month: 'long' })}</div></div><button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronRight size={22} /></button></div>
             <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[10px] text-gray-600 font-black py-1">{d}</div>)}
                {Array.from({length: 35}).map((_, i) => {
                  const d = new Date(year, month, 1); d.setDate(d.getDate() + (i - d.getDay()));
                  const log = logs.find(l => l.date === d.toDateString()); const hasTasks = log && log.tasks.length > 0;
                  const rate = hasTasks ? Math.round((log!.tasks.filter(t => t.status === 'DONE').length / log!.tasks.length) * 100) : 0;
                  return <button key={i} onClick={() => setViewDate(d)} className={`h-11 rounded-xl text-xs flex flex-col items-center justify-center transition-all relative ${d.toDateString() === viewDate.toDateString() ? 'bg-[#7c4dff] text-white shadow-lg shadow-[#7c4dff]/20' : d.getMonth() === month ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700'}`}><span className="font-black text-[14px]">{d.getDate()}</span>{hasTasks && <div className={`mt-0.5 text-[9px] font-black ${d.toDateString() === viewDate.toDateString() ? 'text-white/80' : 'text-[#7c4dff]'}`}>{rate}%</div>}</button>;
                })}
             </div>
          </div>

          <div className="mb-6 flex justify-around items-center px-4">
            {isSecondVisible && <div className="text-center"><div className="text-[28px] font-black text-white leading-none">{secondStats.done}<span className="text-[16px] text-gray-600 font-light mx-1">/</span>{secondStats.total}</div><div className="text-[14px] text-pink-500 font-black mt-1">{secondStats.rate}%</div></div>}
            <div className="text-center"><div className="text-[28px] font-black text-white leading-none">{flowStats.done}<span className="text-[16px] text-gray-600 font-light mx-1">/</span>{flowStats.total}</div><div className="text-[14px] text-[#7c4dff] font-black mt-1">{flowStats.rate}%</div></div>
          </div>
          <div className="px-6 mb-6">
            <AutoResizeTextarea value={currentLog?.memo || ''} onChange={(e: any) => { const newMemo = e.target.value; setLogs(prev => { const updated = prev.map(l => l.date === viewDate.toDateString() ? { ...l, memo: newMemo } : l); saveToLocalStorage(updated); return updated; }); }} placeholder="M E M O" className="w-full bg-transparent text-[16px] text-[#7c4dff]/80 font-bold text-center outline-none placeholder:text-gray-800 placeholder:font-light tracking-widest" />
          </div>
        </div>

        <div className="flex-1 space-y-8 pb-32">
          <div className="animate-in fade-in duration-500">
            {isSecondVisible && (
              <>
                <div className="flex items-center justify-between mb-2 px-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[11px] font-black tracking-[0.2em] text-pink-500 uppercase flex items-center gap-2"><Clock size={16} /> A SECOND</h2>
                    <button onClick={() => { const newTask: Task = { id: Date.now(), text: '', status: 'LATER', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0, isSecond: true }; updateStateAndLogs([...tasks, newTask]); setFocusedTaskId(newTask.id); }} className="text-gray-500 hover:text-pink-500"><Plus size={18} /></button>
                  </div>
                </div>
                <div className="space-y-0">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={secondTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {secondTasks.map((task, idx) => <UnifiedTaskItem key={task.id} task={task} index={idx} allTasks={secondTasks} updateTask={(u) => updateStateAndLogs(tasks.map(t => t.id === u.id ? u : t))} setFocusedTaskId={setFocusedTaskId} focusedTaskId={focusedTaskId} selectedTaskIds={selectedTaskIds} onTaskClick={onTaskClick} logs={logs} onAddTaskAtCursor={handleAddTaskAtCursor} onMergeWithPrevious={handleMergeWithPrevious} onMergeWithNext={handleMergeWithNext} />)}
                    </SortableContext>
                  </DndContext>
                </div>
              </>
            )}
          </div>
          <div className="animate-in fade-in duration-700">
            <div className="flex items-center justify-between mb-2 px-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[11px] font-black tracking-[0.2em] text-[#7c4dff] uppercase flex items-center gap-2"><List size={16} /> FLOW</h2>
                <button onClick={() => { const newTask: Task = { id: Date.now(), text: '', status: 'LATER', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0, isSecond: false }; updateStateAndLogs([...tasks, newTask]); setFocusedTaskId(newTask.id); }} className="text-gray-500 hover:text-[#7c4dff]"><Plus size={18} /></button>
              </div>
            </div>
            <div className="space-y-0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={planTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {planTasks.map((task, idx) => <UnifiedTaskItem key={task.id} task={task} index={idx} allTasks={planTasks} updateTask={(u) => updateStateAndLogs(tasks.map(t => t.id === u.id ? u : t))} setFocusedTaskId={setFocusedTaskId} focusedTaskId={focusedTaskId} selectedTaskIds={selectedTaskIds} onTaskClick={onTaskClick} logs={logs} onAddTaskAtCursor={handleAddTaskAtCursor} onMergeWithPrevious={handleMergeWithPrevious} onMergeWithNext={handleMergeWithNext} onIndent={() => updateStateAndLogs(tasks.map(t => t.id === task.id ? { ...t, depth: (t.depth || 0) + 1 } : t))} onOutdent={() => updateStateAndLogs(tasks.map(t => t.id === task.id ? { ...t, depth: Math.max(0, (t.depth || 0) - 1) } : t))} onMoveUp={() => { const i = tasks.findIndex(t => t.id === task.id); if (i > 0) updateStateAndLogs(arrayMove(tasks, i, i - 1)); }} onMoveDown={() => { const i = tasks.findIndex(t => t.id === task.id); if (i < tasks.length - 1) updateStateAndLogs(arrayMove(tasks, i, i + 1)); }} />)}
                </SortableContext>
              </DndContext>
            </div>
          </div>
          {tasks.length === 0 && <button onClick={() => { const newTask: Task = { id: Date.now(), text: '', status: 'LATER', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0, isSecond: false }; updateStateAndLogs([...tasks, newTask]); setFocusedTaskId(newTask.id); }} className="w-full py-2 border border-dashed border-white/5 rounded-2xl text-gray-700 text-xs font-bold mt-2 transition-all"><Plus size={14} /> NEW FLOW</button>}
        </div>

        {activeTask && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[96%] max-md z-[500] animate-in slide-in-from-bottom-8 duration-500 cubic-bezier(0.16, 1, 0.3, 1)">
            <div className="bg-[#121216]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex items-center gap-2 overflow-x-auto scrollbar-hide no-scrollbar">
              <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }` }} />
              <div className="flex items-center gap-2 flex-shrink-0 pl-1">
                <button onClick={() => updateStateAndLogs(tasks.map(t => t.id === activeTask.id ? { ...t, isTimerOn: !t.isTimerOn, timerStartTime: !t.isTimerOn ? Date.now() : undefined } : t))} className={`p-3.5 rounded-2xl transition-all flex-shrink-0 ${activeTask.isTimerOn ? 'bg-[#7c4dff] text-white shadow-[0_0_25px_rgba(124,77,255,0.5)] scale-105' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                  {activeTask.isTimerOn ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                </button>
                <div className="flex flex-col flex-shrink-0 ml-1">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Execution</span>
                  <input type="text" value={formatTimeFull(activeTask.actTime)} onChange={(e) => updateStateAndLogs(tasks.map(t => t.id === activeTask.id ? { ...t, actTime: parseTimeToSeconds(e.target.value) } : t))} className="bg-transparent text-[18px] font-black font-mono text-[#7c4dff] outline-none w-24 tracking-tight" />
                </div>
              </div>
              <div className="h-8 w-px bg-white/10 flex-shrink-0 mx-1" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => updateStateAndLogs(tasks.map(t => t.id === activeTask.id ? { ...t, depth: Math.max(0, (t.depth || 0) - 1) } : t))} className="p-3 rounded-xl bg-white/5 text-gray-400 active:bg-white/10 flex-shrink-0 transition-colors"><ArrowLeft size={20} /></button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => updateStateAndLogs(tasks.map(t => t.id === activeTask.id ? { ...t, depth: (t.depth || 0) + 1 } : t))} className="p-3 rounded-xl bg-white/5 text-gray-400 active:bg-white/10 flex-shrink-0 transition-colors"><ArrowRight size={20} /></button>
              </div>
              <div className="h-8 w-px bg-white/10 flex-shrink-0 mx-1" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { const idx = tasks.findIndex(t => t.id === activeTask.id); if (idx > 0) updateStateAndLogs(arrayMove(tasks, idx, idx - 1)); }} className="p-3 rounded-xl bg-white/5 text-gray-400 active:bg-white/10 flex-shrink-0 transition-colors"><ArrowUp size={20} /></button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { const idx = tasks.findIndex(t => t.id === activeTask.id); if (idx < tasks.length - 1) updateStateAndLogs(arrayMove(tasks, idx, idx + 1)); }} className="p-3 rounded-xl bg-white/5 text-gray-400 active:bg-white/10 flex-shrink-0 transition-colors"><ArrowDown size={20} /></button>
              </div>
              <div className="h-8 w-px bg-white/10 flex-shrink-0 mx-1" />
              <div className="flex items-center gap-1 flex-shrink-0 pr-2">
                <button onClick={() => { const newTasks = tasks.filter(t => t.id !== activeTask.id); updateStateAndLogs(newTasks); const idx = tasks.findIndex(t => t.id === activeTask.id); if (idx > 0) setFocusedTaskId(tasks[idx-1].id); else if (newTasks.length > 0) setFocusedTaskId(newTasks[0].id); else setFocusedTaskId(null); }} className="p-3 rounded-xl hover:bg-white/5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 size={20} /></button>
                <button onClick={() => setShowDatePicker(true)} className="p-3 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors flex-shrink-0"><Calendar size={20} /></button>
                <button onClick={() => setShowHistoryTarget(activeTask.text)} className="p-3 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors flex-shrink-0"><BarChart2 size={20} /></button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleUndo()} disabled={historyIndex <= 0} className="p-3 rounded-xl hover:bg-white/5 text-gray-400 disabled:opacity-20 flex-shrink-0 transition-colors"><RotateCcw size={20} /></button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleRedo()} disabled={historyIndex >= history.length - 1} className="p-3 rounded-xl hover:bg-white/5 text-gray-400 disabled:opacity-20 flex-shrink-0 transition-colors"><RotateCw size={20} /></button>
                <button onClick={() => setFocusedTaskId(null)} className="p-3 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors flex-shrink-0"><X size={20} /></button>
              </div>
            </div>
          </div>
        )}

        {showDatePicker && activeTask && <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowDatePicker(false)}><div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button><span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button></div><div className="grid grid-cols-7 gap-2">{['S','M','T','W','T','F','S'].map((d, idx) => <div key={`day-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { const d = new Date(year, month, 1); d.setDate(d.getDate() + (i - d.getDay())); return <button key={i} onClick={() => { const targetDate = d.toDateString(); const currentDate = viewDate.toDateString(); if (targetDate !== currentDate) { const newLogs = logs.map(l => { if (l.date === currentDate) return { ...l, tasks: l.tasks.filter(t => t.id !== activeTask.id) }; if (l.date === targetDate) return { ...l, tasks: [...l.tasks, { ...activeTask, id: Date.now() }] }; return l; }); if (!newLogs.some(l => l.date === targetDate)) newLogs.push({ date: targetDate, tasks: [{ ...activeTask, id: Date.now() }], memo: '' }); setLogs(newLogs); saveToLocalStorage(newLogs); updateStateAndLogs(tasks.filter(t => t.id !== activeTask.id)); setFocusedTaskId(null); } setShowDatePicker(false); }} className={`aspect-square rounded-lg border flex items-center justify-center hover:bg-blue-600/20 transition-colors ${d.toDateString() === new Date().toDateString() ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}`}><span className="text-sm">{d.getDate()}</span></button>; })}</div></div></div>}
        {showHistoryTarget && <TaskHistoryModal taskName={showHistoryTarget} logs={logs} onClose={() => setShowHistoryTarget(null)} />}
      </div>
    </div>
  );
}
