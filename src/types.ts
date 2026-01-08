export type Task = {
  id: number;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'icebox';
  indent: number;
  parent: number | null;
  note?: string;
  due?: string;
  total_time?: number;
  space_id: string;
  created_at?: string;
  updated_at?: string;
  start_time?: number;
  end_time?: number;
  is_active?: boolean;
  text?: string;
  done?: boolean; 
  percent?: number;      
  planTime?: number; 
  actTime?: number; 
  isTimerOn?: boolean;
  timerStartTime?: number;
  parentId?: number;
  subtasks?: Task[];
  depth?: number;
  is_starred?: boolean;
};

export type DailyLog = {
  date: string;
  tasks: Task[];
  memo?: string;
};
