// -----------------------------------------------------------------------------
// [개발 원칙 및 주의사항] (Project Manifesto Audit)
// 1. 기능 보존 원칙: 기존 기능(단축키, 다중 선택, 드래그 등)은 명시적인 제거 요청이 없다면 
//    절대 삭제되거나 비활성화되어서는 안 된다. 리팩토링 시 반드시 기존 로직을 이식해야 한다.
//    - 특히 Shift+Click, Alt+Arrow 등의 파워 유저 기능은 필수적으로 유지되어야 함.
// 2. UX 연속성: 텍스트 입력, 포커스 이동, 커서 위치 등 미세한 UX는 
//    사용자의 '근육 기억'과 연결되므로 함부로 변경하지 않는다. (예: 백스페이스 병합 시 포커스)
// 3. 데이터 무결성: 날짜 이동, 동기화 과정에서 데이터가 유실되거나 덮어씌워지지 않도록 
//    이중, 삼중의 안전 장치(Date Guard)를 유지한다.
// 4. 컴포넌트 분리 주의: 컴포넌트를 분리하거나 최적화(React.memo 등)할 때 
//    상위 상태 의존성(props)이 누락되지 않도록 철저히 검토한다. 
//    (예: onTaskClick이 tasks 상태를 참조해야 한다면 의존성 배열에 포함하거나 함수형 업데이트 사용)
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSpace } from './contexts/SpaceContext';
import { AuthModal } from './components/AuthModal';
import { SpaceSelector } from './components/SpaceSelector';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, BarChart2, X, Check, ChevronLeft, ChevronRight, Plus, ArrowRight, ArrowLeft, Calendar, HelpCircle, ChevronDown, Trash2, GripVertical, Copy } from 'lucide-react';
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
const AutoResizeTextarea = React.memo(({ value, onChange, onKeyDown, onFocus, onBlur, onPaste, placeholder, autoFocus, className, inputRef }: any) => {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const combinedRef = inputRef || localRef;

  // 높이 조절
  useLayoutEffect(() => {
    if (combinedRef.current) {
      combinedRef.current.style.height = 'auto';
      combinedRef.current.style.height = combinedRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // 포커스 관리 (초기 마운트 및 isFocused 변경 시)
  useLayoutEffect(() => {
    if (autoFocus && combinedRef.current) {
        combinedRef.current.focus({ preventScroll: true });
        
        // [Hack] 커서 위치 복구 (Merge 동작 후)
        const restorePos = (window as any).__restoreCursorPos;
        if (typeof restorePos === 'number') {
            combinedRef.current.setSelectionRange(restorePos, restorePos);
            (window as any).__restoreCursorPos = undefined;
        }
    }
  }, [autoFocus, value]);

  return (
    <textarea
      ref={combinedRef}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPaste={onPaste}
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
    <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div><h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase mb-1">TASK HISTORY</h2><h1 className="text-xl font-black text-white">"{taskName}"</h1></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
        </div>
        <div className="flex justify-between items-center mb-4 px-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={20} className="text-gray-400" /></button>
          <span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={20} className="text-gray-400" /></button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['S','M','T','W','T','F','S'].map((d, idx) => <div key={`weekday-${idx}`} className="text-center text-[10px] text-gray-400">{d}</div>)}
          {days.map((d: any, i) => {
            if (!d) return <div key={i} />;
            const dateStr = d.toDateString();
            const record = historyMap.get(dateStr);
            return <div key={i} className={`aspect-square rounded-lg border flex items-center justify-center relative ${record ? 'bg-blue-900 border-blue-500' : 'bg-zinc-800 border-transparent'} ${dateStr === today.toDateString() ? 'ring-1 ring-white' : ''}`}><span className={`text-xs ${record ? 'text-white font-black' : 'text-gray-500 font-bold'}`}>{d.getDate()}</span></div>;
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
  onOutdent: (taskId: number) => void,
  onMoveUp: (taskId: number) => void,
  onMoveDown: (taskId: number) => void
}) => {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const isFocused = focusedTaskId === task.id;
  const isSelected = selectedTaskIds.has(task.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useLayoutEffect(() => {
    if (isFocused && textareaRef.current) {
       textareaRef.current.focus({ preventScroll: true });
    }
  }, [task.depth, isFocused]);

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

    // Ctrl + Enter: Toggle Completion
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      updateTask(task.id, { status: newStatus, isTimerOn: false });
      return;
    }

    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textBefore = taskName.substring(0, cursorPos);
        const textAfter = taskName.substring(cursorPos);
        
        const numberMatch = textBefore.match(/^(\d+)\.\s/);
        const bulletMatch = textBefore.match(/^-\s/);
        
        let newTextAfter = textAfter;
        let prefixLen = 0;
        if (numberMatch) {
            const currentNum = parseInt(numberMatch[1], 10);
            const prefix = `${currentNum + 1}. `;
            newTextAfter = `${prefix}${textAfter}`;
            prefixLen = prefix.length;
        } else if (bulletMatch) {
            const prefix = `- `;
            newTextAfter = `${prefix}${textAfter}`;
            prefixLen = prefix.length;
        }

        if (prefixLen > 0) {
            (window as any).__restoreCursorPos = prefixLen;
        }

        onAddTaskAtCursor(task.id, textBefore, newTextAfter);
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
    
    // Alt or Ctrl + Arrows for reordering
    if (e.altKey || e.ctrlKey) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            onMoveUp(task.id);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            onMoveDown(task.id);
            return;
        }
    }
    
    // Ctrl + Space: Toggle Completion
    if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) { 
      e.preventDefault(); 
      const newStatus = task.status === 'completed' ? 'pending' : 'completed'; 
      updateTask(task.id, { status: newStatus, isTimerOn: false }); 
    }
    
    // Shift + Space: Toggle Timer
    if (e.shiftKey && (e.key === ' ' || e.code === 'Space')) {
      e.preventDefault();
      updateTask(task.id, { isTimerOn: !task.isTimerOn, timerStartTime: !task.isTimerOn ? Date.now() : undefined });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes('\n')) {
      e.preventDefault();
      if (window.confirm("Do you want to split this into multiple tasks?")) {
         const lines = text.split('\n');
         const firstLine = lines[0];
         const restLines = lines.slice(1);
         const currentText = task.name || task.text || '';
         const cursor = e.currentTarget.selectionStart;
         const textBefore = currentText.substring(0, cursor);
         const textAfter = currentText.substring(cursor);
         
         onAddTaskAtCursor(task.id, textBefore + firstLine, restLines.join('\n') + textAfter);
      } else {
         const currentText = task.name || task.text || '';
         const cursor = e.currentTarget.selectionStart;
         const newVal = currentText.substring(0, cursor) + text + currentText.substring(cursor);
         updateTask(task.id, { name: newVal, text: newVal });
         setTimeout(() => {
             if (textareaRef.current) {
                 textareaRef.current.selectionStart = textareaRef.current.selectionEnd = cursor + text.length;
             }
         }, 0);
      }
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
    updateTask(task.id, { name: newVal, text: newVal });
  }, [task.id, updateTask]);

  return (
    <div ref={setNodeRef} style={style} className={`relative group flex items-start gap-2 py-0 px-6 transition-colors ${isFocused ? 'bg-white/[0.04]' : ''} ${isSelected ? 'bg-[#7c4dff]/10' : ''}`} onTouchStart={handleItemTouchStart} onTouchEnd={handleItemTouchEnd}>
       {/* Selection Border Indicator (Absolute to avoid layout shift) */}
       <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-colors ${isSelected ? 'bg-[#7c4dff]' : 'bg-transparent'}`} />
       
       <div className="absolute left-0 top-[5px] flex items-center justify-center w-5 h-6 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-400 transition-opacity z-20" {...attributes} {...listeners}>
         <GripVertical size={14} />
       </div>

      {currentDepth > 0 && (
        <div className="flex flex-shrink-0" style={{ width: `${currentDepth * 24}px` }} onClick={(e) => onTaskClick(e, task.id, index)}>
            {Array.from({ length: currentDepth }).map((_, i) => (
            <div key={i} className="h-full border-r border-white/10" style={{ width: '24px' }} />
            ))}
        </div>
      )}
      <div className="flex flex-col items-center justify-start mt-[7px]">
        <button onClick={() => { const newStatus = task.status === 'completed' ? 'pending' : 'completed'; updateTask(task.id, { status: newStatus, isTimerOn: false }); }} className={`flex-shrink-0 w-[15px] h-[15px] border-[1.2px] rounded-[3px] flex items-center justify-center transition-all ${getStatusColor()}`}>
          {task.status === 'completed' && <Check size={11} className="text-white stroke-[3]" />}
          {task.isTimerOn && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
        </button>
      </div>
      <div className="flex-1 relative" onClick={(e) => onTaskClick(e, task.id, index)}>
        <AutoResizeTextarea 
            inputRef={textareaRef} 
            value={task.name || task.text || ''} 
            autoFocus={isFocused} 
            onFocus={() => setFocusedTaskId(task.id)} 
            onChange={handleTextChange} 
            onKeyDown={handleKeyDown} 
            onPaste={handlePaste}
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
      <div className="flex items-center gap-1.5 mt-[4px]">
        {task.actTime !== undefined && task.actTime > 0 && <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap">{formatTimeShort(task.actTime)}</span>}
      </div>
    </div>
  );
});

// --- 유틸리티: 데이터 마이그레이션 및 평탄화 ---
const migrateTasks = (tasks: any[]): Task[] => {
  if (!Array.isArray(tasks)) {
    console.warn('migrateTasks: tasks is not an array', tasks);
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

// --- 메인 앱 ---

export default function App() {
  const { user, signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef(tasks);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
      const ids = tasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
          console.error('[CRITICAL] Duplicate IDs detected in tasks state!', ids);
          const seen = new Set();
          const deduped: Task[] = [];
          tasks.forEach(t => {
              if (!seen.has(t.id)) {
                  seen.add(t.id);
                  deduped.push(t);
              }
          });
      }
  }, [tasks, viewDate]);

  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);

  const [showHistoryTarget, setShowHistoryTarget] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localLogsLoaded, setLocalLogsLoaded] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { currentSpace, spaces, setCurrentSpace } = useSpace();
  const [logs, setLogs] = useState<DailyLog[]>([]);

  const logsRef = useRef(logs);
  const viewDateRef = useRef(viewDate);

  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { viewDateRef.current = viewDate; }, [viewDate]);
  
  const [history, setHistory] = useState<Task[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUpdate = useRef(false);
  const lastLocalChange = useRef(Date.now()); 
  const swipeTouchStart = useRef<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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

  useEffect(() => {
    if (!localLogsLoaded || !currentSpace) return;
    
    const dateStr = viewDate.toDateString();
    
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

        localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(newLogs));
        return newLogs;
    });

    if (!isInternalUpdate.current) {
        setHistory(prev => {
            const newHistory = [...prev.slice(0, historyIndex + 1), tasks];
            if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }

    lastLocalChange.current = Date.now();

    if (viewDateRef.current.toDateString() !== dateStr) {
        return;
    }
    
  }, [tasks]);

  const handleUpdateTask = useCallback((taskId: number, updates: Partial<Task>) => {
    setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, ...updates } : t);
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
        percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: current.depth || 0, space_id: String(currentSpace?.id || ''),
      }));
      const next = [...prev];
      next[idx] = { ...current, name: textBefore, text: textBefore };
      next.splice(idx + 1, 0, ...newTasksToAdd);
      
      if (newTasksToAdd.length > 0) {
        setFocusedTaskId(newTasksToAdd[0].id);
      }
      saveToSupabase(next);
      return next;
    });
  }, [currentSpace, saveToSupabase]);

  const handleMergeWithPrevious = useCallback((taskId: number, currentText: string) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx === -1) return prev;
      
      if (idx > 0) {
        const prevTask = prev[idx - 1];
        const next = [...prev];
        const newPos = (prevTask.name || '').length;
        
        next[idx - 1] = { 
            ...prevTask, 
            name: (prevTask.name || '') + (currentText || ''), 
            text: (prevTask.text || '') + (currentText || '') 
        };
        next.splice(idx, 1);
        
        setFocusedTaskId(prevTask.id);
        (window as any).__restoreCursorPos = newPos;

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
      if (idx === -1 || idx >= prev.length - 1) return prev;
      
      const current = prev[idx];
      const nextTask = prev[idx + 1];
      const next = [...prev];
      
      next[idx] = { ...current, name: (current.name || '') + (nextTask.name || ''), text: (current.text || '') + (nextTask.text || '') };
      next.splice(idx + 1, 1);
      
      saveToSupabase(next);
      return next;
    });
  }, [saveToSupabase]);

  const handleIndent = useCallback((taskId: number) => {
    setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, depth: (t.depth || 0) + 1 } : t);
        saveToSupabase(next);
        return next;
    });
    setFocusedTaskId(taskId);
  }, [saveToSupabase]);

  const handleOutdent = useCallback((taskId: number) => {
    setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, depth: Math.max(0, (t.depth || 0) - 1) } : t);
        saveToSupabase(next);
        return next;
    });
    setFocusedTaskId(taskId);
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

  const handleMoveUp = useCallback((taskId: number) => {
    setTasks(prev => {
      const index = prev.findIndex(t => t.id === taskId);
      if (index <= 0) return prev;
      
      const newTasks = [...prev];
      [newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]];
      
      saveToSupabase(newTasks);
      return newTasks;
    });
  }, [saveToSupabase]);

  const handleMoveDown = useCallback((taskId: number) => {
    setTasks(prev => {
      const index = prev.findIndex(t => t.id === taskId);
      if (index < 0 || index >= prev.length - 1) return prev;
      
      const newTasks = [...prev];
      [newTasks[index + 1], newTasks[index]] = [newTasks[index], newTasks[index + 1]];
      
      saveToSupabase(newTasks);
      return newTasks;
    });
  }, [saveToSupabase]);

  useEffect(() => {
    if (currentSpace) {
      setLocalLogsLoaded(false);
      const saved = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
      let currentLogs: DailyLog[] = [];
      if (saved) { 
          try { 
              currentLogs = JSON.parse(saved).map((log: any) => ({ ...log, tasks: migrateTasks(log.tasks) })); 
          } catch (e) {
              console.error('[DEBUG] Failed to parse localStorage', e);
          } 
      }
      const dateStr = viewDate.toDateString();
      let log = currentLogs.find(l => l.date === dateStr);
      if (!log) {
        log = { date: dateStr, tasks: [], memo: '' };
        currentLogs.push(log);
        localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(currentLogs));
      }
      
      const corrupted = log.tasks.filter(t => !t.name && !t.text);
      if (corrupted.length > 0) {
          log.tasks = log.tasks.filter(t => t.name || t.text);
      }

      setLogs(currentLogs);
      if (log) { 
          isInternalUpdate.current = true;
          setTasks(log.tasks); 
          setHistory([log.tasks]); 
          setHistoryIndex(0); 
          setTimeout(() => isInternalUpdate.current = false, 100);
      }
      
      setLocalLogsLoaded(true);
      setTimeout(() => setIsLoading(false), 50);
    }
  }, [currentSpace, viewDate]);

  useEffect(() => {
    if (!user || !currentSpace) return;
    
    const loadFromSupabase = async () => {
      const targetDateStr = viewDateRef.current.toDateString();
      
      try {
        const { data, error } = await supabase
          .from('task_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('space_id', currentSpace.id);

        if (error) {
          return;
        }

        if (targetDateStr !== viewDateRef.current.toDateString()) return;

        if (data && data.length > 0) {
          const serverLogs = data.map((row: any) => ({
            date: row.date,
            tasks: migrateTasks(typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks),
            memo: row.memo
          }));

          setLogs(prevLogs => {
            if (viewDateRef.current.toDateString() !== targetDateStr) return prevLogs;

            const logMap = new Map(prevLogs.map(l => [l.date, l]));
            let hasChanges = false;
            
            serverLogs.forEach(serverLog => {
              if (serverLog.date === 'SETTINGS') return;

              const localLog = logMap.get(serverLog.date);
              
              if (!localLog) {
                logMap.set(serverLog.date, serverLog);
                hasChanges = true;
              } 
              else if (localLog.tasks.length === 0 && serverLog.tasks.length > 0) {
                logMap.set(serverLog.date, serverLog);
                hasChanges = true;
              }
              else {
                  const simplify = (ts: Task[]) => ts.map(t => ({ id: t.id, name: t.name, status: t.status, depth: t.depth }));
                  const localSimple = JSON.stringify(simplify(localLog.tasks));
                  const serverSimple = JSON.stringify(simplify(serverLog.tasks));
                  
                  if (localSimple !== serverSimple) {
                      logMap.set(serverLog.date, serverLog);
                      hasChanges = true;
                  }
              }
            });

            if (!hasChanges) return prevLogs;

            const mergedLogs = Array.from(logMap.values());
            localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(mergedLogs));
            
            if (targetDateStr !== viewDateRef.current.toDateString()) return prevLogs;

            const currentViewLog = mergedLogs.find(l => l.date === viewDateRef.current.toDateString());
            if (currentViewLog) {
               setTasks(currentTasks => {
                   if (targetDateStr !== viewDateRef.current.toDateString()) return currentTasks;

                   const simplify = (ts: Task[]) => ts.map(t => ({ id: t.id, name: t.name, status: t.status, depth: t.depth }));
                   const localSimple = JSON.stringify(simplify(currentTasks));
                   const serverSimple = JSON.stringify(simplify(currentViewLog.tasks));

                   if (localSimple !== serverSimple) {
                       isInternalUpdate.current = true;
                       setTimeout(() => isInternalUpdate.current = false, 100);
                       return currentViewLog.tasks;
                   }
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
    
    const channel = supabase.channel(`realtime_tasks_${currentSpace.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_logs', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (Date.now() - lastLocalChange.current < 2000) return;

        if (payload.new && payload.new.space_id === currentSpace.id) {
          const serverLog = { date: payload.new.date, tasks: migrateTasks(JSON.parse(payload.new.tasks)), memo: payload.new.memo };
          if (serverLog.date === 'SETTINGS') return;
          
          if (serverLog.date === viewDateRef.current.toDateString()) {
              isInternalUpdate.current = true;
              setTasks(prev => {
                  if (serverLog.date !== viewDateRef.current.toDateString()) return prev;
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
      
    return () => { supabase.removeChannel(channel); };
  }, [user, currentSpace, viewDate]);

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
  }, []);

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

  const onTaskClickWithRange = useCallback((e: React.MouseEvent, taskId: number, index: number) => {
      const currentTasks = tasksRef.current;
      
      // Removed restrictions on TEXTAREA to allow Shift+Click for range selection
      // if (['TEXTAREA', 'INPUT'].includes(target.tagName)) {
      //    if (e.shiftKey) return;
      // }

      if (e.shiftKey && selectedTaskIds.size > 0) {
          const allIds = currentTasks.map(t => t.id);
          const endIdx = allIds.indexOf(taskId);
          const selectedIndices = allIds.map((id, idx) => selectedTaskIds.has(id) ? idx : -1).filter(i => i !== -1);
          
          if (selectedIndices.length > 0) {
              const min = Math.min(...selectedIndices, endIdx);
              const max = Math.max(...selectedIndices, endIdx);
              const rangeIds = allIds.slice(min, max + 1);
              setSelectedTaskIds(new Set(rangeIds));
          } else {
              setSelectedTaskIds(new Set([taskId]));
          }
      } else if (e.ctrlKey || e.metaKey) {
          setSelectedTaskIds(prev => {
              const newSet = new Set(prev);
              if (newSet.has(taskId)) newSet.delete(taskId); else newSet.add(taskId);
              return newSet;
          });
          lastClickedIndex.current = index;
      } else {
          // If simply clicking, usually we just focus, but if we want to allow multiselect reset:
          if (selectedTaskIds.size > 1) {
             setSelectedTaskIds(new Set([taskId]));
          } else if (selectedTaskIds.size === 1 && selectedTaskIds.has(taskId)) {
             // Already selected, do nothing (allow focus)
          } else {
             setSelectedTaskIds(new Set([taskId]));
          }
          lastClickedIndex.current = index;
      }
  }, [selectedTaskIds]);

  const handleSpaceChange = useCallback((space: any) => { setCurrentSpace(space); }, [setCurrentSpace]);

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
  const currentLog = logs.find(l => l.date === viewDate.toDateString());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // 통계 계산
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const showBulkActions = selectedTaskIds.size > 1;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-x-hidden">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <div className="max-w-xl mx-auto min-h-screen flex flex-col p-4">
        <div className="mb-4 flex justify-between items-center">
            <SpaceSelector onSpaceChange={handleSpaceChange} />
            <div className="flex gap-3 items-center">
                {isLoading && <div className="text-xs text-blue-500 animate-pulse font-bold">LOADING...</div>}
                <button onClick={() => setViewDate(new Date())} className="text-gray-500 hover:text-white p-1 text-xs font-bold border border-gray-700 rounded px-2">TODAY</button>
                <button onClick={() => setShowShortcuts(!showShortcuts)} className="text-gray-500 hover:text-white p-1"><HelpCircle size={18} /></button>
                <button onClick={() => user ? signOut() : setShowAuthModal(true)} className="text-xs text-gray-500 hover:text-white">{user ? 'Logout' : 'Login'}</button>
            </div>
        </div>
        
        {/* 달력 영역 */}
        <div className={`calendar-area mb-4 bg-[#0f0f14] p-5 rounded-3xl border border-white/5 shadow-2xl transition-opacity duration-200 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`} onTouchStart={(e) => swipeTouchStart.current = e.touches[0].clientX} onTouchEnd={(e) => { if (swipeTouchStart.current === null) return; const diff = swipeTouchStart.current - e.changedTouches[0].clientX; if (Math.abs(diff) > 100) setViewDate(new Date(year, month + (diff > 0 ? 1 : -1), 1)); swipeTouchStart.current = null; }}>
           <div className="flex justify-between items-center mb-5 px-1"><button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronLeft size={22} /></button><div className="text-center cursor-pointer" onClick={() => setViewDate(new Date())}><div className="text-[11px] text-gray-500 uppercase tracking-widest font-bold">{year}</div><div className="font-black text-xl text-white">{viewDate.toLocaleString('default', { month: 'long' })}</div></div><button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-white/5 rounded-full text-gray-400"><ChevronRight size={22} /></button></div>
           <div className="grid grid-cols-7 gap-1">{['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-center text-[10px] text-gray-600 font-black py-1">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { 
               const d = new Date(year, month, 1); 
               d.setDate(d.getDate() + (i - d.getDay())); 
               const l = logs.find(log => log.date === d.toDateString());
               
               const hasCompleted = l?.tasks.some(t => t.status === 'completed');
               const isToday = d.toDateString() === new Date().toDateString();
               const isSelected = d.toDateString() === viewDate.toDateString();

               // [Calendar Streak Logic]
               const getStreak = (currentDate: Date) => {
                   if (!hasCompleted) return 0;
                   let streak = 1;
                   let checkDate = new Date(currentDate);
                   checkDate.setDate(checkDate.getDate() - 1);
                   // Safety break to prevent infinite loops (though unlikely with date math)
                   for(let k=0; k<365; k++) { 
                       const checkLog = logs.find(l => l.date === checkDate.toDateString());
                       if (checkLog?.tasks.some(t => t.status === 'completed')) {
                           streak++;
                           checkDate.setDate(checkDate.getDate() - 1);
                       } else {
                           break;
                       }
                   }
                   return streak;
               };

               const streakCount = getStreak(d);
               
               // [Calendar Style Logic]
               let btnClass = "h-11 rounded-xl text-xs flex flex-col items-center justify-center relative transition-all border-2 w-full ";
               
               // Border logic
               if (isSelected) btnClass += "border-[#7c4dff] z-10 ";
               else btnClass += "border-transparent ";

               // Today Ring (Inner)
               if (isToday) btnClass += "ring-2 ring-inset ring-blue-500 ";

               // Background & Text logic
               if (hasCompleted) {
                 // Intensity based on streak
                 // Streak 1: 20%, 2: 40%, 3: 60%, 4: 80%, 5+: 100%
                 // const opacity = Math.min(20 + (streakCount - 1) * 20, 90); 
                 // Using style attribute for dynamic opacity might be cleaner, but let's try strict classes if possible or inline style.
                 // Tailwind arbitrary values support: bg-[#39ff14]/[0.2]
                 // Let's just use inline styles for the background to be precise, or map to classes.
                 // Mapping to classes is safer for now.
                 const opacityClass = 
                    streakCount <= 1 ? "bg-[#39ff14]/20" :
                    streakCount === 2 ? "bg-[#39ff14]/40" :
                    streakCount === 3 ? "bg-[#39ff14]/60" :
                    streakCount === 4 ? "bg-[#39ff14]/80" :
                    "bg-[#39ff14]";
                 
                 btnClass += `${opacityClass} `; 

                 if (isSelected) btnClass += "text-white shadow-[0_0_15px_rgba(57,255,20,0.3)] ";
                 else if (streakCount >= 3) btnClass += "text-black font-bold ";
                 else btnClass += "text-white font-bold ";
               } else {
                 if (isSelected) btnClass += "bg-[#7c4dff] text-white ";
                 else if (isToday) btnClass += "bg-blue-500/20 text-blue-400 font-bold ";
                 else if (d.getMonth() !== month) btnClass += "text-gray-700 opacity-30 ";
                 else btnClass += "text-gray-400 hover:bg-white/5 ";
               }

               return (
                <div key={i} className="relative">
                  <button onClick={() => {
                   setViewDate(d);
                  }} className={btnClass}>
                    <span className="font-black text-[14px]">{d.getDate()}</span>
                    {hasCompleted && streakCount > 1 && (
                        <div className="absolute top-0.5 right-1 flex items-center gap-0.5 opacity-80">
                             <span className="text-[8px] font-black">{streakCount}</span>
                        </div>
                    )}
                    {l && l.tasks.length > 0 && <div className={`mt-0.5 text-[9px] font-black ${isSelected ? 'text-white/80' : (hasCompleted && streakCount >= 3) ? 'text-black/70' : hasCompleted ? 'text-[#39ff14] mix-blend-screen' : 'text-gray-500'}`}>{Math.round((l.tasks.filter(t => t.status === 'completed').length / l.tasks.length) * 100)}%</div>}
                  </button>
                </div>
               );
           })}</div>
        </div>

        {/* 메인 통계 및 메모 영역 */}
        <div className="px-6 mb-6">
            <div className="flex items-end justify-between mb-2">
                <div>
                    <span className="text-4xl font-black text-white leading-none tracking-tight">{completedTasks} <span className="text-gray-600">/</span> <span className="text-gray-500">{totalTasks}</span></span>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-[#7c4dff]">{progressPercent}% DONE</div>
                </div>
            </div>
            <div className="h-1.5 w-full bg-[#1a1a1f] rounded-full overflow-hidden mb-4">
                <div className="h-full bg-[#7c4dff] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <AutoResizeTextarea value={currentLog?.memo || ''} onChange={(e: any) => { const newMemo = e.target.value; setLogs(prev => prev.map(l => l.date === viewDate.toDateString() ? { ...l, memo: newMemo } : l)); }} placeholder="M E M O" className="w-full bg-transparent text-[16px] text-[#7c4dff]/80 font-bold text-center outline-none" />
        </div>

        <div className={`flex-1 space-y-8 pb-48 transition-opacity duration-200 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
              <div className="flex items-center justify-between mb-2 px-6">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { const n: Task = { id: Date.now(), name: '', status: 'pending', indent: 0, parent: null, space_id: String(currentSpace?.id || ''), text: '', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, depth: 0 }; setTasks(prev => [...prev, n]); setFocusedTaskId(n.id); }} className="text-gray-500 hover:text-[#7c4dff]"><Plus size={18} /></button>
                  </div>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {tasks.map((t, i) => (
                          <UnifiedTaskItem 
                              key={t.id} 
                              task={t} 
                              index={i} 
                              updateTask={handleUpdateTask} 
                              setFocusedTaskId={setFocusedTaskId} 
                              focusedTaskId={focusedTaskId} 
                              selectedTaskIds={selectedTaskIds} 
                              onTaskClick={onTaskClickWithRange} 
                              logs={logs} 
                              onAddTaskAtCursor={handleAddTaskAtCursor} 
                              onMergeWithPrevious={handleMergeWithPrevious} 
                              onMergeWithNext={handleMergeWithNext} 
                              onIndent={handleIndent} 
                              onOutdent={handleOutdent} 
                              onMoveUp={handleMoveUp}
                              onMoveDown={handleMoveDown}
                          />
                      ))}
                  </SortableContext>
              </DndContext>
          </div>
        </div>

        {(activeTask || showBulkActions) && (
          <div className="fixed bottom-6 left-0 right-0 z-[500] flex justify-center px-4">
              <div className="bg-[#121216]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 flex items-center justify-start gap-2 max-w-full overflow-x-auto no-scrollbar scroll-smooth shadow-2xl">
                  {showBulkActions ? (
                     <>
                        <div className="px-4 font-bold text-white whitespace-nowrap flex items-center gap-2">
                           <div className="bg-[#7c4dff] text-white text-[10px] font-black px-1.5 py-0.5 rounded">{selectedTaskIds.size}</div>
                           <span className="text-sm">Selected</span>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-1" />
                        <button onClick={() => {
                            const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
                            const text = selectedTasks.map(t => t.name || t.text || '').join('\n');
                            navigator.clipboard.writeText(text);
                            alert(`Copied ${selectedTasks.length} tasks`);
                            setSelectedTaskIds(new Set());
                        }} className="p-3 hover:bg-white/10 rounded-2xl text-gray-300 font-bold text-sm px-4 flex items-center gap-2">
                           <Copy size={16} /> Copy
                        </button>
                        <button onClick={() => {
                            if(confirm(`Delete ${selectedTaskIds.size} tasks?`)) {
                                 setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
                                 setSelectedTaskIds(new Set());
                            }
                        }} className="p-3 hover:bg-white/10 rounded-2xl text-red-500 font-bold text-sm px-4 flex items-center gap-2">
                           <Trash2 size={16} /> Delete
                        </button>
                        <div className="h-8 w-px bg-white/10 mx-1" />
                        <button onClick={() => setSelectedTaskIds(new Set())} className="p-3 hover:bg-white/10 rounded-2xl text-gray-400"><X size={20} /></button>
                     </>
                  ) : (
                    activeTask && (
                      <>
                        <div className="flex items-center gap-2 flex-shrink-0 pl-1">
                            <button onClick={() => handleUpdateTask(activeTask.id, { isTimerOn: !activeTask.isTimerOn, timerStartTime: !activeTask.isTimerOn ? Date.now() : undefined })} className={`p-3.5 rounded-2xl transition-all ${activeTask.isTimerOn ? 'bg-[#7c4dff] text-white' : 'bg-white/5 text-gray-400'}`}>{activeTask.isTimerOn ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</button>
                            <div className="flex flex-col ml-1"><span className="text-[9px] text-gray-500 font-black uppercase text-center">Execution</span><input type="text" value={formatTimeFull(activeTask.actTime || 0)} onChange={(e) => handleUpdateTask(activeTask.id, { actTime: parseTimeToSeconds(e.target.value) })} className="bg-transparent text-[18px] font-black font-mono text-[#7c4dff] outline-none w-24 text-center" /></div>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                        <div className="flex items-center gap-0.5 flex-shrink-0"><button onClick={() => handleOutdent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowLeft size={18} /></button><button onClick={() => handleIndent(activeTask.id)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ArrowRight size={18} /></button></div>
                        <div className="h-8 w-px bg-white/10 mx-1 flex-shrink-0" />
                        <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
                            <button onClick={() => setShowDatePicker(true)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><Calendar size={18} /></button>
                            <button onClick={() => setShowHistoryTarget(activeTask.name || '')} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><BarChart2 size={18} /></button>
                            <button onClick={() => { if (window.confirm("Delete this task?")) { setTasks(prev => prev.filter(t => t.id !== activeTask.id)); setFocusedTaskId(null); } }} className="p-2.5 rounded-xl hover:bg-white/5 text-red-500"><Trash2 size={18} /></button>
                            <button onClick={() => setFocusedTaskId(null)} className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400"><ChevronDown size={18} /></button>
                        </div>
                      </>
                    )
                  )}
              </div>
          </div>
        )}
        
        {/* 모달 및 기타 UI들 */}
        {showDatePicker && activeTask && <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowDatePicker(false)}><div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button><span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button></div><div className="grid grid-cols-7 gap-2">{['S','M','T','W','T','F','S'].map((d, idx) => <div key={`day-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}{Array.from({ length: 35 }).map((_, i) => { const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1); d.setDate(d.getDate() + (i - d.getDay())); return <button key={i} onClick={() => { const targetDate = d.toDateString(); if (targetDate !== viewDate.toDateString()) { const taskToMove = activeTask; setTasks(prev => prev.filter(t => t.id !== activeTask.id)); setLogs(prev => { const newLogs = [...prev]; const targetLogIndex = newLogs.findIndex(l => l.date === targetDate); if (targetLogIndex >= 0) { newLogs[targetLogIndex].tasks.push(taskToMove); } else { newLogs.push({ date: targetDate, tasks: [taskToMove], memo: '' }); } return newLogs; }); setFocusedTaskId(null); } setShowDatePicker(false); }} className={`aspect-square rounded-lg border flex items-center justify-center ${d.toDateString() === new Date().toDateString() ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}`}><span className="text-sm">{d.getDate()}</span></button>; })}</div></div></div>}
        {showHistoryTarget && <TaskHistoryModal taskName={showHistoryTarget} logs={logs} onClose={() => setShowHistoryTarget(null)} />}
        {showShortcuts && (
          <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
            <div className="bg-[#0a0a0f]/90 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
                <button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-white"><X /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center"><span className="text-gray-400">Add Task</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Enter</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">New Line</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Shift + Enter</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Toggle Status</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Enter</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Toggle Status</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Space</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Toggle Timer</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Shift + Space</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Indent / Outdent</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Tab / Shift + Tab</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Move Up / Down</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Alt/Ctrl + ↑ / ↓</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Delete Task</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Backspace (Empty)</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Undo</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Z</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Redo</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Ctrl + Shift + Z</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Switch Space</span><kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">Alt + 1~9</kbd></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
