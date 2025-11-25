import React, { useState, useEffect } from 'react';
import { useSystem } from './hooks/useSystem';
import { Target, db } from './db';

const CheckIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const PlusIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const HistoryIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"></path><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path></svg>;
const UndoIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path></svg>;

export default function App() {
  const { activeTasks, completedTasks, allTargets, searchTargets, completeTask, undoTask, deleteTask } = useSystem();
  
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Target[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tempTargetTitle, setTempTargetTitle] = useState('');
  const [tempFirstAction, setTempFirstAction] = useState('');

  const getTargetTitle = (targetId?: number) => {
    if (!targetId) return null;
    return allTargets?.find(t => t.id === targetId)?.title || null;
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.trim().length > 0) {
        const results = await searchTargets(inputValue);
        setSuggestions(results || []);
      } else {
        setSuggestions([]);
      }
    };
    fetchSuggestions();
    setSelectedIndex(-1);
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setIsModalOpen(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      const target = suggestions[selectedIndex];
      db.tasks.add({
        targetId: target.id,
        title: target.defaultAction,
        isCompleted: false,
        createdAt: new Date()
      });
      db.targets.update(target.id!, {
        usageCount: target.usageCount + 1,
        lastUsed: new Date()
      });
      setInputValue('');
      setSuggestions([]);
    } else {
      setTempTargetTitle(inputValue);
      setTempFirstAction('');
      setIsModalOpen(true);
    }
  };

  const handleSelect = (target: Target) => {
    db.tasks.add({
      targetId: target.id,
      title: target.defaultAction,
      isCompleted: false,
      createdAt: new Date()
    });
    db.targets.update(target.id!, {
      usageCount: target.usageCount + 1,
      lastUsed: new Date()
    });
    setInputValue('');
    setSuggestions([]);
  };

  const confirmNewAsset = async () => {
    const newTargetId = await db.targets.add({
      title: tempTargetTitle,
      defaultAction: tempFirstAction,
      notes: '',
      usageCount: 1,
      lastUsed: new Date()
    });

    await db.tasks.add({
      targetId: newTargetId as number,
      title: tempFirstAction,
      isCompleted: false,
      createdAt: new Date()
    });

    setIsModalOpen(false);
    setInputValue('');
    setSuggestions([]);
  };

  const handleDelete = async (taskId: number) => {
    if (window.confirm('정말 삭제하시겠습니까? (복구 불가)')) {
      await deleteTask(taskId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col items-center p-4 pb-20">
      <div className="w-full max-w-md mt-8 space-y-6 relative z-10">
        
        <header className="mb-6 pl-1 flex justify-between items-end">
          <h1 className="text-3xl font-bold text-white tracking-tighter">Protocol<span className="text-blue-500">.</span></h1>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-all ${showHistory ? 'bg-blue-900 text-blue-200' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            <HistoryIcon />
            {showHistory ? 'Hide Log' : 'History'}
          </button>
        </header>

        <form onSubmit={handleFormSubmit} className="relative w-full group">
          <div className="relative flex items-center shadow-2xl shadow-blue-900/10 rounded-2xl bg-gray-900 border border-gray-800">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Objective (원하는 것)..."
              className="w-full bg-transparent text-white px-5 py-4 rounded-2xl focus:outline-none placeholder-gray-600 text-lg z-10"
              autoFocus
            />
            <button type="submit" className="absolute right-3 p-2 bg-gray-800 hover:bg-blue-600 rounded-xl transition-colors text-gray-400 hover:text-white z-20">
              <PlusIcon />
            </button>
          </div>

          {suggestions.length > 0 && (
            <ul className="absolute w-full mt-2 bg-gray-900/95 backdrop-blur-md border border-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[50vh] overflow-y-auto z-50">
              {suggestions.map((item, index) => (
                <li
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`px-5 py-4 cursor-pointer flex justify-between items-center border-b border-gray-800 last:border-0
                    ${index === selectedIndex ? 'bg-blue-900/20' : 'hover:bg-gray-800/50'}
                  `}
                >
                  <div>
                    <span className={`font-bold block ${index === selectedIndex ? 'text-blue-400' : 'text-gray-200'}`}>
                      {item.title}
                    </span>
                    <span className="text-sm text-gray-500">↳ {item.defaultAction}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="space-y-3 mt-6">
          {activeTasks?.map((task) => {
            const targetTitle = getTargetTitle(task.targetId);
            return (
              <div 
                key={task.id}
                className="relative flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-600 transition-all group overflow-hidden"
              >
                <div className="flex flex-col gap-1 max-w-[80%]">
                  {targetTitle && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md w-fit">
                      {targetTitle}
                    </span>
                  )}
                  <span className="text-gray-200 font-medium text-base ml-0.5">
                    {task.title}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 z-10 bg-gray-900 pl-2">
                  <button
                    onClick={() => handleDelete(task.id!)}
                    className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                  <button
                    onClick={() => completeTask(task.id!)}
                    className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-gray-700 text-transparent hover:border-green-500 hover:bg-green-500 hover:text-black transition-all"
                  >
                    <CheckIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {showHistory && (
          <div className="mt-10 pt-6 border-t border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 ml-1">Completed Log</h2>
            <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
              {completedTasks?.length === 0 && <p className="text-gray-600 text-sm">No history yet.</p>}
              {completedTasks?.map((task) => {
                const targetTitle = getTargetTitle(task.targetId);
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50 border border-gray-800/50">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">{targetTitle}</span>
                      <span className="text-gray-400 line-through decoration-gray-600 decoration-2">{task.title}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => undoTask(task.id!)}
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg"
                        title="Undo (되돌리기)"
                      >
                        <UndoIcon />
                      </button>
                      <button 
                        onClick={() => handleDelete(task.id!)}
                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-gray-900 w-full max-w-md rounded-3xl border border-gray-800 shadow-2xl p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white">New Protocol</h3>
              <p className="text-gray-500 text-sm mt-1">
                Target: <span className="text-blue-400 font-semibold">"{tempTargetTitle}"</span>
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold mb-2 ml-1">First Action</label>
              <input 
                type="text" 
                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none text-lg"
                value={tempFirstAction}
                onChange={(e) => setTempFirstAction(e.target.value)}
                autoFocus
                placeholder="가장 먼저 해야 할 행동은?"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) confirmNewAsset();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmNewAsset}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
