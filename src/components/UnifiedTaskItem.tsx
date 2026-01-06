import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, MoreVertical, Copy, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Task, DailyLog } from '../types';
import { formatTimeShort } from '../utils';
import { AutoResizeTextarea } from './AutoResizeTextarea';

export const UnifiedTaskItem = React.memo(({ 
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
  onMoveDown,
  onDelete,
  onCopy
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
  onMoveDown: (taskId: number) => void,
  onDelete?: (taskId: number) => void,
  onCopy?: (task: Task) => void
}) => {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const isFocused = focusedTaskId === task.id;
  const isSelected = selectedTaskIds.has(task.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

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
    <div ref={setNodeRef} style={style} className={`relative group flex items-start gap-2 py-0.5 px-6 transition-colors ${isFocused ? 'bg-white/[0.04]' : ''} ${isSelected ? 'bg-white/[0.08]' : ''}`}>
       
      <div className="flex flex-shrink-0 pt-1.5" onClick={(e) => onTaskClick(e, task.id, index)}>
        {Array.from({ length: currentDepth }).map((_, i) => (
          <div key={i} className="h-full border-r border-white/5" style={{ width: '15px' }} />
        ))}
      </div>
      <div className="flex flex-col items-center justify-start pt-2">
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
      <div className="flex items-center gap-1.5 pt-1.5">
        {task.actTime !== undefined && task.actTime > 0 && <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap">{formatTimeShort(task.actTime)}</span>}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
            className="p-1 text-gray-600 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100 lg:opacity-0"
          >
            <MoreVertical size={14} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-[200] bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[140px] animate-in fade-in zoom-in duration-100 origin-top-right">
              <button onClick={() => { onCopy?.(task); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <Copy size={14} /> Copy
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button onClick={() => { onIndent(task.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <ArrowRight size={14} /> Indent
              </button>
              <button onClick={() => { onOutdent(task.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <ArrowLeft size={14} /> Outdent
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button onClick={() => { onMoveUp(task.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <ChevronUp size={14} /> Move Up
              </button>
              <button onClick={() => { onMoveDown(task.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <ChevronDown size={14} /> Move Down
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button onClick={() => { onDelete?.(task.id); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs font-bold text-red-500/80 hover:text-red-500 hover:bg-red-500/10 flex items-center gap-2">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
