import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Star } from 'lucide-react';
import { Task, DailyLog } from '../types';
import { formatTimeShort } from '../utils';
import { AutoResizeTextarea } from './AutoResizeTextarea';

// Check-Head Pattern: High Responsiveness & Cursor Preservation
export const TodoItem = React.memo(({ 
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
  onFocusPrev,
  onFocusNext
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
  onFocusPrev: (taskId: number, cursorIndex: number | 'start' | 'end') => void,
  onFocusNext: (taskId: number, cursorIndex: number | 'start' | 'end') => void,
  onDelete?: (taskId: number) => void,
  onCopy?: (task: Task) => void
}) => {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const isFocused = focusedTaskId === task.id;
  const isSelected = selectedTaskIds.has(task.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Local state for maximizing responsiveness (Check-Head Pattern)
  const [localText, setLocalText] = useState(task.name || task.text || '');
  const localTextRef = useRef(localText); 
  const isComposing = useRef(false); // IME status tracking
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTask);

  useEffect(() => {
    localTextRef.current = localText;
    taskRef.current = task;
    updateTaskRef.current = updateTask;
  }, [localText, task, updateTask]);

  // Safe-guard: Save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      const currentLocal = localTextRef.current;
      const currentTask = taskRef.current;
      // Compare current local text with the last known task text
      if (currentLocal !== (currentTask.name || currentTask.text || '')) {
        updateTaskRef.current(currentTask.id, { name: currentLocal, text: currentLocal });
      }
    };
  }, []); // Empty dependency ensuring this runs on unmount

  // Sync prop changes to local state only when NOT focused (to avoid typing interference)
  useEffect(() => {
    const taskText = task.name || task.text || '';
    if (!isFocused && taskText !== localText) {
      setLocalText(taskText);
    }
  }, [task.name, task.text, isFocused]); // Removed localText from dep to allow manual set

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Focus Handling & Cursor Preservation
  useLayoutEffect(() => {
    if (isFocused && textareaRef.current) {
       // Prevent unnecessary focus calls if already focused
       if (document.activeElement !== textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          
          // Restore Cursor Position Logic
          const restorePos = (window as any).__restoreCursorPos;
          if (typeof restorePos === 'number') {
              textareaRef.current.setSelectionRange(restorePos, restorePos);
              delete (window as any).__restoreCursorPos;
          } else if ((window as any).__cursorPosition !== undefined) {
              const pos = (window as any).__cursorPosition;
              const len = textareaRef.current.value.length;
              
              if (pos === 'start') {
                  textareaRef.current.setSelectionRange(0, 0);
              } else if (pos === 'end') {
                  textareaRef.current.setSelectionRange(len, len);
              } else if (typeof pos === 'number') {
                  // Math.min logic for vertical navigation preservation
                  const newPos = Math.min(pos, len);
                  textareaRef.current.setSelectionRange(newPos, newPos);
              }
              delete (window as any).__cursorPosition;
          }
       }
    }
  }, [isFocused]); // Depend only on focus state

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  useEffect(() => {
    if (!isFocused || !localText.startsWith('/')) { setSuggestions([]); return; }
    const query = localText.slice(1).toLowerCase();
    const matches: Task[] = [];
    const seen = new Set();
    // Optimization: Limit search depth or cache logs if too heavy
    [...logs].reverse().forEach(log => log.tasks.forEach(t => { 
      const tName = t.name || t.text || '';
      if (tName.toLowerCase().includes(query) && !seen.has(tName)) { 
        matches.push(t); 
        seen.add(tName); 
      } 
    }));
    setSuggestions(matches.slice(0, 5));
    setSelectedSuggestionIndex(-1);
  }, [localText, isFocused, logs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing.current) return;
    const taskName = textareaRef.current ? textareaRef.current.value : localText;

    // Ctrl/Cmd + D: Toggle Star (keyboard shortcut)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      updateTask(task.id, { is_starred: !task.is_starred });
      return;
    }

    // Suggestions Navigation
    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1)); return; }
        if (e.key === 'Enter') {
            if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                e.preventDefault();
                const selectedName = suggestions[selectedSuggestionIndex].name || suggestions[selectedSuggestionIndex].text || '';
                setLocalText(selectedName);
                updateTask(task.id, { name: selectedName, text: selectedName });
                setSuggestions([]);
                return;
            }
        }
    }

    // Vertical Navigation with Cursor Preservation
    if (e.key === 'ArrowUp') {
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const currentVal = textareaRef.current?.value || '';
            const startPos = textareaRef.current?.selectionStart ?? 0;
            const firstLineBreak = currentVal.indexOf('\n');
            
            // If at first line, move to previous task
            if (firstLineBreak === -1 || startPos <= firstLineBreak) {
                 e.preventDefault();
                 // Calculate visual column index (simplified as char index for now)
                 const currentColumnIndex = startPos;
                 onFocusPrev(task.id, currentColumnIndex);
                 return;
            }
        }
    }

    if (e.key === 'ArrowDown') {
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const currentVal = textareaRef.current?.value || '';
            const startPos = textareaRef.current?.selectionStart ?? 0;
            const lastLineBreak = currentVal.lastIndexOf('\n');
            
            // If at last line, move to next task
            if (lastLineBreak === -1 || startPos > lastLineBreak) {
                e.preventDefault();
                // Calculate column index relative to last line
                const currentColumnIndex = lastLineBreak === -1 ? startPos : startPos - (lastLineBreak + 1);
                onFocusNext(task.id, currentColumnIndex);
                return;
            }
        }
    }

    // Reordering
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); onMoveUp(task.id); return; }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); onMoveDown(task.id); return; }

    // Indentation
    if (e.key === 'Tab') { 
      e.preventDefault(); 
      if (e.shiftKey) onOutdent(task.id); else onIndent(task.id); 
      return; 
    }

    // Task Creation / Splitting
    if (e.key === 'Enter') {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (isComposing.current) return;
        e.preventDefault();
        
        const cursor = textareaRef.current?.selectionStart || 0;
        const textBefore = taskName.substring(0, cursor);
        const textAfter = taskName.substring(cursor);
        
        // Auto-Numbering / Bullet Logic
        let newTextAfter = textAfter;
        let prefixLen = 0;
        const numberMatch = textBefore.match(/^(\d+)\.\s/);
        const bulletMatch = textBefore.match(/^-\s/);

        if (numberMatch) {
            const nextNum = parseInt(numberMatch[1], 10) + 1;
            const prefix = `${nextNum}. `;
            newTextAfter = prefix + textAfter;
            prefixLen = prefix.length;
        } else if (bulletMatch) {
            const prefix = `- `;
            newTextAfter = prefix + textAfter;
            prefixLen = prefix.length;
        }

        // Set restoration point for new task
        (window as any).__restoreCursorPos = prefixLen;

        // Immediate Local Update for Responsiveness
        setLocalText(textBefore);
        
        // Propagate to Parent
        onAddTaskAtCursor(task.id, textBefore, newTextAfter);
      }
      return;
    }
    
    // Merging
    if (e.key === 'Backspace' && textareaRef.current?.selectionStart === 0 && textareaRef.current?.selectionEnd === 0) {
      e.preventDefault();
      onMergeWithPrevious(task.id, taskName);
      return;
    }
    if (e.key === 'Delete' && textareaRef.current?.selectionStart === taskName.length) {
      e.preventDefault();
      onMergeWithNext(task.id, taskName);
      return;
    }

    // Completion Toggle
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      updateTask(task.id, { status: newStatus, isTimerOn: false });
      return;
    }

    // Star Toggle
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      updateTask(task.id, { is_starred: !task.is_starred });
      return;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Always update local state immediately
      const newVal = e.target.value;
      setLocalText(newVal);

      // If composing (IME), DO NOT save to DB yet
      if (isComposing.current) return;

      // Debounced Save handled by parent's updateTask or hook, 
      // but we call it here to trigger the flow.
      // NOTE: We rely on the parent's debounce or useTodoSync's debounce.
      // But passing every keystroke up is fine for local state sync.
      updateTask(task.id, { name: newVal, text: newVal });
  };

  const handleBlur = () => {
      isComposing.current = false;
      setFocusedTaskId(null);
      // Force sync on blur
      if ((task.name || task.text || '') !== localText) {
          updateTask(task.id, { name: localText, text: localText });
      }
  };

  const getStatusColor = () => {
    if (task.isTimerOn) return 'bg-[#7c4dff] border-[#7c4dff] shadow-[0_0_8px_rgba(124,77,255,0.6)]';
    if (task.status === 'completed') return 'bg-[#4caf50] border-[#4caf50]';
    return 'bg-transparent border-gray-600 hover:border-gray-400';
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative group flex items-start gap-1 md:gap-2 py-0.5 px-6 transition-colors ${isFocused ? 'bg-white/[0.04]' : ''} ${isSelected ? 'bg-white/[0.08]' : ''}`}>
      {currentDepth > 0 && (
        <div className="flex flex-shrink-0 pt-1.5" onClick={(e) => onTaskClick(e, task.id, index)}>
          {Array.from({ length: currentDepth }).map((_, i) => (
            <div key={i} className="h-full border-r border-white/5" style={{ width: '15px' }} />
          ))}
        </div>
      )}
      
      <div className="relative flex items-center justify-start mt-1.5 flex-shrink-0 z-10">
        <button 
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTask(task.id, { is_starred: !task.is_starred }); }}
          className={`absolute right-full mr-1.5 w-[15px] h-[15px] flex items-center justify-center transition-colors group/star ${!task.is_starred && !isFocused ? 'opacity-0 group-hover:opacity-100' : ''}`}
        >
          <Star size={13} className={`${task.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'} transition-all`} />
        </button>
        <button 
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); const newStatus = task.status === 'completed' ? 'pending' : 'completed'; updateTask(task.id, { status: newStatus, isTimerOn: false }); }} 
            className={`flex-shrink-0 w-[15px] h-[15px] border-[1.2px] rounded-[3px] flex items-center justify-center transition-all ${getStatusColor()}`}
        >
          {task.status === 'completed' && <Check size={11} className="text-white stroke-[3]" />}
          {task.isTimerOn && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
        </button>
      </div>

      <div className="flex-1 relative" onClick={(e) => onTaskClick(e, task.id, index)}>
        <AutoResizeTextarea 
            inputRef={textareaRef} 
            value={localText} 
            autoFocus={isFocused} 
            onFocus={() => setFocusedTaskId(task.id)} 
            onBlur={handleBlur}
            onChange={handleChange} 
            onKeyDown={handleKeyDown} 
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={() => { isComposing.current = false; handleChange({ target: { value: textareaRef.current?.value || '' } } as any); }}
            className={`w-full text-[15px] font-medium leading-[1.2] py-1 ${task.status === 'completed' ? 'text-gray-500 line-through decoration-[1.5px]' : 'text-[#e0e0e0]'}`} 
            placeholder="" 
        />
        {isFocused && localText === '' && <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] font-black text-gray-700 tracking-widest uppercase opacity-40">/ history</div>}
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-[110] mt-0 bg-[#1a1a1f] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[180px]">
            {suggestions.map((s, idx) => <button key={idx} onClick={() => { 
                const newName = s.name || s.text || '';
                setLocalText(newName);
                updateTask(task.id, { name: newName, text: newName }); 
                setSuggestions([]); 
            }} className={`w-full px-3 py-1.5 text-left text-sm ${selectedSuggestionIndex === idx ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{s.name || s.text || ''}</button>)}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1.5 pt-1.5">
        {task.actTime !== undefined && task.actTime > 0 && <span className="text-[9px] font-mono text-gray-500 whitespace-nowrap">{formatTimeShort(task.actTime)}</span>}
      </div>
    </div>
  );
});
