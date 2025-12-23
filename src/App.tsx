import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSpace } from './contexts/SpaceContext';
import { AuthModal } from './components/AuthModal';
import { SpaceSelector } from './components/SpaceSelector';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, BarChart2, X, Check, ChevronLeft, ChevronRight, Plus, Calendar, List, Clock, Eye, EyeOff } from 'lucide-react';

// --- 데이터 타입 ---
type TaskStatus = 'LATER' | 'NOW' | 'DONE';

type Task = {
  id: number;
  text: string;
  status: TaskStatus;
  done?: boolean; 
  percent: number;      
  planTime: number; // 이제 거의 안쓰임
  actTime: number; // 초 단위로 관리 (기존은 분 단위였으나 00:00:00 위해 초 단위 정밀도 사용)
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
const formatTime = (seconds: number) => {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- 유틸리티: 포맷된 시간을 초로 변환 ---
const parseTimeToSeconds = (timeStr: string) => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

// --- [컴포넌트] 자동 높이 조절 Textarea ---
const AutoResizeTextarea = ({ value, onChange, onKeyDown, onFocus, onBlur, placeholder, autoFocus, className }: any) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`resize-none overflow-hidden bg-transparent outline-none ${className}`}
      style={{ minHeight: '24px' }}
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
  const days = Array.from({ length: firstDay }).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase mb-1">TASK HISTORY</h2>
            <h1 className="text-xl font-black text-white">"{taskName}"</h1>
          </div>
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
            const isToday = dateStr === today.toDateString();
            return (
              <div key={i} className={`aspect-square rounded-lg border flex items-center justify-center relative ${record ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800/50 border-gray-800 text-gray-600'} ${isToday ? 'ring-1 ring-white' : ''}`}>
                <span className="text-xs font-medium">{d.getDate()}</span>
              </div>
            );
          })}
        </div>
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
  const days = Array.from({ length: firstDay }).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
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
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <button key={i} onClick={() => onSelectDate(d)} className={`aspect-square rounded-lg border flex items-center justify-center hover:bg-blue-600/20 transition-colors ${isToday ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}`}>
                <span className="text-sm">{d.getDate()}</span>
              </button>
            );
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
  deleteTask, 
  focusedTaskId, 
  setFocusedTaskId, 
  logs, 
  onAddTask,
  onIndent, 
  onOutdent, 
  onMoveUp, 
  onMoveDown 
}: { 
  task: Task, 
  index: number,
  allTasks: Task[],
  updateTask: (task: Task) => void, 
  deleteTask: (id: number) => void, 
  focusedTaskId: number | null, 
  setFocusedTaskId: (id: number | null) => void, 
  logs: DailyLog[], 
  onAddTask: (afterId: number, isSecond: boolean, depth: number) => void,
  onIndent?: () => void, 
  onOutdent?: () => void, 
  onMoveUp?: () => void, 
  onMoveDown?: () => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const paddingLeft = currentDepth * 24;
  const isFocused = focusedTaskId === task.id;

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
    [...logs].reverse().forEach(log => {
      log.tasks.forEach(t => { if (t.text.toLowerCase().includes(query) && !seen.has(t.text)) { matches.push(t); seen.add(t.text); } });
    });
    setSuggestions(matches.slice(0, 5));
    setSelectedSuggestionIndex(-1);
  }, [task.text, isFocused, logs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) { e.preventDefault(); setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); return; }
    if (e.key === 'ArrowUp' && suggestions.length > 0) { e.preventDefault(); setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1); return; }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        const s = suggestions[selectedSuggestionIndex];
        updateTask({ ...task, text: s.text });
        setSuggestions([]);
      } else {
        onAddTask(task.id, task.isSecond || false, currentDepth);
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) onOutdent?.();
      else onIndent?.();
      return;
    }
    if (e.key === 'Backspace' && task.text === '') {
      e.preventDefault();
      if (currentDepth > 0) onOutdent?.();
      else deleteTask(task.id);
      return;
    }
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onMoveUp?.(); return; }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onMoveDown?.(); return; }
    
    if (e.key === 'ArrowUp' && !e.altKey) {
      if (index > 0) { e.preventDefault(); setFocusedTaskId(allTasks[index-1].id); }
    }
    if (e.key === 'ArrowDown' && !e.altKey) {
      if (index < allTasks.length - 1) { e.preventDefault(); setFocusedTaskId(allTasks[index+1].id); }
    }
  };

  const getStatusColor = () => {
    if (task.isTimerOn) return 'bg-blue-600 border-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
    if (task.status === 'DONE') return 'bg-green-600 border-green-600';
    return 'bg-transparent border-gray-700 hover:border-gray-500';
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative group flex items-start gap-2 py-1 pl-4 transition-colors ${isFocused ? 'bg-white/5' : ''}`}>
      {currentDepth > 0 && <div className="absolute top-0 bottom-0 border-l border-white/5" style={{ left: `${paddingLeft + 6}px` }} />}
      <div className="flex items-center gap-1 mt-1.5 min-w-[60px] justify-end mr-1">
        <span className="text-[10px] text-gray-600 font-mono">{formatTime(task.actTime)}</span>
      </div>
      <button onClick={() => updateTask({ ...task, status: task.status === 'DONE' ? 'LATER' : 'DONE', isTimerOn: false })} className={`mt-2 flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center transition-all ${getStatusColor()}`}>
        {task.status === 'DONE' && <Check size={10} className="text-white" />}
        {task.isTimerOn && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
      </button>
      <div className="flex-1 relative">
        <AutoResizeTextarea value={task.text} autoFocus={isFocused} onFocus={() => setFocusedTaskId(task.id)} onChange={(e: any) => updateTask({ ...task, text: e.target.value })} onKeyDown={handleKeyDown} className={`w-full text-sm leading-relaxed py-1.5 ${task.status === 'DONE' ? 'text-gray-600 line-through' : 'text-gray-200'}`} placeholder="" />
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-[110] mt-1 bg-[#1a1a1f] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[200px]">
            {suggestions.map((s, idx) => (
              <button key={idx} onClick={() => { updateTask({ ...task, text: s.text }); setSuggestions([]); }} className={`w-full px-3 py-2 text-left text-xs ${selectedSuggestionIndex === idx ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{s.text}</button>
            ))}
          </div>
        )}
      </div>
      <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 mr-2`}>
        <button onClick={() => deleteTask(task.id)} className="text-gray-700 hover:text-red-500 p-1"><X size={12} /></button>
        <div {...attributes} {...listeners} className="w-4 h-4 cursor-grab text-gray-600 flex items-center justify-center"><List size={12} /></div>
      </div>
    </div>
  );
}

// --- 메인 앱 ---
export default function App() {
  const { user, signOut } = useAuth();
  const { currentSpace } = useSpace();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
  const [showHistoryTarget, setShowHistoryTarget] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSecondVisible, setIsSecondVisible] = useState(true);
  
  // 스와이프 관련
  const touchStart = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (currentSpace) {
      const saved = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
      let currentLogs: DailyLog[] = saved ? JSON.parse(saved) : [];
      const dateStr = viewDate.toDateString();
      let log = currentLogs.find(l => l.date === dateStr);
      if (!log) {
        const yesterday = new Date(viewDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayLog = currentLogs.find(l => l.date === yesterday.toDateString());
        const secondTasks = yesterdayLog ? yesterdayLog.tasks.filter(t => t.isSecond).map(t => ({ ...t, id: Date.now() + Math.random(), status: 'LATER' as TaskStatus, actTime: 0, isTimerOn: false })) : [];
        log = { date: dateStr, tasks: secondTasks, memo: '' };
        currentLogs.push(log);
      }
      setLogs(currentLogs);
      setTasks(log.tasks);
    }
  }, [currentSpace, viewDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        const now = Date.now();
        let changed = false;
        const next = prev.map(t => {
          if (t.isTimerOn && t.timerStartTime) {
            const elapsed = (now - t.timerStartTime) / 1000;
            changed = true;
            return { ...t, actTime: t.actTime + elapsed, timerStartTime: now };
          }
          return t;
        });
        if (changed) {
          const dateStr = viewDate.toDateString();
          setLogs(prevLogs => {
            const updated = prevLogs.map(l => l.date === dateStr ? { ...l, tasks: next } : l);
            localStorage.setItem(`ultra_tasks_space_${currentSpace?.id}`, JSON.stringify(updated));
            return updated;
          });
        }
        return changed ? next : prev;
      });
    }, 1000); // 1초 정밀도
    return () => clearInterval(timer);
  }, [currentSpace, viewDate]);

  const saveLogs = (newTasks: Task[], newMemo?: string) => {
    const dateStr = viewDate.toDateString();
    setLogs(prev => {
      const idx = prev.findIndex(l => l.date === dateStr);
      const updatedLogs = [...prev];
      if (idx >= 0) updatedLogs[idx] = { ...updatedLogs[idx], tasks: newTasks, memo: newMemo !== undefined ? newMemo : updatedLogs[idx].memo };
      else updatedLogs.push({ date: dateStr, tasks: newTasks, memo: newMemo || '' });
      localStorage.setItem(`ultra_tasks_space_${currentSpace?.id}`, JSON.stringify(updatedLogs));
      return updatedLogs;
    });
  };

  const handleUpdateTask = (updated: Task) => {
    const newTasks = tasks.map(t => t.id === updated.id ? updated : t);
    setTasks(newTasks);
    saveLogs(newTasks);
  };

  const handleDeleteTask = (id: number) => {
    const idx = tasks.findIndex(t => t.id === id);
    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);
    saveLogs(newTasks);
    if (idx > 0) setFocusedTaskId(newTasks[idx-1].id);
    else if (newTasks.length > 0) setFocusedTaskId(newTasks[0].id);
    else setFocusedTaskId(null);
  };

  const handleAddTask = (afterId?: number, isSecond: boolean = false, depth: number = 0) => {
    const newTask: Task = { id: Date.now(), text: '', status: 'LATER', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth, isSecond };
    let newTasks;
    if (afterId !== undefined) {
      const idx = tasks.findIndex(t => t.id === afterId);
      newTasks = [...tasks];
      newTasks.splice(idx + 1, 0, newTask);
    } else {
      newTasks = [...tasks, newTask];
    }
    setTasks(newTasks);
    saveLogs(newTasks);
    setFocusedTaskId(newTask.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over?.id);
      const newTasks = arrayMove(tasks, oldIndex, newIndex);
      setTasks(newTasks);
      saveLogs(newTasks);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => touchStart.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart.current - touchEnd;
    if (Math.abs(diff) > 100) {
      if (diff > 0) setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
      else setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    }
    touchStart.current = null;
  };

  const activeTask = useMemo(() => tasks.find(t => t.id === focusedTaskId), [tasks, focusedTaskId]);
  const currentMemo = useMemo(() => logs.find(l => l.date === viewDate.toDateString())?.memo || '', [logs, viewDate]);
  
  const planTasks = tasks.filter(t => !t.isSecond);
  const secondTasks = tasks.filter(t => t.isSecond);
  const doneCount = tasks.filter(t => t.status === 'DONE').length;
  const totalCount = tasks.length;
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30 font-sans overflow-x-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <div className="max-w-xl mx-auto min-h-screen flex flex-col p-4 pb-32">
        <div className="mb-4 flex justify-between items-center"><SpaceSelector /><button onClick={() => user ? signOut() : setShowAuthModal(true)} className="text-xs text-gray-500">{user ? 'Logout' : 'Login'}</button></div>
        
        {/* 캘린더 */}
        <div className="mb-8 bg-[#0f0f14]/80 backdrop-blur-md p-5 rounded-3xl border border-white/5 shadow-2xl">
           <div className="flex justify-between items-center mb-5 px-1">
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronLeft size={20} /></button>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">{viewDate.getFullYear()}</div>
                <div className="font-black text-lg">{viewDate.toLocaleString('default', { month: 'long' })}</div>
              </div>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronRight size={20} /></button>
           </div>
           <div className="grid grid-cols-7 gap-1">
              {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[10px] text-gray-600 font-bold py-1">{d}</div>)}
              {Array.from({length: 35}).map((_, i) => {
                const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
                d.setDate(d.getDate() + (i - d.getDay()));
                const isSelected = d.toDateString() === viewDate.toDateString();
                const isCurrentMonth = d.getMonth() === viewDate.getMonth();
                const log = logs.find(l => l.date === d.toDateString());
                const hasTasks = log && log.tasks.length > 0;
                const dailyRate = (log && log.tasks.length > 0) ? Math.round((log.tasks.filter(t => t.status === 'DONE').length / log.tasks.length) * 100) : 0;
                return (
                  <button key={i} onClick={() => setViewDate(d)} className={`h-11 rounded-xl text-xs flex flex-col items-center justify-center transition-all relative ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : isCurrentMonth ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700'}`}>
                    <span className="font-bold">{d.getDate()}</span>
                    {hasTasks && <div className={`mt-0.5 text-[8px] font-mono ${isSelected ? 'text-blue-100' : 'text-blue-500'}`}>{dailyRate}%</div>}
                  </button>
                )
              })}
           </div>
        </div>

        {/* 평가 및 메모 */}
        <div className="mb-10 text-center px-4">
          <div className="text-4xl font-black mb-1 flex items-baseline justify-center gap-1">
            {doneCount}<span className="text-xl text-gray-700 font-thin">/</span>{totalCount}
            <span className="text-lg text-blue-500 font-bold ml-1">{completionRate}%</span>
          </div>
          <AutoResizeTextarea value={currentMemo} onChange={(e: any) => saveLogs(tasks, e.target.value)} placeholder="+" className="w-full bg-transparent text-sm text-blue-400/80 font-medium text-center outline-none placeholder:text-gray-800" />
        </div>

        <div className="flex-1 space-y-12">
          {/* A SECOND */}
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4 px-3">
              <h2 className="text-[10px] font-black tracking-[0.2em] text-pink-500 uppercase flex items-center gap-2">
                <Clock size={14} className="animate-pulse" /> A SECOND
              </h2>
              <button onClick={() => setIsSecondVisible(!isSecondVisible)} className="text-gray-600 hover:text-gray-400 transition-colors p-1">{isSecondVisible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            </div>
            {isSecondVisible && (
              <div className="space-y-0.5">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={secondTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {secondTasks.map((task, idx) => (
                      <UnifiedTaskItem key={task.id} task={task} index={idx} allTasks={secondTasks} updateTask={handleUpdateTask} deleteTask={handleDeleteTask} focusedTaskId={focusedTaskId} setFocusedTaskId={setFocusedTaskId} logs={logs} onAddTask={handleAddTask} />
                    ))}
                  </SortableContext>
                </DndContext>
                <button onClick={() => handleAddTask(undefined, true)} className="w-full py-2.5 border border-dashed border-pink-500/10 rounded-2xl text-gray-700 hover:text-pink-500/40 transition-all flex items-center justify-center gap-2 text-[10px] font-bold mt-2 uppercase tracking-widest"><Plus size={12} /> Add Ritual</button>
              </div>
            )}
          </div>

          {/* PLAN (압박감 제거 버전) */}
          <div className="animate-in fade-in duration-700">
            <h2 className="text-[10px] font-black tracking-[0.2em] text-blue-500 uppercase mb-4 px-3 flex items-center gap-2"><List size={14} /> FLOW</h2>
            <div className="space-y-0.5">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={planTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {planTasks.map((task, idx) => (
                    <UnifiedTaskItem 
                      key={task.id} task={task} index={idx} allTasks={planTasks} updateTask={handleUpdateTask} deleteTask={handleDeleteTask} focusedTaskId={focusedTaskId} setFocusedTaskId={setFocusedTaskId} logs={logs} onAddTask={handleAddTask}
                      onIndent={() => { const actualIdx = tasks.findIndex(t => t.id === task.id); if (actualIdx > 0) { const prev = tasks[actualIdx-1]; handleUpdateTask({ ...task, depth: Math.min((prev.depth || 0) + 1, (task.depth || 0) + 1) }); } }}
                      onOutdent={() => handleUpdateTask({ ...task, depth: Math.max(0, (task.depth || 0) - 1) })}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <button onClick={() => handleAddTask(undefined, false)} className="w-full py-3.5 border border-dashed border-white/5 rounded-2xl text-gray-700 hover:text-gray-500 transition-all flex items-center justify-center gap-2 text-xs font-bold mt-3"><Plus size={14} /> NEW FLOW</button>
            </div>
          </div>
        </div>

        {/* 플로팅 컨트롤 바 */}
        {activeTask && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-[200] animate-in slide-in-from-bottom-8 duration-500 cubic-bezier(0.16, 1, 0.3, 1)">
            <div className="bg-[#1a1a1f]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => handleUpdateTask({ ...activeTask, isTimerOn: !activeTask.isTimerOn, timerStartTime: !activeTask.isTimerOn ? Date.now() : undefined })} className={`p-3 rounded-2xl transition-all ${activeTask.isTimerOn ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-110' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                  {activeTask.isTimerOn ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>
                <div className="h-10 w-px bg-white/10 mx-1" />
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Execution</span>
                  <input type="text" value={formatTime(activeTask.actTime)} onChange={(e) => handleUpdateTask({ ...activeTask, actTime: parseTimeToSeconds(e.target.value) })} className="bg-transparent text-sm font-black font-mono text-blue-400 outline-none w-20" />
                </div>
              </div>
              <div className="flex items-center gap-1 pr-1">
                <button onClick={() => setShowDatePicker(true)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"><Calendar size={18} /></button>
                <button onClick={() => setShowHistoryTarget(activeTask.text)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"><BarChart2 size={18} /></button>
                <button onClick={() => setFocusedTaskId(null)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"><X size={18} /></button>
              </div>
            </div>
          </div>
        )}

        {showDatePicker && activeTask && <DatePickerModal onSelectDate={(date) => {
          const targetDate = date.toDateString();
          const currentDate = viewDate.toDateString();
          if (targetDate !== currentDate) {
            setLogs(prev => {
              const updated = [...prev];
              const currentIdx = updated.findIndex(l => l.date === currentDate);
              const targetIdx = updated.findIndex(l => l.date === targetDate);
              const taskToMove = { ...activeTask, id: Date.now() };
              if (currentIdx >= 0) updated[currentIdx] = { ...updated[currentIdx], tasks: updated[currentIdx].tasks.filter(t => t.id !== activeTask.id) };
              if (targetIdx >= 0) updated[targetIdx] = { ...updated[targetIdx], tasks: [...updated[targetIdx].tasks, taskToMove] };
              else updated.push({ date: targetDate, tasks: [taskToMove], memo: '' });
              return updated;
            });
            setTasks(prev => prev.filter(t => t.id !== activeTask.id));
            setFocusedTaskId(null);
          }
          setShowDatePicker(false);
        }} onClose={() => setShowDatePicker(false)} />}
        {showHistoryTarget && <TaskHistoryModal taskName={showHistoryTarget} logs={logs} onClose={() => setShowHistoryTarget(null)} />}
      </div>
    </div>
  );
}
