import Dexie, { Table } from 'dexie';

export interface Space {
  id?: number;
  title: string;
  createdAt: Date;
}

export interface Target {
  id?: number;
  spaceId: number;
  title: string;
  defaultAction: string;
  notes: string;
  usageCount: number;
  lastUsed: Date;
  isCompleted?: boolean;
  hideFromAutocomplete?: boolean;
}

export interface Task {
  id?: number;
  targetId?: number;
  title: string;
  isCompleted: boolean;
  createdAt: Date;
  completedAt?: Date;
  timerCount?: number;
  hideFromAutocomplete?: boolean;
}

class SystemDB extends Dexie {
  spaces!: Table<Space>;
  targets!: Table<Target>;
  tasks!: Table<Task>;

  constructor() {
    super('MySystemDB');
    this.version(1).stores({
      targets: '++id, title, usageCount, lastUsed',
      tasks: '++id, targetId, isCompleted, createdAt'
    });
    this.version(2).stores({
      spaces: '++id, title, createdAt',
      targets: '++id, spaceId, title, usageCount, lastUsed',
      tasks: '++id, targetId, isCompleted, createdAt'
    }).upgrade(async tx => {
      const spaces = await tx.table('spaces').toArray();
      if (spaces.length === 0) {
        await tx.table('spaces').add({ title: '기본', createdAt: new Date() });
      }
      const defaultSpace = await tx.table('spaces').toArray();
      const defaultSpaceId = defaultSpace[0].id;
      await tx.table('targets').toCollection().modify(target => {
        if (!target.spaceId) target.spaceId = defaultSpaceId;
      });
    });
    this.version(3).stores({
      spaces: '++id, title, createdAt',
      targets: '++id, spaceId, title, usageCount, lastUsed, isCompleted',
      tasks: '++id, targetId, isCompleted, createdAt'
    }).upgrade(async tx => {
      await tx.table('targets').toCollection().modify(target => {
        if (target.isCompleted === undefined) target.isCompleted = false;
      });
    });
    this.version(4).stores({
      spaces: '++id, title, createdAt',
      targets: '++id, spaceId, title, usageCount, lastUsed, isCompleted',
      tasks: '++id, targetId, isCompleted, createdAt, completedAt'
    });
    this.version(5).stores({
      spaces: '++id, title, createdAt',
      targets: '++id, spaceId, title, usageCount, lastUsed, isCompleted',
      tasks: '++id, targetId, isCompleted, createdAt, completedAt, timerCount'
    });
    this.version(6).stores({
      spaces: '++id, title, createdAt',
      targets: '++id, spaceId, title, usageCount, lastUsed, isCompleted, hideFromAutocomplete',
      tasks: '++id, targetId, isCompleted, createdAt, completedAt, timerCount, hideFromAutocomplete'
    });
  }
}

export const db = new SystemDB();
