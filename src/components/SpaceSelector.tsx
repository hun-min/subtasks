import { useState, useRef, useEffect } from 'react';
import { useSpace } from '../contexts/SpaceContext';
import { Plus, ChevronDown, Check, Layout, Settings, Trash2 } from 'lucide-react';

export function SpaceSelector() {
  const { spaces, currentSpace, setCurrentSpace, addSpace, deleteSpace } = useSpace();
  const [isOpen, setIsOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSpaceName.trim()) {
      await addSpace(newSpaceName);
      setNewSpaceName('');
      setIsAdding(false);
    }
  };

  const handleDeleteSpace = async (id: number) => {
    if (spaces.length <= 1) {
      alert('마지막 공간은 삭제할 수 없습니다.');
      return;
    }
    if (window.confirm('이 공간을 삭제하시겠습니까?')) {
      await deleteSpace(id);
      setShowSettings(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors text-sm font-medium text-gray-200">
        <Layout size={16} className="text-gray-400" />
        <span>{currentSpace ? currentSpace.title : '공간 선택'}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
          <div className="flex items-center justify-between px-2 py-1 border-b border-white/5 mb-1">
            <span className="text-xs text-gray-500">공간 목록</span>
            <button onClick={() => setShowSettings(!showSettings)} className="p-1 text-gray-500 hover:text-white transition-colors">
              <Settings size={14} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto scrollbar-hide py-1">
            {spaces.map(space => (
              <div key={space.id} className="flex items-center gap-1">
                <button onClick={() => { setCurrentSpace(space); setIsOpen(false); }} className={`flex-1 text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group transition-colors ${currentSpace?.id === space.id ? 'bg-blue-600/10 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                  <span className="truncate">{space.title}</span>
                  {currentSpace?.id === space.id && <Check size={14} />}
                </button>
                {showSettings && (
                  <button onClick={() => handleDeleteSpace(space.id!)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 mt-1 pt-1 px-1">
            {isAdding ? (
              <form onSubmit={handleAddSpace} className="flex items-center gap-1 p-1">
                <input autoFocus type="text" value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} placeholder="공간 이름" className="w-full bg-black/30 text-xs text-white px-2 py-1.5 rounded border border-white/10 outline-none focus:border-blue-500" />
                <button type="submit" className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500"><Check size={12} /></button>
              </form>
            ) : (
              <button onClick={() => setIsAdding(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
                <Plus size={12} /><span>새 공간 만들기</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
