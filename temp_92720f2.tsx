import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, Check, ChevronLeft, ChevronRight, Plus, X, Flame, Clock, BarChart2 } from 'lucide-react';

type Task = {
  id: number;
  text: string;
  done: boolean;
  planTime: number;     
  actTime: number;      
  isTimerOn: boolean;
  subtasks?: Task[];
};

type DailyLog = {
  date: string;
  tasks: Task[];
};

function TaskHistoryModal({ taskName, logs, onClose }: { taskName: string, logs: DailyLog[], onClose: () => void }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date());
  
  const historyMap = new Map();
  logs.forEach(log => {
    const found = log.tasks.find(t => t.text.trim() === taskName.trim());
    if (found) {
      historyMap.set(log.date, { task: found, subtasks: found.subtasks || [] });
    }
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: firstDay }).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-[10px] text-blue-400 font-bold tracking-widest uppercase mb-1">HISTORY</h2>
            <h1 className="text-xl font-bold text-white">\"{taskName}\"</h1>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X /></button>
        </div>

        <div className="flex justify-between items-center mb-4 px-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={20} className="text-gray-500" /></button>
          <span className="font-bold text-white">{viewDate.toLocaleString('default', { month: 'long' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={20} className="text-gray-500" /></button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-6">
          {['S','M','T','W','T','F','S'].map((d, idx) => <div key={`weekday-${idx}`} className="text-center text-[10px] text-gray-600">{d}</div>)}
          {days.map((d: any, i) => {
            if (!d) return <div key={i} />;
            const dateStr = d.toDateString();
            const record = historyMap.get(dateStr);
            const isToday = dateStr === today.toDateString();
            
            let colorClass = 'bg-gray-800/30 border-gray-800 text-gray-600';
            if (record) {
              const isOver = record.task.actTime > record.task.planTime;
              colorClass = isOver 
                ? 'bg-pink-500/10 border-pink-500/40 text-pink-400' 
                : 'bg-blue-500/10 border-blue-500/40 text-blue-400';
            }

            return (
              <div key={i} className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative ${colorClass} ${isToday ? 'ring-1 ring-white' : ''}`}>
                <span className="text-xs font-medium">{d.getDate()}</span>
                {record && (
                  <span className="text-[8px] font-mono mt-0.5">
                    {Math.round(record.task.actTime)}m
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4 text-[10px] text-gray-500 mb-4">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500/50"></div>Plan &gt; Act</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500/50"></div>Plan &lt; Act</div>
        </div>
      </div>
    </div>
  );
}

function SubtaskItem({ subtask, task, updateTask }: { subtask: Task, task: Task, updateTask: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1.5 pl-2 group">
      <button 
        onClick={() => {
           const newSubs = task.subtasks!.map(s => s.id === subtask.id ? { ...s, done: !s.done } : s);
           updateTask({ ...task, subtasks: newSubs });
        }}
        className={`flex-shrink-0 w-3.5 h-3.5 border rounded-sm flex items-center justify-center transition-colors ${subtask.done ? 'bg-gray-500 border-gray-500' : 'border-gray-600 hover:border-gray-400'}`}
      >
        {subtask.done && <Check size={10} className="text-black" />}
      </button>

      <input 
        value={subtask.text}
        onChange={(e) => {
           const newSubs = task.subtasks!.map(s => s.id === subtask.id ? { ...s, text: e.target.value } : s);
           updateTask({ ...task, subtasks: newSubs });
        }}
        className={`bg-transparent text-[13px] outline-none flex-1 font-mono ${subtask.done ? 'text-gray-600 line-through' : 'text-gray-300'}`}
        placeholder="세부 실행 단계..."
      />

      <button 
        onClick={() => {
           const newSubs = task.subtasks!.filter(s => s.id !== subtask.id);
           updateTask({ ...task, subtasks: newSubs });
        }}
        className="text-gray-700 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={12} />
      </button>
      
      <div {...attributes} {...listeners} className="w-4 h-4 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50" />
    </div>
  );
}

function TaskItem({ task, updateTask, deleteTask, sensors, onShowHistory, logs }: { task: Task, updateTask: (task: Task) => void, deleteTask: (id: number) => void, sensors: any, onShowHistory: (name: string) => void, logs: DailyLog[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const [suggestions, setSuggestions] = useState<Array<{text: string, planTime: number}>>([]);
  
  const isOver = task.actTime > task.planTime;
  const progress = task.planTime > 0 ? (task.actTime / task.planTime) * 100 : 0;
  const diff = task.planTime - task.actTime;

  const getSuggestions = (input: string) => {
    if (!input.trim()) return [];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const matches = new Map<string, number[]>();
    logs.forEach(log => {
      const logDate = new Date(log.date);
      if (logDate >= threeMonthsAgo) {
        log.tasks.forEach(t => {
          if (t.text.toLowerCase().includes(input.toLowerCase())) {
            if (!matches.has(t.text)) matches.set(t.text, []);
            matches.get(t.text)!.push(t.planTime);
          }
        });
      }
    });
    
    return Array.from(matches.entries())
      .map(([text, times]) => ({ text, planTime: Math.round(times.reduce((a,b) => a+b, 0) / times.length) }))
      .slice(0, 3);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const activeStyle = task.isTimerOn 
    ? 'border-blue-500/50 bg-[#1c1c22] shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
    : 'border-white/5 bg-[#121216]';

  const barColor = isOver ? 'linear-gradient(90deg, #6366f1, #d946ef)' : '#3b82f6';

  return (
    <div ref={setNodeRef} style={style} className={`relative mb-3 rounded-xl overflow-hidden border transition-all duration-300 ${activeStyle} ${task.done ? 'opacity-40 grayscale' : ''}`}>
      
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
                        onChange={(e) => {
                            updateTask({ ...task, text: e.target.value });
                            setSuggestions(getSuggestions(e.target.value));
                        }}
                        onFocus={(e) => setSuggestions(getSuggestions(e.target.value))}
                        onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                        className={`bg-transparent text-lg font-bold outline-none w-full placeholder:text-gray-600 ${task.done ? 'text-gray-500 line-through' : 'text-white'}`}
                        placeholder="목표 (Time Block)"
                    />
                    {suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c1c22] border border-white/10 rounded-lg overflow-hidden z-50 shadow-xl">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        updateTask({ ...task, text: s.text, planTime: s.planTime });
                                        setSuggestions([]);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-blue-600/20 flex justify-between items-center text-sm"
                                >
                                    <span className="text-white font-medium">{s.text}</span>
                                    <span className="text-blue-400 text-xs font-mono">{s.planTime}m</span>
                                </button>
                            ))}
                        </div>
                    )}
                     <button {...attributes} {...listeners} className="touch-none p-1 text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing">
                        <div className="w-8 h-1 bg-gray-800 rounded-full mx-auto mb-0.5" />
                    </button>
                </div>

                <div className="flex items-center gap-3 mt-1">
                    <div className={`flex items-baseline gap-1 font-mono leading-none ${isOver ? 'text-pink-400' : 'text-blue-400'}`}>
                        <input 
                            type="number"
                            value={Math.floor(task.actTime)}
                            onChange={(e) => {
                                const m = Math.max(0, parseInt(e.target.value) || 0);
                                const s = Math.round((task.actTime % 1) * 60);
                                updateTask({ ...task, actTime: m + s / 60 });
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
                            className="w-8 bg-transparent text-xl font-black tracking-tighter text-right outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500"
                        />
                        <span className="text-xs">s</span>
                        <span className="text-[10px] text-gray-500 font-sans font-bold uppercase">/</span>
                        <input 
                            type="number"
                            value={task.planTime}
                            onChange={(e) => updateTask({ ...task, planTime: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-12 bg-transparent text-[10px] font-bold tracking-tighter text-right outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500 text-gray-400"
                        />
                        <span className="text-[10px] text-gray-500 font-sans font-bold uppercase">m</span>
                    </div>
                    
                    <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                        {isOver ? (
                            <span className="text-pink-400 flex items-center gap-1 animate-pulse">
                                BONUS <Flame size={8} />
                            </span>
                        ) : (
                            <span>{Math.ceil(diff)}m LEFT</span>
                        )}
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
                        {(task.subtasks || []).map(sub => (
                            <SubtaskItem key={sub.id} subtask={sub} task={task} updateTask={updateTask} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <div className="flex gap-3">
                    <button 
                        onClick={() => onShowHistory(task.text)}
                        className="text-gray-600 hover:text-blue-400 transition-colors"
                        title="기록 보기"
                    >
                        <BarChart2 size={14} />
                    </button>
                    <button 
                        onClick={() => {
                            const newSub: Task = { id: Date.now(), text: '', done: false, planTime: 0, actTime: 0, isTimerOn: false };
                            updateTask({ ...task, subtasks: [...(task.subtasks || []), newSub] });
                        }}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-400 py-1"
                    >
                        <Plus size={12} /> Step
                    </button>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => { if(window.confirm('포기하시겠습니까?')) deleteTask(task.id); }}
                        className="text-[10px] text-gray-700 hover:text-red-500 px-2"
                    >
                        삭제
                    </button>
                    <button 
                        onClick={() => updateTask({ ...task, done: !task.done, isTimerOn: false })}
                        className={`text-[10px] font-bold px-3 py-1 rounded transition-colors ${task.done ? 'bg-gray-700 text-gray-400' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white'}`}
                    >
                        {task.done ? '취소' : 'BLOCK 완료'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const saved = localStorage.getItem('ultra_simple_logs_v3');
    return saved ? JSON.parse(saved) : [];
  });
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data } = await supabase.from('task_logs').select('*');
        if (data && data.length > 0) {
          const supabaseLogs = data.map(item => ({ date: item.date, tasks: JSON.parse(item.tasks) }));
          setLogs(supabaseLogs);
          localStorage.setItem('ultra_simple_logs_v3', JSON.stringify(supabaseLogs));
        }
      } catch (e) { console.error(e); }
    };
    loadFromSupabase();
  }, []);

  useEffect(() => {
    const dateStr = selectedDate.toDateString();
    const log = logs.find(l => l.date === dateStr);
    setTasks(log ? log.tasks : []);
  }, [selectedDate, logs]);

  const save = (newTasks: Task[]) => {
    setTasks(newTasks);
    const dateStr = selectedDate.toDateString();
    const newLogs = [...logs];
    const idx = newLogs.findIndex(l => l.date === dateStr);
    if (idx >= 0) newLogs[idx] = { date: dateStr, tasks: newTasks };
    else newLogs.push({ date: dateStr, tasks: newTasks });
    setLogs(newLogs);
    localStorage.setItem('ultra_simple_logs_v3', JSON.stringify(newLogs));
    supabase.from('task_logs').upsert({ date: dateStr, tasks: JSON.stringify(newTasks) }).then();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(currentTasks => {
        if (!currentTasks.some(t => t.isTimerOn)) return currentTasks;
        return currentTasks.map(t => t.isTimerOn ? { ...t, actTime: t.actTime + (1/60) } : t);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tasks.length === 0) return;
    const dateStr = selectedDate.toDateString();
    const timeoutId = setTimeout(() => {
      setLogs(prev => {
          const idx = prev.findIndex(l => l.date === dateStr);
          const newLogs = [...prev];
          if (idx >= 0) newLogs[idx] = { date: dateStr, tasks };
          else newLogs.push({ date: dateStr, tasks });
          localStorage.setItem('ultra_simple_logs_v3', JSON.stringify(newLogs));
          return newLogs;
      });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [tasks, selectedDate]); 

  const addTask = (planTime: number) => {
    const newTask: Task = { 
        id: Date.now(), 
        text: '', 
        done: false, 
        planTime: planTime, 
        actTime: 0, 
        isTimerOn: false,
        subtasks: [] 
    };
    save([...tasks, newTask]);
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor), useSensor(KeyboardSensor));
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isFutureOrToday = selectedDate >= new Date(new Date().setHours(0, 0, 0, 0));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: firstDay }).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  );

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden select-none">
      
      {historyTarget && (
        <TaskHistoryModal taskName={historyTarget} logs={logs} onClose={() => setHistoryTarget(null)} />
      )}
      
      <div className="flex-none bg-[#0a0a0c] px-4 py-3 border-b border-white/5 z-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 text-gray-600 hover:text-white"><ChevronLeft size={16}/></button>
          <span className="font-bold text-sm text-gray-300">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 text-gray-600 hover:text-white"><ChevronRight size={16}/></button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[9px] text-gray-700 font-bold">{d}</div>)}
          {days.map((d: any, i) => {
             if (!d) return <div key={i} />;
             const dateStr = d.toDateString();
             const isSelected = dateStr === selectedDate.toDateString();
             const isRealToday = dateStr === new Date().toDateString();
             const log = logs.find(l => l.date === dateStr);
             const hasData = log && log.tasks.length > 0;
             const allDone = hasData && log.tasks.every(t => t.done);

             return (
               <button 
                 key={i} 
                 onClick={() => setSelectedDate(d)}
                 className={`
                   relative h-10 rounded flex flex-col items-center justify-center transition-all
                   ${isSelected ? 'bg-white text-black font-bold shadow-lg shadow-white/20' : 'text-gray-500 hover:bg-white/5'}
                   ${isRealToday && !isSelected ? 'text-blue-500' : ''}
                 `}
               >
                 <span className="text-xs">{d.getDate()}</span>
                 {hasData && (
                    <span className={`text-[7px] font-mono mt-0.5 ${isSelected ? 'text-black' : (allDone ? 'text-green-500' : 'text-gray-500')}`}>
                      {log.tasks.filter(t => t.done).length}/{log.tasks.length}
                    </span>
                 )}
               </button>
             )
          })}
        </div>
      </div>

      {/* 총 시간 비교 표시 */}
      {tasks.length > 0 && (
        <div className="flex-none bg-[#0a0a0c] px-4 py-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] text-gray-600 uppercase font-bold">Plan</span>
              <span className="text-lg font-black font-mono text-gray-400">{tasks.reduce((acc, t) => acc + t.planTime, 0)}m</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] text-gray-600 uppercase font-bold">Act</span>
              <span className={`text-lg font-black font-mono ${tasks.reduce((acc, t) => acc + t.actTime, 0) > tasks.reduce((acc, t) => acc + t.planTime, 0) ? 'text-pink-400' : 'text-blue-400'}`}>
                {Math.floor(tasks.reduce((acc, t) => acc + t.actTime, 0))}m
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden mt-2">
            <div 
              className={`h-full transition-all duration-500 ${tasks.reduce((acc, t) => acc + t.actTime, 0) > tasks.reduce((acc, t) => acc + t.planTime, 0) ? 'bg-gradient-to-r from-indigo-500 to-pink-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.min((tasks.reduce((acc, t) => acc + t.actTime, 0) / Math.max(tasks.reduce((acc, t) => acc + t.planTime, 0), 1)) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 pb-40 scrollbar-hide">
        <div className="flex items-end justify-between mb-6 px-1">
             <div>
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                    {isToday ? "Do it Now" : "Records"}
                </h2>
                <p className="text-[10px] text-gray-500 font-mono mt-1">
                    {selectedDate.toLocaleDateString()}
                </p>
             </div>
             {tasks.length > 0 && (
                 <div className="flex flex-col items-end">
                     <span className="text-[10px] text-gray-600 uppercase font-bold">Progress</span>
                     <span className="text-sm font-mono text-blue-400">
                         {tasks.filter(t => t.done).length} / {tasks.length}
                     </span>
                 </div>
             )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e: DragEndEvent) => {
             const {active, over} = e;
             if (active.id !== over?.id) {
               const oldIdx = tasks.findIndex(t => t.id === active.id);
               const newIdx = tasks.findIndex(t => t.id === over?.id);
               save(arrayMove(tasks, oldIdx, newIdx));
             }
        }}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map(task => (
                <TaskItem key={task.id} task={task} updateTask={(t) => save(tasks.map(x => x.id === t.id ? t : x))} deleteTask={(id) => save(tasks.filter(x => x.id !== id))} sensors={sensors} onShowHistory={(name) => setHistoryTarget(name)} logs={logs} />
              ))}
            </SortableContext>
        </DndContext>

        {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-24 opacity-20">
                <Clock size={48} className="mb-4" />
                <span className="text-xs font-bold tracking-widest">NO PLAN</span>
            </div>
        )}
      </div>

      {isFutureOrToday && (
          <div className="flex-none bg-[#0a0a0c]/90 backdrop-blur-xl border-t border-white/5 p-4 pb-8">
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Add Time Block</span>
            </div>
            <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
              {[30, 60, 90].map(min => (
                  <button key={min} onClick={() => addTask(min)} className="group bg-[#1c1c22] hover:bg-white hover:text-black text-gray-400 font-bold py-3 rounded-xl transition-all border border-white/5 active:scale-95">
                    <span className="text-xl group-hover:text-black">{min}</span>
                    <span className="text-[9px] uppercase block -mt-1 opacity-50">min</span>
                 </button>
              ))}
              <button onClick={() => addTask(0)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors flex flex-col items-center justify-center gap-0.5 active:scale-95 shadow-lg shadow-blue-900/20">
                 <Plus size={20} />
                 <span className="text-[9px] uppercase opacity-80">Custom</span>
              </button>
            </div>
          </div>
      )}
    </div>
  );
}
