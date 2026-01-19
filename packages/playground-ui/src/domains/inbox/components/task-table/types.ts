import type { Task, TaskStatus, TaskPriority } from '@mastra/core';

export type TaskTableData = Task;

export type TaskTableColumn = {
  id: string;
} & TaskTableData;
