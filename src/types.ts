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
  act_time?: number; // DB compatibility
  isTimerOn?: boolean;
  timerStartTime?: number;
  parentId?: number;
  subtasks?: Task[];
  depth?: number;
  is_starred?: boolean;
  is_concept?: boolean; // 개념(원하는 것)인지 여부
  concept_id?: number; // 속한 개념의 ID
  is_expanded?: boolean; // 개념 확장/축소 상태
};

export type DailyLog = {
  date: string;
  tasks: Task[];
  memo?: string;
};
