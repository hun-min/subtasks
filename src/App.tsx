import React, { useState, useEffect } from 'react';
import { useSystem } from './hooks/useSystem';
import { Target, Task, db } from './db';

// --- Icons ---
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const HistoryIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const UndoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 0 0 0-6 2.3L3 13"></path></svg>;
const FocusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>;
const TargetIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>;
const ActionIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M9 18l6-6-6-6"></path></svg>;

export default function App() {
  const { allSpaces, activeTasks, completedTasks, allTargets, searchTargets, searchActions, completeTask, updateTaskTitle, updateTargetTitle, undoTask, deleteTask, deleteGroup, addTask, addTarget, addSpace, updateSpace, deleteSpace, updateTargetUsage, moveTaskUp, moveTaskDown } = useSystem();
  
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
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [editSpaceTitle, setEditSpaceTitle] = useState('');
  const [showSpaceModal, setShowSpaceModal] = useState(false);

  const groupedTasks = React.useMemo(() => {
    if (!activeTasks || !allTargets) return {};
    const groups: Record<string, Task[]> = {};
    activeTasks.forEach(task => {
        const target = allTargets.find(t => t.id === task.targetId);
        if (!target) return;
        if (currentSpaceId && target.spaceId !== currentSpaceId) return;
        const title = target.title || 'Uncategorized';
        if (!groups[title]) groups[title] = [];
        groups[title].push(task);
    });
    return groups;
  }, [activeTasks, allTargets, currentSpaceId]);

  const sortedGroupTitles = React.useMemo(() => {
    return Object.keys(groupedTasks).sort((a, b) => {
        const tasksA = groupedTasks[a];
        const tasksB = groupedTasks[b];
        const lastTaskA = tasksA[tasksA.length - 1]; 
        const lastTaskB = tasksB[tasksB.length - 1];
        if (!lastTaskA) return 1;
        if (!lastTaskB) return -1;
        return new Date(lastTaskB.createdAt).getTime() - new Date(lastTaskA.createdAt).getTime();
    });
  }, [groupedTasks]);

  useEffect(() => {
    const initSpace = async () => {
      const spaces = await db.spaces.toArray();
      if (spaces.length > 0 && !currentSpaceId) {
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
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        if (allSpaces && allSpaces[0]) setCurrentSpaceId(allSpaces[0].id!);
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        if (allSpaces && allSpaces[1]) setCurrentSpaceId(allSpaces[1].id!);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const tasks = Object.values(groupedTasks).flat();
        if (!selectedTaskId && tasks.length > 0) {
          setSelectedTaskId(tasks[0].id!);
        } else {
          const idx = tasks.findIndex(t => t.id === selectedTaskId);
          if (idx < tasks.length - 1) setSelectedTaskId(tasks[idx + 1].id!);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const tasks = Object.values(groupedTasks).flat();
        const idx = tasks.findIndex(t => t.id === selectedTaskId);
        if (idx > 0) setSelectedTaskId(tasks[idx - 1].id!);
      } else if (e.key === 'Enter' && selectedTaskId) {
        e.preventDefault();
        const task = activeTasks?.find(t => t.id === selectedTaskId);
        if (task) startEditing('task', task.id!, task.title);
      } else if (e.key === ' ' && selectedTaskId) {
        e.preventDefault();
        completeTask(selectedTaskId);
        setSelectedTaskId(null);
      } else if (e.key === 'Delete' && selectedTaskId) {
        e.preventDefault();
        handleDeleteTask(selectedTaskId);
        setSelectedTaskId(null);
      } else if (e.altKey && e.key === 'ArrowUp' && selectedTaskId) {
        e.preventDefault();
        const task = activeTasks?.find(t => t.id === selectedTaskId);
        if (task) {
          const group = groupedTasks[getTargetTitle(task.targetId)];
          if (group) moveTaskUp(task, group);
        }
      } else if (e.altKey && e.key === 'ArrowDown' && selectedTaskId) {
        e.preventDefault();
        const task = activeTasks?.find(t => t.id === selectedTaskId);
        if (task) {
          const group = groupedTasks[getTargetTitle(task.targetId)];
          if (group) moveTaskDown(task, group);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [allSpaces, currentSpaceId, selectedTaskId, groupedTasks, activeTasks]);

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
    } else if (e.key === 'Escape') { resetForm(); setSpotlightGroup(null); setExpandedGroup(null); }
  };

  const selectTarget = (item: Target) => {
    if (focusedInput === 'obj') {
        setObjValue(item.title); setActValue(''); setSelectedTargetId(item.id!); setIsInputMode(true); setSuggestions([]);
    } else {
        setActValue(item.title); setSuggestions([]);
    }
  };

  const submitFinal = async () => {
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
      // [✨ 핵심 수정] 저장이 되든 말든, 포커스가 빠지면 무조건 편집 모드 종료
      setEditingId(null); 
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

      <div className="w-full max-w-md mt-8 space-y-8 relative z-10">
        
        <header className={`pl-1 flex justify-between items-center transition-all duration-500 ${spotlightGroup ? 'opacity-10 grayscale' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          <h1 className="text-3xl font-bold text-white tracking-tighter cursor-pointer select-none" onClick={resetForm}>⦿</h1>
          <div className="flex items-center gap-2">
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
          <div className={`relative flex flex-col shadow-2xl rounded-2xl bg-gray-900 border border-gray-800`}>
            <div className="flex items-center px-4 py-3">
                <span className="text-blue-400 mr-2"><TargetIcon /></span>
                <input type="text" value={objValue} onChange={(e) => setObjValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setFocusedInput('obj')} placeholder="Objective..." className={`w-full bg-transparent text-white rounded-t-2xl focus:outline-none font-medium text-lg placeholder-gray-600 ${isInputMode ? 'text-blue-400' : ''}`} autoFocus />
            </div>
            {isInputMode && (
                <div className="px-4 pb-3 flex items-center">
                    <span className="text-gray-600 mr-2 ml-0.5">↳</span>
                    <input type="text" value={actValue} onChange={(e) => setActValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setFocusedInput('act')} placeholder="Next Action..." className="w-full bg-transparent text-gray-200 focus:outline-none text-base" autoFocus />
                    <div className="absolute right-3 bottom-3"><button onClick={submitFinal} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"><PlusIcon /></button></div>
                </div>
            )}
          </div>
          {suggestions.length > 0 && (
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
        <div className="space-y-3 pb-2">
          {sortedGroupTitles.map((title) => {
            const tasks = groupedTasks[title];
            if (!tasks || tasks.length === 0) return null;

            const topTask = tasks[0];
            const targetId = topTask.targetId!;
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
                    className={`flex items-center justify-between px-4 py-2 bg-gray-900 border rounded-xl transition-all duration-500 cursor-pointer select-none z-30 mb-1 group
                        ${isSpotlighted ? 'border-blue-500 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]' : 'border-gray-700 shadow-md hover:border-gray-500'}
                    `}
                    onContextMenu={(e) => handleGroupContextMenu(e, title, targetId)}
                    onClick={(e) => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : title); }}
                    style={{ marginBottom: 0 }}
                >
                    <div className="flex items-center gap-3 w-full overflow-hidden">
                        <span className={`flex-shrink-0 ${isSpotlighted ? 'text-blue-400' : 'text-gray-500'}`}><TargetIcon /></span>
                        {editingId?.type === 'target' && editingId.id === targetId ? (
                            <input className="bg-black text-white px-1 rounded border border-blue-500 outline-none w-full text-lg" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} autoFocus onClick={(e) => e.stopPropagation()} />
                        ) : (
                            <span onClick={(e) => { e.stopPropagation(); startEditing('target', targetId, title); }} className="text-lg font-medium text-gray-200 cursor-pointer hover:text-white transition-colors truncate w-full">{title}</span>
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
                            onClick={(e) => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : title); }}
                            className="w-5 h-5 rounded-full border border-gray-500 hover:border-blue-500 text-xs text-gray-400 flex items-center justify-center cursor-pointer transition-all"
                        >
                            {tasks.length}
                        </span>
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
                    <div className="relative">
                    <div 
                        className={`bg-gray-800 border px-4 py-2 rounded-xl flex items-center justify-between group transition-all duration-300 z-20 relative
                            ${!isExpanded ? 'shadow-lg cursor-pointer' : 'mb-0'}
                            ${selectedTaskId === topTask.id ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-600'}
                        `}
                        onClick={(e) => { e.stopPropagation(); setSelectedTaskId(topTask.id!); if(!isExpanded) setExpandedGroup(title); }}
                        onContextMenu={(e) => handleTaskContextMenu(e, topTask)}
                    >
                        <div className="flex items-center gap-3 overflow-hidden w-full">
                            <span className="text-gray-500"><ActionIcon /></span>
                            {editingId?.type === 'task' && editingId.id === topTask.id ? (
                                <input className="bg-black text-white px-1 rounded border border-blue-500 outline-none w-full text-lg" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} autoFocus onClick={(e) => e.stopPropagation()} />
                            ) : (
                                <span onClick={(e) => { e.stopPropagation(); startEditing('task', topTask.id!, topTask.title); }} className="text-base text-gray-300 cursor-pointer hover:text-white transition-colors select-none w-full break-words">{topTask.title}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleDeleteTask(topTask.id!)} className={`text-gray-600 hover:text-red-400 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><TrashIcon /></button>
                            <button onClick={(e) => { completeTask(topTask.id!); e.currentTarget.blur(); }} className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-500 flex items-center justify-center transition-all"><CheckIcon /></button>
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
                                height: '2.75rem',
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

                    {isExpanded && queueTasks.map((task) => (
                        <div 
                            key={task.id}
                            className={`bg-gray-800 border px-4 py-2 rounded-xl flex items-center justify-between group transition-all duration-300 z-20 relative mb-0
                                ${selectedTaskId === task.id ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-600'}
                            `}
                            onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id!); }}
                            onContextMenu={(e) => handleTaskContextMenu(e, task)}
                        >
                            <div className="flex items-center gap-3 overflow-hidden w-full">
                                <span className="text-gray-500"><ActionIcon /></span>
                                {editingId?.type === 'task' && editingId.id === task.id ? (
                                    <input className="bg-black text-white px-1 rounded border border-blue-500 outline-none w-full text-lg" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} autoFocus onClick={(e) => e.stopPropagation()} />
                                ) : (
                                    <span onClick={(e) => { e.stopPropagation(); startEditing('task', task.id!, task.title); }} className="text-base text-gray-300 cursor-pointer hover:text-white transition-colors select-none w-full break-words">{task.title}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleDeleteTask(task.id!)} className="text-gray-600 hover:text-red-400 transition-opacity opacity-0 group-hover:opacity-100"><TrashIcon /></button>
                                <button onClick={(e) => { completeTask(task.id!); e.currentTarget.blur(); }} className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-500 flex items-center justify-center transition-all"><CheckIcon /></button>
                            </div>
                        </div>
                    ))}

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
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Completed Log</h2>
            <div className="space-y-2">
              {completedTasks?.filter(task => {
                  const target = allTargets?.find(t => t.id === task.targetId);
                  return target && (!currentSpaceId || target.spaceId === currentSpaceId);
              }).map((task) => {
                  const targetTitle = getTargetTitle(task.targetId) || 'Unknown';
                  return (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-900/50 border border-gray-800/50 group hover:border-gray-700 transition-all cursor-context-menu" 
                        onContextMenu={(e) => handleTaskContextMenu(e, task)}
                      >
                        <div className="flex items-center gap-3 w-full overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-blue-400/70 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-900/30 whitespace-nowrap">
                                {targetTitle}
                            </span>
                            <span className="text-lg text-gray-400 line-through decoration-gray-600 decoration-2 truncate">
                                {task.title}
                            </span>
                        </div>
                        
                        {/* [✨ 수정됨] 우측 버튼: [휴지통] [되돌리기] 순서로 변경 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button 
                                onClick={() => handleDeleteTask(task.id!)} 
                                className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            >
                                <TrashIcon />
                            </button>
                            <button 
                                onClick={() => undoTask(task.id!)} 
                                className="p-1 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
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