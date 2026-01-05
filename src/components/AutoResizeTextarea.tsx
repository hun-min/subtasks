import React, { useRef, useLayoutEffect } from 'react';

// --- [컴포넌트] 자동 높이 조절 Textarea ---
export const AutoResizeTextarea = React.memo(({ value, onChange, onKeyDown, onFocus, onBlur, onPaste, placeholder, autoFocus, className, inputRef }: any) => {
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
    <textarea
      ref={combinedRef}
      rows={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPaste={onPaste}
      placeholder={placeholder}
      className={`resize-none overflow-hidden bg-transparent outline-none ${className}`}
      style={{ minHeight: '18px' }}
    />
  );
});
