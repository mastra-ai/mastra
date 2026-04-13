import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '@mastra/core/background-tasks';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { BackgroundTasksStorage, createStorageErrorId, TABLE_BACKGROUND_TASKS } from '@mastra/core/storage';
import type { Service } from 'electrodb';

import { resolveDynamoDBConfig } from '../../db';
import type { DynamoDBDomainConfig } from '../../db';
import { deleteTableData } from '../utils';

const ENTITY = 'background_task';

function serializeJson(v: unknown): any {
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return v ?? undefined;
}

function toElectroRecord(task: BackgroundTask): Record<string, unknown> {
  return {
    entity: ENTITY,
    id: task.id,
    status: task.status,
    toolName: task.toolName,
    toolCallId: task.toolCallId,
    agentId: task.agentId,
    runId: task.runId,
    threadId: task.threadId ?? undefined,
    resourceId: task.resourceId ?? undefined,
    args: serializeJson(task.args),
    result: serializeJson(task.result),
    error: serializeJson(task.error),
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    timeoutMs: task.timeoutMs,
    createdAt: task.createdAt.toISOString(),
    startedAtIso: task.startedAt?.toISOString(),
    completedAtIso: task.completedAt?.toISOString(),
  };
}

function fromElectroRecord(data: Record<string, any>): BackgroundTask {
  const parseJson = (v: unknown): any => {
    if (v == null || v === '') return undefined;
    if (typeof v === 'string') {
      try {
        if (v.startsWith('{') || v.startsWith('[')) return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };
  const asDate = (v: unknown): Date | undefined => (v ? new Date(String(v)) : undefined);
  return {
    id: String(data.id),
    status: String(data.status) as BackgroundTaskStatus,
    toolName: String(data.toolName),
    toolCallId: String(data.toolCallId),
    args: parseJson(data.args) ?? {},
    agentId: String(data.agentId),
    threadId: data.threadId != null && data.threadId !== '' ? String(data.threadId) : undefined,
    resourceId: data.resourceId != null && data.resourceId !== '' ? String(data.resourceId) : undefined,
    runId: String(data.runId),
    result: parseJson(data.result),
    error: parseJson(data.error),
    retryCount: Number(data.retryCount ?? 0),
    maxRetries: Number(data.maxRetries ?? 0),
    timeoutMs: Number(data.timeoutMs ?? 300_000),
    createdAt: asDate(data.createdAt) ?? new Date(),
    startedAt: asDate(data.startedAtIso),
    completedAt: asDate(data.completedAtIso),
  };
}

export class BackgroundTasksStorageDynamoDB extends BackgroundTasksStorage {
  private service: Service<Record<string, any>>;

  constructor(config: DynamoDBDomainConfig) {
    super();
    const resolved = resolveDynamoDBConfig(config);
    this.service = resolved.service;
  }

  async dangerouslyClearAll(): Promise<void> {
    await deleteTableData(this.service, TABLE_BACKGROUND_TASKS);
  }

  async createTask(task: BackgroundTask): Promise<void> {
    try {
      await this.service.entities.background_task.create(toElectroRecord(task)).go();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'BACKGROUND_TASKS_CREATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { taskId: task.id },
        },
        error,
      );
    }
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    try {
      const setFields: Record<string, unknown> = {};
      // ElectroDB's .set() ignores undefined values, so any field explicitly set
      // to undefined must be cleared via .remove() instead.
      const removeFields: string[] = [];

      if ('status' in update && update.status !== undefined) {
        setFields.status = update.status;
      }
      if ('retryCount' in update && update.retryCount !== undefined) {
        setFields.retryCount = update.retryCount;
      }
      if ('result' in update) {
        if (update.result === undefined || update.result === null) {
          removeFields.push('result');
        } else {
          setFields.result = serializeJson(update.result);
        }
      }
      if ('error' in update) {
        if (update.error === undefined || update.error === null) {
          removeFields.push('error');
        } else {
          setFields.error = serializeJson(update.error);
        }
      }
      if ('startedAt' in update) {
        if (update.startedAt === undefined || update.startedAt === null) {
          removeFields.push('startedAtIso');
        } else {
          setFields.startedAtIso = update.startedAt.toISOString();
        }
      }
      if ('completedAt' in update) {
        if (update.completedAt === undefined || update.completedAt === null) {
          removeFields.push('completedAtIso');
        } else {
          setFields.completedAtIso = update.completedAt.toISOString();
        }
      }

      if (Object.keys(setFields).length === 0 && removeFields.length === 0) return;

      let op = this.service.entities.background_task.patch({ entity: ENTITY, id: taskId }) as any;
      if (Object.keys(setFields).length > 0) op = op.set(setFields);
      if (removeFields.length > 0) op = op.remove(removeFields);
      await op.go();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'BACKGROUND_TASKS_UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { taskId },
        },
        error,
      );
    }
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    try {
      const result = await this.service.entities.background_task.get({ entity: ENTITY, id: taskId }).go();
      if (!result.data) return null;
      return fromElectroRecord(result.data);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'BACKGROUND_TASKS_GET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { taskId },
        },
        error,
      );
    }
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    try {
      // Choose the most selective index based on the filter
      let rawResults: any[] = [];

      if (filter.runId) {
        const res = await this.service.entities.background_task.query
          .byRun({ entity: ENTITY, runId: filter.runId })
          .go({ pages: 'all' });
        rawResults = res.data;
      } else if (filter.agentId) {
        const res = await this.service.entities.background_task.query
          .byAgent({ entity: ENTITY, agentId: filter.agentId })
          .go({ pages: 'all' });
        rawResults = res.data;
      } else if (filter.status && !Array.isArray(filter.status)) {
        const res = await this.service.entities.background_task.query
          .byStatus({ entity: ENTITY, status: filter.status })
          .go({ pages: 'all' });
        rawResults = res.data;
      } else {
        // Fall back to full scan
        const res = await this.service.entities.background_task.scan.go({ pages: 'all' });
        rawResults = res.data;
      }

      let tasks = rawResults.map(fromElectroRecord);

      // Apply remaining in-memory filters
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        tasks = tasks.filter(t => statuses.includes(t.status));
      }
      if (filter.agentId) tasks = tasks.filter(t => t.agentId === filter.agentId);
      if (filter.threadId) tasks = tasks.filter(t => t.threadId === filter.threadId);
      if (filter.resourceId) tasks = tasks.filter(t => t.resourceId === filter.resourceId);
      if (filter.toolName) tasks = tasks.filter(t => t.toolName === filter.toolName);
      if (filter.runId) tasks = tasks.filter(t => t.runId === filter.runId);

      const dateCol = filter.dateFilterBy ?? 'createdAt';
      if (filter.fromDate) {
        tasks = tasks.filter(t => {
          const val = t[dateCol];
          return val != null && val >= filter.fromDate!;
        });
      }
      if (filter.toDate) {
        tasks = tasks.filter(t => {
          const val = t[dateCol];
          return val != null && val < filter.toDate!;
        });
      }

      const orderBy = filter.orderBy ?? 'createdAt';
      const dir = filter.orderDirection === 'desc' ? -1 : 1;
      tasks.sort((a, b) => ((a[orderBy]?.getTime() ?? 0) - (b[orderBy]?.getTime() ?? 0)) * dir);

      const total = tasks.length;

      if (filter.page != null && filter.perPage != null) {
        const start = filter.page * filter.perPage;
        tasks = tasks.slice(start, start + filter.perPage);
      } else if (filter.perPage != null) {
        tasks = tasks.slice(0, filter.perPage);
      }

      return { tasks, total };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'BACKGROUND_TASKS_LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.service.entities.background_task.delete({ entity: ENTITY, id: taskId }).go();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'BACKGROUND_TASKS_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { taskId },
        },
        error,
      );
    }
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const { tasks } = await this.listTasks(filter);
    if (tasks.length === 0) return;
    try {
      // DynamoDB batch-delete limit is 25
      const batchSize = 25;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize).map(t => ({ entity: ENTITY, id: t.id }));
        await this.service.entities.background_task.delete(batch).go();
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'BACKGROUND_TASKS_DELETE_MANY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getRunningCount(): Promise<number> {
    const { total } = await this.listTasks({ status: 'running' });
    return total;
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    const { total } = await this.listTasks({ status: 'running', agentId });
    return total;
  }
}
