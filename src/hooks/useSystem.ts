import { useLiveQuery } from 'dexie-react-hooks';
import { db, Target } from '../db';

export function useSystem() {
  
  const activeTasks = useLiveQuery(
    () => db.tasks
      .filter(task => task.isCompleted === false)
      .reverse()
      .toArray()
  );

  const completedTasks = useLiveQuery(
    () => db.tasks
      .filter(task => task.isCompleted === true)
      .reverse()
      .limit(50)
      .toArray()
  );

  const allTargets = useLiveQuery(() => db.targets.toArray());

  const searchTargets = async (query: string) => {
    if (!query) return [];
    return await db.targets
      .where('title')
      .startsWithIgnoreCase(query)
      .sortBy('usageCount')
      .then(arr => arr.reverse());
  };

  const submitTask = async (inputTitle: string, selectedTarget?: Target) => {
    let targetId = selectedTarget?.id;
    let actionTitle = inputTitle;

    if (selectedTarget) {
      await db.targets.update(selectedTarget.id!, {
        usageCount: selectedTarget.usageCount + 1,
        lastUsed: new Date()
      });
      actionTitle = selectedTarget.defaultAction || inputTitle;
    } else {
      targetId = await db.targets.add({
        title: inputTitle,
        defaultAction: inputTitle, 
        notes: '',
        usageCount: 1,
        lastUsed: new Date()
      }) as number;
    }

    await db.tasks.add({
      targetId,
      title: actionTitle,
      isCompleted: false,
      createdAt: new Date()
    });
  };

  const completeTask = async (taskId: number) => {
    await db.tasks.update(taskId, { isCompleted: true });
  };

  const undoTask = async (taskId: number) => {
    await db.tasks.update(taskId, { isCompleted: false });
  };

  const deleteTask = async (taskId: number) => {
    await db.tasks.delete(taskId);
  };

  return {
    activeTasks,
    completedTasks,
    allTargets,
    searchTargets,
    submitTask,
    completeTask,
    undoTask,
    deleteTask
  };
}
