import { useState } from 'react';
import { useSpace } from '../contexts/SpaceContext';

export function SpaceSelector() {
  const { spaces, currentSpace, setCurrentSpace, addSpace, updateSpace } = useSpace();
  const [showAdd, setShowAdd] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const handleAdd = async () => {
    if (!newSpaceName.trim()) return;
    await addSpace(newSpaceName);
    setNewSpaceName('');
    setShowAdd(false);
  };

  const startEdit = (space: any) => {
    setEditingId(space.id);
    setEditName(space.title);
  };

  const handleEdit = async () => {
    if (!editName.trim() || !editingId) return;
    await updateSpace(editingId, editName);
    setEditingId(null);
  };



  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
      {spaces.map(space => (
        <div key={space.id} className="flex items-center gap-1">
          {editingId === space.id ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEdit();
                else if (e.key === 'Escape') setEditingId(null);
              }}
              onBlur={handleEdit}
              className="w-24 bg-gray-800 border border-white/10 rounded-full px-3 py-1 text-xs text-white outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setCurrentSpace(space)}
              onDoubleClick={() => startEdit(space)}
              onTouchStart={() => {
                const timer = setTimeout(() => startEdit(space), 500);
                setLongPressTimer(timer);
              }}
              onTouchEnd={() => {
                if (longPressTimer) clearTimeout(longPressTimer);
              }}
              onTouchMove={() => {
                if (longPressTimer) clearTimeout(longPressTimer);
              }}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                currentSpace?.id === space.id
                  ? 'bg-white text-black font-bold'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {space.title}
            </button>
          )}

        </div>
      ))}
      {showAdd ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              else if (e.key === 'Escape') setShowAdd(false);
            }}
            onBlur={() => {
              if (newSpaceName.trim()) handleAdd();
              else setShowAdd(false);
            }}
            placeholder="공간 이름"
            className="w-24 bg-gray-800 border border-white/10 rounded-full px-3 py-1 text-xs text-white outline-none"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-full text-xs bg-gray-800 text-gray-400 hover:text-white"
        >
          +
        </button>
      )}
    </div>
  );
}
