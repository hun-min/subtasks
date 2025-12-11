
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Square, GripVertical, Trash2 } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  estTime: number;
  actTime: number;
  progress: number;
  isTimerRunning: boolean;
  done: boolean;
};

export function SortableTaskItem({ task, onToggle, onDelete, onEdit, onTimerToggle }: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (field: string, val: number | string) => void;
  onTimerToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative flex items-center justify-between py-4 border-b border-gray-900 hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <button {...attributes} {...listeners} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-manipulation">
          <GripVertical size={16}/>
        </button>
        
        <button onClick={onToggle} className={`w-4 h-4 rounded border transition-colors ${task.done ? 'bg-green-600 border-green-600' : 'border-gray-600 hover:border-white'}`}>
          {task.done && <div className="w-full h-full flex items-center justify-center text-white text-xs">✓</div>}
        </button>
        
        <input 
          value={task.title} 
          onChange={(e) => onEdit('title', e.target.value)}
          className={`flex-1 bg-transparent outline-none font-light text-lg ${task.done ? 'text-gray-500 line-through' : 'text-white'}`}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs font-mono">
          <input 
            type="number" min="0" value={isNaN(task.actTime) ? 0 : Math.floor(task.actTime)} 
            onChange={(e) => onEdit('actTime', Math.max(0, Number(e.target.value) || 0))}
            className={`w-8 bg-transparent text-center outline-none border-b border-gray-800 focus:border-green-500 transition-colors ${task.isTimerRunning ? 'text-green-400 font-bold' : 'text-gray-300'}`}
          />
          <span className="text-gray-500">m</span>
          <input 
            type="number" min="0" max="59" value={isNaN(task.actTime) ? 0 : Math.floor((task.actTime % 1) * 60)} 
            onChange={(e) => {
              const minutes = Math.floor(task.actTime || 0);
              const seconds = Math.max(0, Math.min(59, Number(e.target.value) || 0));
              onEdit('actTime', minutes + (seconds / 60));
            }}
            className={`w-6 bg-transparent text-center outline-none border-b border-gray-800 focus:border-green-500 transition-colors text-xs ${task.isTimerRunning ? 'text-green-400 font-bold' : 'text-gray-300'}`}
          />
          <span className="text-gray-500 text-xs">s</span>
        </div>
        
        <button onClick={onTimerToggle} className={`p-2 rounded transition-all touch-manipulation ${task.isTimerRunning ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'}`}>
          {task.isTimerRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        </button>
        
        <button onClick={onDelete} className="text-gray-700 hover:text-red-500 p-1 touch-manipulation">
          <Trash2 size={14}/>
        </button>
      </div>
    </div>
  );
}