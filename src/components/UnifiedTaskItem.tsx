import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Star } from 'lucide-react';
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
  onDelete?: (taskId: number) => void,
  onCopy?: (task: Task) => void,
  onFocusPrev?: (taskId: number, cursorIndex: number | 'start' | 'end') => void,
  onFocusNext?: (taskId: number, cursorIndex: number | 'start' | 'end') => void
}) => {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const isFocused = focusedTaskId === task.id;
  const isSelected = selectedTaskIds.has(task.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number | null>(null);
  const isComposing = useRef(false);

  // Local state for text input to prevent IME issues
  const [localText, setLocalText] = useState(task.name || task.text || '');
  const localTextRef = useRef(localText); // To access latest text in callbacks without re-creating them
  const updateTimeoutRef = useRef<any>(null);
  
  // Timer logic
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let intervalId: any;
    if (task.isTimerOn && task.timerStartTime) {
      const updateTimer = () => {
        const now = Date.now();
        const start = task.timerStartTime || now;
        const seconds = Math.floor((now - start) / 1000);
        setElapsedSeconds(seconds);
      };
      
      updateTimer();
      intervalId = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(0);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [task.isTimerOn, task.timerStartTime]);

  useEffect(() => {
    localTextRef.current = localText;
  }, [localText]);

  // Sync local text with prop only when not focused (to allow external updates but prevent overwrite while typing)
  useEffect(() => {
    const taskText = task.name || task.text || '';
    if (!isFocused && taskText !== localText) {
      setLocalText(taskText);
    }
  }, [task.name, task.text, isFocused]); // Removed localText from deps

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useLayoutEffect(() => {
    if (isFocused && textareaRef.current) {
       // Check if we already have focus to avoid messing with cursor during typing/re-renders
       const isAlreadyFocused = document.activeElement === textareaRef.current;
       
       if (!isAlreadyFocused) {
          textareaRef.current.focus({ preventScroll: true });
          
          // 커서 위치 복원 로직
          const restorePos = (window as any).__restoreCursorPos;
          if (typeof restorePos === 'number') {
              textareaRef.current.setSelectionRange(restorePos, restorePos);
              delete (window as any).__restoreCursorPos;
          } else if ((window as any).__cursorPosition !== undefined) {
              const pos = (window as any).__cursorPosition;
              if (pos === 'start') {
                  textareaRef.current.setSelectionRange(0, 0);
              } else if (pos === 'end') {
                  const len = textareaRef.current.value.length;
                  textareaRef.current.setSelectionRange(len, len);
              } else if (typeof pos === 'number') {
                  const len = textareaRef.current.value.length;
                  const newPos = Math.min(pos, len);
                  textareaRef.current.setSelectionRange(newPos, newPos);
              }
              delete (window as any).__cursorPosition;
          }
       }
    }
  }, [task.depth, isFocused]); 

  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  useEffect(() => {
    const taskName = localText; // Use localText
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
  }, [localText, isFocused, logs]); // Use localText

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing.current) return;
    // Use directly DOM value for most up-to-date text (ignoring potential state lag)
    const taskName = textareaRef.current ? textareaRef.current.value : localTextRef.current;
    
    // Suggestions navigation
    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1); return; }
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

    // Arrow keys handling
    if (e.key === 'ArrowUp') {
        if (e.altKey || e.ctrlKey) {
            e.preventDefault();
            onMoveUp(task.id);
            return;
        }
        
        // Navigation: Check if cursor moves; if not, move focus
        if (!e.shiftKey && !e.metaKey) {
            const currentVal = textareaRef.current?.value || '';
            const startPos = textareaRef.current?.selectionStart ?? 0;
            const firstLineBreakIndex = currentVal.indexOf('\n');
            
            // 첫 줄에 있거나, 한 줄 짜리 텍스트인데 위로 갈 때
            // startPos <= firstLineBreakIndex : 첫 줄에 커서가 있음
            // firstLineBreakIndex === -1 : 전체가 한 줄임
            if (firstLineBreakIndex === -1 || startPos <= firstLineBreakIndex) {
                 e.preventDefault();
                 onFocusPrev?.(task.id, startPos);
                 return;
            }
            // 그 외(두 번째 줄 이상)는 브라우저 기본 동작
        }
    }

    if (e.key === 'ArrowDown') {
        if (e.altKey || e.ctrlKey) {
            e.preventDefault();
            onMoveDown(task.id);
            return;
        }

        // Navigation: Check if cursor moves; if not, move focus
        if (!e.shiftKey && !e.metaKey) {
            const currentVal = textareaRef.current?.value || '';
            const startPos = textareaRef.current?.selectionStart ?? 0;
            const lastLineBreakIndex = currentVal.lastIndexOf('\n');
            
            // 마지막 줄에 있을 때
            // lastLineBreakIndex === -1 : 전체가 한 줄 (무조건 마지막 줄)
            // startPos > lastLineBreakIndex : 마지막 줄바꿈 이후에 커서가 있음 (즉 마지막 줄)
            if (lastLineBreakIndex === -1 || startPos > lastLineBreakIndex) {
                e.preventDefault();
                // 현재 줄에서의 오프셋 계산 (여러 줄일 경우 마지막 줄의 시작점부터의 거리)
                const currentLineOffset = lastLineBreakIndex === -1 ? startPos : startPos - (lastLineBreakIndex + 1);
                onFocusNext?.(task.id, currentLineOffset);
                return;
            }
        }
    }

    // 좌우 방향키로 항목 간 이동
    if (e.key === 'ArrowLeft') {
        if (e.shiftKey || e.metaKey || e.altKey || e.ctrlKey) return; // 조합키 제외
        
        const cursor = textareaRef.current?.selectionStart || 0;
        if (cursor === 0) {
             e.preventDefault();
             onFocusPrev?.(task.id, 'end');
        }
    }

    if (e.key === 'ArrowRight') {
        if (e.shiftKey || e.metaKey || e.altKey || e.ctrlKey) return; // 조합키 제외
        
        const cursor = textareaRef.current?.selectionStart || 0;
        const length = textareaRef.current?.value.length || 0;
        if (cursor === length) {
             e.preventDefault();
             onFocusNext?.(task.id, 'start');
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
        // 중복 입력 방지 (IME 조합 중이거나, 너무 빠른 연타)
        if (isComposing.current || e.nativeEvent.isComposing) {
            e.preventDefault(); // 조합 중 엔터도 막아서 이상 동작 방지
            return;
        }

        e.preventDefault();
        e.stopPropagation(); // 이벤트 전파 방지
        const cursor = textareaRef.current?.selectionStart || 0;
        const textBefore = taskName.substring(0, cursor);
        const textAfter = taskName.substring(cursor);
        
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
        } else {
             (window as any).__restoreCursorPos = 0;
        }

        // 1. 현재 태스크 즉시 로컬 업데이트 (데이터 유실 방지)
        setLocalText(textBefore);
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        
        // 2. 부모 컴포넌트에 추가 요청 (textAfter 전달)
        // 로컬 업데이트 후 즉시 호출하여 레이턴시 최소화
        // onAddTaskAtCursor에서 상태 업데이트와 동기화 처리가 이루어짐
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
    
    // Alt or Ctrl + Arrows for reordering logic is now handled in the main arrow key blocks above
    
    // Ctrl + Space: Toggle Completion
    if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) { 
      e.preventDefault(); 
      const newStatus = task.status === 'completed' ? 'pending' : 'completed'; 
      updateTask(task.id, { status: newStatus, isTimerOn: false }); 
    }
    
    // Shift + Space: Toggle Timer
    if (e.shiftKey && (e.key === ' ' || e.code === 'Space')) {
      e.preventDefault();
      if (task.isTimerOn && task.timerStartTime) {
          const elapsed = Math.floor((Date.now() - task.timerStartTime) / 1000);
          const newActTime = (task.actTime || 0) + elapsed;
          updateTask(task.id, { isTimerOn: false, timerStartTime: undefined, actTime: newActTime, act_time: newActTime });
      } else {
          updateTask(task.id, { isTimerOn: true, timerStartTime: Date.now() });
      }
    }

    // Shift + Enter: Toggle Timer (Recovered)
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      if (task.isTimerOn && task.timerStartTime) {
          const elapsed = Math.floor((Date.now() - task.timerStartTime) / 1000);
          const newActTime = (task.actTime || 0) + elapsed;
          updateTask(task.id, { isTimerOn: false, timerStartTime: undefined, actTime: newActTime, act_time: newActTime });
      } else {
          updateTask(task.id, { isTimerOn: true, timerStartTime: Date.now() });
      }
      return;
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
         const currentText = localTextRef.current;
         const cursor = e.currentTarget.selectionStart;
         const textBefore = currentText.substring(0, cursor);
         const textAfter = currentText.substring(cursor);
         
         // Immediately update
         setLocalText(textBefore + firstLine);
         updateTask(task.id, { name: textBefore + firstLine, text: textBefore + firstLine });

         onAddTaskAtCursor(task.id, textBefore + firstLine, restLines.join('\n') + textAfter);
      } else {
         const currentText = localTextRef.current;
         const cursor = e.currentTarget.selectionStart;
         const newVal = currentText.substring(0, cursor) + text + currentText.substring(cursor);
         
         setLocalText(newVal);
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
    // Composition 중일 때는 업데이트를 건너뛰거나 최소한의 처리만
    if (isComposing.current) {
        setLocalText(e.target.value);
        return;
    }

    const newVal = e.target.value;
    if (newVal === undefined) return;
    
    setLocalText(newVal);
    cursorRef.current = e.target.selectionStart;

    // Debounce update to prevent frequent re-renders disrupting IME
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      updateTask(task.id, { name: newVal, text: newVal });
    }, 500); // 500ms debounce
  }, [task.id, updateTask]);

  const handleBlur = useCallback(() => {
      isComposing.current = false; // Reset composition state on blur
      setFocusedTaskId(null);
      // Ensure final state is saved on blur
      if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
      }
      // Compare with latest prop to avoid redundant updates if debounce already fired
      if ((task.name || task.text || '') !== localTextRef.current) {
          updateTask(task.id, { name: localTextRef.current, text: localTextRef.current });
      }
  }, [task.name, task.text, task.id, updateTask, setFocusedTaskId]);

  return (
    <div ref={setNodeRef} style={style} className={`relative group flex items-start gap-1 md:gap-2 py-0.5 px-6 transition-colors ${isFocused ? 'bg-white/[0.04]' : ''} ${isSelected ? 'bg-white/[0.08]' : ''}`}>
       
      {currentDepth > 0 && (
        <div className="flex flex-shrink-0 pt-1.5" onClick={(e) => onTaskClick(e, task.id, index)}>
          {Array.from({ length: currentDepth }).map((_, i) => (
            <div key={i} className="h-full border-r border-white/5" style={{ width: '15px' }} />
          ))}
        </div>
      )}
      <div className="relative flex items-center justify-start mt-1 flex-shrink-0">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            updateTask(task.id, { is_starred: !task.is_starred }); 
          }}
          disabled={!task.is_starred && !isFocused}
          className={`absolute right-full mr-1.5 w-[15px] h-[15px] flex items-center justify-center transition-colors group/star ${
             !task.is_starred && !isFocused ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          <Star 
            size={13} 
            className={`${
              task.is_starred 
                ? 'fill-yellow-400 text-yellow-400 opacity-100' 
                : isFocused 
                  ? 'text-gray-500 opacity-30 hover:opacity-100' 
                  : 'opacity-0'
            } transition-all`} 
          />
        </button>
        <button onClick={() => { const newStatus = task.status === 'completed' ? 'pending' : 'completed'; updateTask(task.id, { status: newStatus, isTimerOn: false }); }} className={`flex-shrink-0 w-[15px] h-[15px] border-[1.2px] rounded-[3px] flex items-center justify-center transition-all ${getStatusColor()}`}>
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
            onChange={handleTextChange} 
            onKeyDown={handleKeyDown} 
            onPaste={handlePaste}
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={() => { isComposing.current = false; }}
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
        {((task.actTime || 0) + elapsedSeconds > 0 || task.isTimerOn) && (
          <span className={`text-[10px] font-mono whitespace-nowrap ${task.isTimerOn ? 'text-[#7c4dff] font-bold' : 'text-gray-500/80'}`}>
            {formatTimeShort((task.actTime || 0) + elapsedSeconds)}
          </span>
        )}
      </div>
    </div>
  );
});
