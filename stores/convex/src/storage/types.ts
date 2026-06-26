import type { TABLE_NAMES } from '@mastra/core/storage';

export type EqualityFilter = {
  field: string;
  value: string | number | boolean | null;
};

export type IndexHint =
  | { index: 'by_workflow'; workflowName: string }
  | { index: 'by_workflow_run'; workflowName: string; runId: string };

export type StorageRequest =
  | {
      op: 'insert';
      tableName: TABLE_NAMES | string;
      record: Record<string, any>;
    }
  | {
      op: 'batchInsert';
      tableName: TABLE_NAMES | string;
      records: Record<string, any>[];
    }
  | {
      op: 'patch';
      tableName: TABLE_NAMES | string;
      id: string;
      record: Record<string, any>;
    }
  | {
      op: 'updateThread';
      tableName: TABLE_NAMES | string;
      id: string;
      title: string;
      metadata: Record<string, any>;
      updatedAt: string;
    }
  | {
      op: 'updateResource';
      tableName: TABLE_NAMES | string;
      resourceId: string;
      workingMemory?: string;
      metadata?: Record<string, any>;
      createdAt: string;
      updatedAt: string;
    }
  | {
      op: 'load';
      tableName: TABLE_NAMES | string;
      keys: Record<string, any>;
    }
  | {
      op: 'loadMany';
      tableName: TABLE_NAMES | string;
      ids: string[];
    }
  | {
      op: 'clearTable' | 'dropTable';
      tableName: TABLE_NAMES | string;
    }
  | {
      op: 'queryTable';
      tableName: TABLE_NAMES | string;
      filters?: EqualityFilter[];
      limit?: number;
      /** Cursor pagination is currently supported for vector table reads. */
      pageSize?: number;
      /** Requires pageSize; currently supported for vector table reads. */
      cursor?: string | null;
      indexHint?: IndexHint;
    }
  | {
      op: 'deleteMany';
      tableName: TABLE_NAMES | string;
      ids: string[];
    }
  | {
      op: 'mergeWorkflowStepResult';
      tableName: TABLE_NAMES | string;
      workflowName: string;
      runId: string;
      stepId: string;
      result: string;
      requestContext: string;
    }
  | {
      op: 'mergeWorkflowState';
      tableName: TABLE_NAMES | string;
      workflowName: string;
      runId: string;
      opts: string;
    }
  | {
      op: 'createSchedule';
      tableName: TABLE_NAMES | string;
      record: Record<string, any>;
    }
  | {
      op: 'recordScheduleTrigger';
      tableName: TABLE_NAMES | string;
      record: Record<string, any>;
    }
  | {
      op: 'listDueSchedules';
      tableName: TABLE_NAMES | string;
      now: number;
      limit?: number;
    }
  | {
      op: 'updateScheduleNextFire';
      tableName: TABLE_NAMES | string;
      id: string;
      expectedNextFireAt: number;
      newNextFireAt: number;
      lastFireAt: number;
      lastRunId: string;
    }
  | {
      op: 'updateSchedule';
      tableName: TABLE_NAMES | string;
      id: string;
      patch: Record<string, any>;
    }
  | {
      op: 'listScheduleTriggers';
      tableName: TABLE_NAMES | string;
      scheduleId: string;
      fromActualFireAt?: number;
      toActualFireAt?: number;
      limit?: number;
    }
  | {
      op: 'deleteScheduleTriggers';
      tableName: TABLE_NAMES | string;
      scheduleId: string;
    };

export type StorageResponse =
  | {
      ok: true;
      result?: any;
      /** Indicates more batches or pages remain for the operation. */
      hasMore?: boolean;
      /** Cursor for the next page when hasMore is true. */
      continuationCursor?: string | null;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      details?: Record<string, any>;
    };
