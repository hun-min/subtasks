// test-migration.js

// Mock data based on user description
const inputData = [
  {
    id: 631560697,
    text: "오늘 가기",
    depth: 0,
    subtasks: [
      {
        text: "사당 거기",
        depth: 0, // Problematic: depth is explicitly 0 in subtask
        done: false
      }
    ]
  },
  {
    id: 1766012815033,
    text: "subtask",
    status: "LATER", // Problematic: Unknown status
    subtasks: []
  },
  {
      text: "Done Task",
      status: "DONE", // Problematic: Should be 'completed'
      subtasks: []
  },
    {
      text: "Legacy Done Task",
      done: true, // Should be converted to 'completed' if status is missing
      subtasks: []
  }
];

// Paste migrateTasks logic here (slightly modified for JS)
const migrateTasks = (tasks) => {
  if (!Array.isArray(tasks)) {
    console.warn('migrateTasks: tasks is not an array', tasks);
    return [];
  }
  
  const flattened = [];
  const seenIds = new Set();

  const processTask = (t, depth = 0) => {
      if (!t || typeof t !== 'object') return;

      let id = t.id;
      if (!id) {
          id = Date.now() + Math.random(); 
      }
      
      if (seenIds.has(id)) {
          const newId = Date.now() + Math.random();
          id = newId;
      }
      seenIds.add(id);

      const currentTask = {
          ...t,
          id: id,
          name: t.name || t.text || '',
          status: t.status || (t.done ? 'completed' : 'pending'),
          depth: typeof t.depth === 'number' ? t.depth : depth, // This is likely the bug
          isSecond: t.isSecond === true,
          actTime: Number(t.actTime) || 0,
          planTime: Number(t.planTime) || 0,
          percent: Number(t.percent) || 0,
          space_id: t.space_id || '',
          subtasks: undefined 
      };

      flattened.push(currentTask);

      if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
          t.subtasks.forEach((sub) => processTask(sub, depth + 1));
      }
  };

  tasks.forEach(task => processTask(task, task.depth || 0));

  return flattened;
};

const result = migrateTasks(inputData);
console.log(JSON.stringify(result, null, 2));