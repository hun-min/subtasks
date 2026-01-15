import React, { useRef, useLayoutEffect } from 'react';

// --- [컴포넌트] 자동 높이 조절 Textarea ---
export const AutoResizeTextarea = React.memo(({ value, onChange, onKeyDown, onFocus, onBlur, onPaste, onCompositionStart, onCompositionEnd, placeholder, autoFocus, className, inputRef }: any) => {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const combinedRef = inputRef || localRef;

  // 높이 조절
  useLayoutEffect(() => {
    if (combinedRef.current) {
      combinedRef.current.style.height = 'auto';
      combinedRef.current.style.height = combinedRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // 포커스 관리 (초기 마운트 및 isFocused 변경 시)
  useLayoutEffect(() => {
    if (autoFocus && combinedRef.current) {
        combinedRef.current.focus({ preventScroll: true });
        
        // [Hack] 커서 위치 복구 (Merge 동작 후)
        const restorePos = (window as any).__restoreCursorPos;
        if (typeof restorePos === 'number') {
            combinedRef.current.setSelectionRange(restorePos, restorePos);
            (window as any).__restoreCursorPos = undefined;
        }
    }
  }, [autoFocus, value]);

  return (
    <div>
      <textarea
        ref={combinedRef}
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && (e.target as HTMLTextAreaElement).selectionStart === (e.target as HTMLTextAreaElement).selectionEnd) {
            const currentValue = (e.target as HTMLTextAreaElement).value;
            const newStart = (e.target as HTMLTextAreaElement).selectionStart;
            if (newStart > 0 && currentValue[newStart - 1] === '\n') {
              e.preventDefault();
              const newValue = currentValue.substring(0, newStart - 1) + currentValue.substring(newStart);
              onChange({ target: { value: newValue } });
              (e.target as HTMLTextAreaElement).selectionStart = newStart - 1;
              (e.target as HTMLTextAreaElement).selectionEnd = newStart - 1;
            } else {
              onKeyDown(e);
            }
          } else if (e.key === 'Delete' && (e.target as HTMLTextAreaElement).selectionStart === (e.target as HTMLTextAreaElement).selectionEnd) {
            const currentValue = (e.target as HTMLTextAreaElement).value;
            const start = (e.target as HTMLTextAreaElement).selectionStart;
            if (start > 0 && currentValue[start - 1] === '\n') {
              e.preventDefault();
              const newValue = currentValue.substring(0, start - 1) + currentValue.substring(start);
              onChange({ target: { value: newValue } });
              (e.target as HTMLTextAreaElement).selectionStart = start - 1;
              (e.target as HTMLTextAreaElement).selectionEnd = start - 1;
            } else if (start < currentValue.length && currentValue[start] === '\n') {
              e.preventDefault();
              const newValue = currentValue.substring(0, start) + currentValue.substring(start + 1);
              onChange({ target: { value: newValue } });
              (e.target as HTMLTextAreaElement).selectionStart = start;
              (e.target as HTMLTextAreaElement).selectionEnd = start;
            } else {
              onKeyDown(e);
            }
          } else {
            onKeyDown(e);
          }
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        onPaste={onPaste}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        placeholder={placeholder}
        className={`resize-none overflow-hidden bg-transparent outline-none ${className}`}
        style={{ minHeight: '18px' }}
      />
    </div>
  );
});
