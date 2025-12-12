import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Pause, GripVertical, BarChart2, X, Check, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

// --- 데이터 타입 ---
type Task = {
  id: number;
  text: string;
  done: boolean;
  percent: number;      
  planTime: number;     
  actTime: number;      
  isTimerOn: boolean;
  timerStartTime?: number; // 타이머 시작 시간 (timestamp)
  parentId?: number; // 상위할일 ID
  subtasks?: Task[]; // 하위할일들
};

type DailyLog = {
  date: string;
  tasks: Task[];
};

// --- 유틸 ---
const formatFullTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  // 0시간일 때도 분/초 표시, 0분일 때도 초 표시
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`; 
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

// --- [컴포넌트] 하위할일 아이템 ---
function SubtaskItem({ subtask, task, updateTask, setFocusedSubtaskId }: { subtask: Task, task: Task, updateTask: (task: Task) => void, setFocusedSubtaskId: (id: number | null) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="group flex items-center gap-2 py-1.5 pl-2 pr-1 bg-black/30 hover:bg-black/50 rounded-lg transition-colors border border-transparent hover:border-white/5">
        <button {...attributes} {...listeners} className="text-gray-600 hover:text-white p-1 touch-none">
          <GripVertical size={12} />
        </button>
        
        <button 
          onClick={() => {
            const updatedSubtask = { ...subtask, done: !subtask.done };
            const updatedTask = {
              ...task,
              subtasks: task.subtasks!.map(st => st.id === updatedSubtask.id ? updatedSubtask : st)
            };
            updateTask(updatedTask);
          }}
          className={`flex-shrink-0 transition-colors ${subtask.done ? 'text-emerald-500' : 'text-gray-800 hover:text-gray-600'}`}
        >
          <Check size={12} strokeWidth={4} />
        </button>
      
        <input 
          type="text" 
          value={subtask.text}
          onChange={(e) => {
            const updatedSubtask = { ...subtask, text: e.target.value };
            const updatedTask = {
              ...task,
              subtasks: task.subtasks!.map(st => st.id === updatedSubtask.id ? updatedSubtask : st)
            };
            updateTask(updatedTask);
          }}
          onFocus={() => setFocusedSubtaskId(subtask.id)}
          onBlur={() => setFocusedSubtaskId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const newSubtask: Task = {
                id: Date.now(),
                text: '',
                done: false,
                percent: 0,
                planTime: 15,
                actTime: 0,
                isTimerOn: false,
                parentId: task.id
              };
              const updatedTask = {
                ...task,
                subtasks: [...(task.subtasks || []), newSubtask]
              };
              updateTask(updatedTask);
            }
          }}
          className={`flex-1 bg-transparent outline-none text-xs ${subtask.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}
        />
        
        <button 
          onClick={() => {
            if(window.confirm('삭제하시겠습니까?')) {
              const updatedTask = {
                ...task,
                subtasks: task.subtasks!.filter(st => st.id !== subtask.id)
              };
              updateTask(updatedTask);
            }
          }}
          className="text-gray-700 hover:text-rose-500 active:text-rose-500 p-1 transition-colors"
        >
          <X size={10} />
        </button>
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
function TaskItem({ task, updateTask, deleteTask, onShowHistory, isPlanning, sensors, onChangeDate }: { task: Task, updateTask: (task: Task) => void, deleteTask: (id: number) => void, onShowHistory: (name: string) => void, isPlanning?: boolean, sensors: any, onChangeDate?: (taskId: number, newDate: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubtasksCollapsed, setIsSubtasksCollapsed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);


  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div>
      <div ref={setNodeRef} style={style} className={`group flex flex-col gap-1 py-2 px-3 mb-2 rounded-2xl border transition-all ${task.done ? 'bg-black/20 border-white/5 opacity-60' : task.isTimerOn ? 'bg-[#0f0f14] border-indigo-500/50 shadow-[0_0_20px_-5px_rgba(99,102,241,0.4)]' : 'bg-[#0f0f14] border-white/5 hover:border-white/10'} ${task.parentId ? 'ml-6' : ''}`}>
      {/* 상단: 제목 줄 */}
      <div className="flex items-center gap-1.5">
        {/* 핸들 */}
        <button {...attributes} {...listeners} className="text-gray-600 hover:text-white p-0.5 touch-none">
          <GripVertical size={14} />
        </button>
        
        {/* 체크 (완료) */}
        <button 
          onClick={() => updateTask({ ...task, done: !task.done })} 
          className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border transition-all ${task.done ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-transparent border-gray-700 text-transparent hover:border-gray-500'}`}
        >
          <Check size={10} strokeWidth={4} />
        </button>

        {/* 제목 (한 줄로 쭉) */}
        <input 
          type="text" 
          value={task.text}
          onChange={(e) => updateTask({ ...task, text: e.target.value })}
          className={`flex-1 bg-transparent outline-none text-xs whitespace-nowrap ${task.done ? 'text-gray-500 line-through' : 'text-white'}`}
        />
        
        {/* 삭제 버튼 */}
        <button 
          onMouseDown={() => setIsDeleting(true)}
          onMouseUp={() => setIsDeleting(false)}
          onTouchStart={() => setIsDeleting(true)}
          onTouchEnd={() => setIsDeleting(false)}
          onClick={() => {
            if(window.confirm('삭제하시겠습니까?')) {
              deleteTask(task.id);
            }
          }} 
          className={`p-0.5 transition-colors ${isDeleting ? 'text-rose-500' : 'text-gray-700'}`}
        >
          <X size={12} />
        </button>
      </div>

      {/* 하단: 컨트롤들 일렬 배치 (오른쪽 정렬) */}
      {isPlanning !== true && (
      <div className="flex items-center justify-end gap-2 text-xs">
        {/* 날짜 변경 버튼 */}
        {onChangeDate && (
          <>
            <button 
              onClick={() => setShowDatePicker(true)}
              className="text-gray-700 hover:text-blue-400 p-0.5" 
              title="날짜 변경"
            >
              <Calendar size={12} />
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
        {/* 하위할일 추가 버튼 */}
        {!task.parentId && (
          <button 
            onClick={() => {
              setIsSubtasksCollapsed(false);
              const newSubtask: Task = {
                id: Date.now(),
                text: '',
                done: false,
                percent: 0,
                planTime: 15,
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
            className="text-gray-600 hover:text-blue-400"
          >
            +
          </button>
        )}

        
        {/* 히스토리 버튼 */}
        <button onClick={() => onShowHistory(task.text)} className="text-gray-700 hover:text-blue-400 p-0.5" title="기록">
          <BarChart2 size={12} />
        </button>

        {/* 퍼센트 */}
        <div className="flex items-center bg-gray-900 rounded px-1.5 py-0.5 border border-gray-800">
          <input 
            type="number" min="0" max="100" step="1"
            value={task.percent}
            onChange={(e) => {
               let val = parseFloat(e.target.value);
               if(val < 0) val = 0; if(val > 100) val = 100;
               updateTask({ ...task, percent: val });
            }}
            className="w-7 bg-transparent text-right text-blue-400 font-bold outline-none text-[10px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-gray-600 text-[10px]">%</span>
        </div>

        {/* Plan Time */}
        <div className="flex items-center bg-gray-900 rounded px-1.5 py-0.5 border border-gray-800">
          <span className="text-[10px] text-gray-500 opacity-50">P</span>
          <input 
            type="number" min="0"
            value={task.planTime}
            onChange={(e) => updateTask({ ...task, planTime: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-7 bg-transparent text-right text-gray-400 outline-none text-[10px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
          />
        </div>
        
        {/* Actual Time + Timer */}
        <div className={`flex items-center gap-0.5 bg-gray-900 rounded px-1.5 py-0.5 border border-gray-800 ${task.isTimerOn ? 'text-green-400' : 'text-gray-400'}`}>
          <button onClick={() => updateTask({ ...task, isTimerOn: !task.isTimerOn })}>
            {task.isTimerOn ? <Pause size={9} className="fill-current" /> : <Play size={9} className="fill-current" />}
          </button>
          <input 
            type="number" min="0"
            value={Math.floor(task.actTime)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                updateTask({ ...task, actTime: 0 + Math.floor((task.actTime % 1) * 60) / 60 });
              } else {
                const newMinutes = Math.max(0, parseInt(val));
                const keepSeconds = Math.floor((task.actTime % 1) * 60);
                updateTask({ ...task, actTime: newMinutes + keepSeconds / 60 });
              }
            }}
            className="w-5 bg-transparent text-right outline-none text-[10px] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[10px]">m</span>
          <input 
            type="number" min="0" max="59"
            value={Math.floor((task.actTime % 1) * 60)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                updateTask({ ...task, actTime: Math.floor(task.actTime) });
              } else {
                const keepMinutes = Math.floor(task.actTime);
                const newSeconds = Math.max(0, Math.min(59, parseInt(val)));
                updateTask({ ...task, actTime: keepMinutes + newSeconds / 60 });
              }
            }}
            className="w-5 bg-transparent text-right outline-none text-[10px] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none -ml-1.5"
          />
          <span className="text-[10px]">s</span>
        </div>
      </div>
      )}
      </div>
      
      {/* 하위할일들 (간단한 형태) */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className={`ml-6 space-y-1 ${!isSubtasksCollapsed ? 'pb-3' : ''}`}>
          <button 
            onClick={() => setIsSubtasksCollapsed(!isSubtasksCollapsed)}
            className="w-full h-[12px] bg-gray-1000/30 hover:bg-gray-900/50 transition-colors relative flex items-center justify-center"
          >
            <span className="text-[8px] text-gray-500 absolute">{isSubtasksCollapsed ? '▼' : '▲'}</span>
          </button>
          
          {!isSubtasksCollapsed && (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => {
                const { active, over } = event;
                if (active.id !== over?.id) {
                  const oldIndex = task.subtasks!.findIndex((st: Task) => st.id === active.id);
                  const newIndex = task.subtasks!.findIndex((st: Task) => st.id === over?.id);
                  const reorderedSubtasks = arrayMove(task.subtasks!, oldIndex, newIndex);
                  const updatedTask = { ...task, subtasks: reorderedSubtasks };
                  updateTask(updatedTask);
                }
              }}>
                <SortableContext items={task.subtasks!.map((st: Task) => st.id)} strategy={verticalListSortingStrategy}>
                  {task.subtasks.map((subtask: Task) => (
                    <SubtaskItem 
                      key={subtask.id} 
                      subtask={subtask} 
                      task={task} 
                      updateTask={updateTask} 
                      setFocusedSubtaskId={setFocusedSubtaskId}
                    />
                  ))}
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
                        done: false,
                        percent: 0,
                        planTime: 15,
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- 메인 앱 ---
export default function App() {
  const [mode, setMode] = useState<'PLANNING' | 'FOCUS' | 'SUMMARY' | 'HISTORY'>(() => {
    const saved = localStorage.getItem('ultra_mode');
    const now = new Date();
    // 23시 이후면 SUMMARY 모드로 시작
    if (now.getHours() >= 23 && saved === 'FOCUS') {
      return 'SUMMARY';
    }
    return (saved as any) || 'PLANNING';
  });

  useEffect(() => {
    localStorage.setItem('ultra_mode', mode);
    // PLANNING이나 FOCUS 모드로 전환하면 오늘 날짜로 설정
    if (mode === 'PLANNING' || mode === 'FOCUS') {
      setViewDate(new Date());
    }
  }, [mode]);
  const [viewDate, setViewDate] = useState(new Date());
  
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const saved = localStorage.getItem('ultra_tasks_v3');
    return saved ? JSON.parse(saved) : [];
  });

  // Supabase에서 데이터 로드
  useEffect(() => {
    const loadFromSupabase = async () => {
      try {
        const { data } = await supabase.from('task_logs').select('*');
        if (data && data.length > 0) {
          const supabaseLogs = data.map(item => ({
            date: item.date,
            tasks: JSON.parse(item.tasks)
          }));
          setLogs(supabaseLogs);
          localStorage.setItem('ultra_tasks_v3', JSON.stringify(supabaseLogs));
        }
      } catch (error) {
        console.log('Supabase load error:', error);
      }
    };
    loadFromSupabase();
  }, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // 히스토리 모달 상태
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);

  const [newTask, setNewTask] = useState('');
  const [suggestions, setSuggestions] = useState<Task[]>([]); 
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [summaryStep, setSummaryStep] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 11시 자동 정산
  useEffect(() => {
    const checkTime = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() === 0 && now.getSeconds() === 0 && mode === 'FOCUS') startSummary();
    }, 1000);
    return () => clearInterval(checkTime);
  }, [mode]);

  // 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        if (!prev.some(t => t.isTimerOn)) return prev;
        return prev.map(t => t.isTimerOn ? { ...t, actTime: t.actTime + (1 / 60) } : t);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 저장/로드 + Supabase 동기화
  useEffect(() => { 
    localStorage.setItem('ultra_tasks_v3', JSON.stringify(logs)); 
    // Supabase에 동기화
    if (logs.length > 0) {
      supabase.from('task_logs').upsert(logs.map(log => ({
        date: log.date,
        tasks: JSON.stringify(log.tasks)
      }))).then(({ error }) => {
        if (error) console.log('Supabase sync error:', error);
      });
    }
  }, [logs]);
  useEffect(() => {
    const dateStr = viewDate.toDateString();
    const log = logs.find(l => l.date === dateStr);
    if (log) setTasks(log.tasks);
    else setTasks([]);
  }, [viewDate]); 

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
    const newTaskObj: Task = { id: Date.now(), text: newTask, done: false, percent: 0, planTime: 30, actTime: 0, isTimerOn: false, subtasks: [] };
    updateLogs([...tasks, newTaskObj]);
    setNewTask(''); setSuggestions([]);
  };

  const updateTask = (updated: Task) => updateLogs(tasks.map(t => t.id === updated.id ? updated : t));
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
      id: Date.now(),          // ID 새로 발급
      text: pastTask.text,     // 이름 가져옴
      done: false,             // 완료 여부 리셋
      isTimerOn: false,        // 타이머 끔
      actTime: 0,              // 실제 시간 리셋
      
      // ▼▼▼ 여기가 핵심입니다. 과거 기록을 강제로 주입합니다. ▼▼▼
      percent: pastTask.percent || 0,        // 퍼센트 가져옴
      planTime: pastTask.planTime || 30,     // 계획 시간 가져옴
      
      // 하위할일도 복사 (완료된 것은 제외, done=false로 리셋)
      subtasks: pastTask.subtasks ? pastTask.subtasks
        .filter(st => !st.done)  // 완료된 하위할일은 제외
        .map(st => ({
          ...st,
          id: Date.now() + Math.random(), // 새 ID 발급
          done: false,                     // 완료 여부 리셋
          isTimerOn: false,                // 타이머 끔
          actTime: 0,                      // 실제 시간 리셋
          parentId: Date.now()             // 새 부모 ID
        })) : []
    };
    
    updateLogs([...tasks, newTaskObj]);
    setNewTask('');
    setSuggestions([]);
  };

  const startSummary = () => {
    setMode('SUMMARY');
    setSummaryStep(0);
    setTimeout(() => setSummaryStep(1), 1000);
    setTimeout(() => setSummaryStep(2), 2500);
    setTimeout(() => setSummaryStep(3), 4000);
    setTimeout(() => setSummaryStep(4), 5500);
    setTimeout(() => setSummaryStep(5), 7000);
    setTimeout(() => setSummaryStep(6), 8500);
  };

  // 앱 시작 시 SUMMARY 모드면 애니메이션 실행
  useEffect(() => {
    if (mode === 'SUMMARY') {
      startSummary();
    }
  }, []);

  const completedCount = tasks.filter(t => t.done).length;

  // 완료율에 따른 평가 메시지 (날짜 기반으로 고정)
  const getEvaluationMessage = (completionRate: number, dateStr: string) => {
    const messages = {
      veryLow: ["시작이 반은 무슨, 시작은 그냥 0이다.", "시작이 반이라던데 아직 0임", "숨 쉬는 거 빼고 다 귀찮네", "내일의 내가 욕하고 있을 듯", "폰 볼 시간은 있고 이거 할 시간은 없지", "일단 눕고 생각할까", "로딩 중... 뇌가 연결되지 않음", "의욕 0, 귀찮음 100", "이거 꼭 해야 됨? (ㅇㅇ 해야 됨)", "시작 버튼 누르는 게 제일 힘듦", "도망치고 싶다 격렬하게", "청소 핑계 그만 대라", "멍 때리다 10분 순삭", "하기 싫어서 몸 비트는 중", "딱 5분만 더... 하다가 망함", "누구 머리 대신 써줄 사람", "영감님은 안 오신다 그냥 해라", "침대랑 접착제로 붙은 듯", "오늘따라 벽지가 재밌네", "숨 참고 다이브 말고 그냥 다이브 하고 싶다", "계획은 완벽했지, 실행이 문제지", "뇌세포 파업 선언", "미루기의 신 강림", "지금 안 하면 이따가 피눈물", "손가락 하나 움직이기 싫음", "0에서 1 만드는 게 제일 빡셈", "유튜브 알고리즘이 날 놔주질 않네", "슬슬 발등 뜨거워질 시간", "아 몰라 배째", "생각만 하다가 하루 다 감", "일단 앱 켠 게 어디냐"],
      low: ["하긴 하는데, 티가 안 나네 티가.", "진도가 안 나감. 고장 났나?", "딴짓하느라 바쁨", "집중력 5분을 못 넘김", "영혼 없이 손만 움직이는 중", "이 속도면 내년에 끝남", "좀비 모드 ON", "뇌는 멈췄고 손만 일함", "아 당 떨어진다", "폰 좀 그만 봐 제발", "내가 뭘 하고 있는지 까먹음", "노동요 고르다 시간 다 감", "진척도 1도 안 오르는 마법", "슬슬 엉덩이 아픔", "고지가 안 보여", "배고픈데 밥부터 먹을까? (안 됨)", "머리는 거부하고 몸은 억지로 함", "모니터 뚫어지겠다", "아직도 초반인 게 레전드", "누가 시간 좀 멈춰봐", "멍하니 있다가 침 흘릴 뻔", "카페인으로 버티는 중", "격하게 아무것도 안 하고 싶다", "억지로 끌려가는 기분", "지금 포기하면 쓰레기겠지", "산 넘어 산이네", "백스페이스를 더 많이 누름", "눈이 침침해짐", "그냥 잘까? (악마의 속삭임)", "늪에 빠진 기분", "물음표 살인마 빙의 중"],
      medium: ["반이나 남았어? 반밖에 안 했어?", "반타작 인생", "웃음이 실실 나네 미쳤나", "아직도 반이나 남음", "기계처럼 하는 중", "뇌 빼고 손만 움직여", "슬슬 눈에 뵈는 게 없음", "마우스 던질 뻔", "돌아가기엔 너무 멀리 옴", "해탈의 경지", "오늘 안에 끝나긴 하냐", "퀄리티 타협 중", "나 자신과의 싸움 (지는 중)", "뇌가 흐물흐물해짐", "여기가 어디요 나는 누구요", "악으로 깡으로 버텨", "정신줄 잡아라", "40과 60 사이의 림보", "스트레스 지수 폭발", "이 짓을 왜 시작했을까", "시스템 종료 마렵다", "완벽주의 갖다 버림", "허리 끊어질 듯", "사리 나오겠다", "그냥 대충 할까", "중꺾마는 무슨 그냥 꺾임", "영혼 가출", "인간 승리 도전 중", "멘탈 바사삭", "좀비처럼 걷는 중", "비명 지르고 싶다"],
      high: ["어? 이거 끝나겠는데?", "이제 좀 속도 붙네", "비켜 방해하지 마", "갑자기 삘 받음", "끝이 보인다 보여", "아드레날린 도는 중", "미친 속도, 오타는 나중에", "내가 이걸 해내네", "불도저 모드 가동", "막판 스퍼트", "전투력 상승", "존버는 승리한다", "터널 끝에 빛이 보임", "밥 안 먹어도 배부름 (뻥임)", "멈추면 죽는 병 걸림", "집중력 최고조", "딴짓만 안 하면 금방임", "런닝맨 찍는 기분", "빈칸 채워지는 맛", "슬슬 끝낼 준비", "뒷심 발휘 중", "각성 상태", "눕기 1시간 전", "에라 모르겠다 질러", "마법처럼 채워짐", "손가락에서 연기 남", "70 넘으면 다 한 거지", "설레발 치는 중", "누구도 날 막을 수 없다", "저장 버튼 연타 중", "곧 자유다"],
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

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans overflow-y-auto selection:bg-indigo-500/30">
      <div className="max-w-xl mx-auto min-h-screen flex flex-col p-4 pb-24">
        
        {/* 모달: 태스크 히스토리 */}
        {historyTarget && (
          <TaskHistoryModal taskName={historyTarget} logs={logs} onClose={() => setHistoryTarget(null)} />
        )}

        {/* PLANNING */}
        {mode === 'PLANNING' && (
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-gray-600 text-xs tracking-[0.3em] mb-6 text-center">PLANNING</h1>
            {/* 수정 후: TaskItem을 사용하여 수정/삭제/순서변경 가능 */}
            <div className="space-y-1 mb-8">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {tasks.map(task => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      updateTask={updateTask}
                      deleteTask={deleteTask}
                      onShowHistory={(name: string) => setHistoryTarget(name)}
                      isPlanning={true}
                      sensors={sensors}
                      onChangeDate={undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            {/* 자동완성 칩 (입력창 위에) */}
            {suggestions.length > 0 && (
              <div className="flex gap-2 justify-center mb-4 overflow-x-auto scrollbar-hide">
                {suggestions.map((s, idx) => (
                  <button 
                    key={s.id} 
                    onClick={() => selectSuggestion(s)} 
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-blue-300 border whitespace-nowrap hover:bg-gray-700 flex-shrink-0 text-sm ${selectedSuggestionIndex === idx ? 'bg-gray-700 border-blue-500' : 'bg-gray-800 border-blue-900/30'}`}
                  >
                    <span className="font-bold text-white">{s.text}</span>
                    <span className="text-gray-500 text-xs">({s.planTime}m / {s.percent}%)</span>
                  </button>
                ))}
              </div>
            )}
            <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { 
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
            }} placeholder="오늘의 목표..." className="w-full bg-transparent text-center text-lg outline-none border-b-2 border-gray-700 focus:border-white pb-2 placeholder:text-gray-700 transition-colors" autoFocus />
            <div className="text-center mt-8">
              <button onClick={() => setMode('FOCUS')} className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-all">START DAY</button>
            </div>
          </div>
        )}

        {/* FOCUS */}
        {mode === 'FOCUS' && (
          <div className="flex-1 flex flex-col pt-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl font-bold tracking-tight text-white">TODAY'S PLAN</h1>
              <button onClick={() => setMode('HISTORY')} className="text-xs text-gray-500 hover:text-white">{new Date().toDateString()}</button>
            </div>
            <div className="flex-1 space-y-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {tasks.map(task => (
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
            </div>

            {/* FOCUS 모드 하단 입력창 */}
            <div className="p-3 bg-[#0a0a0f]/90 backdrop-blur-xl border-t border-white/5">
              
              <div className="flex flex-col-reverse gap-2">
                {/* 입력 */}
                <input 
                  type="text" 
                  value={newTask} 
                  onChange={(e) => setNewTask(e.target.value)} 
                  onKeyDown={(e) => { 
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
                  placeholder="할 일 입력..." 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                />

                {/* 자동완성 칩 (입력창 바로 위에 고정됨) */}
                {suggestions.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {suggestions.map((s, idx) => (
                      <button 
                        key={s.id} 
                        onClick={() => selectSuggestion(s)} 
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-blue-300 border whitespace-nowrap hover:bg-gray-700 flex-shrink-0 text-sm ${selectedSuggestionIndex === idx ? 'bg-gray-700 border-blue-500' : 'bg-gray-800 border-blue-900/30'}`}
                      >
                        <span className="font-bold text-white">{s.text}</span>
                        <span className="text-gray-500 text-xs">({s.planTime}m / {s.percent}%)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center py-6">
              <button onClick={() => setMode('PLANNING')} className="text-xs text-gray-500 hover:text-white transition-colors">← PLANNING</button>
              <button onClick={() => { if(window.confirm('하루를 종료하시겠습니까?')) startSummary(); }} className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-all whitespace-nowrap">FINISH DAY</button>
              <button onClick={() => setMode('HISTORY')} className="text-xs text-gray-500 hover:text-white transition-colors">CALENDAR →</button>
            </div>
          </div>
        )}

        {/* SUMMARY (턱턱턱) */}
        {mode === 'SUMMARY' && (
          <div className="flex-1 flex flex-col justify-center space-y-10 py-10">
            <div className={`transition-all duration-700 ${summaryStep >= 1 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
              <h2 className="text-blue-500 text-xs font-bold tracking-widest mb-3">원하는 것들</h2>
              <div className={`space-y-2 transition-all duration-700 ${summaryStep >= 2 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
                {tasks.map(t => (
                  <div key={t.id} className="flex justify-between text-gray-400 py-1 border-b border-gray-800"><span>{t.text}</span><span className="font-mono text-xs">{t.planTime}m</span></div>
                ))}
              </div>
            </div>
            <div className={`transition-all duration-700 ${summaryStep >= 3 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
              <h2 className="text-green-500 text-xs font-bold tracking-widest mb-3">완료한 일들</h2>
              <div className={`space-y-2 transition-all duration-700 ${summaryStep >= 4 ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
                {tasks.filter(t => t.done).length > 0 ? tasks.filter(t => t.done).map(t => (
                  <div key={t.id} className="flex justify-between text-white py-1 border-b border-gray-800">
                    <span>{t.text}</span>
                    <div className="flex gap-3 text-xs font-mono"><span className="text-gray-500">{formatFullTime(t.actTime)}</span><span className="text-blue-400">{t.percent}%</span></div>
                  </div>
                )) : <div className="text-gray-600 text-sm">No completed tasks</div>}
              </div>
            </div>
            {/* 3. 점수 표시 부분 (수정) */}
            <div className={`text-center pt-6 transition-all duration-700 ${summaryStep >= 5 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
              <div className="text-4xl font-thin text-white">
                {completedCount}<span className="text-xl text-gray-700 font-thin mx-1"> / </span>{tasks.length}<span className="text-lg text-gray-500 font-thin"> ({tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%)</span>
              </div>
              
              {/* 평가 메시지 */}
              <div className="mt-3 text-sm text-blue-400 font-medium">
                {getEvaluationMessage(tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0, viewDate.toDateString())}
              </div>
              
              <div className="mt-6 flex justify-center gap-6 border-t border-gray-900/50 pt-4">
                <div className="text-center">
                  <div className="text-[9px] text-blue-500 mb-1 tracking-widest font-bold">TOTAL PLAN</div>
                  <div className="text-gray-400 font-mono font-bold text-sm">
                    {formatFullTime(tasks.reduce((acc, t) => acc + t.planTime, 0))}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] text-green-500 mb-1 tracking-widest font-bold">TOTAL ACTUAL</div>
                  <div className="text-white font-mono font-bold text-sm">
                    {formatFullTime(tasks.reduce((acc, t) => acc + t.actTime, 0))}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] text-green-500 mb-1 tracking-widest font-bold opacity-0">.</div>
                  <div className="text-gray-400 font-mono font-bold text-sm">
                    ({(() => {
                      const totalPlan = tasks.reduce((acc, t) => acc + t.planTime, 0);
                      const totalActual = tasks.reduce((acc, t) => acc + t.actTime, 0);
                      return totalPlan > 0 ? (totalActual / totalPlan * 100).toFixed(1) : '0.0';
                    })()}%)
                  </div>
                </div>
              </div>
            </div>
            <div className={`text-center transition-all duration-1000 ${summaryStep >= 6 ? 'opacity-100' : 'opacity-0'}`}>
              <button onClick={() => { setMode('HISTORY'); setViewDate(new Date()); }} className="px-8 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200">NEXT</button>
            </div>
          </div>
        )}

        {/* === HISTORY 모드 (수정된 버전) === */}
        {mode === 'HISTORY' && (
          <div className="flex-1 flex flex-col pt-6">
            
            {/* 1. 상단 캘린더 */}
            <div className="mb-8 bg-[#0f0f14]/50 backdrop-blur-sm p-5 rounded-3xl border border-white/5">
              <div className="flex items-center mb-4 px-2">
                <div className="flex gap-2 w-24">
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))} className="text-gray-500 hover:text-white"><ChevronLeft size={16} /></button>
                  <span className="font-bold text-sm text-white">{viewDate.getFullYear()}</span>
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))} className="text-gray-500 hover:text-white"><ChevronRight size={16} /></button>
                </div>
                <div className="flex-1 flex justify-center items-center gap-2">
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="text-gray-400 hover:text-white"><ChevronLeft size={20} /></button>
                  <span className="font-bold text-lg text-white">{viewDate.toLocaleString('default', { month: 'long' })}</span>
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

            {/* 2. 하단 리스트 (여기가 핵심 수정됨: 타겟/결과 분리 + 수정 가능) */}
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
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-blue-300 border whitespace-nowrap hover:bg-gray-700 flex-shrink-0 text-sm ${selectedSuggestionIndex === idx ? 'bg-gray-700 border-blue-500' : 'bg-gray-800 border-blue-900/30'}`}
                      >
                        <span className="font-bold text-white">{s.text}</span>
                        <span className="text-gray-500 text-xs">({s.planTime}m / {s.percent}%)</span>
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

              {/* 통계 요약 (SUMMARY와 동일한 디자인) */}
              {tasks.length > 0 && (
                <div className="mt-6 text-center pt-6 border-t border-gray-900/50">
                  <div className="text-4xl font-thin text-white">
                    {tasks.filter(t => t.done).length}<span className="text-xl text-gray-700 font-thin mx-1"> / </span>{tasks.length}<span className="text-lg text-gray-500 font-thin"> ({tasks.length > 0 ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0}%)</span>
                  </div>
                  
                  {/* 평가 메시지 */}
                  <div className="mt-3 text-sm text-blue-400 font-medium">
                    {getEvaluationMessage(tasks.length > 0 ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0, viewDate.toDateString())}
                  </div>
                  
                  <div className="mt-6 flex justify-center gap-6 border-t border-gray-900/50 pt-4">
                    <div className="text-center">
                      <div className="text-[9px] text-blue-500 mb-1 tracking-widest font-bold">TOTAL PLAN</div>
                      <div className="text-gray-400 font-mono font-bold text-sm">
                        {formatFullTime(tasks.reduce((acc, t) => acc + t.planTime, 0))}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-green-500 mb-1 tracking-widest font-bold">TOTAL ACTUAL</div>
                      <div className="text-white font-mono font-bold text-sm">
                        {formatFullTime(tasks.reduce((acc, t) => acc + t.actTime, 0))}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-green-500 mb-1 tracking-widest font-bold opacity-0">.</div>
                      <div className="text-gray-400 font-mono font-bold text-sm">
                        ({(() => {
                          const totalPlan = tasks.reduce((acc, t) => acc + t.planTime, 0);
                          const totalActual = tasks.reduce((acc, t) => acc + t.actTime, 0);
                          return totalPlan > 0 ? (totalActual / totalPlan * 100).toFixed(1) : '0.0';
                        })()}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 하단 버튼 */}
              <div className="text-center mt-12">
                <button onClick={() => { setViewDate(new Date()); setMode('FOCUS'); }} className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-all whitespace-nowrap">BACK TO DETAIL</button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}