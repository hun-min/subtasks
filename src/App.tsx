import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './contexts/AuthContext';
import { useSpace } from './contexts/SpaceContext';
import { AuthModal } from './components/AuthModal';
import { SpaceSelector } from './components/SpaceSelector';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, BarChart2, X, Check, ChevronLeft, ChevronRight, Plus, Flame, Calendar, Trash2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';

// --- 데이터 타입 ---
type TaskStatus = 'LATER' | 'NOW' | 'DONE';

type Task = {
  id: number;
  text: string;
  status: TaskStatus;
  done?: boolean; // 구버전 호환용
  percent: number;      
  planTime: number;     
  actTime: number;      
  isTimerOn: boolean;
  timerStartTime?: number;
  parentId?: number;
  subtasks?: Task[];
  depth?: number;
};

type DailyLog = {
  date: string;
  tasks: Task[];
};

// --- [컴포넌트] 자동 높이 조절 Textarea ---
const AutoResizeTextarea = ({ value, onChange, onKeyDown, placeholder, autoFocus, className }: any) => {
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
      placeholder={placeholder}
      className={`resize-none overflow-hidden bg-transparent outline-none ${className}`}
      style={{ minHeight: '24px' }}
    />
  );
};





// --- [컴포넌트] 태스크 히스토리 모달 (새로 추가됨) ---
function TaskHistoryModal({ taskName, logs, onClose }: { taskName: string, logs: DailyLog[], onClose: () => void }) {
  // 오늘 기준 달력 생성
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date());
  
  // 해당 태스크의 과거 기록 찾기 (이름 일치)
  const historyMap = new Map();
  logs.forEach(log => {
    const found = log.tasks.find(t => t.text.trim() === taskName.trim());
    if (found) {
      historyMap.set(log.date, {
        task: found,
        subtasks: found.subtasks || []
      });
    }
  });

  // 달력 데이터 생성
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: firstDay }).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-sm text-gray-400 font-bold tracking-widest uppercase mb-1">TASK HISTORY</h2>
            <h1 className="text-xl font-black text-white">"{taskName}"</h1>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X /></button>
        </div>

        {/* 달력 헤더 */}
        <div className="flex justify-between items-center mb-4 px-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button>
          <span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button>
        </div>

        {/* 달력 그리드 */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {['S','M','T','W','T','F','S'].map((d, idx) => <div key={`weekday-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}
          {days.map((d: any, i) => {
            if (!d) return <div key={i} />;
            const dateStr = d.toDateString();
            const record = historyMap.get(dateStr);
            const isToday = dateStr === today.toDateString();
            
            return (
              <div key={i} className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative
                ${record 
                  ? (record.task.done ? 'bg-blue-900/20 border-blue-500/50' : 'bg-red-900/20 border-red-500/50') 
                  : 'bg-gray-800/50 border-gray-800 text-gray-600'}
                ${isToday ? 'ring-1 ring-white' : ''}
              `}>
                <span className="text-xs font-medium">{d.getDate()}</span>
                {record && (
                  <>
                    <span className={`text-[8px] font-mono mt-0.5 ${record.task.done ? 'text-blue-400' : 'text-red-400'}`}>
                      {Math.floor(record.task.percent)}%
                    </span>
                    {record.subtasks.length > 0 && (
                      <span className="text-[7px] text-gray-500 mt-0.5">
                        +{record.subtasks.length}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center text-xs text-gray-500 mb-4">
          이 일을 수행한 날짜와 퍼센트가 표시됩니다.
        </div>

        {/* 하위할일 목록 */}
        <div className="max-h-40 overflow-y-auto scrollbar-hide">
          {Array.from(historyMap.entries()).reverse().slice(0, 5).map(([date, data]) => (
            <div key={date} className="mb-4 pb-4 border-b border-gray-800 last:border-0">
              <div className="text-[10px] text-gray-500 mb-2">{new Date(date).toLocaleDateString()}</div>
              {data.subtasks.length > 0 ? (
                <div className="space-y-1">
                  {data.subtasks.map((st: Task, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className={st.done ? 'text-green-500' : 'text-gray-600'}>•</span>
                      <span className={st.done ? 'text-gray-500 line-through' : 'text-gray-300'}>{st.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-700">하위할일 없음</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- [컴포넌트] 하위할일 아이템 (Logseq 완전판) ---
function SubtaskItem({ subtask, task, index, updateTask, focusedSubtaskId, setFocusedSubtaskId }: { subtask: Task, task: Task, index: number, updateTask: (task: Task) => void, focusedSubtaskId: number | null, setFocusedSubtaskId: (id: number | null) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id });
  
  const currentDepth = subtask.depth || 0;
  const paddingLeft = currentDepth * 24;
  const isFocused = focusedSubtaskId === subtask.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: `${paddingLeft}px`
  };

  const cycleStatus = (current: TaskStatus = 'LATER'): TaskStatus => {
    if (current === 'LATER') return 'NOW';
    if (current === 'NOW') return 'DONE';
    return 'LATER';
  };

  const handleIndent = () => {
    const subtasks = task.subtasks || [];
    const target = { ...subtasks[index] };
    const prev = index > 0 ? subtasks[index - 1] : null;
    const prevDepth = prev ? (prev.depth || 0) : 0;
    if (prev && (target.depth || 0) <= prevDepth) {
      const newSubtasks = [...subtasks];
      target.depth = (target.depth || 0) + 1;
      newSubtasks[index] = target;
      updateTask({ ...task, subtasks: newSubtasks });
    }
  };

  const handleOutdent = () => {
    const subtasks = task.subtasks || [];
    const target = { ...subtasks[index] };
    if ((target.depth || 0) > 0) {
      const newSubtasks = [...subtasks];
      target.depth = (target.depth || 0) - 1;
      newSubtasks[index] = target;
      updateTask({ ...task, subtasks: newSubtasks });
    }
  };

  const handleMoveUp = () => {
    const subtasks = task.subtasks || [];
    if (index > 0) {
      const newSubtasks = [...subtasks];
      [newSubtasks[index - 1], newSubtasks[index]] = [newSubtasks[index], newSubtasks[index - 1]];
      updateTask({ ...task, subtasks: newSubtasks });
    }
  };

  const handleMoveDown = () => {
    const subtasks = task.subtasks || [];
    if (index < subtasks.length - 1) {
      const newSubtasks = [...subtasks];
      [newSubtasks[index], newSubtasks[index + 1]] = [newSubtasks[index + 1], newSubtasks[index]];
      updateTask({ ...task, subtasks: newSubtasks });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const subtasks = task.subtasks || [];

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const newSubtasks = [...subtasks];
      newSubtasks[index] = { ...subtasks[index], status: cycleStatus(subtask.status) };
      updateTask({ ...task, subtasks: newSubtasks });
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newId = Date.now();
      const newSubtasks = [...subtasks];
      const newSub: Task = {
        id: newId, text: '', status: 'LATER', percent: 0, planTime: 0, actTime: 0, isTimerOn: false, parentId: task.id, depth: currentDepth
      };
      newSubtasks.splice(index + 1, 0, newSub);
      updateTask({ ...task, subtasks: newSubtasks });
      setFocusedSubtaskId(newId);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) handleOutdent();
      else handleIndent();
      return;
    }

    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); handleMoveUp(); return; }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); handleMoveDown(); return; }

    if (e.key === 'Backspace' && subtask.text === '') {
      e.preventDefault();
      if (currentDepth > 0) { handleOutdent(); return; }
      const newSubtasks = subtasks.filter(s => s.id !== subtask.id);
      updateTask({ ...task, subtasks: newSubtasks });
      if (index > 0) setFocusedSubtaskId(subtasks[index - 1].id);
      return;
    }

    if (!e.altKey && e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      setFocusedSubtaskId(subtasks[index - 1].id);
    }
    if (!e.altKey && e.key === 'ArrowDown' && index < subtasks.length - 1) {
      e.preventDefault();
      setFocusedSubtaskId(subtasks[index + 1].id);
    }
  };

  const getStatusColor = () => {
    switch (subtask.status) {
      case 'NOW': return 'bg-blue-600 border-blue-600 text-white font-bold shadow-[0_0_10px_rgba(37,99,235,0.5)]';
      case 'DONE': return 'bg-gray-700 border-gray-700 text-gray-500';
      default: return 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400';
    }
  };

  const getTextStyle = () => {
    switch (subtask.status) {
      case 'NOW': return 'text-blue-400 font-bold';
      case 'DONE': return 'text-gray-600 line-through';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="relative">
      <div ref={setNodeRef} style={style} className="flex items-start gap-2 py-1 pl-2 group relative z-0">
        {currentDepth > 0 && (
          <div className="absolute top-0 bottom-0 border-l border-white/5" style={{ left: `${paddingLeft + 6}px` }} />
        )}

        <button 
          onClick={() => {
             const newSubs = task.subtasks!.map(s => s.id === subtask.id ? { ...s, status: cycleStatus(s.status) } : s);
             updateTask({ ...task, subtasks: newSubs });
          }}
          className={`mt-1.5 flex-shrink-0 w-10 h-4 border rounded-[4px] text-[9px] flex items-center justify-center transition-all z-10 select-none ${getStatusColor()}`}
        >
          {subtask.status || 'LATER'}
        </button>

        <AutoResizeTextarea
          value={subtask.text}
          autoFocus={focusedSubtaskId === subtask.id}
          onChange={(e: any) => {
             const newSubs = task.subtasks!.map(s => s.id === subtask.id ? { ...s, text: e.target.value } : s);
             updateTask({ ...task, subtasks: newSubs });
          }}
          onKeyDown={handleKeyDown}
          className={`flex-1 text-sm leading-relaxed ${getTextStyle()}`}
          placeholder="LATER"
        />

        <button 
          onClick={() => {
               const newSubs = task.subtasks!.filter(s => s.id !== subtask.id);
               updateTask({ ...task, subtasks: newSubs });
          }}
          className="mt-1 text-gray-700 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
        
        <div {...attributes} {...listeners} className="mt-1.5 w-4 h-4 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50 touch-none" />
      </div>

      {isFocused && (
        <div className="flex gap-2 items-center justify-end px-3 py-2 bg-[#18181b] border-y border-white/5 animate-in slide-in-from-top-1 mt-1 rounded-lg mx-2 mb-2 shadow-xl">
           <button onMouseDown={(e) => { e.preventDefault(); handleOutdent(); }} className={`p-2 rounded bg-white/5 ${currentDepth > 0 ? 'text-gray-200' : 'text-gray-600'}`} disabled={currentDepth === 0}><ArrowLeft size={16} /></button>
           <button onMouseDown={(e) => { e.preventDefault(); handleIndent(); }} className="p-2 rounded bg-white/5 text-gray-200"><ArrowRight size={16} /></button>
           <div className="w-px h-6 bg-white/10 mx-1"></div>
           <button onMouseDown={(e) => { e.preventDefault(); handleMoveUp(); }} className="p-2 rounded bg-white/5 text-gray-200"><ArrowUp size={16} /></button>
           <button onMouseDown={(e) => { e.preventDefault(); handleMoveDown(); }} className="p-2 rounded bg-white/5 text-gray-200"><ArrowDown size={16} /></button>
        </div>
      )}
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
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
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
              <button
                key={i}
                onClick={() => onSelectDate(d)}
                className={`aspect-square rounded-lg border flex items-center justify-center hover:bg-blue-600/20 transition-colors
                  ${isToday ? 'border-blue-500 text-blue-400' : 'border-gray-800 text-gray-400'}
                `}
              >
                <span className="text-sm">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- [컴포넌트] 할 일 아이템 ---
function TaskItem({ task, updateTask, deleteTask, onShowHistory, sensors, onChangeDate }: { task: Task, updateTask: (task: Task) => void, deleteTask: (id: number) => void, onShowHistory: (name: string) => void, sensors: any, onChangeDate?: (taskId: number, newDate: string) => void }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isOver = task.actTime > task.planTime;
  const progress = task.planTime > 0 ? (task.actTime / task.planTime) * 100 : 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const activeStyle = task.isTimerOn 
    ? 'border-blue-500/50 bg-[#1c1c22] shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
    : 'border-white/5 bg-[#121216]';

  const barColor = 'linear-gradient(90deg, #6366f1, #d946ef)';
  const isDone = task.status === 'DONE';

  return (
    <div>
      <div ref={setNodeRef} style={style} className={`relative mb-3 rounded-xl overflow-hidden border transition-all duration-300 ${activeStyle} ${isDone ? 'opacity-40 grayscale' : ''}`}>
      
      <div className="absolute top-0 left-0 bottom-0 pointer-events-none opacity-10 transition-all duration-1000 ease-linear"
        style={{ width: `${Math.min(progress, 100)}%`, background: barColor }}
      ></div>
      
      <div className="relative p-3">
        <div className="flex gap-3 items-start">
            <button 
                onClick={() => updateTask({ ...task, isTimerOn: !task.isTimerOn })}
                className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${task.isTimerOn ? 'bg-blue-600 text-white scale-105' : 'bg-[#27272a] text-gray-400 hover:bg-[#3f3f46] hover:text-white'}`}
            >
                {task.isTimerOn ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start relative">
                    <input 
                        value={task.text}
                        onChange={(e) => updateTask({ ...task, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        className={`bg-transparent text-lg font-bold outline-none w-full placeholder:text-gray-600 ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}
                        placeholder="목표 (Time Block)"
                    />
                </div>

                <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-2">
                        <div className={`flex items-baseline gap-1 font-mono leading-none ${isOver ? 'text-pink-400' : 'text-blue-400'}`}>
                            <input 
                                type="number"
                                value={Math.floor(task.actTime)}
                                onChange={(e) => {
                                    const m = Math.max(0, parseInt(e.target.value) || 0);
                                    const s = Math.round((task.actTime % 1) * 60);
                                    updateTask({ ...task, actTime: m + s / 60 });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-12 bg-transparent text-xl font-black tracking-tighter text-right outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500"
                            />
                            <span className="text-xs">m</span>
                            <input 
                                type="number"
                                value={Math.round((task.actTime % 1) * 60)}
                                onChange={(e) => {
                                    const m = Math.floor(task.actTime);
                                    const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                    updateTask({ ...task, actTime: m + s / 60 });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-8 bg-transparent text-xl font-black tracking-tighter text-right outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500"
                            />
                            <span className="text-xs">s</span>
                        </div>
                        
                        <span className="text-gray-600">/</span>
                        
                        <div className="flex items-baseline gap-1 font-mono leading-none text-gray-400">
                            <input 
                                type="number"
                                value={task.planTime}
                                onChange={(e) => updateTask({ ...task, planTime: Math.max(0, parseInt(e.target.value) || 0) })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-12 bg-transparent text-xl font-black tracking-tighter text-right outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500"
                            />
                            <span className="text-xs">m</span>
                        </div>
                        
                        {isOver && <Flame size={16} className="text-pink-400 animate-pulse" />}
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-3 pl-[3.25rem]">
            
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
                const {active, over} = e;
                if (active.id !== over?.id) {
                    const oldIdx = task.subtasks!.findIndex(t => t.id === active.id);
                    const newIdx = task.subtasks!.findIndex(t => t.id === over?.id);
                    updateTask({ ...task, subtasks: arrayMove(task.subtasks!, oldIdx, newIdx) });
                }
            }}>
                <SortableContext items={(task.subtasks || []).map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-0.5">
                        {(task.subtasks || []).map((sub, idx) => (
                            <SubtaskItem key={sub.id} subtask={sub} task={task} index={idx} updateTask={updateTask} focusedSubtaskId={focusedSubtaskId} setFocusedSubtaskId={setFocusedSubtaskId} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            
            {focusedSubtaskId && (
              <div className="flex justify-center mt-0.5">
                <button 
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const newSubtask: Task = {
                      id: Date.now(),
                      text: '',
                      status: 'LATER',
                      percent: 0,
                      planTime: 0,
                      actTime: 0,
                      isTimerOn: false,
                      parentId: task.id
                    };
                    const updatedTask = {
                      ...task,
                      subtasks: [...(task.subtasks || []), newSubtask]
                    };
                    updateTask(updatedTask);
                  }}
                  className="text-gray-600 hover:text-blue-400 px-1 py-0 text-[10px]"
                >
                  +
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <div className="flex gap-3">
                    <button 
                        onClick={() => onShowHistory(task.text)}
                        className="text-gray-500 hover:text-blue-400 transition-colors p-1"
                        title="기록 보기"
                    >
                        <BarChart2 size={16} />
                    </button>
                    <button 
                        onClick={() => {
                            const newSub: Task = { id: Date.now(), text: '', status: 'LATER', percent: 0, planTime: 0, actTime: 0, isTimerOn: false };
                            updateTask({ ...task, subtasks: [...(task.subtasks || []), newSub] });
                        }}
                        className="text-gray-500 hover:text-blue-400 p-1"
                        title="Step 추가"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className="flex gap-2 items-center">
                    {onChangeDate && (
                      <>
                        <button 
                          onClick={() => setShowDatePicker(true)}
                          className="text-gray-500 hover:text-blue-400 p-1"
                          title="날짜 변경"
                        >
                          <Calendar size={16} />
                        </button>
                        {showDatePicker && (
                          <DatePickerModal 
                            onSelectDate={(date) => {
                              onChangeDate(task.id, date.toDateString());
                              setShowDatePicker(false);
                            }}
                            onClose={() => setShowDatePicker(false)}
                          />
                        )}
                      </>
                    )}
                    <button 
                        onClick={() => { if(window.confirm('삭제하시겠습니까?')) deleteTask(task.id); }}
                        className="text-gray-500 hover:text-red-400 p-1"
                        title="삭제"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button 
                        onClick={() => {
                          const newStatus: TaskStatus = task.status === 'DONE' ? 'LATER' : 'DONE';
                          updateTask({ ...task, status: newStatus, isTimerOn: false });
                        }}
                        className={`p-1 rounded transition-colors ${isDone ? 'text-gray-500' : 'text-blue-400 hover:text-white'}`}
                        title={isDone ? '취소' : '완료'}
                    >
                        <Check size={18} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// --- 유틸리티: 데이터 마이그레이션 ---
const migrateTasks = (tasks: any[]): Task[] => {
  return tasks.map(t => ({
    ...t,
    status: t.status || (t.done ? 'DONE' : 'LATER'),
    subtasks: t.subtasks ? t.subtasks.map((s: any) => ({
      ...s,
      status: s.status || (s.done ? 'DONE' : 'LATER'),
      depth: s.depth || 0
    })) : []
  }));
};

// --- 메인 앱 ---
export default function App() {
  const { user, signOut } = useAuth();
  const { currentSpace } = useSpace();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [viewDate, setViewDate] = useState(new Date());
  
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [localLogsLoaded, setLocalLogsLoaded] = useState(false);

  // 로컬 데이터 로드 (마이그레이션 포함)
  useEffect(() => {
    if (currentSpace) {
      setLocalLogsLoaded(false);
      const saved = localStorage.getItem(`ultra_tasks_space_${currentSpace.id}`);
      if (saved) {
        const parsedLogs = JSON.parse(saved);
        const migratedLogs = parsedLogs.map((log: any) => ({
          ...log,
          tasks: migrateTasks(log.tasks)
        }));
        setLogs(migratedLogs);
        console.log('Logs loaded for space', currentSpace.id, ':', migratedLogs);
      } else {
        setLogs([]);
        console.log('No data for space', currentSpace.id);
      }
      setLocalLogsLoaded(true);
    }
  }, [currentSpace]);

  // Supabase 동기화 (마이그레이션 포함)
  useEffect(() => {
    if (!user || !currentSpace || !localLogsLoaded) return;
    
    const loadFromSupabase = async () => {
      try {
        const { data } = await supabase
          .from('task_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('space_id', currentSpace.id);
        if (data && data.length > 0) {
          const supabaseLogs = data.map(item => ({
            date: item.date,
            tasks: migrateTasks(JSON.parse(item.tasks))
          }));
          setLogs(supabaseLogs);
          localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(supabaseLogs));
        }
      } catch (error) {
        console.log('Supabase load error:', error);
      }
    };
    loadFromSupabase();
  }, [user, currentSpace, localLogsLoaded]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // 히스토리 모달 상태
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);

  const [newTask, setNewTask] = useState('');
  const [suggestions, setSuggestions] = useState<Task[]>([]); 
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);


  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );



  // 타이머 (timestamp 기반)
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        const now = Date.now();
        return prev.map(t => {
          if (t.isTimerOn && t.timerStartTime) {
            const elapsed = (now - t.timerStartTime) / 1000 / 60;
            return { ...t, actTime: t.actTime + elapsed, timerStartTime: now };
          }
          return t;
        });
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 저장 + Supabase 동기화
  useEffect(() => {
    if (!currentSpace || !localLogsLoaded) return;
    
    localStorage.setItem(`ultra_tasks_space_${currentSpace.id}`, JSON.stringify(logs));
    
    // 로그인 시에만 Supabase 동기화
    if (user) {
      supabase.from('task_logs').upsert(logs.map(log => ({
        date: log.date,
        user_id: user.id,
        space_id: currentSpace.id,
        tasks: JSON.stringify(log.tasks)
      }))).then(({ error }) => {
        if (error) console.log('Supabase sync error:', error);
      });
    }
  }, [logs, user, currentSpace, localLogsLoaded]);
  useEffect(() => {
    const dateStr = viewDate.toDateString();
    const log = logs.find(l => l.date === dateStr);
    if (log) setTasks(log.tasks);
    else setTasks([]);
  }, [viewDate, logs]); 

  const updateLogs = (newTasks: Task[]) => {
    setTasks(newTasks);
    const dateStr = viewDate.toDateString();
    setLogs(prev => {
      const idx = prev.findIndex(l => l.date === dateStr);
      if (idx >= 0) { const updated = [...prev]; updated[idx] = { date: dateStr, tasks: newTasks }; return updated; }
      return [...prev, { date: dateStr, tasks: newTasks }];
    });
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const newTaskObj: Task = { id: Date.now(), text: newTask, status: 'LATER', percent: 0, planTime: 30, actTime: 0, isTimerOn: false, subtasks: [] };
    updateLogs([...tasks, newTaskObj]);
    setNewTask(''); setSuggestions([]);
  };

  const updateTask = (updated: Task) => {
    const now = Date.now();
    const oldTask = tasks.find(t => t.id === updated.id);
    
    if (updated.isTimerOn && !oldTask?.isTimerOn) {
      updated.timerStartTime = now;
    } else if (!updated.isTimerOn && oldTask?.isTimerOn && oldTask.timerStartTime) {
      const elapsed = (now - oldTask.timerStartTime) / 1000 / 60;
      updated.actTime = oldTask.actTime + elapsed;
      updated.timerStartTime = undefined;
    }
    
    updateLogs(tasks.map(t => t.id === updated.id ? updated : t));
  };
  const deleteTask = (id: number) => { if(window.confirm('삭제하시겠습니까?')) updateLogs(tasks.filter(t => t.id !== id)); };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over?.id);
      updateLogs(arrayMove(tasks, oldIndex, newIndex));
    }
  };

  // 1. 자동완성 감지 (입력할 때마다 실행)
  useEffect(() => {
    if (!newTask.trim()) { 
      setSuggestions([]);
      setSelectedSuggestionIndex(-1);
      return; 
    }
    
    const matches: Task[] = [];
    const seen = new Set();
    
    // logs(과거기록) 전체를 뒤져서 검색어와 일치하는 걸 찾음
    // reverse()를 써서 '최신 기록'부터 가져오게 함 (최신 설정을 불러오기 위해)
    [...logs].reverse().forEach(log => {
      log.tasks.forEach(t => {
        // 검색어가 포함되어 있고, 아직 리스트에 안 넣은 이름이면 추가
        if (t.text.toLowerCase().includes(newTask.toLowerCase()) && !seen.has(t.text)) {
          matches.push(t); 
          seen.add(t.text);
        }
      });
    });
    
    setSuggestions(matches.slice(0, 5)); // 최대 5개까지 추천
    setSelectedSuggestionIndex(-1);
  }, [newTask, logs]);

  const selectSuggestion = (pastTask: Task) => {
    const newTaskObj: Task = {
      id: Date.now(),
      text: pastTask.text,
      status: 'LATER',
      isTimerOn: false,
      actTime: 0,
      percent: pastTask.percent || 0,
      planTime: pastTask.planTime || 30,
      subtasks: pastTask.subtasks ? pastTask.subtasks
        .filter(st => st.status !== 'DONE')
        .map(st => ({
          ...st,
          id: Date.now() + Math.random(),
          status: 'LATER' as TaskStatus,
          isTimerOn: false,
          actTime: 0,
          parentId: Date.now()
        })) : []
    };
    
    updateLogs([...tasks, newTaskObj]);
    setNewTask('');
    setSuggestions([]);
  };





  const totalPlanTime = tasks.reduce((acc, t) => acc + t.planTime, 0);
  const totalActTime = tasks.reduce((acc, t) => acc + t.actTime, 0);

  // 완료율에 따른 평가 메시지 (날짜 기반으로 고정)
  const getEvaluationMessage = (completionRate: number, dateStr: string) => {
    const messages = {
      veryLow: ["시작이 반은 무슨, 시작은 그냥 0이다.", "시작이 반이라던데 아직 0임", "숨 쉬는 거 빼고 다 귀찮네", "내일의 내가 욕하고 있을 듯", "딴짓할 시간은 있고 이거 할 시간은 없지", "일단 눕고 생각할까", "로딩 중... 뇌가 연결되지 않음", "의욕 0, 귀찮음 100", "이거 꼭 해야 됨? (ㅇㅇ 해야 됨)", "시작 버튼 누르는 게 제일 힘듦", "도망치고 싶다 격렬하게", "청소 핑계 그만 대라", "멍 때리다 10분 순삭", "하기 싫어서 몸 비트는 중", "딱 5분만 더... 하다가 망함", "누구 머리 대신 써줄 사람", "영감님은 안 오신다 그냥 해라", "침대랑 접착제로 붙은 듯", "오늘따라 벽지가 재밌네", "숨 참고 다이브 말고 그냥 다이브 하고 싶다", "계획은 완벽했지, 실행이 문제지", "뇌세포 파업 선언", "미루기의 신 강림", "지금 안 하면 이따가 피눈물", "손가락 하나 움직이기 싫음", "0에서 1 만드는 게 제일 빡셈", "유튜브 알고리즘이 날 놔주질 않네", "슬슬 발등 뜨거워질 시간", "아 몰라 배째", "생각만 하다가 하루 다 감", "일단 앱 켠 게 어디냐"],
      low: ["하긴 하는데, 티가 안 나네 티가.", "진도가 안 나감. 고장 났나?", "딴짓하느라 바쁨", "집중력 5분을 못 넘김", "영혼 없이 손만 움직이는 중", "이 속도면 내년에 끝남", "좀비 모드 ON", "뇌는 멈췄고 손만 일함", "아 당 떨어진다", "딴짓 좀 그만해 제발", "내가 뭘 하고 있는지 까먹음", "노동요 고르다 시간 다 감", "진척도 1도 안 오르는 마법", "슬슬 엉덩이 아픔", "고지가 안 보여", "배고픈데 밥부터 먹을까? (안 됨)", "머리는 거부하고 몸은 억지로 함", "화면 뚫어지겠다", "아직도 초반인 게 레전드", "누가 시간 좀 멈춰봐", "멍하니 있다가 침 흘릴 뻔", "카페인으로 버티는 중", "격하게 아무것도 안 하고 싶다", "지금 포기하면 쓰레기겠지", "산 넘어 산이네", "지우기를 더 많이 함", "눈이 침침해짐", "그냥 잘까? (악마의 속삭임)", "늪에 빠진 기분", "물음표 살인마 빙의 중"],
      medium: ["반이나 남았어? 반밖에 안 했어?", "반타작 인생", "웃음이 실실 나네 미쳤나", "아직도 반이나 남음", "기계처럼 하는 중", "뇌 빼고 손만 움직여", "슬슬 눈에 뵈는 게 없음", "기기 던질 뻔", "돌아가기엔 너무 멀리 옴", "해탈의 경지", "오늘 안에 끝나긴 하냐", "퀄리티 타협 중", "나 자신과의 싸움 (지는 중)", "뇌가 흐물흐물해짐", "여기가 어디요 나는 누구요", "악으로 깡으로 버텨", "정신줄 잡아라", "40과 60 사이의 림보", "스트레스 지수 폭발", "이 짓을 왜 시작했을까", "시스템 종료 마렵다", "완벽주의 갖다 버림", "허리 끊어질 듯", "사리 나오겠다", "그냥 대충 할까", "중꺾마는 무슨 그냥 꺾임", "영혼 가출", "인간 승리 도전 중", "멘탈 바사삭", "좀비처럼 걷는 중", "비명 지르고 싶다", "억지로 끌려가는 기분"],
      high: ["어? 이거 끝나겠는데?", "이제 좀 속도 붙네", "비켜 방해하지 마", "갑자기 삘 받음", "끝이 보인다 보여", "아드레날린 도는 중", "미친 속도, 수정은 나중에", "내가 이걸 해내네", "불도저 모드 가동", "막판 스퍼트", "전투력 상승", "존버는 승리한다", "터널 끝에 빛이 보임", "밥 안 먹어도 배부름 (뻥임)", "멈추면 죽는 병 걸림", "집중력 최고조", "딴짓만 안 하면 금방임", "런닝맨 찍는 기분", "빈칸 채워지는 맛", "슬슬 끝낼 준비", "뒷심 발휘 중", "각성 상태", "눕기 1시간 전", "에라 모르겠다 질러", "마법처럼 채워짐", "손가락에서 연기 남", "70 넘으면 다 한 거지", "설레발 치는 중", "누구도 날 막을 수 없다", "저장 버튼 연타 중", "곧 자유다"],
      veryHigh: ["끝. 더 이상은 못 해.", "해치웠다", "찢었다", "나 좀 제법인 듯", "박수 칠 때 떠나라", "체크 완료. 이 맛이지.", "오늘 할 일 끝", "앓던 이 빠진 기분", "자유다", "나 자신 고생했다", "당분간 찾지 마쇼", "하얗게 불태움", "승자의 여유", "완료 버튼 누르는 맛", "100% 채움", "고생 끝 꿀잠 시작", "이제 놀아도 됨", "발 뻗고 자겠다", "세상을 다 가진 기분", "치킨 시켜라", "내가 해냄", "드디어 끝", "지긋지긋했다 잘 가라", "레벨업", "셔터 내림", "퇴근하겠습니다 (마음만은)", "완벽해", "쾌감 쩐다", "마무리까지 깔끔", "국보급 결과물", "수고했어 오늘도"]
    };
    
    let pool;
    if (completionRate >= 80) pool = messages.veryHigh;
    else if (completionRate >= 60) pool = messages.high;
    else if (completionRate >= 40) pool = messages.medium;
    else if (completionRate >= 20) pool = messages.low;
    else pool = messages.veryLow;
    
    // 날짜 문자열을 숫자로 변환하여 시드로 사용
    const seed = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = seed % pool.length;
    return pool[index];
  };

  // currentSpace는 항상 존재하므로 Loading 화면 불필요

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans overflow-y-auto selection:bg-indigo-500/30">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      
      <div className="max-w-xl mx-auto min-h-screen flex flex-col p-4 pb-24">
        
        {/* 상단 헤더: Space 선택 + 로그인 */}
        <div className="mb-4 flex justify-between items-center">
          <SpaceSelector />
          <button
            onClick={() => user ? signOut() : setShowAuthModal(true)}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5"
          >
            {user ? '로그아웃' : '로그인'}
          </button>
        </div>
        
        {/* 모달: 태스크 히스토리 */}
        {historyTarget && (
          <TaskHistoryModal taskName={historyTarget} logs={logs} onClose={() => setHistoryTarget(null)} />
        )}

        {/* === 캘린더 페이지 === */}
        {
          <div className="flex-1 flex flex-col pt-6">
            
            {/* 상단 캘린더 */}
            <div className="mb-6 bg-[#0f0f14]/50 backdrop-blur-sm p-5 rounded-3xl border border-white/5">
              <div className="flex items-center mb-4 px-2">
                <div className="flex gap-2 w-24">
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))} className="text-gray-500 hover:text-white"><ChevronLeft size={16} /></button>
                  <span className="font-bold text-sm text-white">{viewDate.getFullYear()}</span>
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))} className="text-gray-500 hover:text-white"><ChevronRight size={16} /></button>
                </div>
                <div className="flex-1 flex justify-center items-center gap-2">
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="text-gray-400 hover:text-white"><ChevronLeft size={20} /></button>
                  <span className="font-bold text-lg text-white whitespace-nowrap">{viewDate.toLocaleString('default', { month: 'long' })}</span>
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="text-gray-400 hover:text-white"><ChevronRight size={20} /></button>
                </div>
                <button onClick={() => setViewDate(new Date())} className="text-xs text-blue-400 hover:text-blue-300 w-24 text-right">●</button>
              </div>
              {/* 달력 그리드 (기존 유지) */}
              <div className="grid grid-cols-7 gap-2">
                {['S','M','T','W','T','F','S'].map((d, idx) => <div key={`cal-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}
                {Array.from({length: 35}).map((_, i) => {
                  const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
                  d.setDate(d.getDate() + (i - d.getDay()));
                  const dateStr = d.toDateString();
                  const log = logs.find(l => l.date === dateStr);
                  const isSelected = viewDate.toDateString() === dateStr;
                  const completed = log ? log.tasks.filter(t => t.done).length : 0;
                  const total = log ? log.tasks.length : 0;
                  
                  return (
                    <button key={i} onClick={() => { setViewDate(d); /* 날짜만 변경하고 모드는 HISTORY 유지 */ }} className={`h-12 rounded border transition-all ${isSelected ? 'border-white bg-white/10 text-white' : 'border-gray-900 text-gray-600'}`}>
                      <span className="text-xs">{d.getDate()}</span>
                      {log && total > 0 && (
                        <>
                          <span className="block text-[8px] text-blue-500">{completed}/{total}</span>
                          <span className="block text-[7px] text-green-400">{Math.round((completed / total) * 100)}%</span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Plan/Act 총 시간 비교 */}
            {tasks.length > 0 && (
              <div className="mb-6 bg-[#0f0f14]/50 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-gray-600 uppercase font-bold">Plan</span>
                    <span className="text-lg font-black font-mono text-gray-400">{totalPlanTime}m</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-gray-600 uppercase font-bold">Act</span>
                    <span className={`text-lg font-black font-mono ${totalActTime > totalPlanTime ? 'text-pink-400' : 'text-blue-400'}`}>
                      {Math.floor(totalActTime)}m
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-pink-500"
                    style={{ width: `${Math.min((totalActTime / Math.max(totalPlanTime, 1)) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* 평가 메시지 */}
            {tasks.length > 0 && (
              <div className="mb-6 text-center">
                <div className="text-4xl font-thin text-white mb-2">
                  {tasks.filter(t => t.done).length}<span className="text-xl text-gray-700 font-thin mx-1"> / </span>{tasks.length}<span className="text-lg text-gray-500 font-thin"> ({tasks.length > 0 ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0}%)</span>
                </div>
                <div className="text-sm text-blue-400 font-medium">
                  {getEvaluationMessage(tasks.length > 0 ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0, viewDate.toDateString())}
                </div>
              </div>
            )}

            {/* 하단 리스트 */}
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-96 px-2">
              <h3 className="text-xs font-bold text-gray-500 mb-6 uppercase tracking-widest text-center">Record of {viewDate.toLocaleDateString()}</h3>
              
              {tasks.length > 0 ? (
                <div className="space-y-10">
                  
                  {/* 섹션 1: TARGET (원하는 것) - 미완료 태스크만 표시 + 수정 가능 */}
                  <div>
                    <h2 className="text-blue-500 text-[10px] font-bold tracking-widest mb-3 border-b border-blue-900/30 pb-1">원하는 것들</h2>
                    <div className="space-y-1">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={tasks.filter((t: Task) => !t.done).map((t: Task) => t.id)} strategy={verticalListSortingStrategy}>
                          {tasks.filter((t: Task) => !t.done).map((task: Task) => (
                              <TaskItem 
                              key={task.id} task={task} updateTask={updateTask} deleteTask={deleteTask} 
                              onShowHistory={(name: string) => setHistoryTarget(name)}
                              sensors={sensors}
                              onChangeDate={(taskId, newDate) => {
                                const taskToMove = tasks.find(t => t.id === taskId);
                                if (!taskToMove) return;
                                const targetDate = new Date(newDate).toDateString();
                                const currentDate = viewDate.toDateString();
                                
                                // 현재 날짜에서 제거
                                const updatedCurrentTasks = tasks.filter(t => t.id !== taskId);
                                setLogs(prev => {
                                  const newLogs = [...prev];
                                  const currentIdx = newLogs.findIndex(l => l.date === currentDate);
                                  if (currentIdx >= 0) newLogs[currentIdx] = { date: currentDate, tasks: updatedCurrentTasks };
                                  
                                  // 타겟 날짜에 추가
                                  const targetIdx = newLogs.findIndex(l => l.date === targetDate);
                                  if (targetIdx >= 0) {
                                    newLogs[targetIdx] = { date: targetDate, tasks: [...newLogs[targetIdx].tasks, taskToMove] };
                                  } else {
                                    newLogs.push({ date: targetDate, tasks: [taskToMove] });
                                  }
                                  return newLogs;
                                });
                                setTasks(updatedCurrentTasks);
                              }}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                      {tasks.filter((t: Task) => !t.done).length === 0 && (
                        <div className="text-gray-800 text-xs py-2">No pending tasks.</div>
                      )}
                    </div>
                  </div>

                  {/* 섹션 2: RESULT (실제 한 것) - 완료된 것만 표시 + 수정 가능 */}
                  <div>
                    <h2 className="text-green-500 text-[10px] font-bold tracking-widest mb-3 border-b border-green-900/30 pb-1">완료한 일들</h2>
                    <div className="space-y-1">
                      {tasks.filter(t => t.done).length > 0 ? (
                        tasks.filter(t => t.done).map(task => (
                          <TaskItem 
                            key={`done-${task.id}`} task={task} updateTask={updateTask} deleteTask={deleteTask} 
                            onShowHistory={(name: string) => setHistoryTarget(name)}
                            sensors={sensors}
                            onChangeDate={(taskId, newDate) => {
                              const taskToMove = tasks.find(t => t.id === taskId);
                              if (!taskToMove) return;
                              const targetDate = new Date(newDate).toDateString();
                              const currentDate = viewDate.toDateString();
                              
                              // 현재 날짜에서 제거
                              const updatedCurrentTasks = tasks.filter(t => t.id !== taskId);
                              setLogs(prev => {
                                const newLogs = [...prev];
                                const currentIdx = newLogs.findIndex(l => l.date === currentDate);
                                if (currentIdx >= 0) newLogs[currentIdx] = { date: currentDate, tasks: updatedCurrentTasks };
                                
                                // 타겟 날짜에 추가
                                const targetIdx = newLogs.findIndex(l => l.date === targetDate);
                                if (targetIdx >= 0) {
                                  newLogs[targetIdx] = { date: targetDate, tasks: [...newLogs[targetIdx].tasks, taskToMove] };
                                } else {
                                  newLogs.push({ date: targetDate, tasks: [taskToMove] });
                                }
                                return newLogs;
                              });
                              setTasks(updatedCurrentTasks);
                            }}
                          />
                        ))
                      ) : (
                        <div className="text-gray-800 text-xs py-2">No completed tasks yet.</div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-gray-800 text-xs text-center py-10">No records for this day.</div>
              )}
              
              {/* 과거 날짜에도 추가 가능하게 입력창 유지 */}
              <div className="mt-8 pt-4 border-t border-gray-900">
                {/* 자동완성 칩 (입력창 위에) */}
                {suggestions.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-2">
                    {suggestions.map((s, idx) => (
                      <button 
                        key={s.id} 
                        onClick={() => selectSuggestion(s)} 
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-blue-300 border whitespace-nowrap hover:bg-gray-700 flex-shrink-0 text-xs ${selectedSuggestionIndex === idx ? 'bg-gray-700 border-blue-500' : 'bg-gray-800 border-blue-900/30'}`}
                      >
                        <span className="font-bold text-white text-xs">{s.text}</span>
                        <span className="text-gray-500 text-[10px]">({s.planTime}m / {s.percent}%)</span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { 
                    if (e.key === 'Enter') {
                      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                        selectSuggestion(suggestions[selectedSuggestionIndex]);
                      } else {
                        addTask();
                      }
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                    }
                  }}
                  placeholder="+ Add task to history"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>




            </div>
          </div>
        }

      </div>
    </div>
  );
}