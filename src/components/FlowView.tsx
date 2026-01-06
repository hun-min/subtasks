import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { DailyLog, Task } from '../types';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { UnifiedTaskItem } from './UnifiedTaskItem';
import { Flame } from 'lucide-react';

interface FlowViewProps {
  logs: DailyLog[];
  currentSpaceId: string;
  onUpdateTask: (date: string, taskId: number, updates: Partial<Task>) => void;
  onAddTask: (date: string, taskId: number, textBefore: string, textAfter: string) => void;
  onMergeTask: (date: string, taskId: number, currentText: string, direction: 'prev' | 'next') => void;
  onIndentTask: (date: string, taskId: number, direction: 'in' | 'out') => void;
  setFocusedTaskId: (id: number | null) => void;
  focusedTaskId: number | null;
  onViewDateChange?: (date: Date) => void;
}

export const FlowView: React.FC<FlowViewProps> = ({ 
  logs, 
  onUpdateTask, 
  onAddTask, 
  onMergeTask,
  onIndentTask,
  setFocusedTaskId, 
  focusedTaskId, 
  onViewDateChange 
}) => {
    // 1. Flatten Logs into Active Days (filtering out empty ones)
    const activeDays = useMemo(() => {
        // Sort logs by date descending (today first)
        return [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .filter(log => log.tasks.length > 0); // User requirement: hide empty days
    }, [logs]);

    // Intersection Observer for Sticky Header Highlight
    const observer = useRef<IntersectionObserver | null>(null);

    const getStreakAtDate = useCallback((currentDate: Date) => {
        const hasCompletedAtDate = (date: Date) => {
            const l = logs.find(log => log.date === date.toDateString());
            return l?.tasks.some(t => t.status === 'completed');
        };
        if (!hasCompletedAtDate(currentDate)) return 0;
        let streak = 1;
        let checkDate = new Date(currentDate);
        checkDate.setDate(checkDate.getDate() - 1);
        for(let k=0; k<365; k++) { 
            if (hasCompletedAtDate(checkDate)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }, [logs]);

    useEffect(() => {
        // Debounced observer setup
        const setupObserver = () => {
            if (observer.current) observer.current.disconnect();

            observer.current = new IntersectionObserver((entries) => {
                // Find the entry with the highest intersection ratio
                const visibleEntries = entries.filter(e => e.isIntersecting);
                if (visibleEntries.length > 0) {
                     // Sort by ratio descending
                     visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
                     const bestMatch = visibleEntries[0];
                     const dateStr = bestMatch.target.getAttribute('data-date');
                     if (dateStr && onViewDateChange) {
                         onViewDateChange(new Date(dateStr));
                     }
                }
            }, {
                root: null, // viewport
                rootMargin: '-50px 0px -50% 0px', // Center focused
                threshold: [0, 0.1, 0.5, 1.0]
            });

            const sections = document.querySelectorAll('.flow-section');
            sections.forEach(s => observer.current?.observe(s));
        };

        const timer = setTimeout(setupObserver, 100);
        return () => {
            clearTimeout(timer);
            observer.current?.disconnect();
        };
    }, [activeDays, onViewDateChange]);


    return (
        <div className="flex flex-col gap-0 pb-48">
           {activeDays.length === 0 && (
               <div className="text-center text-gray-500 py-20">No tasks found. Switch to Day View to add tasks.</div>
           )}
           {activeDays.map(log => {
               const d = new Date(log.date);
               // Fix Date Format: 2026-1-5 (No zero padding, YYYY-M-D)
               const dateLabel = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; 
               const streakAtDate = getStreakAtDate(d);

               return (
               <div key={log.date} className="group mb-8 flow-section" data-date={log.date}>
                   <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-sm py-2 px-6 border-b border-white/5 mb-2 flex items-center gap-4 flow-date-header" data-date={log.date}>
                       <h3 className="text-xl font-black text-white">{dateLabel}</h3>
                       {streakAtDate > 1 && (
                           <div className="flex items-center gap-0.5 ml-2">
                               <Flame size={14} className="text-orange-500 fill-orange-500" />
                               <span className="text-xs font-black text-white">{streakAtDate}</span>
                           </div>
                       )}
                       <div className="h-px flex-1 bg-white/10" />
                   </div>
                   <div className="px-0">
                       <SortableContext items={log.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                           {log.tasks.map((t, i) => (
                               <UnifiedTaskItem 
                                   key={t.id} 
                                   task={t} 
                                   index={i} 
                                   updateTask={(tid, updates) => onUpdateTask(log.date, tid, updates)}
                                   setFocusedTaskId={setFocusedTaskId}
                                   focusedTaskId={focusedTaskId}
                                   selectedTaskIds={new Set()} 
                                   onTaskClick={() => {}} 
                                   logs={logs}
                                   onAddTaskAtCursor={(tid, before, after) => onAddTask(log.date, tid, before, after)}
                                   onMergeWithPrevious={(tid, txt) => onMergeTask(log.date, tid, txt, 'prev')} 
                                   onMergeWithNext={(tid, txt) => onMergeTask(log.date, tid, txt, 'next')} 
                                   onIndent={(tid) => onIndentTask(log.date, tid, 'in')} 
                                   onOutdent={(tid) => onIndentTask(log.date, tid, 'out')} 
                                   onMoveUp={() => {
                                       const index = log.tasks.findIndex(t => t.id === focusedTaskId);
                                       if (index > 0) {
                                           const newTasks = [...log.tasks];
                                           [newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]];
                                           onUpdateTask(log.date, focusedTaskId!, {}); // Trigger update logic via onUpdateTask proxy if needed or direct
                                       }
                                   }} 
                                   onMoveDown={() => {}} 
                               />
                           ))}
                       </SortableContext>
                   </div>
               </div>
               );
           })}
        </div>
    );
};
