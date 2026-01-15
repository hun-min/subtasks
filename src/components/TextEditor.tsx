import { useState } from 'react';

export const TextEditor = () => {
  const [text, setText] = useState('');

  return (
    <div className="w-full h-full p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-full bg-transparent outline-none text-white font-mono text-sm resize-none"
        placeholder="텍스트를 입력하세요..."
      />
    </div>
  );
};
