import type { Task, TaskStatus, TaskPriority } from '@mastra/core/inbox';

export type TaskTableData = Task;

export type TaskTableColumn = {
  id: string;
} & TaskTableData;
