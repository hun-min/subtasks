// test-migration-fixed.js

const inputData = [
  {
    id: 631560697,
    text: "오늘 가기",
    depth: 0,
    subtasks: [
      {
        text: "사당 거기 (Should be depth 1)",
        depth: 0, 
        done: false
      }
    ]
  },
  {
    id: 1766012815033,
    text: "subtask (Should be icebox)",
    status: "LATER",
    subtasks: []
  },
  {
      text: "Done Task (Should be completed)",
      status: "DONE",
      subtasks: []
  }
];

const migrateTasks = (tasks) => {
  if (!Array.isArray(tasks)) {
    return [];
  }
  
  const flattened = [];
  const seenIds = new Set();

  const processTask = (t, depth = 0) => {
      if (!t || typeof t !== 'object') return;

      let id = t.id;
      if (!id) id = Date.now() + Math.random(); 
      
      if (seenIds.has(id)) {
          id = Date.now() + Math.random();
      }
      seenIds.add(id);

      // --- FIX START ---
      let finalStatus = t.status || (t.done ? 'completed' : 'pending');
      const upperStatus = String(finalStatus).toUpperCase();
      
      if (upperStatus === 'DONE') finalStatus = 'completed';
      else if (upperStatus === 'LATER') finalStatus = 'icebox';
      else if (upperStatus === 'TODO') finalStatus = 'pending';
      // --- FIX END ---

      const currentTask = {
          ...t,
          id: id,
          name: t.name || t.text || '',
          status: finalStatus,
          depth: depth, // --- FIX: Use recursive depth ---
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
console.log(JSON.stringify(result.map(t => ({ 
    name: t.name, 
    status: t.status, 
    depth: t.depth 
})), null, 2));