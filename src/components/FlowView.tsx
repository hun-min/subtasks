import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { DailyLog, Task } from '../types';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { UnifiedTaskItem } from './UnifiedTaskItem';
import { Flame } from 'lucide-react';
import { formatCompletionTime } from '../utils';

interface FlowViewProps {
  logs: DailyLog[];
  currentSpaceId: string;
  onUpdateTask: (date: string, taskId: number, updates: Partial<Task>) => void;
  onAddTask: (date: string, taskId: number, textBefore: string, textAfter: string) => void;
  onIndentTask: (date: string, taskId: number, direction: 'in' | 'out') => void;
  onMoveTask: (date: string, taskId: number, direction: 'up' | 'down') => void;
  setFocusedTaskId: (id: number | null) => void;
  focusedTaskId: number | null;
  onViewDateChange?: (date: Date) => void;
}

export const FlowView: React.FC<FlowViewProps> = ({
  logs,
  onUpdateTask,
  onAddTask,
  onIndentTask,
  onMoveTask,
  setFocusedTaskId,
  focusedTaskId,
  onViewDateChange
}) => {
    const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
    const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

    // 1. Flatten Logs into Active Days (filtering out empty ones)
    const activeDays = useMemo(() => {
        // Sort logs by date descending (today first)
        return [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .filter(log => log.tasks.length > 0); // User requirement: hide empty days
    }, [logs]);

    // Create a flat list of tasks for navigation
    const flatTaskList = useMemo(() => {
        const list: { id: number; date: string }[] = [];
        activeDays.forEach(log => {
            log.tasks.forEach(t => {
                list.push({ id: t.id, date: log.date });
            });
        });
        return list;
    }, [activeDays]);

    const handleFocusPrev = useCallback((currentTaskId: number) => {
        const index = flatTaskList.findIndex(item => item.id === currentTaskId);
        if (index > 0) {
            setFocusedTaskId(flatTaskList[index - 1].id);
        }
    }, [flatTaskList, setFocusedTaskId]);

    const handleFocusNext = useCallback((currentTaskId: number) => {
        const index = flatTaskList.findIndex(item => item.id === currentTaskId);
        if (index !== -1 && index < flatTaskList.length - 1) {
            setFocusedTaskId(flatTaskList[index + 1].id);
        }
    }, [flatTaskList, setFocusedTaskId]);

    const handleSelectTask = useCallback((e: React.MouseEvent, taskId: number) => {
        const currentIndex = flatTaskList.findIndex(item => item.id === taskId);
        if (currentIndex === -1) return;

        if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            setSelectedTasks(prev => {
                const newSet = new Set(prev);
                if (newSet.has(taskId)) {
                    newSet.delete(taskId);
                } else {
                    newSet.add(taskId);
                }
                return newSet;
            });
            setLastClickedIndex(currentIndex);
        } else if (e.shiftKey && lastClickedIndex !== null) {
            // Range selection from last clicked to current
            const start = Math.min(currentIndex, lastClickedIndex);
            const end = Math.max(currentIndex, lastClickedIndex);
            const rangeIds = flatTaskList.slice(start, end + 1).map(item => item.id);
            setSelectedTasks(new Set(rangeIds));
        } else {
            // Single selection
            setSelectedTasks(new Set([taskId]));
            setLastClickedIndex(currentIndex);
        }
    }, [flatTaskList, selectedTasks, lastClickedIndex]);

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

    // Key handler for Del key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && selectedTasks.size > 0) {
                e.preventDefault();
                // Delete selected tasks
                selectedTasks.forEach(taskId => {
                    const taskItem = flatTaskList.find(item => item.id === taskId);
                    if (taskItem) {
                        // Find the task in logs and call onDelete if available
                        // Since onDelete is not passed, we need to handle deletion differently
                        // For now, just log or handle as needed
                        console.log('Delete task:', taskId);
                    }
                });
                setSelectedTasks(new Set());
            } else if (e.key === 'Escape') {
                setSelectedTasks(new Set());
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedTasks, flatTaskList]);


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
                    <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-sm py-2 px-4 border-b border-white/5 mb-2 flex items-center gap-4 flow-date-header" data-date={log.date}>
                        <h3 className="text-xl font-black text-white">{dateLabel}</h3>
                        {streakAtDate > 1 && (
                            <div className="flex items-center gap-0.5 ml-2">
                                <Flame size={14} className="text-orange-500 fill-orange-500" />
                                <span className="text-xs font-black text-white">{streakAtDate}</span>
                            </div>
                        )}
                        <div className="h-px flex-1 bg-white/10" />
                        <div className="flex items-center gap-2">
                            {(() => {
                                const completedCount = log.tasks.filter(t => t.status === 'completed').length;
                                const totalCount = log.tasks.length;
                                const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                                return (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-[#7c4dff]">{percent}%</span>
                                        <div className="h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#7c4dff] transition-all" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="px-4 mb-2">
                        {(() => {
                            const completedTasks = log.tasks.filter(t => t.status === 'completed');
                            if (completedTasks.length === 0) return null;
                            
                            const latestCompleted = completedTasks.reduce((latest, task) => {
                                if (!task.end_time) return latest;
                                if (!latest || task.end_time > latest.end_time!) return task;
                                return latest;
                            }, null as Task | null);
                            
                            if (!latestCompleted || !latestCompleted.end_time) return null;
                            
                            const timeDisplay = formatCompletionTime(latestCompleted.end_time);
                            return (
                                <div className="text-[10px] text-gray-500 font-mono">
                                    Completed at {timeDisplay}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="-ml-7">
                       <SortableContext items={log.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                           {log.tasks.map((t, i) => (
                               <UnifiedTaskItem
                                   key={t.id}
                                   task={t}
                                   index={i}
                                   updateTask={(tid, updates) => onUpdateTask(log.date, tid, updates)}
                                   setFocusedTaskId={setFocusedTaskId}
                                   focusedTaskId={focusedTaskId}
                                   onTaskClick={handleSelectTask}
                                   logs={logs}
                                   onAddTaskAtCursor={(tid, before, after) => onAddTask(log.date, tid, before, after)}
                                   onMergeWithPrevious={() => {}}
                                   onMergeWithNext={() => {}}
                                   isSelected={selectedTasks.has(t.id)}
                                   onIndent={(tid) => onIndentTask(log.date, tid, 'in')}
                                   onOutdent={(tid) => onIndentTask(log.date, tid, 'out')}
                                   onMoveUp={(tid) => onMoveTask(log.date, tid, 'up')}
                                   onMoveDown={(tid) => onMoveTask(log.date, tid, 'down')}
                                   onFocusPrev={handleFocusPrev}
                                   onFocusNext={handleFocusNext}
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
