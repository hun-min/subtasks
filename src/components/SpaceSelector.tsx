// components/SpaceSelector.tsx
import { useState, useRef, useEffect } from 'react';
import { useSpace } from '../contexts/SpaceContext';
import { ChevronDown, Plus, Edit2, Trash2, Check, X } from 'lucide-react';

export function SpaceSelector({ onSpaceChange }: { onSpaceChange?: (space: any) => void }) {
  const { spaces, currentSpace, setCurrentSpace, createSpace, updateSpace, deleteSpace } = useSpace();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false); // 인풋창 표시 여부
  const [newSpaceName, setNewSpaceName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null); // 버튼 Ref 추가
  const addInputRef = useRef<HTMLInputElement>(null); // 인풋 포커싱용 Ref

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
        setShowAddInput(false); // 닫힐 때 인풋창도 숨김
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 화면 밖으로 나가는 문제 해결을 위한 동적 스타일
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
      if (isOpen && buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const screenWidth = window.innerWidth;
          const dropdownWidth = 256; // w-64 = 256px
          
          let left = rect.left;
          
          // 화면 오른쪽 밖으로 나가는 경우 처리
          if (left + dropdownWidth > screenWidth) {
              left = Math.max(10, screenWidth - dropdownWidth - 10); // 오른쪽 여백 10px 유지
          }

          setDropdownStyle({
              position: 'fixed',
              top: `${rect.bottom + 8}px`, // 버튼 아래 8px
              left: `${left}px`,
              zIndex: 9999, // 다른 요소보다 위에
              maxHeight: '60vh'
          });
      }
  }, [isOpen]);

  // 인풋창이 열릴 때 자동 포커스
  useEffect(() => {
    if (showAddInput && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddInput]);

  const handleCreate = async () => {
    if (!newSpaceName.trim()) {
        setShowAddInput(false);
        return;
    }
    try {
      await createSpace(newSpaceName);
      setNewSpaceName('');
      setShowAddInput(false);
    } catch (error) {
      console.error('Failed to create space:', error);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await updateSpace(id, editName);
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update space:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (spaces.length <= 1) {
        alert("최소 하나의 스페이스는 있어야 합니다.");
        return;
    }
    if (window.confirm('정말 삭제하시겠습니까? 모든 데이터가 사라집니다.')) {
      try {
        await deleteSpace(id);
        if (currentSpace?.id === id) {
            setCurrentSpace(spaces.find(s => s.id !== id) || spaces[0]);
        }
      } catch (error) {
        console.error('Failed to delete space:', error);
      }
    }
  };

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
      >
        <span className="font-black text-lg tracking-tight max-w-[110px] truncate text-left">{currentSpace?.title || 'Loading...'}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
         <div className="fixed top-0 left-0 w-full h-full z-[4000]" onClick={() => setIsOpen(false)} /> // 배경 클릭 시 닫힘용 오버레이 (옵션)
      )}

      {isOpen && (
        <div 
            ref={dropdownRef}
            style={dropdownStyle}
            className="fixed w-64 bg-[#1a1a1f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-2 flex flex-col"
        >
          <div className="overflow-y-auto custom-scrollbar space-y-1 flex-1">
            {spaces.map(space => (
              <div 
                key={space.id} 
                className={`group flex items-center justify-between p-2 rounded-xl transition-all ${currentSpace?.id === space.id ? 'bg-[#7c4dff]/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              >
                {editingId === space.id ? (
                  <div className="flex items-center gap-1 w-full">
                    <input 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-sm outline-none focus:border-[#7c4dff]"
                      autoFocus
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(space.id!);
                          if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button onClick={() => handleUpdate(space.id!)} className="p-1 hover:text-green-400"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 hover:text-red-400"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <button 
                        onClick={() => { 
                            setCurrentSpace(space); 
                            setIsOpen(false);
                            onSpaceChange?.(space);
                        }} 
                        className="flex-1 text-left font-bold truncate px-1"
                    >
                        {space.title}
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(space.id!); setEditName(space.title); }} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-white"><Edit2 size={12} /></button>
                        <button onClick={() => handleDelete(space.id!)} className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-2 pt-2 border-t border-white/10">
            {showAddInput ? (
                <div className="flex items-center gap-2 px-2 py-1">
                    <input 
                        ref={addInputRef}
                        value={newSpaceName}
                        onChange={(e) => setNewSpaceName(e.target.value)}
                        placeholder="New Space Name"
                        className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-sm outline-none focus:border-[#7c4dff] placeholder:text-gray-600"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreate();
                            if (e.key === 'Escape') setShowAddInput(false);
                        }}
                    />
                    <button onClick={handleCreate} className="p-1.5 bg-[#7c4dff] rounded text-white hover:bg-[#6c3de6]"><Check size={14} /></button>
                </div>
            ) : (
                <button 
                    onClick={() => setShowAddInput(true)} 
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/10"
                >
                    <Plus size={14} /> Create Space
                </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
