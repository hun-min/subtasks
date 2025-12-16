import { useState } from 'react';
import { X } from 'lucide-react';
import { useSpace } from '../contexts/SpaceContext';

export function SpaceSelector() {
  const { spaces, currentSpace, setCurrentSpace, addSpace, deleteSpace, updateSpace } = useSpace();
  const [showAdd, setShowAdd] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
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

  const handleDelete = async (id: number, title: string) => {
    if (window.confirm(`"${title}" 공간을 삭제하시겠습니까?`)) {
      await deleteSpace(id);
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
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setEditingId(null);
                }
              }}
              onBlur={() => {
                if (editingName.trim()) {
                  updateSpace(space.id!, editingName.trim());
                }
                setEditingId(null);
              }}
              className="w-24 bg-gray-800 border border-white/10 rounded-full px-3 py-1 text-xs text-white outline-none"
              autoFocus
            />
          </div>
        ) : (
          <div key={space.id} className="flex flex-col items-center gap-0.5 group">
            <button
              onClick={() => setCurrentSpace(space)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                currentSpace?.id === space.id
                  ? 'bg-white text-black font-bold'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {space.title}
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startEdit(space)}
                className="text-gray-600 hover:text-blue-400 text-[10px]"
              >
                ✎
              </button>
              {spaces.length > 1 && (
                <button
                  onClick={() => handleDelete(space.id!, space.title)}
                  className="text-gray-600 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )
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
