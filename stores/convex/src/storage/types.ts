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
      op: 'load';
      tableName: TABLE_NAMES | string;
      keys: Record<string, any>;
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
      /** Indicates more batches remain for bulk operations (e.g., clearTable) */
      hasMore?: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      details?: Record<string, any>;
    };
