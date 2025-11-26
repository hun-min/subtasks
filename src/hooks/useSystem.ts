import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task, Target } from '../db';
import { supabase } from '../supabase';

export function useSystem() {
  
  useEffect(() => {
    const syncFromCloud = async () => {
      if (!navigator.onLine) return;
      const { data: remoteTargets } = await supabase.from('targets').select('*');
      if (remoteTargets) await db.targets.bulkPut(remoteTargets);
      const { data: remoteTasks } = await supabase.from('tasks').select('*');
      if (remoteTasks) await db.tasks.bulkPut(remoteTasks);
    };
    syncFromCloud();
  }, []);

  const activeTasks = useLiveQuery(() => db.tasks.filter(task => task.isCompleted === false).sortBy('createdAt'));
  const completedTasks = useLiveQuery(() => db.tasks.filter(task => task.isCompleted === true).reverse().limit(50).toArray());
  const allTargets = useLiveQuery(() => db.targets.toArray());

  const searchTargets = async (query: string) => {
    if (!query) return [];
    const results = await db.targets.where('title').startsWithIgnoreCase(query).sortBy('lastUsed');
    return results.reverse().slice(0, 10);
  };

  const searchActions = async (query: string, targetId?: number) => {
    if (!query || !targetId) return [];
    const tasks = await db.tasks.where('targetId').equals(targetId).reverse().toArray();
    const matches = tasks.filter(t => t.title.toLowerCase().startsWith(query.toLowerCase()));
    const uniqueActions = Object.values(matches.reduce((acc, current) => {
        if (!acc[current.title]) acc[current.title] = current;
        return acc;
    }, {} as Record<string, Task>));
    return uniqueActions.slice(0, 5).map(t => ({ id: t.id, title: t.title, defaultAction: '', notes: '', usageCount: 0, lastUsed: t.createdAt } as Target));
  };

  const addTask = async (task: Omit<Task, 'id'>) => {
    const id = await db.tasks.add(task) as number;
    supabase.from('tasks').insert([{ ...task, id }]).then();
    return id;
  };

  const addTarget = async (target: Omit<Target, 'id'>) => {
    const id = await db.targets.add(target) as number;
    supabase.from('targets').insert([{ ...target, id }]).then();
    return id;
  };

  const completeTask = async (taskId: number) => {
    await db.tasks.update(taskId, { isCompleted: true });
    supabase.from('tasks').update({ isCompleted: true }).eq('id', taskId).then();
  };

  const updateTaskTitle = async (taskId: number, newTitle: string) => {
    await db.tasks.update(taskId, { title: newTitle });
    supabase.from('tasks').update({ title: newTitle }).eq('id', taskId).then();
  };

  const updateTargetTitle = async (targetId: number, newTitle: string) => {
    await db.targets.update(targetId, { title: newTitle });
    supabase.from('targets').update({ title: newTitle }).eq('id', targetId).then();
  };

  const updateTargetUsage = async (targetId: number, usageCount: number) => {
    await db.targets.update(targetId, { usageCount, lastUsed: new Date() });
    supabase.from('targets').update({ usageCount, lastUsed: new Date() }).eq('id', targetId).then();
  };

  const undoTask = async (taskId: number) => {
    await db.tasks.update(taskId, { isCompleted: false });
    supabase.from('tasks').update({ isCompleted: false }).eq('id', taskId).then();
  };

  const deleteTask = async (taskId: number) => {
    const task = await db.tasks.get(taskId);
    if (!task) return;
    const targetId = task.targetId;
    await db.tasks.delete(taskId);
    supabase.from('tasks').delete().eq('id', taskId).then();
    if (targetId) {
        const remainingCount = await db.tasks.where('targetId').equals(targetId).count();
        if (remainingCount === 0) {
            await db.targets.delete(targetId);
            supabase.from('targets').delete().eq('id', targetId).then();
        }
    }
  };

  const deleteGroup = async (targetId: number) => {
    const relatedTasks = await db.tasks.where('targetId').equals(targetId).toArray();
    const taskIds = relatedTasks.map(t => t.id!);
    if (taskIds.length > 0) await db.tasks.bulkDelete(taskIds);
    await db.targets.delete(targetId);
    supabase.from('tasks').delete().eq('targetId', targetId).then();
    supabase.from('targets').delete().eq('id', targetId).then();
  };

  const moveTaskUp = async (currentTask: Task, allTasksInGroup: Task[]) => {
    const index = allTasksInGroup.findIndex(t => t.id === currentTask.id);
    if (index > 1) {
        const upperTask = allTasksInGroup[index - 1];
        const tempTime = new Date(upperTask.createdAt);
        await db.tasks.update(upperTask.id!, { createdAt: currentTask.createdAt });
        await db.tasks.update(currentTask.id!, { createdAt: tempTime });
        supabase.from('tasks').upsert([{ id: upperTask.id, createdAt: currentTask.createdAt }, { id: currentTask.id, createdAt: tempTime }]).then();
    }
  };

  const moveTaskDown = async (currentTask: Task, allTasksInGroup: Task[]) => {
    const index = allTasksInGroup.findIndex(t => t.id === currentTask.id);
    if (index > 0 && index < allTasksInGroup.length - 1) {
        const lowerTask = allTasksInGroup[index + 1];
        const tempTime = new Date(lowerTask.createdAt);
        await db.tasks.update(lowerTask.id!, { createdAt: currentTask.createdAt });
        await db.tasks.update(currentTask.id!, { createdAt: tempTime });
        supabase.from('tasks').upsert([{ id: lowerTask.id, createdAt: currentTask.createdAt }, { id: currentTask.id, createdAt: tempTime }]).then();
    }
  };

  return { activeTasks, completedTasks, allTargets, searchTargets, searchActions, completeTask, updateTaskTitle, updateTargetTitle, undoTask, deleteTask, deleteGroup, moveTaskUp, moveTaskDown, addTask, addTarget, updateTargetUsage };
}
