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
          console.log('AutoResizeTextarea onKeyDown:', e.key, combinedRef.current?.selectionStart, combinedRef.current?.selectionEnd);
          if (e.key === 'Backspace' && combinedRef.current?.selectionStart === combinedRef.current?.selectionEnd) {
            const currentValue = combinedRef.current.value;
            const newStart = combinedRef.current.selectionStart;
            console.log('Backspace check:', newStart > 0 && currentValue[newStart - 1] === '\n', currentValue);
            if (newStart > 0 && currentValue[newStart - 1] === '\n') {
              e.preventDefault();
              const newValue = currentValue.substring(0, newStart - 1) + currentValue.substring(newStart);
              console.log('Merging lines:', currentValue, '->', newValue);
              onChange({ target: { value: newValue } });
              setTimeout(() => {
                if (combinedRef.current) {
                  combinedRef.current.selectionStart = newStart - 1;
                  combinedRef.current.selectionEnd = newStart - 1;
                }
              }, 0);
            } else {
              onKeyDown(e);
            }
          } else if (e.key === 'Delete' && combinedRef.current?.selectionStart === combinedRef.current?.selectionEnd) {
            const currentValue = combinedRef.current.value;
            const start = combinedRef.current.selectionStart;
            console.log('Delete check:', start < currentValue.length && currentValue[start] === '\n', currentValue);
            if (start < currentValue.length && currentValue[start] === '\n') {
              e.preventDefault();
              const newValue = currentValue.substring(0, start) + currentValue.substring(start + 1);
              console.log('Merging lines:', currentValue, '->', newValue);
              onChange({ target: { value: newValue } });
              setTimeout(() => {
                if (combinedRef.current) {
                  combinedRef.current.selectionStart = start;
                  combinedRef.current.selectionEnd = start;
                }
              }, 0);
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
