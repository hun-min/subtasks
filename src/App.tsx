import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSystem } from './hooks/useSystem';
import { Target, Task, db } from './db';
import { supabase } from './supabase';

// --- Icons ---
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;

const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const HistoryIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const HeatmapIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="4" height="4"></rect><rect x="9" y="3" width="4" height="4"></rect><rect x="15" y="3" width="4" height="4"></rect><rect x="3" y="9" width="4" height="4"></rect><rect x="9" y="9" width="4" height="4"></rect><rect x="15" y="9" width="4" height="4"></rect><rect x="3" y="15" width="4" height="4"></rect><rect x="9" y="15" width="4" height="4"></rect><rect x="15" y="15" width="4" height="4"></rect></svg>;
const UndoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>;
const FocusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>;
const ZapIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
const TargetIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>;
const DiceIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 8h.01"></path><path d="M8 8h.01"></path><path d="M8 16h.01"></path><path d="M16 16h.01"></path><path d="M12 12h.01"></path></svg>;

const CalendarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;

function SortableTargetItem({ target, wrapperClass, children }: { target: Target, wrapperClass: string, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: target.id! });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`relative flex flex-col transition-all duration-500 ease-in-out ${wrapperClass} ${isDragging ? 'opacity-80' : ''}`}>{children}</div>;
}

function SortableTaskItem({ task, children }: { task: Task, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id! });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.8 : 1 };
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{children}</div>;
}

export default function App() {
  const { allSpaces, activeTasks, completedTasks, allTargets, searchTargets, searchActions, completeTask, completeTarget, updateTaskTitle, updateTargetTitle, undoTask, undoTarget, deleteTask, deleteGroup, addTask, addTarget, addSpace, updateSpace, deleteSpace, updateTargetUsage, moveTaskUp, moveTaskDown, getHeatmapData, updateTimerCount } = useSystem();
  const [currentSpaceId, setCurrentSpaceId] = useState<number | null>(() => {
    const saved = localStorage.getItem('currentSpaceId');
    return saved ? parseInt(saved) : null;
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );
  
  const [objValue, setObjValue] = useState(''); 
  const [actValue, setActValue] = useState(''); 
  const [suggestions, setSuggestions] = useState<Target[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInputMode, setIsInputMode] = useState(false); 
  const [focusedInput, setFocusedInput] = useState<'obj' | 'act'>('obj');
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null); 
  const [showHistory, setShowHistory] = useState(() => {
    const saved = localStorage.getItem('showHistory');
    return saved === 'true';
  });
  const [editingId, setEditingId] = useState<{type: 'target'|'task', id: number} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, type: 'group' | 'task' | 'space', id: number, title: string } | null>(null);
  const [spotlightGroup, setSpotlightGroup] = useState<string | null>(null);

  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [editSpaceTitle, setEditSpaceTitle] = useState('');
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [addingTaskToTarget, setAddingTaskToTarget] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [history, setHistory] = useState<Array<{type: 'complete'|'delete'|'add'|'edit', data: any}>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [gachaTask, setGachaTask] = useState<{task: Task, targetTitle: string} | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [keyboardFocusedItem, setKeyboardFocusedItem] = useState<{type: string, id?: number} | null>(null);
  const [activeTimer, setActiveTimer] = useState<{taskId: number, timeLeft: number} | null>(null);

  const getTaskAgeStyle = (createdAt: Date) => {
      const diffMs = new Date().getTime() - new Date(createdAt).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 3) return "text-red-400 opacity-60";
      if (diffDays > 1) return "text-yellow-500";
      return "text-gray-300";
  };

  const runGacha = () => {
      if (!activeTasks || !allTargets || !currentSpaceId) return;
      const spaceTasks = activeTasks.filter(task => {
          const target = allTargets.find(t => t.id === task.targetId);
          return target && !target.isCompleted && target.spaceId === currentSpaceId;
      });
      if (spaceTasks.length === 0) return;
      const randomTask = spaceTasks[Math.floor(Math.random() * spaceTasks.length)];
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



  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const completedDates = React.useMemo(() => {
    const dates = new Set<string>();
    completedTasks?.filter(task => {
      const target = allTargets?.find(t => t.id === task.targetId);
      return target && (!currentSpaceId || target.spaceId === currentSpaceId);
    }).forEach(task => {
      const d = task.completedAt ? (task.completedAt instanceof Date ? task.completedAt : new Date(task.completedAt)) : (task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt));
      dates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    });
    allTargets?.filter(t => t.isCompleted && (!currentSpaceId || t.spaceId === currentSpaceId)).forEach(target => {
      const d = target.lastUsed instanceof Date ? target.lastUsed : new Date(target.lastUsed);
      dates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    });
    return dates;
  }, [completedTasks, allTargets, currentSpaceId]);

  const filteredCompletedTasks = React.useMemo(() => {
    if (!completedTasks) return [];
    if (!selectedDate) return completedTasks;
    return completedTasks.filter(task => {
      const taskDate = task.completedAt ? (task.completedAt instanceof Date ? task.completedAt : new Date(task.completedAt)) : (task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt));
      const dateStr = `${taskDate.getFullYear()}-${taskDate.getMonth() + 1}-${taskDate.getDate()}`;
      return dateStr === selectedDate;
    });
  }, [completedTasks, selectedDate]);

  const groupedCompletedItems = React.useMemo(() => {
    const items: Array<{type: 'task' | 'target', data: Task | Target, date: Date}> = [];
    const completedTargetIds = new Set<number>();
    
    filteredCompletedTasks.filter(task => {
      const target = allTargets?.find(t => t.id === task.targetId);
      return target && (!currentSpaceId || target.spaceId === currentSpaceId);
    }).forEach(task => {
      const date = task.completedAt ? (task.completedAt instanceof Date ? task.completedAt : new Date(task.completedAt)) : (task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt));
      items.push({type: 'task', data: task, date});
      if (task.targetId) completedTargetIds.add(task.targetId);
    });
    
    if (allTargets) {
      const completed = allTargets.filter(target => target.isCompleted && (!currentSpaceId || target.spaceId === currentSpaceId) && !completedTargetIds.has(target.id!));
      const filtered = !selectedDate ? completed : completed.filter(target => {
        if (!target.lastUsed) return false;
        const targetDate = target.lastUsed instanceof Date ? target.lastUsed : new Date(target.lastUsed);
        const dateStr = `${targetDate.getFullYear()}-${targetDate.getMonth() + 1}-${targetDate.getDate()}`;
        return dateStr === selectedDate;
      });
      filtered.forEach(target => {
        const date = target.lastUsed instanceof Date ? target.lastUsed : new Date(target.lastUsed);
        items.push({type: 'target', data: target as Target, date});
      });
    }
    
    const sorted = items.sort((a, b) => b.date.getTime() - a.date.getTime());
    const grouped: Record<string, Array<{type: 'task' | 'target', data: Task | Target, date: Date}>> = {};
    sorted.forEach(item => {
      const dateStr = `${item.date.getFullYear()}-${item.date.getMonth() + 1}-${item.date.getDate()}`;
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(item);
    });
    return grouped;
  }, [filteredCompletedTasks, allTargets, currentSpaceId, selectedDate]);

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
            const targetResults = await searchTargets(objValue, currentSpaceId || undefined);
            const taskResults = await searchActions(objValue);
            setSuggestions([...(targetResults || []), ...(taskResults || [])]);
        } else {
            setSuggestions([]);
        }
      } else if (focusedInput === 'act') {
        if (actValue.trim().length > 0) {
            const results = await searchActions(actValue, selectedTargetId || undefined);
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
    let interval: any;
    if (activeTimer && activeTimer.timeLeft > 0) {
      interval = setInterval(() => setActiveTimer(prev => prev ? {...prev, timeLeft: prev.timeLeft - 1} : null), 1000);
    } else if (activeTimer && activeTimer.timeLeft === 0) {
      setActiveTimer(null);
    }
    return () => clearInterval(interval);
  }, [activeTimer, activeTasks]);

  useEffect(() => {
      const handleKeyDown = async (e: KeyboardEvent) => {
          if (suggestions.length > 0) return;
          if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          
          const allItems: Array<{type: string, id?: number, title?: string, action?: () => void}> = [
              {type: 'dice', action: runGacha},
              ...(allSpaces?.map(s => ({type: 'space', id: s.id!, title: s.title, action: () => setCurrentSpaceId(s.id!)})) || []),
              {type: 'addSpace', action: handleAddSpace},
              {type: 'logToggle', action: () => { const newState = !showHistory; setShowHistory(newState); localStorage.setItem('showHistory', String(newState)); }},
              {type: 'objInput'},
              ...(isInputMode ? [{type: 'actInput'}] : []),
              ...activeTargets.slice(0, 3).flatMap(t => {
                  const tasks = groupedTasks[t.title] || [];
                  const isExpanded = expandedGroup === t.title;
                  return [{type: 'target' as const, id: t.id!, title: t.title}, ...(isExpanded ? tasks.map(task => ({type: 'task' as const, id: task.id!, title: task.title})) : tasks.length > 0 ? [{type: 'task' as const, id: tasks[0].id!, title: tasks[0].title}] : [])];
              }),
              ...activeTargets.slice(3).map(t => ({type: 'backlog', id: t.id!, title: t.title})),
              ...(showHistory ? [{type: 'heatmap', action: () => { setShowHeatmap(!showHeatmap); setShowCalendar(false); }}, {type: 'calendar', action: () => { setShowCalendar(!showCalendar); setShowHeatmap(false); }}] : []),
              ...(showHistory && groupedCompletedItems ? Object.values(groupedCompletedItems).flat().map((item) => ({type: item.type === 'task' ? 'completedTask' : 'completedTarget', id: (item.data as any).id, title: item.type === 'task' ? (item.data as Task).title : (item.data as Target).title})) : [])
          ];
          
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (e.target instanceof HTMLInputElement) {
                  (e.target as HTMLInputElement).blur();
                  document.body.focus();
              }
              const newIndex = focusIndex < allItems.length - 1 ? focusIndex + 1 : focusIndex;
              setFocusIndex(newIndex);
              const item = allItems[newIndex];
              if (item?.type === 'objInput') {
                  const input = document.querySelector('input[placeholder="Objective..."]') as HTMLInputElement;
                  if (input) input.focus();
                  setKeyboardFocusedItem(null);
              } else if (item?.type === 'actInput') {
                  const input = document.querySelector('input[placeholder="Next Action..."]') as HTMLInputElement;
                  if (input) input.focus();
                  setKeyboardFocusedItem(null);
              } else if (item) {
                  setKeyboardFocusedItem({type: item.type, id: item.id});
              } else {
                  setKeyboardFocusedItem(null);
              }
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (e.target instanceof HTMLInputElement) {
                  (e.target as HTMLInputElement).blur();
                  document.body.focus();
              }
              const newIndex = focusIndex > 0 ? focusIndex - 1 : 0;
              setFocusIndex(newIndex);
              const item = allItems[newIndex];
              if (item?.type === 'objInput') {
                  const input = document.querySelector('input[placeholder="Objective..."]') as HTMLInputElement;
                  if (input) input.focus();
                  setKeyboardFocusedItem(null);
              } else if (item?.type === 'actInput') {
                  const input = document.querySelector('input[placeholder="Next Action..."]') as HTMLInputElement;
                  if (input) input.focus();
                  setKeyboardFocusedItem(null);
              } else if (item) {
                  setKeyboardFocusedItem({type: item.type, id: item.id});
              } else {
                  setKeyboardFocusedItem(null);
              }
          } else if (e.key === 'Enter' && focusIndex >= 0 && allItems[focusIndex]) {
              e.preventDefault();
              const item = allItems[focusIndex];
              if (item.action) item.action();
              else if (item.type === 'target' || item.type === 'task') startEditing(item.type as 'target'|'task', item.id!, item.title!);
          } else if (focusIndex >= 0 && allItems[focusIndex]) {
              const item = allItems[focusIndex];
              if (e.key === 'Delete') {
                  e.preventDefault();
                  if (item.type === 'task' && item.id) handleDeleteTask(item.id);
                  else if (item.id && window.confirm('목표 삭제?')) deleteGroup(item.id);
              } else if (e.key === ' ') {
                  e.preventDefault();
                  if (item.type === 'task' && item.id) handleCompleteTask(item.id);
                  else if (item.type === 'completedTask' && item.id) undoTask(item.id);
                  else if (item.type === 'completedTarget' && item.id) undoTarget(item.id);
                  else if (item.type === 'target' && item.id) completeTarget(item.id);
              }
          } else if (e.ctrlKey && e.key === 'z' && historyIndex >= 0) {
              e.preventDefault();
              const action = history[historyIndex];
              if (action.type === 'complete') await undoTask(action.data.id);
              else if (action.type === 'delete') await addTask(action.data);
              else if (action.type === 'add') await deleteTask(action.data.id);
              else if (action.type === 'edit') await (action.data.isTask ? updateTaskTitle(action.data.id, action.data.oldValue) : updateTargetTitle(action.data.id, action.data.oldValue));
              setHistoryIndex(historyIndex - 1);
          } else if (e.ctrlKey && e.key === 'y' && historyIndex < history.length - 1) {
              e.preventDefault();
              const action = history[historyIndex + 1];
              if (action.type === 'complete') await completeTask(action.data.id);
              else if (action.type === 'delete') await deleteTask(action.data.id);
              else if (action.type === 'add') await addTask(action.data);
              else if (action.type === 'edit') await (action.data.isTask ? updateTaskTitle(action.data.id, action.data.newValue) : updateTargetTitle(action.data.id, action.data.newValue));
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
  }, [history, historyIndex, allSpaces, undoTask, completeTask, addTask, deleteTask, updateTaskTitle, updateTargetTitle]);

  const handleQuickAdd = async () => {
    const text = focusedInput === 'obj' ? objValue : actValue;
    if (!text.trim() || !currentSpaceId) return;
    let inboxTarget = await db.targets.where('title').equals('⚡ Inbox').and(t => t.spaceId === currentSpaceId).first();
    let targetId;
    if (!inboxTarget) {
      targetId = await addTarget({ spaceId: currentSpaceId, title: '⚡ Inbox', defaultAction: '', notes: 'Quick tasks', usageCount: 9999, lastUsed: new Date() });
    } else {
      targetId = inboxTarget.id;
      await updateTargetUsage(targetId!, inboxTarget.usageCount + 1);
    }
    await addTask({ targetId: targetId!, title: text.trim(), isCompleted: false, createdAt: new Date() });
    resetForm();
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev)); return; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1)); return; }
    }
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handleQuickAdd();
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) { selectTarget(suggestions[selectedIndex]); }
        else {
            if (focusedInput === 'obj') {
                if (!objValue.trim()) return;
                setIsInputMode(true); setActValue(''); setSuggestions([]);
            } else {
                if (!actValue.trim()) { submitTarget(); return; }
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

  const submitTarget = async () => {
    if (!objValue.trim() || !currentSpaceId) return;
    const trimmedObjValue = objValue.trim();
    const existingTarget = await db.targets.where('title').equals(trimmedObjValue).and(t => t.spaceId === currentSpaceId).first();
    if (!existingTarget) {
      await addTarget({ spaceId: currentSpaceId, title: trimmedObjValue, defaultAction: '', notes: '', usageCount: 0, lastUsed: new Date() });
    }
    resetForm();
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
    const newTask = { targetId: targetId!, title: trimmedActValue, isCompleted: false, createdAt: new Date() };
    const newTaskId = await addTask(newTask);
    if (newTaskId) {
        setHistory([...history.slice(0, historyIndex + 1), {type: 'add', data: {...newTask, id: newTaskId}}]);
        setHistoryIndex(historyIndex + 1);
    }
    resetForm(); 
  };

  const resetForm = () => {
    setObjValue(''); setActValue(''); setIsInputMode(false); setSelectedTargetId(null); setSuggestions([]); setFocusedInput('obj');
  };

  const [editOriginalValue, setEditOriginalValue] = useState('');
  const startEditing = (type: 'target' | 'task', id: number, text: string) => { setEditingId({ type, id }); setEditValue(text); setEditOriginalValue(text); };
  const saveEdit = async () => {
      if (editingId && editValue.trim() && editValue !== editOriginalValue) {
          setHistory([...history.slice(0, historyIndex + 1), {type: 'edit', data: {id: editingId.id, isTask: editingId.type === 'task', oldValue: editOriginalValue, newValue: editValue}}]);
          setHistoryIndex(historyIndex + 1);
          if (editingId.type === 'target') await updateTargetTitle(editingId.id, editValue);
          else await updateTaskTitle(editingId.id, editValue);
      }
      setEditingId(null); 
  };

  const handleCompleteTask = async (taskId: number) => {
      setHistory([...history.slice(0, historyIndex + 1), {type: 'complete', data: {id: taskId}}]);
      setHistoryIndex(historyIndex + 1);
      await completeTask(taskId);
  };

  const deleteTargetAsset = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('목표 삭제?')) { await db.targets.delete(id); setSuggestions([]); }
  };
  const handleDeleteTask = async (taskId: number) => {
      if(window.confirm('삭제?')) {
          const task = activeTasks?.find(t => t.id === taskId);
          if (task) {
              setHistory([...history.slice(0, historyIndex + 1), {type: 'delete', data: task}]);
              setHistoryIndex(historyIndex + 1);
          }
          await deleteTask(taskId);
      }
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

  const handleTargetDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const visibleTargets = activeTargets.slice(0, 3);
    const oldIndex = visibleTargets.findIndex(t => t.id === active.id);
    const newIndex = visibleTargets.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    
    const currentTarget = visibleTargets[oldIndex];
    const targetAtNewPosition = visibleTargets[newIndex];
    
    await db.targets.update(currentTarget.id!, { lastUsed: targetAtNewPosition.lastUsed });
    await db.targets.update(targetAtNewPosition.id!, { lastUsed: currentTarget.lastUsed });
  };

  const handleTaskDragEnd = async (event: any, tasks: Task[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);
    const task = tasks[oldIndex];
    if (oldIndex < newIndex) {
      for (let i = 0; i < newIndex - oldIndex; i++) await moveTaskDown(task, tasks);
    } else {
      for (let i = 0; i < oldIndex - newIndex; i++) await moveTaskUp(task, tasks);
    }
  };

  return (
    <div 
        className={`min-h-screen font-sans flex flex-col items-center p-4 pb-40 overflow-x-hidden bg-gray-950 text-gray-100 transition-colors duration-500`}
        // [✨ 핵심 수정] 배경 클릭 시: 그룹 접기 + 입력창 초기화 + "편집 모드 강제 종료" + spotlight 해제
        onClick={() => { 
            setExpandedGroup(null);
            if (editingId) saveEdit();
            setSpotlightGroup(null);
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
                        onClick={() => { if(window.confirm('포기하시겠습니까?')) { deleteTask(gachaTask.task.id!); setGachaTask(null); }}}
                        className="py-4 rounded-xl border border-red-900/50 text-red-500 hover:bg-red-900/20 font-bold transition-all"
                      >
                        삭제
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
        
        <header className={`pl-1 flex justify-between items-center transition-all duration-500 ${spotlightGroup ? 'opacity-30' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          <h1 className="text-3xl font-bold text-white tracking-tighter cursor-pointer select-none" onClick={resetForm}>⦿</h1>
          <div className="hidden md:block">
            <WeekStreak getHeatmapData={getHeatmapData} currentSpaceId={currentSpaceId} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runGacha} className={`transition-all ${keyboardFocusedItem?.type === 'dice' ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`} title="Random Pick"><DiceIcon /></button>
            <div className="flex gap-1 bg-gray-900 rounded-full p-1">
              {allSpaces?.map(space => (
                <button key={space.id} onClick={() => setCurrentSpaceId(space.id!)} onContextMenu={(e) => handleSpaceContextMenu(e, space.id!, space.title)} className={`px-3 py-1 rounded-full text-sm transition-all ${keyboardFocusedItem?.type === 'space' && keyboardFocusedItem.id === space.id ? 'bg-blue-600 text-white ring-2 ring-white' : currentSpaceId === space.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>{space.title}</button>
              ))}
              <button onClick={handleAddSpace} className={`px-2 py-1 rounded-full text-sm transition-all ${keyboardFocusedItem?.type === 'addSpace' ? 'text-white bg-gray-700 ring-2 ring-white' : 'text-gray-500 hover:text-white'}`}>+</button>
            </div>
            <button onClick={() => { const newState = !showHistory; setShowHistory(newState); localStorage.setItem('showHistory', String(newState)); }} className={`text-[10px] px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${keyboardFocusedItem?.type === 'logToggle' ? 'bg-gray-700 text-white ring-2 ring-white' : showHistory ? 'bg-blue-900 text-blue-200' : 'bg-gray-800 text-gray-400'}`}><HistoryIcon /> Log</button>
          </div>
        </header>

        <div className={`md:hidden flex justify-center transition-all duration-500 ${spotlightGroup ? 'opacity-30' : 'opacity-100'}`}>
          <WeekStreak getHeatmapData={getHeatmapData} currentSpaceId={currentSpaceId} />
        </div>

        <div className={`relative w-full group z-50 transition-all duration-500 ${spotlightGroup ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          <div className={`relative flex flex-col shadow-2xl rounded-2xl bg-gray-900 border border-gray-800`}>
            <div className="flex items-center px-3 py-2 relative">
                <span className="text-blue-400 mr-2 flex-shrink-0"><TargetIcon /></span>
                <input type="text" value={objValue} onChange={(e) => setObjValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setFocusedInput('obj')} placeholder="Objective..." className={`flex-1 min-w-0 bg-transparent text-white focus:outline-none font-medium text-base placeholder-gray-600 pr-10 ${isInputMode ? 'text-blue-400' : ''}`} autoFocus />
                {objValue.trim() && !isInputMode && (
                  <button onClick={handleQuickAdd} className="absolute right-3 p-1 text-yellow-500 hover:text-yellow-300 hover:bg-yellow-500/20 rounded-lg transition-colors" style={{fontSize: '16px'}} title="Quick add to Inbox">⚡</button>
                )}
            </div>
            {isInputMode && (
                <div className="px-3 pb-2 flex items-center relative">
                    <span className="text-gray-600 mr-2 ml-0.5 flex-shrink-0">↳</span>
                    <input type="text" value={actValue} onChange={(e) => setActValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => { setFocusedInput('act'); }} placeholder="Next Action..." className="flex-1 min-w-0 bg-transparent text-gray-200 focus:outline-none text-sm pr-10" autoFocus />
                    {actValue.trim() && (
                      <button onClick={handleQuickAdd} className="absolute right-3 p-1 text-yellow-500 hover:text-yellow-300 hover:bg-yellow-500/20 rounded-lg transition-colors" style={{fontSize: '16px'}} title="Quick add to Inbox">⚡</button>
                    )}
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
        
        {/* --- Inbox (Always on top) --- */}
        {(() => {
          const inboxTarget = activeTargets.find(t => t.title === '⚡ Inbox');
          if (!inboxTarget) return null;
          const tasks = groupedTasks[inboxTarget.title] || [];
          if (tasks.length === 0) return null;
          const targetId = inboxTarget.id!;
          const isExpanded = expandedGroup === inboxTarget.title;
          const isSpotlighted = spotlightGroup === inboxTarget.title;
          return (
            <div className="space-y-2 pb-0 -mt-16">
              <div key={targetId}>
                <div 
                    className={`flex items-center justify-between px-3 py-1.5 bg-gray-900 border transition-all duration-500 cursor-pointer select-none z-30 group
                        ${isSpotlighted ? 'border-blue-500 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]' : 'border-gray-700 shadow-md hover:border-gray-500'}
                        ${tasks.length > 0 ? 'rounded-t-xl' : 'rounded-xl mb-2'}
                    `}
                    onContextMenu={(e) => handleGroupContextMenu(e, inboxTarget.title, targetId)}
                    onClick={(e) => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : inboxTarget.title); }}
                >
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                        <span className="flex-shrink-0 text-yellow-500 inline-block -ml-1" style={{width: '14px'}}>⚡</span>
                        <span className="text-base font-medium transition-colors truncate w-full text-gray-200">Inbox</span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span onClick={(e) => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : inboxTarget.title); }} className="w-5 h-5 rounded-full border border-gray-500 hover:border-blue-500 text-xs text-gray-400 flex items-center justify-center cursor-pointer transition-all">{tasks.length}</span>
                    </div>
                </div>
                {tasks.length > 0 && (
                <div className="relative mb-2">
                  {/* Stacked card layers - only show when collapsed */}
                  {!isExpanded && tasks.length >= 3 && <div className={`absolute left-1 right-1 top-1 h-full rounded-b-xl border border-t-0 ${isSpotlighted ? 'border-blue-500/30 bg-gray-900/30' : 'border-gray-700/30 bg-gray-900/30'}`} />}
                  {!isExpanded && tasks.length >= 2 && <div className={`absolute left-0.5 right-0.5 top-0.5 h-full rounded-b-xl border border-t-0 ${isSpotlighted ? 'border-blue-500/50 bg-gray-900/50' : 'border-gray-700/50 bg-gray-900/50'}`} />}
                  
                  <div className={`relative bg-gray-900 border border-t-0 rounded-b-xl px-3 py-2 space-y-1 transition-all duration-500 ${isSpotlighted ? 'border-blue-500' : 'border-gray-700'}`}>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleTaskDragEnd(e, tasks)}>
                      <SortableContext items={tasks.map(t => t.id!)} strategy={verticalListSortingStrategy}>
                      {(isExpanded ? tasks : [tasks[0]]).map((task, idx) => {
                        const isTopTask = idx === 0;
                        const isTimerActive = activeTimer?.taskId === task.id;
                        const timeLeft = isTimerActive && activeTimer ? activeTimer.timeLeft : 300;
                        return (
                          <SortableTaskItem key={task.id} task={task}>
                          <div className={`flex items-center gap-2 py-0.5 group/task relative overflow-hidden ${isTimerActive ? 'border-l-2 border-yellow-500 pl-1' : ''}`} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => handleTaskContextMenu(e, task)}>
                              {isTimerActive && (<div className="absolute left-0 top-0 bottom-0 bg-yellow-500/10 transition-all duration-1000" style={{width: `${(timeLeft/300)*100}%`}} />)}
                              {isTopTask && !editingId ? (<button onClick={(e) => { e.stopPropagation(); if(isTimerActive) setActiveTimer(null); else { setActiveTimer({taskId: task.id!, timeLeft: 300}); updateTimerCount(task.id!, (task.timerCount || 0) + 1); } }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const count = prompt('타이머 횟수:', String(task.timerCount || 0)); if(count !== null) updateTimerCount(task.id!, parseInt(count) || 0); }} onTouchStart={(e) => { const timer = setTimeout(() => { e.preventDefault(); const count = prompt('타이머 횟수:', String(task.timerCount || 0)); if(count !== null) updateTimerCount(task.id!, parseInt(count) || 0); }, 500); (e.target as any).longPressTimer = timer; }} onTouchEnd={(e) => { if((e.target as any).longPressTimer) clearTimeout((e.target as any).longPressTimer); }} className={`flex-shrink-0 text-xs font-mono z-10 ${isTimerActive ? 'text-yellow-500 font-bold' : 'text-gray-600 hover:text-yellow-500'}`}>{isTimerActive ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : task.timerCount ? `▶${task.timerCount}` : '▶'}</button>) : (<span className="text-gray-600 ml-0.5 flex-shrink-0 leading-none">↳</span>)}
                              {editingId?.type === 'task' && editingId.id === task.id ? (<input className="flex-1 min-w-0 bg-transparent text-white px-1 rounded border border-blue-500 outline-none text-sm z-10" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditingId(null); }} autoFocus onClick={(e) => e.stopPropagation()} />) : (<span onClick={(e) => { e.stopPropagation(); startEditing('task', task.id!, task.title); }} className={`flex-1 min-w-0 text-sm cursor-pointer transition-colors z-10 ${keyboardFocusedItem?.type === 'task' && keyboardFocusedItem.id === task.id ? 'text-white font-bold underline' : getTaskAgeStyle(task.createdAt) + ' hover:text-white'}`}>{task.title}</span>)}
                              {!isTimerActive && (<button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id!); }} className={`text-gray-600 hover:text-red-400 transition-opacity flex-shrink-0 z-10 ${editingId?.type === 'task' && editingId.id === task.id ? 'opacity-100' : 'opacity-0 group-hover/task:opacity-100'}`}><TrashIcon /></button>)}
                              <button onClick={(e) => { e.stopPropagation(); setActiveTimer(null); handleCompleteTask(task.id!); e.currentTarget.blur(); }} className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-500 flex items-center justify-center transition-all flex-shrink-0 z-10"><CheckIcon /></button>
                          </div>
                          </SortableTaskItem>
                        );
                      })}
                    </SortableContext>
                    </DndContext>
                  </div>
                </div>
                )}

                {isExpanded && addingTaskToTarget === targetId && (
                    <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 py-0.5">
                            <span className="text-gray-600 ml-0.5 flex-shrink-0 leading-none">↳</span>
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
                                className="flex-1 min-w-0 bg-transparent text-gray-200 text-sm outline-none"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {isExpanded && addingTaskToTarget !== targetId && (
                    <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setAddingTaskToTarget(targetId);
                                setNewTaskTitle('');
                            }}
                            className="w-full py-0.5 text-[10px] text-gray-600 hover:text-gray-400 transition-all text-center"
                        >
                            +
                        </button>
                    </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* --- Focus Groups (Top 3) --- */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTargetDragEnd}>
        <SortableContext items={activeTargets.filter(t => t.title !== '⚡ Inbox').slice(0, 3).map(t => t.id!)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 pb-2">
          {activeTargets.filter(t => t.title !== '⚡ Inbox').slice(0, 3).map((target) => {
            const targetId = target.id!;
            const title = target.title;
            const tasks = groupedTasks[title] || [];
            const isExpanded = expandedGroup === title;
            const isSpotlighted = spotlightGroup === title; 

            const wrapperClass = spotlightGroup
                ? (isSpotlighted ? 'scale-100 z-50 opacity-100' : 'opacity-30 pointer-events-none') 
                : 'opacity-100 z-auto';

            return (
              <SortableTargetItem key={targetId} target={target} wrapperClass={wrapperClass}>
                {/* 1. Objective (Target) */}
                <div 
                    className={`flex items-center justify-between px-3 py-1.5 bg-gray-900 border transition-all duration-500 cursor-pointer select-none z-30 group
                        ${isSpotlighted ? 'border-blue-500 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]' : keyboardFocusedItem?.type === 'target' && keyboardFocusedItem.id === targetId ? 'border-white shadow-lg ring-2 ring-white' : 'border-gray-700 shadow-md hover:border-gray-500'}
                        ${tasks.length > 0 ? 'rounded-t-xl' : 'rounded-xl mb-2'}
                    `}
                    onContextMenu={(e) => handleGroupContextMenu(e, title, targetId)}
                    onClick={(e) => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : title); }}
                >
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                        <span className={`flex-shrink-0 ${isSpotlighted ? 'text-blue-400' : title === '⚡ Inbox' ? 'text-yellow-500' : 'text-gray-500'}`}>{title === '⚡ Inbox' ? <ZapIcon /> : <TargetIcon />}</span>
                        {editingId?.type === 'target' && editingId.id === targetId ? (
                            <input className="bg-black text-white px-1 rounded border border-blue-500 outline-none w-full max-w-[calc(100%-31px)] text-base" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditingId(null); }} autoFocus onClick={(e) => e.stopPropagation()} />
                        ) : (
                            <span onClick={(e) => { e.stopPropagation(); startEditing('target', targetId, title); }} className={`text-base font-medium cursor-pointer transition-colors truncate w-full ${keyboardFocusedItem?.type === 'target' && keyboardFocusedItem.id === targetId ? 'text-white font-bold' : 'text-gray-200 hover:text-white'}`}>{title}</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if(window.confirm(`"${title}" 목표를 삭제하시겠습니까?`)) deleteGroup(targetId); 
                            }} 
                            className={`text-gray-600 hover:text-red-400 transition-opacity ${editingId?.type === 'target' && editingId.id === targetId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                            <TrashIcon />
                        </button>
                        <span 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setExpandedGroup(isExpanded ? null : title);
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
                {tasks.length > 0 && (
                <div className="relative mb-2">
                  {/* Stacked card layers - only show when collapsed */}
                  {!isExpanded && tasks.length >= 3 && <div className={`absolute left-1 right-1 top-1 h-full rounded-b-xl border border-t-0 ${isSpotlighted ? 'border-blue-500/30 bg-gray-900/30' : 'border-gray-700/30 bg-gray-900/30'}`} />}
                  {!isExpanded && tasks.length >= 2 && <div className={`absolute left-0.5 right-0.5 top-0.5 h-full rounded-b-xl border border-t-0 ${isSpotlighted ? 'border-blue-500/50 bg-gray-900/50' : 'border-gray-700/50 bg-gray-900/50'}`} />}
                  
                  <div className={`relative bg-gray-900 border border-t-0 rounded-b-xl px-3 py-2 space-y-1 transition-all duration-500 ${isSpotlighted ? 'border-blue-500' : 'border-gray-700'}`}>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleTaskDragEnd(e, tasks)}>
                    <SortableContext items={tasks.map(t => t.id!)} strategy={verticalListSortingStrategy}>
                    {(isExpanded ? tasks : [tasks[0]]).map((task, idx) => {
                      const isTopTask = idx === 0;
                      const isTimerActive = activeTimer?.taskId === task.id;
                      const timeLeft = isTimerActive && activeTimer ? activeTimer.timeLeft : 300;
                      return (
                        <SortableTaskItem key={task.id} task={task}>
                        <div className={`flex items-center gap-2 py-0.5 group/task relative overflow-hidden ${isTimerActive ? 'border-l-2 border-yellow-500 pl-1' : ''}`} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => handleTaskContextMenu(e, task)}>
                            {isTimerActive && (
                              <div className="absolute left-0 top-0 bottom-0 bg-yellow-500/10 transition-all duration-1000" style={{width: `${(timeLeft/300)*100}%`}} />
                            )}
                            {isTopTask && !editingId ? (
                              <button onClick={(e) => { e.stopPropagation(); if(isTimerActive) setActiveTimer(null); else { setActiveTimer({taskId: task.id!, timeLeft: 300}); updateTimerCount(task.id!, (task.timerCount || 0) + 1); } }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); const count = prompt('타이머 횟수:', String(task.timerCount || 0)); if(count !== null) updateTimerCount(task.id!, parseInt(count) || 0); }} onTouchStart={(e) => { const timer = setTimeout(() => { e.preventDefault(); const count = prompt('타이머 횟수:', String(task.timerCount || 0)); if(count !== null) updateTimerCount(task.id!, parseInt(count) || 0); }, 500); (e.target as any).longPressTimer = timer; }} onTouchEnd={(e) => { if((e.target as any).longPressTimer) clearTimeout((e.target as any).longPressTimer); }} className={`flex-shrink-0 text-xs font-mono z-10 ${isTimerActive ? 'text-yellow-500 font-bold' : 'text-gray-600 hover:text-yellow-500'}`}>
                                {isTimerActive ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : task.timerCount ? `▶${task.timerCount}` : '▶'}
                              </button>
                            ) : (
                              <span className="text-gray-600 ml-0.5 flex-shrink-0 leading-none">↳</span>
                            )}
                            {editingId?.type === 'task' && editingId.id === task.id ? (
                                <input className="flex-1 min-w-0 bg-transparent text-white px-1 rounded border border-blue-500 outline-none text-sm z-10" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditingId(null); }} autoFocus onClick={(e) => e.stopPropagation()} />
                            ) : (
                                <span onClick={(e) => { e.stopPropagation(); startEditing('task', task.id!, task.title); }} className={`flex-1 min-w-0 text-sm cursor-pointer transition-colors z-10 ${keyboardFocusedItem?.type === 'task' && keyboardFocusedItem.id === task.id ? 'text-white font-bold underline' : getTaskAgeStyle(task.createdAt) + ' hover:text-white'}`}>{task.title}</span>
                            )}
                            {!isTimerActive && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id!); }} className={`text-gray-600 hover:text-red-400 transition-opacity flex-shrink-0 z-10 ${editingId?.type === 'task' && editingId.id === task.id ? 'opacity-100' : 'opacity-0 group-hover/task:opacity-100'}`}><TrashIcon /></button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setActiveTimer(null); handleCompleteTask(task.id!); e.currentTarget.blur(); }} className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-500 hover:bg-green-500/20 text-transparent hover:text-green-500 flex items-center justify-center transition-all flex-shrink-0 z-10"><CheckIcon /></button>
                        </div>
                        </SortableTaskItem>
                      );
                    })}
                    </SortableContext>
                    </DndContext>

                  </div>
                </div>
                )}

                {isExpanded && addingTaskToTarget === targetId && (
                    <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 py-0.5">
                            <span className="text-gray-600 ml-0.5 flex-shrink-0 leading-none">↳</span>
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
                                className="flex-1 min-w-0 bg-transparent text-gray-200 text-sm outline-none"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {isExpanded && addingTaskToTarget !== targetId && (
                    <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setAddingTaskToTarget(targetId);
                                setNewTaskTitle('');
                            }}
                            className="w-full py-0.5 text-[10px] text-gray-600 hover:text-gray-400 transition-all text-center"
                        >
                            +
                        </button>
                    </div>
                )}
              </SortableTargetItem>
            );
          })}
        </div>
        </SortableContext>
        </DndContext>

        {/* --- Backlog Groups --- */}
        {activeTargets.filter(t => t.title !== '⚡ Inbox').length > 3 && (
          <div className={`mt-4 pt-4 border-t border-gray-900 transition-all duration-500 ${spotlightGroup ? 'opacity-30' : 'opacity-100'}`}>
            <div className="flex items-center gap-2 mb-4 px-2 opacity-40">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-600">Backlog ({activeTargets.filter(t => t.title !== '⚡ Inbox').length - 3})</span>
            </div>
            <div className="space-y-2 opacity-30 grayscale pointer-events-none select-none">
              {activeTargets.filter(t => t.title !== '⚡ Inbox').slice(3).map((target) => {
                const title = target.title;
                const tasks = groupedTasks[title] || [];
                return (
                  <div key={target.id} className={`flex items-center justify-between px-3 py-1.5 border-2 rounded-xl transition-all ${keyboardFocusedItem?.type === 'backlog' && keyboardFocusedItem.id === target.id ? 'border-gray-400' : 'border-gray-800'}`}>
                    <span className="text-gray-500 text-sm">{title}</span>
                    <span className="text-xs text-gray-700 font-mono">{tasks.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Context Menu */}
        {contextMenu && contextMenu.visible && (
            <div className="fixed z-[100] bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px] animate-in fade-in zoom-in-95 duration-100" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
                <div className="px-4 py-2 border-b border-gray-700/50 bg-gray-800/50"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{contextMenu.title}</span></div>
                {(contextMenu.type === 'group' || contextMenu.type === 'task') && (
                    <>
                    <button onClick={() => { 
                        if (contextMenu.type === 'task') {
                            const task = activeTasks?.find(t => t.id === contextMenu.id);
                            if (task) {
                                const targetTitle = getTargetTitle(task.targetId);
                                if (spotlightGroup === targetTitle) setSpotlightGroup(null);
                                else setSpotlightGroup(targetTitle);
                            }
                        } else {
                            toggleSpotlight();
                        }
                        setContextMenu(null);
                    }} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors flex items-center gap-3"><span className="w-[14px] flex-shrink-0"><FocusIcon /></span>{spotlightGroup === contextMenu.title || (contextMenu.type === 'task' && activeTasks?.find(t => t.id === contextMenu.id) && spotlightGroup === getTargetTitle(activeTasks.find(t => t.id === contextMenu.id)!.targetId)) ? 'Exit Focus' : 'Focus'}</button>
                    {contextMenu.type === 'task' && (() => {
                        const task = activeTasks?.find(t => t.id === contextMenu.id);
                        const targetTitle = task ? getTargetTitle(task.targetId) : '';
                        return targetTitle === '⚡ Inbox' ? (
                            <button onClick={async () => {
                                if (!task || !currentSpaceId) return;
                                const newTargetId = await addTarget({ spaceId: currentSpaceId, title: task.title, defaultAction: '', notes: '', usageCount: 1, lastUsed: new Date() });
                                await deleteTask(task.id!);
                                setExpandedGroup(task.title);
                                setAddingTaskToTarget(newTargetId);
                                setContextMenu(null);
                            }} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-green-600/20 hover:text-green-400 transition-colors flex items-center gap-3"><span className="w-[14px] flex-shrink-0"><TargetIcon /></span>To Target</button>
                        ) : null;
                    })()}
                    </>
                )}
                {contextMenu.type === 'group' && contextMenu.title !== '⚡ Inbox' && (
                    <button onClick={async () => {
                        if (!currentSpaceId) return;
                        let inboxTarget = await db.targets.where('title').equals('⚡ Inbox').and(t => t.spaceId === currentSpaceId).first();
                        let inboxId;
                        if (!inboxTarget) {
                            inboxId = await addTarget({ spaceId: currentSpaceId, title: '⚡ Inbox', defaultAction: '', notes: 'Quick tasks', usageCount: 9999, lastUsed: new Date() });
                        } else {
                            inboxId = inboxTarget.id!;
                        }
                        const tasks = await db.tasks.where('targetId').equals(contextMenu.id).toArray();
                        for (const task of tasks) {
                            await db.tasks.update(task.id!, { targetId: inboxId });
                            supabase.from('tasks').update({ targetId: inboxId }).eq('id', task.id).then();
                        }
                        await addTask({ targetId: inboxId, title: contextMenu.title, isCompleted: false, createdAt: new Date() });
                        await deleteGroup(contextMenu.id);
                        setContextMenu(null);
                    }} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-yellow-600/20 hover:text-yellow-400 transition-colors flex items-center gap-3"><span className="w-[14px] flex-shrink-0 text-yellow-500">⚡</span>To Inbox</button>
                )}
                {contextMenu.type === 'space' && (
                    <button onClick={handleEditSpace} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors flex items-center gap-3"><span className="w-[14px] flex-shrink-0">✏️</span>Edit</button>
                )}
                <button onClick={handleGeneralDelete} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-colors flex items-center gap-3"><span className="w-[14px] flex-shrink-0"><TrashIcon /></span>Delete</button>
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
          <div className={`mt-10 pt-6 border-t border-gray-800 transition-all duration-500 ${spotlightGroup ? 'opacity-30' : 'opacity-100'}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Completed Log</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowHeatmap(!showHeatmap); setShowCalendar(false); }} 
                  className={`p-1.5 rounded-lg transition-colors ${keyboardFocusedItem?.type === 'heatmap' ? 'text-white bg-gray-700' : showHeatmap ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                >
                  <HeatmapIcon />
                </button>
                <button 
                  onClick={() => { setShowCalendar(!showCalendar); setShowHeatmap(false); if (!showCalendar) setCurrentDate(new Date()); }} 
                  className={`p-1.5 rounded-lg transition-colors ${keyboardFocusedItem?.type === 'calendar' ? 'text-white bg-gray-700' : showCalendar ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                >
                  <CalendarIcon />
                </button>
              </div>
            </div>

            {showHeatmap && (
              <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
                <HeatmapView getHeatmapData={getHeatmapData} currentSpaceId={currentSpaceId} onDateClick={(date) => setSelectedDate(date)} />
              </div>
            )}

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
                    const today = new Date();
                    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
                    const todayDate = today.getDate();
                    const days = [];
                    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateStr = `${year}-${month + 1}-${d}`;
                      const isSelected = selectedDate === dateStr;
                      const isToday = isCurrentMonth && d === todayDate;
                      const hasTask = completedDates.has(dateStr);
                      days.push(
                        <div key={d} onClick={(e) => { e.stopPropagation(); setSelectedDate(isSelected ? null : dateStr); }} className={`h-8 w-8 flex items-center justify-center rounded-full text-xs cursor-pointer transition-all relative ${isSelected ? 'bg-blue-600 text-white font-bold' : isToday ? 'bg-gray-700 text-white font-bold' : 'hover:bg-gray-800 text-gray-400'}`}>
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

            <div className="space-y-4">
              {Object.entries(groupedCompletedItems).map(([dateStr, items]) => (
                <div key={dateStr} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-xs font-bold text-gray-500">{dateStr}</span>
                    <span className="text-xs text-gray-600">({items.length})</span>
                    <div className="flex-1 h-px bg-gray-800"></div>
                  </div>
                  {items.map((item) => {
                if (item.type === 'task') {
                  const task = item.data as Task;
                  const targetTitle = getTargetTitle(task.targetId) || 'Unknown';
                  return (
                    <div 
                      key={`task-${task.id}`} 
                      className={`flex items-center justify-between px-2 py-1 rounded-lg bg-gray-900/50 border-2 group transition-all cursor-context-menu ${keyboardFocusedItem?.type === 'completedTask' && keyboardFocusedItem.id === task.id ? 'border-gray-400' : 'border-gray-800/50 hover:border-gray-700'}`}
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
                } else {
                  const target = item.data as Target;
                  return (
                    <div 
                      key={`target-${target.id}`} 
                      className={`flex items-center justify-between px-2 py-1 rounded-lg bg-gray-900/50 border-2 group transition-all ${keyboardFocusedItem?.type === 'completedTarget' && keyboardFocusedItem.id === target.id ? 'border-gray-400' : 'border-gray-800/50 hover:border-gray-700'}`}
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
                  );
                }
              })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function WeekStreak({ getHeatmapData, currentSpaceId }: { getHeatmapData: (spaceId?: number) => Promise<Record<string, number>>, currentSpaceId: number | null }) {
  const [data, setData] = useState<Record<string, number>>({});

  useEffect(() => {
    getHeatmapData(currentSpaceId || undefined).then(setData);
  }, [currentSpaceId, getHeatmapData]);

  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const count = data[dateStr] || 0;
    let colorClass = "bg-gray-800/50";
    if (count >= 1) colorClass = "bg-blue-900/40";
    if (count >= 3) colorClass = "bg-blue-600";
    if (count >= 5) colorClass = "bg-blue-400";
    days.push({ dateStr, count, colorClass, isToday: i === 0 });
  }

  return (
    <div className="flex gap-0.5">
      {days.map((day) => (
        <div key={day.dateStr} className={`w-2 h-2 rounded-sm transition-all ${day.colorClass} ${day.isToday ? 'ring-1 ring-white/50' : ''}`} title={`${day.dateStr}: ${day.count}`} />
      ))}
    </div>
  );
}

function HeatmapView({ getHeatmapData, currentSpaceId, onDateClick }: { getHeatmapData: (spaceId?: number) => Promise<Record<string, number>>, currentSpaceId: number | null, onDateClick: (date: string) => void }) {
  const [data, setData] = useState<Record<string, number>>({});

  useEffect(() => {
    getHeatmapData(currentSpaceId || undefined).then(setData);
  }, [currentSpaceId, getHeatmapData]);

  const weeks = 12;
  const today = new Date();
  const grid = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekData = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7) - (6 - d));
      const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      const count = data[dateStr] || 0;
      
      let colorClass = "bg-gray-800/50";
      if (count >= 1) colorClass = "bg-blue-900/40";
      if (count >= 3) colorClass = "bg-blue-800/60";
      if (count >= 5) colorClass = "bg-blue-600";
      if (count >= 8) colorClass = "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]";

      weekData.push({ date: dateStr, count, colorClass });
    }
    grid.push(weekData);
  }

  const firstHalf = grid.slice(0, 6);
  const secondHalf = grid.slice(6, 12);

  return (
    <div className="w-full pb-2 pt-3 flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {firstHalf.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1">
            {week.map((day) => (
              <div 
                key={day.date}
                onClick={() => day.count > 0 && onDateClick(day.date)}
                className={`w-3 h-3 rounded-sm transition-all hover:scale-125 hover:border-white/50 border border-transparent ${day.colorClass} ${day.count > 0 ? 'cursor-pointer' : ''}`}
                title={`${day.date}: ${day.count} tasks`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {secondHalf.map((week, wIdx) => (
          <div key={wIdx + 6} className="flex flex-col gap-1">
            {week.map((day) => (
              <div 
                key={day.date}
                onClick={() => day.count > 0 && onDateClick(day.date)}
                className={`w-3 h-3 rounded-sm transition-all hover:scale-125 hover:border-white/50 border border-transparent ${day.colorClass} ${day.count > 0 ? 'cursor-pointer' : ''}`}
                title={`${day.date}: ${day.count} tasks`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2 text-[9px] text-gray-600 uppercase tracking-widest">
        <span>Less</span>
        <div className="flex gap-0.5">
          <div className="w-2 h-2 rounded-sm bg-gray-800/50"></div>
          <div className="w-2 h-2 rounded-sm bg-blue-900/40"></div>
          <div className="w-2 h-2 rounded-sm bg-blue-600"></div>
          <div className="w-2 h-2 rounded-sm bg-blue-400"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
