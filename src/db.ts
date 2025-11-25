import Dexie, { Table } from 'dexie';

export interface Target {
  id?: number;
  title: string;
  defaultAction: string;
  notes: string;
  usageCount: number;
  lastUsed: Date;
}

export interface Task {
  id?: number;
  targetId?: number;
  title: string;
  isCompleted: boolean;
  createdAt: Date;
}

class SystemDB extends Dexie {
  targets!: Table<Target>;
  tasks!: Table<Task>;

  constructor() {
    super('MySystemDB');
    this.version(1).stores({
      targets: '++id, title, usageCount, lastUsed',
      tasks: '++id, targetId, isCompleted, createdAt'
    });
  }
}

export const db = new SystemDB();
