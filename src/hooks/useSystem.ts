import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task, Target } from '../db';

export function useSystem() {
  
  const activeTasks = useLiveQuery(
    () => db.tasks.filter(task => task.isCompleted === false).sortBy('createdAt')
  );

  const completedTasks = useLiveQuery(
    () => db.tasks.filter(task => task.isCompleted === true).reverse().limit(50).toArray()
  );

  const allTargets = useLiveQuery(() => db.targets.toArray());

  const searchTargets = async (query: string) => {
    if (!query) return [];
    const results = await db.targets
      .where('title')
      .startsWithIgnoreCase(query)
      .sortBy('lastUsed');
    return results.reverse().slice(0, 10);
  };

  const searchActions = async (query: string, targetId?: number) => {
    if (!query || !targetId) return [];
    const tasks = await db.tasks.where('targetId').equals(targetId).reverse().toArray();
    const matches = tasks.filter(t => t.title.toLowerCase().startsWith(query.toLowerCase()));
    const uniqueActions = Object.values(
        matches.reduce((acc, current) => {
            if (!acc[current.title]) acc[current.title] = current;
            return acc;
        }, {} as Record<string, Task>)
    );
    return uniqueActions.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        defaultAction: '',
        notes: '',
        usageCount: 0,
        lastUsed: t.createdAt
    } as Target));
  };

  const completeTask = async (taskId: number) => {
    await db.tasks.update(taskId, { isCompleted: true });
  };

  const updateTaskTitle = async (taskId: number, newTitle: string) => {
    await db.tasks.update(taskId, { title: newTitle });
  };

  const updateTargetTitle = async (targetId: number, newTitle: string) => {
    await db.targets.update(targetId, { title: newTitle });
  };

  const nukeTargetHistory = async (targetId: number) => {
    const tasksToDelete = await db.tasks
        .where('targetId').equals(targetId)
        .filter(t => t.isCompleted === true)
        .toArray();
    const ids = tasksToDelete.map(t => t.id!);
    await db.tasks.bulkDelete(ids);
  };

  const undoTask = async (taskId: number) => {
    await db.tasks.update(taskId, { isCompleted: false });
  };

  const deleteTask = async (taskId: number) => {
    const task = await db.tasks.get(taskId);
    if (!task) return;

    const targetId = task.targetId;
    await db.tasks.delete(taskId);

    if (targetId) {
        const remainingCount = await db.tasks.where('targetId').equals(targetId).count();
        if (remainingCount === 0) {
            await db.targets.delete(targetId);
        }
    }
  };

  const moveTaskUp = async (currentTask: Task, allTasksInGroup: Task[]) => {
    const index = allTasksInGroup.findIndex(t => t.id === currentTask.id);
    if (index > 1) {
        const upperTask = allTasksInGroup[index - 1];
        const tempTime = new Date(upperTask.createdAt);
        await db.tasks.update(upperTask.id!, { createdAt: currentTask.createdAt });
        await db.tasks.update(currentTask.id!, { createdAt: tempTime });
    }
  };

  const moveTaskDown = async (currentTask: Task, allTasksInGroup: Task[]) => {
    const index = allTasksInGroup.findIndex(t => t.id === currentTask.id);
    if (index > 0 && index < allTasksInGroup.length - 1) {
        const lowerTask = allTasksInGroup[index + 1];
        const tempTime = new Date(lowerTask.createdAt);
        await db.tasks.update(lowerTask.id!, { createdAt: currentTask.createdAt });
        await db.tasks.update(currentTask.id!, { createdAt: tempTime });
    }
  };

  return {
    activeTasks,
    completedTasks,
    allTargets,
    searchTargets,
    searchActions,
    completeTask,
    updateTaskTitle,
    updateTargetTitle,
    undoTask,
    deleteTask,
    nukeTargetHistory,
    moveTaskUp,
    moveTaskDown
  };
}
