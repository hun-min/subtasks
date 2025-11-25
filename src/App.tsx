import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks'; 
import { useSystem } from './hooks/useSystem';
import { Target, Task, db } from './db';

const CheckIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const PlusIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const HistoryIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const UndoIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>;
const UpIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>;
const DownIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const FocusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>;

export default function App() {
  const { activeTasks, completedTasks, allTargets, searchTargets, searchActions, completeTask, updateTaskTitle, undoTask, deleteTask, moveTaskUp, moveTaskDown } = useSystem();
  
  const [objValue, setObjValue] = useState(''); 
  const [actValue, setActValue] = useState(''); 
  const [suggestions, setSuggestions] = useState<Target[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInputMode, setIsInputMode] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'obj' | 'act'>('obj');
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null); 
  const [showHistory, setShowHistory] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, type: 'group' | 'task' | 'topTask', id: number, title: string, subtitle?: string} | null>(null);
  const [spotlightGroup, setSpotlightGroup] = useState<string | null>(null);

  const targetHistory = useLiveQuery(
    () => selectedTargetId 
      ? db.tasks.where('targetId').equals(selectedTargetId).reverse().limit(10).toArray()
      : []
  , [selectedTargetId]);

  const groupedTasks = React.useMemo(() => {
    if (!activeTasks || !allTargets) return {};
    const groups: Record<string, Task[]> = {};
    activeTasks.forEach(task => {
        const title = allTargets.find(t => t.id === task.targetId)?.title || 'Uncategorized';
        if (!groups[title]) groups[title] = [];
        groups[title].push(task);
    });
    return groups;
  }, [activeTasks, allTargets]);

  const sortedGroupKeys = React.useMemo(() => {
    if (!allTargets) return Object.keys(groupedTasks);
    return Object.keys(groupedTasks).sort((a, b) => {
      const targetA = allTargets.find(t => t.title === a);
      const targetB = allTargets.find(t => t.title === b);
      if (!targetA || !targetB) return 0;
      return targetB.lastUsed.getTime() - targetA.lastUsed.getTime();
    });
  }, [groupedTasks, allTargets]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (focusedInput === 'obj') {
        if (objValue.trim().length > 0) {
          const results = await searchTargets(objValue);
          setSuggestions(results || []);
        } else {
          setSuggestions([]);
        }
      } else if (focusedInput === 'act') {
        if (actValue.trim().length > 0 && selectedTargetId !== null) {
          const results = await searchActions(actValue, selectedTargetId);
          setSuggestions(results || []);
        } else {
          setSuggestions([]);
        }
      }
    };
    fetchSuggestions();
    setSelectedIndex(-1);
  }, [objValue, actValue, focusedInput, selectedTargetId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    
    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
            return;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
            return;
        }
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            selectTarget(suggestions[selectedIndex]);
        } else {
            if (focusedInput === 'obj') {
                if (!objValue.trim()) return;
                setIsInputMode(true);
                setActValue('');
                setSuggestions([]);
            } else {
                submitFinal();
            }
        }
    } else if (e.key === 'Escape') {
        resetForm();
    }
  };

  const selectTarget = (item: Target) => {
    if (focusedInput === 'obj') {
      setObjValue(item.title);
      setActValue('');
      setSelectedTargetId(item.id ?? null);
      setIsInputMode(true);
      setSuggestions([]);
    } else {
      setActValue(item.title);
      setSuggestions([]);
    }
  };

  const submitFinal = async () => {
    if (!objValue.trim() || !actValue.trim()) return;

    let targetId: number | undefined = selectedTargetId ?? undefined;
    if (!targetId) {
        const existingTarget = await db.targets.where('title').equals(objValue).first();
        if (existingTarget) {
            targetId = existingTarget.id;
            await db.targets.update(targetId!, {
                usageCount: existingTarget.usageCount + 1,
                lastUsed: new Date(),
                defaultAction: actValue
            });
        } else {
            targetId = await db.targets.add({
                title: objValue,
                defaultAction: actValue, 
                notes: '',
                usageCount: 1,
                lastUsed: new Date()
            }) as number;
        }
    } else {
        const existing = await db.targets.get(targetId);
        if (existing) {
            await db.targets.update(targetId, {
                usageCount: existing.usageCount + 1,
                lastUsed: new Date(),
                defaultAction: actValue 
            });
        }
    }

    await db.tasks.add({
        targetId: targetId!,
        title: actValue,
        isCompleted: false,
        createdAt: new Date()
    });
    resetForm(); 
  };

  const resetForm = () => {
    setObjValue('');
    setActValue('');
    setIsInputMode(false);
    setSelectedTargetId(null);
    setSuggestions([]);
    setFocusedInput('obj');
  };

  const startEditing = (task: Task) => {
      setEditingTaskId(task.id!);
      setEditValue(task.title);
  };

  const saveEdit = async () => {
      if (editingTaskId && editValue.trim()) {
          await updateTaskTitle(editingTaskId, editValue);
          setEditingTaskId(null);
      }
  };

  const deleteTargetAsset = async (e: React.MouseEvent, id: number | undefined) => {
    e.stopPropagation();
    if (id && window.confirm('이 목표(자동완성)를 영구 삭제하시겠습니까?')) {
        await db.targets.delete(id);
        setSuggestions([]);
    }
  };
  
  const handleDeleteTask = async (taskId: number) => {
      if(window.confirm('기록을 영구 삭제하시겠습니까?')) {
          await deleteTask(taskId);
      }
  };

  const getTargetTitle = (id?: number) => {
    if (!id || !allTargets) return null;
    return allTargets.find(t => t.id === id)?.title || 'Uncategorized';
  };

  const handleGroupContextMenu = (e: React.MouseEvent, title: string, targetId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.pageX, y: e.pageY, type: 'group', id: targetId, title });
  };

  const handleTopTaskContextMenu = (e: React.MouseEvent, task: Task, targetTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.pageX, y: e.pageY, type: 'topTask', id: task.id!, title: targetTitle, subtitle: task.title });
  };

  const handleTaskContextMenu = (e: React.MouseEvent, task: Task, targetTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.pageX, y: e.pageY, type: 'task', id: task.id!, title: targetTitle, subtitle: task.title });
  };

  const toggleSpotlight = () => {
    if (contextMenu) {
      setSpotlightGroup(prev => prev === contextMenu.title ? null : contextMenu.title);
      setContextMenu(null);
    }
  };

  const handleGeneralDelete = async () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'group') {
      if (window.confirm(`Delete Object "${contextMenu.title}" and ALL tasks?`)) {
        const tasksToDelete = await db.tasks.where('targetId').equals(contextMenu.id).toArray();
        await db.tasks.bulkDelete(tasksToDelete.map(t => t.id!));
        await db.targets.delete(contextMenu.id);
      }
    } else {
      if (window.confirm(`Delete task "${contextMenu.subtitle || contextMenu.title}"?`)) {
        await deleteTask(contextMenu.id);
      }
    }
    setContextMenu(null);
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const closeSpotlight = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpotlightGroup(null);
    };
    window.addEventListener('keydown', closeSpotlight);
    return () => window.removeEventListener('keydown', closeSpotlight);
  }, []);

  return (
    <>
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col items-center p-4 pb-20 overflow-x-hidden" onClick={() => setExpandedGroup(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
      <div className="w-full max-w-md mt-8 space-y-10 relative z-10">
        
        <header className={`pl-1 flex justify-between items-end transition-all duration-500 ${spotlightGroup ? 'opacity-30 blur-sm grayscale' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          <h1 className="text-4xl font-bold text-white tracking-tighter cursor-pointer" onClick={resetForm}>
            ⦿
          </h1>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${showHistory ? 'bg-blue-900 text-blue-200' : 'bg-gray-800 text-gray-400'}`}
          >
            <HistoryIcon /> Log
          </button>
        </header>

        <div className={`relative w-full group z-50 transition-all duration-500 ${spotlightGroup ? 'opacity-0 pointer-events-none translate-y-[-20px]' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          <div className={`relative flex flex-col shadow-2xl rounded-2xl bg-gray-900 border transition-all duration-300 ${isInputMode ? 'border-blue-500/50 ring-2 ring-blue-500/20' : 'border-gray-800'}`}>
            <input
              type="text"
              value={objValue}
              onChange={(e) => setObjValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocusedInput('obj')}
              placeholder="Objective..."
              className={`w-full bg-transparent text-white px-5 pt-4 pb-2 rounded-t-2xl focus:outline-none font-bold text-lg placeholder-gray-600 ${isInputMode ? 'text-blue-400' : ''}`}
              autoFocus
            />
            {isInputMode && (
                <div className="px-5 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="h-px w-full bg-gray-800 mb-2"></div>
                    <input 
                        type="text"
                        value={actValue}
                        onChange={(e) => setActValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setFocusedInput('act')}
                        placeholder="Next Action..."
                        className="w-full bg-transparent text-gray-200 focus:outline-none text-base"
                        autoFocus 
                    />
                    <div className="absolute right-3 bottom-3">
                        <button onClick={submitFinal} className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors">
                            <PlusIcon />
                        </button>
                    </div>
                </div>
            )}
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute w-full mt-2 bg-gray-900/95 backdrop-blur-md border border-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[50vh] overflow-y-auto z-50">
              {suggestions.map((item, index) => (
                <li key={item.id} onClick={() => selectTarget(item)} className={`px-5 py-3 cursor-pointer flex justify-between items-center border-b border-gray-800 last:border-0 group ${index === selectedIndex ? 'bg-blue-900/20' : 'hover:bg-gray-800/50'}`}>
                  <div className="flex-1">
                    <span className={`font-bold block ${index === selectedIndex ? 'text-blue-400' : 'text-gray-200'}`}>{item.title}</span>
                  </div>
                  {focusedInput === 'obj' && (
                    <button onClick={(e) => deleteTargetAsset(e, item.id!)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"><XIcon /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {isInputMode && targetHistory && targetHistory.length > 0 && (
            <div className="pl-4 border-l-2 border-gray-800">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">History</h3>
                <div className="space-y-1">
                    {targetHistory.map(h => (
                        <div key={h.id} className="text-sm text-gray-500 flex items-center gap-2">
                             <span className={`w-1.5 h-1.5 rounded-full ${h.isCompleted ? 'bg-green-500/30' : 'bg-red-500/30'}`}></span>
                             {h.title}
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="space-y-10 pb-20">
          {sortedGroupKeys.map((title) => {
            const tasks = groupedTasks[title];
            if (!tasks || tasks.length === 0) return null;

            const topTask = tasks[0];
            const queueTasks = tasks.slice(1);
            const visibleQueue = queueTasks.slice(0, 3); 
            const hiddenCount = queueTasks.length - 3;
            const isSpotlighted = spotlightGroup === title;
            const wrapperClass = spotlightGroup
                ? (isSpotlighted ? 'scale-105 z-50 opacity-100' : 'scale-95 z-0 opacity-20 blur-[2px] grayscale pointer-events-none')
                : 'opacity-100 z-auto';

            return (
              <div key={title} className={`relative flex flex-col transition-all duration-700 ease-in-out ${wrapperClass}`} onContextMenu={(e) => handleGroupContextMenu(e, title, topTask.targetId!)}>
                
                <div className="flex items-center gap-2 pl-1 mb-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md transition-colors ${isSpotlighted ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'text-blue-400 bg-blue-400/10'}`}>
                        {title}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono">
                        {tasks.length}
                    </span>
                </div>

                <div className={`relative z-30 flex items-center justify-between p-5 bg-gray-900 border rounded-2xl transition-all duration-500 group
                    ${isSpotlighted ? 'border-blue-500 shadow-[0_0_40px_-5px_rgba(59,130,246,0.4)] ring-1 ring-blue-500/30' : 'border-gray-700 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]'}
                `} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => handleTopTaskContextMenu(e, topTask, title)}>
                    {editingTaskId === topTask.id ? (
                        <input 
                            className="bg-black text-white px-2 py-1 rounded border border-blue-500 outline-none w-full mr-10 text-lg"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            autoFocus
                        />
                    ) : (
                        <span 
                            onClick={() => startEditing(topTask)}
                            className="text-gray-100 font-bold text-xl cursor-pointer hover:text-blue-300 transition-colors flex-1"
                        >
                            {topTask.title}
                        </span>
                    )}
                    
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={() => handleDeleteTask(topTask.id!)}
                            className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <TrashIcon />
                        </button>
                        <button 
                            onClick={() => completeTask(topTask.id!)}
                            className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-all ${isSpotlighted ? 'border-blue-500 hover:bg-blue-500 text-white' : 'border-gray-600 hover:border-green-500 hover:bg-green-500 hover:text-black'}`}
                        >
                            <CheckIcon />
                        </button>
                    </div>
                </div>

                {queueTasks.length > 0 && (
                    <div 
                        className={`relative z-10 p-4 -mx-2 transition-all duration-300 ease-in-out cursor-pointer ${expandedGroup === title ? 'mt-0' : '-mt-4'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (expandedGroup === title) {
                                setExpandedGroup(null);
                            } else {
                                setExpandedGroup(title);
                            }
                        }}
                    >
                        {expandedGroup === title ? (
                            <div className="flex flex-col gap-2">
                                {queueTasks.map((task) => (
                                    <div key={task.id} className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-xl group" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => handleTaskContextMenu(e, task, title)}>
                                        <div className="flex items-center gap-2 overflow-hidden w-full">
                                            <div className="flex flex-col gap-0.5">
                                                <button onClick={() => moveTaskUp(task, tasks)} className="text-gray-400 hover:text-white"><UpIcon /></button>
                                                <button onClick={() => moveTaskDown(task, tasks)} className="text-gray-400 hover:text-white"><DownIcon /></button>
                                            </div>
                                            {editingTaskId === task.id ? (
                                                <input 
                                                    className="bg-black text-sm text-gray-300 px-2 py-1 rounded border border-blue-500 outline-none w-full"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span onClick={() => startEditing(task)} className="text-sm text-gray-200 cursor-pointer hover:text-white flex-1">
                                                    {task.title}
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={() => handleDeleteTask(task.id!)} className="text-gray-600 hover:text-red-400">
                                            <XIcon />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={(e) => { e.stopPropagation(); setExpandedGroup(null); }} className="text-xs text-gray-600 hover:text-gray-400 text-center py-1">
                                    접기
                                </button>
                            </div>
                        ) : (
                            <>
                                {visibleQueue.map((task, idx) => {
                                    const scale = 1 - (idx + 1) * 0.03;
                                    const opacity = 0.6 - (idx * 0.15);
                                    const translateY = -10 * (idx + 1);

                                    return (
                                        <div 
                                            key={task.id} 
                                            onContextMenu={(e) => { e.stopPropagation(); handleTaskContextMenu(e, task, title); }}
                                            className="bg-gray-800 border-x border-b border-gray-700/50 p-3 rounded-b-xl flex items-center justify-between hover:opacity-100 transition-opacity"
                                            style={{
                                                transform: `scaleX(${scale}) translateY(${translateY}px)`,
                                                opacity: opacity,
                                                marginTop: idx === 0 ? '0px' : '-20px',
                                                zIndex: 10 - idx
                                            }}
                                        >
                                            <span className="text-sm text-gray-300 truncate">{task.title}</span>
                                        </div>
                                    );
                                })}
                                {hiddenCount > 0 && (
                                    <div className="text-center mt-[-10px] text-[10px] text-gray-700 tracking-widest uppercase hover:text-gray-500">
                                        + {hiddenCount} more
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

              </div>
            );
          })}
        </div>

        {showHistory && (
          <div className="mt-10 pt-6 border-t border-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Completed Log</h2>
            <div className="space-y-2">
              {completedTasks?.map((task) => {
                const targetTitle = getTargetTitle(task.targetId) || 'Unknown';
                return (
                  <div 
                    key={task.id} 
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50 border border-gray-800/50 group hover:border-gray-700 transition-all cursor-context-menu"
                    onContextMenu={(e) => handleTaskContextMenu(e, task, targetTitle)}
                  >
                    <div className="flex flex-col opacity-60 group-hover:opacity-100">
                        <span className="text-[10px] text-gray-500">{targetTitle}</span>
                        <span className="text-gray-400 line-through text-sm decoration-gray-600 decoration-2">{task.title}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => undoTask(task.id!)} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg"><UndoIcon /></button>
                        <button onClick={() => handleDeleteTask(task.id!)} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg"><TrashIcon /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
    {contextMenu && (
      <div 
        className="fixed z-[100] bg-gray-900/90 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[180px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-800/30">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {contextMenu.type === 'group' ? contextMenu.title : 'Task Action'}
          </span>
          {contextMenu.subtitle && <div className="text-xs text-gray-500 truncate mt-1">{contextMenu.subtitle}</div>}
        </div>
        {(contextMenu.type === 'group' || contextMenu.type === 'topTask') && (
          <button 
            onClick={() => { toggleSpotlight(); setContextMenu(null); }}
            className="w-full text-left px-4 py-3 text-sm text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors flex items-center gap-3"
          >
            <FocusIcon />
            {spotlightGroup === contextMenu.title ? 'Exit Spotlight' : 'Spotlight'}
          </button>
        )}
        <button 
          onClick={handleGeneralDelete}
          className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-colors flex items-center gap-3"
        >
          <TrashIcon />
          {contextMenu.type === 'group' ? 'Delete Object' : 'Delete Task'}
        </button>
      </div>
    )}
    </>
  );
}
