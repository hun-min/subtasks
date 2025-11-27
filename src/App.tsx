import React, { useState, useEffect } from 'react';
import { useSystem } from './hooks/useSystem';
import { Target, Task, db } from './db';

// --- Icons ---
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const HistoryIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const UndoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>;
const FocusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>;
const TargetIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>;
const ActionIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M9 18l6-6-6-6"></path></svg>;
const DiceIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 8h.01"></path><path d="M8 8h.01"></path><path d="M8 16h.01"></path><path d="M16 16h.01"></path><path d="M12 12h.01"></path></svg>;
const LockIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
const CalendarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;

export default function App() {
  const { allSpaces, activeTasks, completedTasks, allTargets, searchTargets, searchActions, completeTask, completeTarget, updateTaskTitle, updateTargetTitle, undoTask, undoTarget, deleteTask, deleteGroup, addTask, addTarget, addSpace, updateSpace, deleteSpace, updateTargetUsage } = useSystem();
  
  const [objValue, setObjValue] = useState(''); 
  const [actValue, setActValue] = useState(''); 
  const [suggestions, setSuggestions] = useState<Target[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInputMode, setIsInputMode] = useState(false); 
  const [focusedInput, setFocusedInput] = useState<'obj' | 'act'>('obj');
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null); 
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<{type: 'target'|'task', id: number} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, type: 'group' | 'task' | 'space', id: number, title: string } | null>(null);
  const [spotlightGroup, setSpotlightGroup] = useState<string | null>(null);
  const [currentSpaceId, setCurrentSpaceId] = useState<number | null>(() => {
    const saved = localStorage.getItem('currentSpaceId');
    return saved ? parseInt(saved) : null;
  });

  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [editSpaceTitle, setEditSpaceTitle] = useState('');
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [addingTaskToTarget, setAddingTaskToTarget] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [history, setHistory] = useState<number[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [gachaTask, setGachaTask] = useState<{task: Task, targetTitle: string} | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getTaskAgeStyle = (createdAt: Date) => {
      const diffMs = new Date().getTime() - new Date(createdAt).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 3) return "text-red-400 opacity-60";
      if (diffDays > 1) return "text-yellow-500";
      return "text-gray-300";
  };

  const runGacha = () => {
      if (!activeTasks || activeTasks.length === 0) return;
      const randomTask = activeTasks[Math.floor(Math.random() * activeTasks.length)];
      const targetTitle = getTargetTitle(randomTask.targetId) || 'Unknown';
      setGachaTask({ task: randomTask, targetTitle });
  };

  const groupedTasks = React.useMemo(() => {
    if (!activeTasks || !allTargets) return {};
    const groups: Record<string, Task[]> = {};
    activeTasks.forEach(task => {
        const target = allTargets.find(t => t.id === task.targetId);
        if (!target || target.isCompleted) return;
        if (currentSpaceId && target.spaceId !== currentSpaceId) return;
        const title = target.title || 'Uncategorized';
        if (!groups[title]) groups[title] = [];
        groups[title].push(task);
    });
    return groups;
  }, [activeTasks, allTargets, currentSpaceId]);

  const activeTargets = React.useMemo(() => {
    if (!allTargets || !currentSpaceId) return [];
    const filtered = allTargets.filter(t => !t.isCompleted && t.spaceId === currentSpaceId);
    return [...filtered].sort((a, b) => {
        const timeA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const timeB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return timeB - timeA;
    });
  }, [allTargets, currentSpaceId]);

  const isWipLimitReached = activeTargets.length >= 3;

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const completedDates = React.useMemo(() => {
    const dates = new Set<string>();
    completedTasks?.forEach(task => {
      const d = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
      dates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    });
    return dates;
  }, [completedTasks]);

  const filteredCompletedTasks = React.useMemo(() => {
    if (!completedTasks) return [];
    if (!selectedDate) return completedTasks;
    return completedTasks.filter(task => {
      const taskDate = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
      const dateStr = `${taskDate.getFullYear()}-${taskDate.getMonth() + 1}-${taskDate.getDate()}`;
      return dateStr === selectedDate;
    });
  }, [completedTasks, selectedDate]);

  useEffect(() => {
    const initSpace = async () => {
      const saved = localStorage.getItem('currentSpaceId');
      const spaces = await db.spaces.toArray();
      if (saved && spaces.find(s => s.id === parseInt(saved))) {
        setCurrentSpaceId(parseInt(saved));
      } else if (spaces.length > 0) {
        setCurrentSpaceId(spaces[0].id!);
      }
    };
    initSpace();
  }, [allSpaces]);

  useEffect(() => {
    if (currentSpaceId) {
      localStorage.setItem('currentSpaceId', currentSpaceId.toString());
    }
  }, [currentSpaceId]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (focusedInput === 'obj') {
        if (objValue.trim().length > 0) {
            const results = await searchTargets(objValue, currentSpaceId || undefined);
            setSuggestions(results || []);
        } else {
            setSuggestions([]);
        }
      } else if (focusedInput === 'act') {
        if (actValue.trim().length > 0 && selectedTargetId) {
            const results = await searchActions(actValue, selectedTargetId);
            setSuggestions(results || []);
        } else {
            setSuggestions([]);
        }
      }
    };
    fetchSuggestions();
    setSelectedIndex(-1);
  }, [objValue, actValue, focusedInput, currentSpaceId]);

  useEffect(() => {
      const handleClick = () => setContextMenu(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.ctrlKey && e.key === 'z' && historyIndex >= 0) {
              e.preventDefault();
              const taskId = history[historyIndex];
              undoTask(taskId);
              setHistoryIndex(historyIndex - 1);
          } else if (e.ctrlKey && e.key === 'y' && historyIndex < history.length - 1) {
              e.preventDefault();
              const taskId = history[historyIndex + 1];
              completeTask(taskId);
              setHistoryIndex(historyIndex + 1);
          } else if (e.altKey && allSpaces) {
              const num = parseInt(e.key);
              if (num >= 1 && num <= allSpaces.length) {
                  e.preventDefault();
                  setCurrentSpaceId(allSpaces[num - 1].id!);
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, allSpaces]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev)); return; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1)); return; }
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) { selectTarget(suggestions[selectedIndex]); }
        else {
            if (focusedInput === 'obj') {
                if (!objValue.trim()) return;
                setIsInputMode(true); setActValue(''); setSuggestions([]);
            } else {
                submitFinal();
            }
        }
    } else if (e.key === 'Escape') { resetForm(); setSpotlightGroup(null); setExpandedGroup(null); setGachaTask(null); }
  };

  const selectTarget = (item: Target) => {
    if (focusedInput === 'obj') {
        setObjValue(item.title); setActValue(''); setSelectedTargetId(item.id!); setIsInputMode(true); setSuggestions([]);
    } else {
        setActValue(item.title); setSuggestions([]);
    }
  };

  const submitFinal = async () => {
    if (isWipLimitReached) return;
    if (!objValue.trim() || !actValue.trim() || !currentSpaceId) return;
    const trimmedObjValue = objValue.trim();
    const trimmedActValue = actValue.trim();
    let targetId = selectedTargetId;
    if (!targetId) {
        const existingTarget = await db.targets.where('title').equals(trimmedObjValue).and(t => t.spaceId === currentSpaceId).first();
        if (existingTarget && existingTarget.id) {
            targetId = existingTarget.id;
            await updateTargetUsage(existingTarget.id, existingTarget.usageCount + 1);
        } else {
            const newId = await addTarget({ spaceId: currentSpaceId, title: trimmedObjValue, defaultAction: trimmedActValue, notes: '', usageCount: 1, lastUsed: new Date() });
            if (newId !== undefined) targetId = newId;
        }
    } else {
        const existing = await db.targets.get(targetId);
        if (existing && existing.id) { await updateTargetUsage(existing.id, existing.usageCount + 1); }
    }
    await addTask({ targetId: targetId!, title: trimmedActValue, isCompleted: false, createdAt: new Date() });
    resetForm(); 
  };

  const resetForm = () => {
    setObjValue(''); setActValue(''); setIsInputMode(false); setSelectedTargetId(null); setSuggestions([]); setFocusedInput('obj');
  };

  const startEditing = (type: 'target' | 'task', id: number, text: string) => { setEditingId({ type, id }); setEditValue(text); };
  const saveEdit = async () => {
      if (editingId && editValue.trim()) { 
          if (editingId.type === 'target') {
              await updateTargetTitle(editingId.id, editValue);
          } else {
              await updateTaskTitle(editingId.id, editValue); 
          }
      }
      setEditingId(null); 
  };

  const handleCompleteTask = async (taskId: number) => {
      await completeTask(taskId);
      setHistory([...history.slice(0, historyIndex + 1), taskId]);
      setHistoryIndex(historyIndex + 1);
  };

  const deleteTargetAsset = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('목표 삭제?')) { await db.targets.delete(id); setSuggestions([]); }
  };
  const handleDeleteTask = async (taskId: number) => {
      if(window.confirm('삭제?')) { await deleteTask(taskId); }
  };
  const getTargetTitle = (id?: number) => { const t = allTargets?.find(t => t.id === id); return t ? t.title : 'Uncategorized'; };
  const handleGroupContextMenu = (e: React.MouseEvent, title: string, targetId: number) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'group', id: targetId, title: title }); };
  const handleTaskContextMenu = (e: React.MouseEvent, task: Task) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'task', id: task.id!, title: task.title }); };
  const handleSpaceContextMenu = (e: React.MouseEvent, spaceId: number, title: string) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'space', id: spaceId, title: title }); };
  const toggleSpotlight = () => { if (contextMenu) { if (spotlightGroup === contextMenu.title) { setSpotlightGroup(null); } else { setSpotlightGroup(contextMenu.title); } } };
  const handleGeneralDelete = async () => {
      if (!contextMenu) return;
      if (contextMenu.type === 'group') { if (window.confirm(`"${contextMenu.title}" 전체 삭제?`)) await deleteGroup(contextMenu.id); } 
      else if (contextMenu.type === 'space') { 
        if (window.confirm(`"${contextMenu.title}" 공간을 삭제하시겠습니까? 모든 목표와 할일이 삭제됩니다.`)) {
          await deleteSpace(contextMenu.id);
          const spaces = await db.spaces.toArray();
          if (spaces.length > 0) setCurrentSpaceId(spaces[0].id!);
        }
      }
      else { if (window.confirm(`삭제?`)) await deleteTask(contextMenu.id); }
      setContextMenu(null);
  };

  const handleAddSpace = async () => {
    const title = prompt('공간 이름:');
    if (title) {
      const id = await addSpace({ title, createdAt: new Date() });
      setCurrentSpaceId(id);
    }
  };

  const handleEditSpace = () => {
    if (!contextMenu) return;
    const space = allSpaces?.find(s => s.id === contextMenu.id);
    if (space) {
      setEditingSpaceId(space.id!);
      setEditSpaceTitle(space.title);
      setShowSpaceModal(true);
    }
    setContextMenu(null);
  };

  const saveSpaceEdit = async () => {
    if (editingSpaceId && editSpaceTitle) {
      await updateSpace(editingSpaceId, editSpaceTitle);
      setShowSpaceModal(false);
      setEditingSpaceId(null);
    }
  };

  return (
    <div 
        className={`min-h-screen font-sans flex flex-col items-center p-4 pb-40 overflow-x-hidden bg-gray-950 text-gray-100 transition-colors duration-500`}
        // [✨ 핵심 수정] 배경 클릭 시: 그룹 접기 + 입력창 초기화 + "편집 모드 강제 종료"
        onClick={() => { 
            setExpandedGroup(null); 
            resetForm();
            setEditingId(null); // <-- 이거 추가
        }}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
    >
      {spotlightGroup && (
          <div className="fixed inset-0 z-0 pointer-events-none transition-all duration-700 bg-gray-950/90 backdrop-blur-sm" />
      )}

      {gachaTask && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="w-full max-w-sm text-center space-y-8">
                  <div className="space-y-2">
                      <h2 className="text-sm text-blue-400 font-bold tracking-widest uppercase">{gachaTask.targetTitle}</h2>
                      <h1 className="text-3xl font-bold text-white leading-tight">{gachaTask.task.title}</h1>
                  </div>
                  <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-gray-500 text-sm">
                      이걸 처리하기 전까지는<br/>아무것도 할 수 없습니다.
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => { if(window.confirm('진짜 못하겠어?')) { deleteTask(gachaTask.task.id!); setGachaTask(null); }}}
                        className="py-4 rounded-xl border border-red-900/50 text-red-500 hover:bg-red-900/20 font-bold transition-all"
                      >
                        포기 (삭제)
                      </button>
                      <button 
                        onClick={() => { handleCompleteTask(gachaTask.task.id!); setGachaTask(null); }}
                        className="py-4 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-all"
                      >
                        완료!
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="w-full max-w-md mt-8 space-y-8 relative z-10">
        
        <header className={`pl-1 flex justify-between items-center transition-all duration-500 ${spotlightGroup ? 'opacity-10 grayscale' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          <h1 className="text-3xl font-bold text-white tracking-tighter cursor-pointer select-none" onClick={resetForm}>⦿</h1>
          <div className="flex items-center gap-2">
            <button onClick={runGacha} className="text-gray-400 hover:text-white transition-colors" title="Random Pick"><DiceIcon /></button>
            <div className="flex gap-1 bg-gray-900 rounded-full p-1">
              {allSpaces?.map(space => (
                <button key={space.id} onClick={() => setCurrentSpaceId(space.id!)} onContextMenu={(e) => handleSpaceContextMenu(e, space.id!, space.title)} className={`px-3 py-1 rounded-full text-sm transition-all ${currentSpaceId === space.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>{space.title}</button>
              ))}
              <button onClick={handleAddSpace} className="px-2 py-1 rounded-full text-sm text-gray-500 hover:text-white transition-all">+</button>
            </div>
            <button onClick={() => setShowHistory(!showHistory)} className={`text-[10px] px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${showHistory ? 'bg-blue-900 text-blue-200' : 'bg-gray-800 text-gray-400'}`}><HistoryIcon /> Log</button>
          </div>
        </header>

        <div className={`relative w-full group z-50 transition-all duration-500 ${spotlightGroup ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          {isWipLimitReached ? (
              <div className="flex flex-col items-center justify-center py-6 bg-red-900/10 border border-red-900/30 rounded-2xl text-center space-y-2">
                  <span className="text-red-500"><LockIcon /></span>
                  <p className="text-sm text-red-400 font-medium">목표가 너무 많습니다 (3/3)</p>
                  <p className="text-xs text-red-500/60">하나를 완료하거나 삭제해야 추가할 수 있습니다.</p>
              </div>
          ) : (
          <div className={`relative flex flex-col shadow-2xl rounded-2xl bg-gray-900 border border-gray-800`}>
            <div className="flex items-center px-3 py-2">
                <span className="text-blue-400 mr-2"><TargetIcon /></span>
                <input type="text" value={objValue} onChange={(e) => setObjValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setFocusedInput('obj')} placeholder="Objective..." className={`w-full bg-transparent text-white rounded-t-2xl focus:outline-none font-medium text-base placeholder-gray-600 ${isInputMode ? 'text-blue-400' : ''}`} autoFocus />
            </div>
            {isInputMode && (
                <div className="px-3 pb-2 flex items-center">
                    <span className="text-gray-600 mr-2 ml-0.5">↳</span>
                    <input type="text" value={actValue} onChange={(e) => setActValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setFocusedInput('act')} placeholder="Next Action..." className="w-full bg-transparent text-gray-200 focus:outline-none text-sm" autoFocus />
                    <div className="absolute right-2 bottom-2"><button onClick={submitFinal} className="p-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"><PlusIcon /></button></div>
                </div>
            )}
          </div>
          )}
          {!isWipLimitReached && suggestions.length > 0 && (
            <ul className="absolute w-full mt-2 bg-gray-900/95 backdrop-blur-md border border-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[50vh] overflow-y-auto z-50">
              {suggestions.map((item, index) => (
                <li key={item.id} onClick={() => selectTarget(item)} className={`px-5 py-3 cursor-pointer flex justify-between items-center border-b border-gray-800 last:border-0 group ${index === selectedIndex ? 'bg-blue-900/20' : 'hover:bg-gray-800/50'}`}>
                  <span className={`font-bold text-base block ${index === selectedIndex ? 'text-blue-400' : 'text-gray-200'}`}>{item.title}</span>
                  {focusedInput === 'obj' && <button onClick={(e) => deleteTargetAsset(e, item.id!)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"><XIcon /></button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* --- Tasks Groups --- */}
        <div className="space-y-2 pb-2">
          {activeTargets.map((target) => {
            const targetId = target.id!;
            const title = target.title;
            const tasks = groupedTasks[title] || [];
            const topTask = tasks[0];
            const isExpanded = expandedGroup === title;
            const isSpotlighted = spotlightGroup === title;
            const queueTasks = tasks.slice(1); 

            const wrapperClass = spotlightGroup
                ? (isSpotlighted ? 'scale-100 z-50 opacity-100' : 'opacity-10 blur-sm pointer-events-none') 
                : 'opacity-100 z-auto';

            return (
              <div 
                key={title} 
                className={`relative flex flex-col transition-all duration-500 ease-in-out ${wrapperClass}`}
              >
                {/* 1. Objective (Target) */}
                <div 
                    className={`flex items-center justify-between px-3 py-1.5 bg-gray-900 border rounded-xl transition-all duration-500 cursor-pointer select-none z-30 mb-1 group
                        ${isSpotlighted ? 'border-blue-500 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]' : 'border-gray-700 shadow-md hover:border-gray-500'}
                    `}
                    onContextMenu={(e) => handleGroupContextMenu(e, title, targetId)}
                    onClick={(e) => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : title); }}
                    style={{ marginBottom: 0 }}
                >
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                        <span className={`flex-shrink-0 ${isSpotlighted ? 'text-blue-400' : 'text-gray-500'}`}><TargetIcon /></span>
                        {editingId?.type === 'target' && editingId.id === targetId ? (
                            <input className="bg-black text-white px-1 rounded border border-blue-500 outline-none w-full text-base" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditingId(null); }} autoFocus onClick={(e) => e.stopPropagation()} />
                        ) : (
                            <span onClick={(e) => { e.stopPropagation(); startEditing('target', targetId, title); }} className="text-base font-medium text-gray-200 cursor-pointer hover:text-white transition-colors truncate w-full">{title}</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if(window.confirm(`"${title}" 목표를 삭제하시겠습니까?`)) deleteGroup(targetId); 
                            }} 
                            className="text-gray-600 hover:text-red-400 transition-opacity opacity-0 group-hover:opacity-100"
                        >
                            <TrashIcon />
                        </button>
                        <span 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (tasks.length === 0) {
                                    setAddingTaskToTarget(targetId);
                                    setNewTaskTitle('');
                                } else {
                                    setExpandedGroup(isExpanded ? null : title);
                                }
                            }}
                            className="w-5 h-5 rounded-full border border-gray-500 hover:border-blue-500 text-xs text-gray-400 flex items-center justify-center cursor-pointer transition-all"
                        >
                            {tasks.length}
                        </span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); completeTarget(targetId); }} 
                            className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-500 flex items-center justify-center transition-all"
                        >
                            <CheckIcon />
                        </button>
                    </div>
                </div>

                {/* 2. Actions Container (Stack or List) */}
                <div 
                    className={`relative transition-all duration-500 ease-in-out ml-6 border-l-2 border-gray-700/50 pl-4 pb-2
                        ${isExpanded ? 'h-auto' : 'h-auto cursor-pointer'} 
                    `}
                    style={{ marginTop: '-1px' }}
                    onClick={(e) => { 
                        e.stopPropagation();
                        if (!isExpanded) setExpandedGroup(title);
                    }}
                >
                    {topTask && (
                    <div className="relative">
                    <div 
                        className={`bg-gray-800 border border-gray-600 px-3 py-1.5 rounded-xl flex items-center justify-between group transition-all duration-300 z-20 relative
                            ${!isExpanded ? 'shadow-lg cursor-pointer' : 'mb-0'}
                        `}
                        onClick={(e) => { e.stopPropagation(); if(!isExpanded) setExpandedGroup(title); }}
                        onContextMenu={(e) => handleTaskContextMenu(e, topTask)}
                    >
                        <div className="flex items-center gap-2 overflow-hidden w-full">
                            <span className="text-gray-500"><ActionIcon /></span>
                            {editingId?.type === 'task' && editingId.id === topTask.id ? (
                                <input className="bg-black text-white px-1 rounded border border-blue-500 outline-none w-full text-base" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditingId(null); }} autoFocus onClick={(e) => e.stopPropagation()} />
                            ) : (
                                <span onClick={(e) => { e.stopPropagation(); startEditing('task', topTask.id!, topTask.title); }} className={`text-base cursor-pointer hover:text-white transition-colors select-none w-full break-words ${getTaskAgeStyle(topTask.createdAt)}`}>{topTask.title}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleDeleteTask(topTask.id!)} className={`text-gray-600 hover:text-red-400 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><TrashIcon /></button>
                            <button onClick={(e) => { handleCompleteTask(topTask.id!); e.currentTarget.blur(); }} className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-500 flex items-center justify-center transition-all"><CheckIcon /></button>
                        </div>
                    </div>

                    {!isExpanded && queueTasks.slice(0, 2).map((task, idx) => (
                        <div 
                            key={task.id}
                            className="absolute bg-gray-800 border border-gray-600 rounded-xl"
                            style={{
                                top: `${(idx + 1) * 6}px`,
                                left: 0,
                                right: 0,
                                height: '2.25rem',
                                opacity: 0.4,
                                zIndex: -1 - idx,
                                pointerEvents: 'auto',
                                cursor: 'pointer'
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpandedGroup(title);
                            }}
                        />
                    ))}
                    </div>
                    )}

                    {isExpanded && queueTasks.map((task) => (
                        <div 
                            key={task.id}
                            className="bg-gray-800 border border-gray-600 px-3 py-1.5 rounded-xl flex items-center justify-between group transition-all duration-300 z-20 relative mb-0"
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => handleTaskContextMenu(e, task)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden w-full">
                                <span className="text-gray-500"><ActionIcon /></span>
                                {editingId?.type === 'task' && editingId.id === task.id ? (
                                    <input className="bg-black text-white px-1 rounded border border-blue-500 outline-none w-full text-base" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditingId(null); }} autoFocus onClick={(e) => e.stopPropagation()} />
                                ) : (
                                    <span onClick={(e) => { e.stopPropagation(); startEditing('task', task.id!, task.title); }} className={`text-base cursor-pointer hover:text-white transition-colors select-none w-full break-words ${getTaskAgeStyle(task.createdAt)}`}>{task.title}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleDeleteTask(task.id!)} className="text-gray-600 hover:text-red-400 transition-opacity opacity-0 group-hover:opacity-100"><TrashIcon /></button>
                                <button onClick={(e) => { handleCompleteTask(task.id!); e.currentTarget.blur(); }} className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-500 flex items-center justify-center transition-all"><CheckIcon /></button>
                            </div>
                        </div>
                    ))}

                    {isExpanded && addingTaskToTarget !== targetId && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setAddingTaskToTarget(targetId);
                                setNewTaskTitle('');
                            }}
                            className="mt-1 w-full py-0.5 text-[10px] text-gray-600 hover:text-gray-400 transition-all text-center"
                        >
                            +
                        </button>
                    )}

                    {addingTaskToTarget === targetId && (
                        <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 px-3 py-1.5 rounded-xl" onClick={(e) => e.stopPropagation()}>
                            <span className="text-gray-500"><ActionIcon /></span>
                            <input 
                                type="text" 
                                value={newTaskTitle} 
                                onChange={(e) => setNewTaskTitle(e.target.value)} 
                                onBlur={async () => {
                                    if (newTaskTitle.trim()) {
                                        await addTask({ targetId, title: newTaskTitle.trim(), isCompleted: false, createdAt: new Date() });
                                    }
                                    setAddingTaskToTarget(null);
                                    setNewTaskTitle('');
                                }}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && newTaskTitle.trim()) {
                                        await addTask({ targetId, title: newTaskTitle.trim(), isCompleted: false, createdAt: new Date() });
                                        setAddingTaskToTarget(null);
                                        setNewTaskTitle('');
                                    } else if (e.key === 'Escape') {
                                        setAddingTaskToTarget(null);
                                        setNewTaskTitle('');
                                    }
                                }}
                                placeholder="Action..."
                                className="w-full bg-transparent text-white text-base outline-none"
                                autoFocus
                            />
                        </div>
                    )}

                </div>
              </div>
            );
          })}
        </div>
        
        {/* Context Menu */}
        {contextMenu && contextMenu.visible && (
            <div className="fixed z-[100] bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px] animate-in fade-in zoom-in-95 duration-100" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
                <div className="px-4 py-2 border-b border-gray-700/50 bg-gray-800/50"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{contextMenu.title}</span></div>
                {contextMenu.type === 'group' && (
                    <button onClick={() => { toggleSpotlight(); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors flex items-center gap-3"><FocusIcon />{spotlightGroup === contextMenu.title ? 'Exit Focus' : 'Focus'}</button>
                )}
                {contextMenu.type === 'space' && (
                    <button onClick={handleEditSpace} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors flex items-center gap-3">✏️ Edit</button>
                )}
                <button onClick={handleGeneralDelete} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-colors flex items-center gap-3"><TrashIcon />Delete</button>
            </div>
        )}

        {/* Space Edit Modal */}
        {showSpaceModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowSpaceModal(false)}>
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-white mb-4">공간 편집</h3>
                    <input type="text" value={editSpaceTitle} onChange={(e) => setEditSpaceTitle(e.target.value)} placeholder="이름" className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg mb-4 outline-none" />
                    <div className="flex gap-2">
                        <button onClick={saveSpaceEdit} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-500 transition-colors">저장</button>
                        <button onClick={() => setShowSpaceModal(false)} className="flex-1 bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors">취소</button>
                    </div>
                </div>
            </div>
        )}

        {/* History Log */}
        {showHistory && (
          <div className="mt-10 pt-6 border-t border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Completed Log</h2>
              <button 
                onClick={() => { setShowCalendar(!showCalendar); if (!showCalendar) setCurrentDate(new Date()); }} 
                className={`p-1.5 rounded-lg transition-colors ${showCalendar ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
              >
                <CalendarIcon />
              </button>
            </div>

            {showCalendar && (
              <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-gray-200">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-1 text-gray-500 hover:text-white"><ChevronLeft /></button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-1 text-gray-500 hover:text-white"><ChevronRight /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['S','M','T','W','T','F','S'].map((d, i) => <span key={`day-${i}`} className="text-[10px] text-gray-600 py-1">{d}</span>)}
                  {(() => {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const daysInMonth = getDaysInMonth(year, month);
                    const firstDay = getFirstDayOfMonth(year, month);
                    const days = [];
                    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateStr = `${year}-${month + 1}-${d}`;
                      const isSelected = selectedDate === dateStr;
                      const hasTask = completedDates.has(dateStr);
                      days.push(
                        <div key={d} onClick={(e) => { e.stopPropagation(); setSelectedDate(isSelected ? null : dateStr); }} className={`h-8 w-8 flex items-center justify-center rounded-full text-xs cursor-pointer transition-all relative ${isSelected ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-800 text-gray-400'}`}>
                          {d}
                          {hasTask && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-blue-500 rounded-full"></div>}
                        </div>
                      );
                    }
                    return days;
                  })()}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">{selectedDate ? `Selected: ${selectedDate}` : 'Select a date to filter'}</span>
                  {selectedDate && <button onClick={() => setSelectedDate(null)} className="text-[10px] text-blue-400 hover:text-blue-300">Clear Filter</button>}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {allTargets?.filter(target => target.isCompleted && (!currentSpaceId || target.spaceId === currentSpaceId)).map((target) => (
                  <div 
                    key={`target-${target.id}`} 
                    className="flex items-center justify-between px-2 py-1 rounded-lg bg-gray-900/50 border border-gray-800/50 group hover:border-gray-700 transition-all" 
                  >
                    <div className="flex items-center gap-2 w-full overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="text-blue-400/70"><TargetIcon /></span>
                        <span className="text-sm text-gray-400 line-through decoration-gray-600 truncate">
                            {target.title}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button 
                            onClick={() => { if(window.confirm('Delete?')) deleteGroup(target.id!); }} 
                            className="p-0.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        >
                            <TrashIcon />
                        </button>
                        <button 
                            onClick={() => undoTarget(target.id!)} 
                            className="p-0.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                        >
                            <UndoIcon />
                        </button>
                    </div>
                  </div>
              ))}
              {filteredCompletedTasks.filter(task => {
                  const target = allTargets?.find(t => t.id === task.targetId);
                  return target && (!currentSpaceId || target.spaceId === currentSpaceId);
              }).map((task) => {
                  const targetTitle = getTargetTitle(task.targetId) || 'Unknown';
                  return (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between px-2 py-1 rounded-lg bg-gray-900/50 border border-gray-800/50 group hover:border-gray-700 transition-all cursor-context-menu" 
                        onContextMenu={(e) => handleTaskContextMenu(e, task)}
                      >
                        <div className="flex items-center gap-2 w-full overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-blue-400/70 bg-blue-900/20 px-1 py-0.5 rounded border border-blue-900/30 whitespace-nowrap">
                                {targetTitle}
                            </span>
                            <span className="text-sm text-gray-400 line-through decoration-gray-600 truncate">
                                {task.title}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button 
                                onClick={() => handleDeleteTask(task.id!)} 
                                className="p-0.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            >
                                <TrashIcon />
                            </button>
                            <button 
                                onClick={() => undoTask(task.id!)} 
                                className="p-0.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                            >
                                <UndoIcon />
                            </button>
                        </div>
                      </div>
                  );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}