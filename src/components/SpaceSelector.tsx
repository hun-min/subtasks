import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useSpace } from '../contexts/SpaceContext';

export function SpaceSelector() {
  const { spaces, currentSpace, setCurrentSpace, addSpace, deleteSpace, updateSpace } = useSpace();
  const [showAdd, setShowAdd] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleAdd = async () => {
    if (!newSpaceName.trim()) return;
    await addSpace(newSpaceName);
    setNewSpaceName('');
    setShowAdd(false);
  };

  const startEdit = (space: any) => {
    setEditingId(space.id!);
    setEditingName(space.title);
  };

  const handleTouchStart = (space: any) => {
    const timer = setTimeout(() => startEdit(space), 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
      {spaces.map(space => (
        editingId === space.id ? (
          <div key={space.id} className="flex items-center gap-1">
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingName.trim()) {
                    updateSpace(space.id!, editingName.trim());
                  }
                  setEditingId(null);
                } else if (e.key === 'Escape') {
                  setEditingId(null);
                } else if (e.key === 'Backspace' && editingName === '') {
                  if (spaces.length > 1 && window.confirm(`"${space.title}" 공간을 삭제하시겠습니까?`)) {
                    deleteSpace(space.id!);
                  }
                  setEditingId(null);
                }
              }}
              className="w-24 bg-gray-800 border border-white/10 rounded-full px-3 py-1 text-xs text-white outline-none"
              autoFocus
            />
          </div>
        ) : (
          <button
            key={space.id}
            onClick={() => setCurrentSpace(space)}
            onDoubleClick={() => startEdit(space)}
            onTouchStart={() => handleTouchStart(space)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}

            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
              currentSpace?.id === space.id
                ? 'bg-white text-black font-bold'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {space.title}
          </button>
        )
      ))}
      {showAdd ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="공간 이름"
            className="w-24 bg-gray-800 border border-white/10 rounded-full px-3 py-1 text-xs text-white outline-none"
            autoFocus
          />
          <button onClick={handleAdd} className="text-green-500 hover:text-green-400">
            <Plus size={16} />
          </button>
          <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-full text-xs bg-gray-800 text-gray-400 hover:text-white"
        >
          + 공간 추가
        </button>
      )}
    </div>
  );
}
