import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Star } from 'lucide-react';
import { Task, DailyLog } from '../types';
import { formatCompletionTime } from '../utils';
import { AutoResizeTextarea } from './AutoResizeTextarea';

export const UnifiedTaskItem = React.memo(({
  task,
  index,
  updateTask,
  setFocusedTaskId,
  focusedTaskId,
  onTaskClick,
  logs,
  onAddTaskAtCursor,
  isSelected,

  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  onDelete,
  onFocusPrev,
  onFocusNext
}: {
  task: Task,
  index: number,
  updateTask: (taskId: number, updates: Partial<Task>) => void,
  setFocusedTaskId: (id: number | null) => void,
  focusedTaskId: number | null,
  onTaskClick: (e: React.MouseEvent, taskId: number, index: number) => void,
  logs: DailyLog[],
  onAddTaskAtCursor: (taskId: number, textBefore: string, textAfter: string) => void,
  onMergeWithPrevious: (taskId: number, currentText: string) => void,
  onMergeWithNext: (taskId: number, currentText: string) => void,
  isSelected?: boolean,
  onIndent: (taskId: number) => void,
  onOutdent: (taskId: number) => void,
  onMoveUp: (taskId: number) => void,
  onMoveDown: (taskId: number) => void,
  onDelete?: (taskId: number, options?: { mergeDirection?: 'prev' | 'next', currentText?: string, deleteNext?: boolean }) => void,
  onCopy?: (task: Task) => void,
  onFocusPrev?: (taskId: number, cursorIndex: number | 'start' | 'end') => void,
  onFocusNext?: (taskId: number, cursorIndex: number | 'start' | 'end') => void
}) => {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const currentDepth = task.depth || 0;
  const isFocused = focusedTaskId === task.id;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number | null>(null);
  const isComposing = useRef(false);

  // Local state for text input to prevent IME issues
  const [localText, setLocalText] = useState(task.name || task.text || '');
  const localTextRef = useRef(localText); // To access latest text in callbacks without re-creating them
  const updateTimeoutRef = useRef<any>(null);
  const skipSyncRef = useRef(false);

  // Time editing logic
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editHours, setEditHours] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');

  useEffect(() => {
    localTextRef.current = localText;
  }, [localText]);

  // Sync local text with prop only when not focused (to allow external updates but prevent overwrite while typing)
  useEffect(() => {
    if (skipSyncRef.current) return;
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
    if (!isFocused) { setSuggestions([]); return; }
    
    // If it starts with /, it's a command/search
    if (taskName.startsWith('/')) {
        const query = taskName.slice(1).toLowerCase();
        if (query === 'history') {
            setSuggestions([]); // /history is a command, not a suggestion trigger usually
            return;
        }
        const matches: Task[] = [];
        const seen = new Set();
        [...logs].reverse().forEach(log => log.tasks.forEach(t => {
          const tName = (t.name || t.text || '').trim();
          if (tName.toLowerCase().includes(query) && !seen.has(tName)) {
            // [FIX] Strip leading / if it exists in the suggestion name (though usually it doesn't)
            // The requirement is: "the suggestions should not include the leading slash (/). It should just show the task name."
            const displayName = tName.startsWith('/') ? tName.slice(1) : tName;
            matches.push({ ...t, name: displayName, text: displayName });
            seen.add(tName);
          }
        }));
        setSuggestions(matches.slice(0, 5));
        setSelectedSuggestionIndex(-1);
    } else {
        setSuggestions([]);
    }
  }, [localText, isFocused, logs]); // Use localText

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing.current) return;

    // Handle backspace/delete for empty tasks or end-of-line merging
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const currentText = textareaRef.current?.value || '';
      const cursorPos = textareaRef.current?.selectionStart || 0;

      // If task is empty, merge with adjacent line instead of deleting
      if (currentText === '' && onDelete) {
        e.preventDefault();
        if (e.key === 'Backspace') {
          // Backspace: merge with previous line (cursor moves up)
          onDelete(task.id, { mergeDirection: 'prev' });
        } else {
          // Delete: merge with next line (cursor stays)
          onDelete(task.id, { mergeDirection: 'next' });
        }
        return;
      }

      // If cursor is at the end of a line with content, delete next line
      if (e.key === 'Delete' && cursorPos === currentText.length && currentText !== '' && onDelete) {
        e.preventDefault();
        // Delete next line
        onDelete(task.id, { deleteNext: true });
        return;
      }

      // Allow normal backspace/delete behavior for text editing
      return;
    }

    // Suggestions navigation
    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') {
            if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                e.preventDefault();
                const selectedTask = suggestions[selectedSuggestionIndex];
                const selectedName = selectedTask.name || selectedTask.text || '';
                
                // Ensure we don't have a leading slash in the final name
                const finalName = selectedName.startsWith('/') ? selectedName.slice(1) : selectedName;
                
                setLocalText(finalName);
                updateTask(task.id, { 
                  name: finalName, 
                  text: finalName,
                  percent: selectedTask.percent,
                  planTime: selectedTask.planTime,
                  actTime: selectedTask.actTime,
                  act_time: selectedTask.act_time
                });
                setSuggestions([]);
                return;
            } else if (e.key === 'Enter' && localText.startsWith('/')) {
                // If user presses Enter on a /command that isn't a suggestion, 
                // we might want to handle it or just let it be.
                // But for /history specifically, we want to trigger the modal.
            }
        }
    }

    // Handle /history command on Enter
    if (e.key === 'Enter' && localText.trim() === '/history') {
        e.preventDefault();
        // Find the previous task name to show history for
        // If this task has a name, use it. If not, maybe the one above?
        // Usually /history is typed on a line that already has a name or we want history for the current line's name.
        const taskName = (task.name || task.text || '').replace('/history', '').trim();
        if (taskName) {
            (window as any).dispatchEvent(new CustomEvent('open-history', { detail: { taskName } }));
            // Optionally clear the /history part from the task
            const newName = taskName;
            setLocalText(newName);
            updateTask(task.id, { name: newName, text: newName });
        } else {
            // If empty /history, maybe show history for the task above?
            // For now, just do nothing or alert.
        }
        return;
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

    // Ctrl + Enter: Toggle Completion (100%)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const isCompleted = task.status === 'completed';
      const newPercent = isCompleted ? undefined : 100;
      const newStatus = isCompleted ? 'pending' : 'completed';
      updateTask(task.id, { percent: newPercent, status: newStatus, isTimerOn: false });
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

        // 다음 줄에 새 빈 태스크 생성하고 포커스 이동
        onAddTaskAtCursor(task.id, localTextRef.current, '');
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) onOutdent(task.id); else onIndent(task.id);
      return;
    }

    // Ctrl + D: Toggle Star
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      updateTask(task.id, { is_starred: !task.is_starred });
      return;
    }

    // Ctrl + Space: Toggle Completion (REMOVED per user requirement)
    // if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) {
    //   e.preventDefault();
    //   const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    //   updateTask(task.id, { status: newStatus, isTimerOn: false });
    // }

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

  const handleBlur = useCallback((e: React.FocusEvent) => {
      isComposing.current = false;

      // 플로팅 바로 포커스 이동하는 경우 focusedTaskId 유지
      if (e.relatedTarget?.closest?.('.floating-bar')) {
          return;
      }

      // Clear debounce and save immediately
      if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
      }

      const currentLocal = localTextRef.current;
      if ((task.name || task.text || '') !== currentLocal) {
          updateTask(task.id, { name: currentLocal, text: currentLocal });
      }

      // Block prop sync briefly after blur
      skipSyncRef.current = true;
      setTimeout(() => { skipSyncRef.current = false; }, 200);

      setFocusedTaskId(null);
  }, [task.name, task.text, task.id, updateTask, setFocusedTaskId]);

  return (
    <div ref={setNodeRef} style={style} className={`relative group flex items-start gap-2 md:gap-3 py-0.5 px-2 transition-colors ${isFocused ? 'bg-zinc-800/20' : ''} ${(isSelected || false) ? 'bg-zinc-800/40' : ''} ${currentDepth === 0 ? 'bg-yellow-500/10 rounded-lg p-2 mb-2 ml-4' : ''}`}>

      <div className="flex flex-shrink-0" onClick={(e) => onTaskClick(e, task.id, index)}>
        {/* Indentation spaces */}
        {Array.from({ length: currentDepth }).map((_, i) => (
          <div key={i} className="h-full" style={{ width: currentDepth === 0 ? '0px' : '30px' }} />
        ))}
      </div>
      <div className="relative flex flex-row items-center justify-start mt-1.5 flex-shrink-0 gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateTask(task.id, { is_starred: !task.is_starred });
          }}
          className={`w-[15px] h-[15px] flex items-center justify-center transition-colors group/star cursor-pointer`}
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
        {/* 상위/하위 할일 완료 표시 */}
        {task.status === 'completed' && (
          <div className="w-[15px] h-[15px] flex items-center justify-center">
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
          </div>
        )}
      </div>
        <div className="flex-1 relative" onClick={(e) => onTaskClick(e, task.id, index)}>
        {currentDepth === 0 ? (
          // Main task: text input only
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
            className="w-full text-[15px] font-bold leading-[1.2] py-1 text-yellow-400"
            placeholder="원하는 것"
          />
        ) : (
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
            className={`w-full text-[15px] font-medium leading-[1.2] py-1 ${(task.depth === 0 || task.depth === undefined) ? 'text-yellow-400' : (task.percent !== undefined && task.percent !== null) ? 'text-yellow-400' : 'text-[#e0e0e0]'}`}
            placeholder=""
          />
        )}
        {isFocused && localText === '' && currentDepth > 0 && <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] font-black text-gray-700 tracking-widest uppercase opacity-40">/ history</div>}
        {suggestions.length > 0 && currentDepth > 0 && (
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
        <div className="flex flex-col items-end gap-1 pt-1.5 flex-shrink-0">
          {(() => {
            // Show completion time (end_time) in "at HH:MM" format
            // Show for any task that has end_time set (completed or has time entered)
            const completionTimeDisplay = task.end_time ? `at ${formatCompletionTime(task.end_time)}` : null;
            let displayText = '';
            if (currentDepth === 0) {
              // Main task: show percent
              if (task.percent !== undefined && task.percent !== null) {
                if (task.percent > 0) {
                  displayText = `${task.percent}%`;
                } else if (task.percent === 0) {
                  displayText = '0%';
                }
              }
            } else {
              // Sub task: show time only
              if (completionTimeDisplay) {
                displayText = completionTimeDisplay;
              }
            }
            return (
              <div className="flex flex-col items-end gap-1">
                {currentDepth === 0 && isEditingTime ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-6 text-[10px] font-mono bg-transparent text-gray-500/80 outline-none"
                      placeholder="H"
                    />
                    :
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(e.target.value)}
                      className="w-6 text-[10px] font-mono bg-transparent text-gray-500/80 outline-none"
                      placeholder="M"
                    />
                    :
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editSeconds}
                      onChange={(e) => setEditSeconds(e.target.value)}
                      className="w-6 text-[10px] font-mono bg-transparent text-gray-500/80 outline-none"
                      placeholder="S"
                      onBlur={() => {
                        const h = parseInt(editHours) || 0;
                        const m = parseInt(editMinutes) || 0;
                        const s = parseInt(editSeconds) || 0;
                        const totalSeconds = h * 3600 + m * 60 + s;
                        updateTask(task.id, { actTime: totalSeconds, act_time: totalSeconds });
                        setIsEditingTime(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const h = parseInt(editHours) || 0;
                          const m = parseInt(editMinutes) || 0;
                          const s = parseInt(editSeconds) || 0;
                          const totalSeconds = h * 3600 + m * 60 + s;
                          updateTask(task.id, { actTime: totalSeconds, act_time: totalSeconds });
                          setIsEditingTime(false);
                        }
                      }}
                    />
                  </div>
                ) : (
                  displayText && (
                    <div className={`text-[11px] font-mono text-gray-500/80 ${currentDepth === 0 ? 'cursor-pointer' : ''}`}
                         onClick={() => {
                           if (currentDepth === 0) {
                             // Show input time for editing (not timer elapsed time)
                             const totalSeconds = task.actTime || 0;
                             const h = Math.floor(totalSeconds / 3600);
                             const m = Math.floor((totalSeconds % 3600) / 60);
                             const s = totalSeconds % 60;
                             setEditHours(h.toString());
                             setEditMinutes(m.toString());
                             setEditSeconds(s.toString());
                             setIsEditingTime(true);
                           }
                         }}>
                      {displayText}
                    </div>
                  )
                )}
                {currentDepth === 0 && task.percent !== undefined && task.percent > 0 && (
                  <div
                    className="h-1 w-12 bg-white/5 rounded-full overflow-hidden relative"
                    style={{
                      background: `linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff)`,
                    }}
                  >
                    <div
                      className="absolute inset-0 bg-[#050505] transition-all duration-500"
                      style={{
                        left: `${task.percent}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
    </div>
  );
});
