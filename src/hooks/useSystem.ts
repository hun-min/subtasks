import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task, Target, Space } from '../db';
import { supabase } from '../supabase';

export function useSystem() {
  
  useEffect(() => {
    const syncData = async () => {
      if (!navigator.onLine) return;
      
      const { data: remoteSpaces } = await supabase.from('spaces').select('*');
      if (remoteSpaces && remoteSpaces.length > 0) {
        await db.spaces.bulkPut(remoteSpaces);
      } else {
        const defaultSpace = { title: '기본', createdAt: new Date() };
        await db.spaces.add(defaultSpace);
        supabase.from('spaces').insert([defaultSpace]).then();
      }
      
      const { data: remoteTargets } = await supabase.from('targets').select('*');
      if (remoteTargets) await db.targets.bulkPut(remoteTargets);
      
      const { data: remoteTasks } = await supabase.from('tasks').select('*');
      if (remoteTasks) await db.tasks.bulkPut(remoteTasks);
    };
    syncData();
  }, []);

  const allSpaces = useLiveQuery(() => db.spaces.toArray());
  const activeTasks = useLiveQuery(() => db.tasks.filter(task => task.isCompleted === false).sortBy('createdAt'));
  const completedTasks = useLiveQuery(() => db.tasks.filter(task => task.isCompleted === true).sortBy('completedAt').then(tasks => tasks.reverse().slice(0, 50)));
  const allTargets = useLiveQuery(() => db.targets.toArray());

  const searchTargets = async (query: string, spaceId?: number) => {
    if (!query) return [];
    let results = await db.targets.where('title').startsWithIgnoreCase(query).sortBy('lastUsed');
    if (spaceId) results = results.filter(t => t.spaceId === spaceId);
    return results.reverse().slice(0, 10);
  };

  const searchActions = async (query: string, targetId?: number) => {
    if (!query) return [];
    const tasks = targetId ? await db.tasks.where('targetId').equals(targetId).reverse().toArray() : await db.tasks.reverse().toArray();
    const matches = tasks.filter(t => t.title.toLowerCase().startsWith(query.toLowerCase()));
    const uniqueActions = Object.values(matches.reduce((acc, current) => {
        if (!acc[current.title]) acc[current.title] = current;
        return acc;
    }, {} as Record<string, Task>));
    return uniqueActions.slice(0, 5).map(t => ({ id: t.id, title: t.title, defaultAction: '', notes: '', usageCount: 0, lastUsed: t.createdAt } as Target));
  };

  const addTask = async (task: Omit<Task, 'id'>) => {
    const id = await db.tasks.add(task) as number;
    supabase.from('tasks').upsert([{ ...task, id }]).then(({ error }) => {
      if (error) console.error('Sync Error (Task):', error);
    });
    return id;
  };

  const addSpace = async (space: Omit<Space, 'id'>) => {
    const id = await db.spaces.add(space) as number;
    supabase.from('spaces').upsert([{ ...space, id }]).then(({ error }) => {
      if (error) console.error('Space insert error:', error);
    });
    return id;
  };

  const updateSpace = async (spaceId: number, title: string) => {
    await db.spaces.update(spaceId, { title });
    supabase.from('spaces').update({ title }).eq('id', spaceId).then();
  };

  const deleteSpace = async (spaceId: number) => {
    await db.spaces.delete(spaceId);
    const targetsInSpace = await db.targets.where('spaceId').equals(spaceId).toArray();
    const targetIds = targetsInSpace.map(t => t.id!);
    for (const targetId of targetIds) {
      const tasks = await db.tasks.where('targetId').equals(targetId).toArray();
      await db.tasks.bulkDelete(tasks.map(t => t.id!));
      supabase.from('tasks').delete().eq('targetId', targetId).then();
    }
    await db.targets.where('spaceId').equals(spaceId).delete();
    supabase.from('spaces').delete().eq('id', spaceId).then();
    supabase.from('targets').delete().eq('spaceId', spaceId).then();
  };

  const addTarget = async (target: Omit<Target, 'id'>) => {
    const targetWithCompletion = { ...target, isCompleted: false };
    const id = await db.targets.add(targetWithCompletion) as number;
    supabase.from('targets').upsert([{ ...targetWithCompletion, id }]).then(({ error }) => {
      if (error) console.error('Sync Error (Target):', error);
    });
    return id;
  };

  const completeTask = async (taskId: number) => {
    const completedAt = new Date();
    await db.tasks.update(taskId, { isCompleted: true, completedAt });
    supabase.from('tasks').update({ isCompleted: true, completedAt }).eq('id', taskId).then(({ error }) => {
      if (error) console.log('Supabase sync skipped:', error.message);
    });
  };

  const completeTarget = async (targetId: number) => {
    const completedAt = new Date();
    await db.targets.update(targetId, { isCompleted: true, lastUsed: completedAt });
    supabase.from('targets').update({ isCompleted: true, lastUsed: completedAt }).eq('id', targetId).then(({ error }) => {
      if (error) console.log('Supabase sync skipped:', error.message);
    });
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

  const undoTarget = async (targetId: number) => {
    await db.targets.update(targetId, { isCompleted: false });
    supabase.from('targets').update({ isCompleted: false }).eq('id', targetId).then();
  };

  const deleteTask = async (taskId: number) => {
    await db.tasks.delete(taskId);
    supabase.from('tasks').delete().eq('id', taskId).then();
  };

  const deleteGroup = async (targetId: number) => {
    await db.targets.delete(targetId);
    supabase.from('targets').delete().eq('id', targetId).then();
  };

  const moveTaskUp = async (currentTask: Task, allTasksInGroup: Task[]) => {
    const index = allTasksInGroup.findIndex(t => t.id === currentTask.id);
    if (index > 0) {
        const upperTask = allTasksInGroup[index - 1];
        const upperTime = new Date(upperTask.createdAt).getTime();
        const currentTime = new Date(currentTask.createdAt).getTime();

        if (upperTime === currentTime) {
             await db.tasks.update(upperTask.id!, { createdAt: new Date(currentTime + 1000) });
             supabase.from('tasks').update({ createdAt: new Date(currentTime + 1000) }).eq('id', upperTask.id).then();
        } else {
             await db.tasks.update(upperTask.id!, { createdAt: currentTask.createdAt });
             await db.tasks.update(currentTask.id!, { createdAt: upperTask.createdAt });
             supabase.from('tasks').upsert([{ id: upperTask.id, createdAt: currentTask.createdAt }, { id: currentTask.id, createdAt: upperTask.createdAt }]).then();
        }
    }
  };

  const moveTaskDown = async (currentTask: Task, allTasksInGroup: Task[]) => {
    const index = allTasksInGroup.findIndex(t => t.id === currentTask.id);
    if (index < allTasksInGroup.length - 1) {
        const lowerTask = allTasksInGroup[index + 1];
        const lowerTime = new Date(lowerTask.createdAt).getTime();
        const currentTime = new Date(currentTask.createdAt).getTime();

        if (lowerTime === currentTime) {
             await db.tasks.update(lowerTask.id!, { createdAt: new Date(currentTime - 1000) });
             supabase.from('tasks').update({ createdAt: new Date(currentTime - 1000) }).eq('id', lowerTask.id).then();
        } else {
             await db.tasks.update(lowerTask.id!, { createdAt: currentTask.createdAt });
             await db.tasks.update(currentTask.id!, { createdAt: lowerTask.createdAt });
             supabase.from('tasks').upsert([{ id: lowerTask.id, createdAt: currentTask.createdAt }, { id: currentTask.id, createdAt: lowerTask.createdAt }]).then();
        }
    }
  };

  const moveTargetUp = async (currentTargetId: number) => {
    const targets = await db.targets.orderBy('lastUsed').reverse().toArray();
    const index = targets.findIndex(t => t.id === currentTargetId);
    if (index > 0) {
        const upperTarget = targets[index - 1];
        const currentTarget = targets[index];
        const tempTime = new Date(upperTarget.lastUsed);
        await db.targets.update(upperTarget.id!, { lastUsed: currentTarget.lastUsed });
        await db.targets.update(currentTarget.id!, { lastUsed: tempTime });
        supabase.from('targets').update({ lastUsed: currentTarget.lastUsed }).eq('id', upperTarget.id).then();
        supabase.from('targets').update({ lastUsed: tempTime }).eq('id', currentTarget.id).then();
    }
  };

  const moveTargetDown = async (currentTargetId: number) => {
    const targets = await db.targets.orderBy('lastUsed').reverse().toArray();
    const index = targets.findIndex(t => t.id === currentTargetId);
    if (index < targets.length - 1) {
        const lowerTarget = targets[index + 1];
        const currentTarget = targets[index];
        const tempTime = new Date(lowerTarget.lastUsed);
        await db.targets.update(lowerTarget.id!, { lastUsed: currentTarget.lastUsed });
        await db.targets.update(currentTarget.id!, { lastUsed: tempTime });
        supabase.from('targets').update({ lastUsed: currentTarget.lastUsed }).eq('id', lowerTarget.id).then();
        supabase.from('targets').update({ lastUsed: tempTime }).eq('id', currentTarget.id).then();
    }
  };

  const updateTimerCount = async (taskId: number, count: number) => {
    await db.tasks.update(taskId, { timerCount: count });
    supabase.from('tasks').update({ timerCount: count }).eq('id', taskId).then();
  };

  const getHeatmapData = async (spaceId?: number) => {
    const tasks = await db.tasks.filter(t => t.isCompleted === true).toArray();
    const targets = await db.targets.toArray();
    const stats: Record<string, number> = {};
    
    tasks.forEach(t => {
      const target = targets.find(tg => tg.id === t.targetId);
      if (spaceId && (!target || target.spaceId !== spaceId)) return;
      const d = t.completedAt ? (t.completedAt instanceof Date ? t.completedAt : new Date(t.completedAt)) : (t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt));
      const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      stats[dateStr] = (stats[dateStr] || 0) + 1;
    });
    
    targets.filter(t => t.isCompleted && (!spaceId || t.spaceId === spaceId)).forEach(target => {
      const d = target.lastUsed instanceof Date ? target.lastUsed : new Date(target.lastUsed);
      const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      stats[dateStr] = (stats[dateStr] || 0) + 1;
    });
    
    return stats;
  };

  return { allSpaces, activeTasks, completedTasks, allTargets, searchTargets, searchActions, completeTask, completeTarget, updateTaskTitle, updateTargetTitle, undoTask, undoTarget, deleteTask, deleteGroup, addTask, addTarget, addSpace, updateSpace, deleteSpace, updateTargetUsage, moveTaskUp, moveTaskDown, moveTargetUp, moveTargetDown, getHeatmapData, updateTimerCount };
}
