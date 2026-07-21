import type { TABLE_NAMES } from '@mastra/core/storage';

/**
 * Observational memory table name. Defined locally (not value-imported from
 * core) following the mongodb/pg convention: core exports the constant, but
 * OM is optional and the constant is absent from older cores in the peer range.
 */
export const TABLE_OBSERVATIONAL_MEMORY = 'mastra_observational_memory';

/**
 * Table names accepted by ConvexDB: core storage tables plus the Convex OM
 * table, which is intentionally excluded from core's TABLE_NAMES union
 * because observational memory is an optional, per-adapter capability.
 * Kept as a closed union (never `| string`) so table-name typos stay
 * compile-time errors instead of routing to the mastra_documents fallback.
 */
export type ConvexStorageTable = TABLE_NAMES | typeof TABLE_OBSERVATIONAL_MEMORY;

export type EqualityFilter = {
  field: string;
  value: string | number | boolean | null;
};

export type IndexHint =
  { index: 'by_workflow'; workflowName: string } | { index: 'by_workflow_run'; workflowName: string; runId: string };

/**
 * A buffered observation chunk in wire/storage format: Date fields are ISO
 * strings so chunks survive the JSON HTTP boundary and Convex storage
 * (persisted as a JSON string inside the record's bufferedObservationChunks).
 */
export type SerializedOMChunk = {
  id: string;
  cycleId: string;
  observations: string;
  tokenCount: number;
  messageIds: string[];
  messageTokens: number;
  /** ISO timestamp */
  lastObservedAt: string;
  /** ISO timestamp */
  createdAt: string;
  suggestedContinuation?: string;
  currentTask?: string;
  threadTitle?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
};

/**
 * Serialized observational memory generation fields the server needs to create
 * a new generation record (used by omSwapBufferedReflection). Timestamps are
 * ISO strings; config/metadata are JSON strings.
 */
export type SerializedOMCurrentRecord = {
  id: string;
  lookupKey: string;
  scope: string;
  threadId: string | null;
  resourceId: string;
  config: string;
  metadata: string | null;
  observedTimezone: string | null;
  lastObservedAt: string | null;
  totalTokensObserved: number;
  generationCount: number;
};

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
    }
  | {
      op: 'omGetLatest';
      tableName: TABLE_NAMES | string;
      lookupKey: string;
    }
  | {
      op: 'omGetHistory';
      tableName: TABLE_NAMES | string;
      lookupKey: string;
      limit: number;
      /** ISO timestamp; records with createdAt >= from */
      from?: string;
      /** ISO timestamp; records with createdAt <= to */
      to?: string;
      offset?: number;
    }
  | {
      op: 'omUpdateActive';
      tableName: TABLE_NAMES | string;
      id: string;
      observations: string;
      tokenCount: number;
      /** ISO timestamp */
      lastObservedAt: string;
      observedMessageIds: string[] | null;
      /** ISO timestamp */
      updatedAt: string;
    }
  | {
      op: 'omAppendBufferedChunk';
      tableName: TABLE_NAMES | string;
      id: string;
      chunk: SerializedOMChunk;
      /** ISO timestamp */
      lastBufferedAtTime?: string;
      /** ISO timestamp */
      updatedAt: string;
    }
  | {
      op: 'omSwapBuffered';
      tableName: TABLE_NAMES | string;
      id: string;
      activationRatio: number;
      messageTokensThreshold: number;
      currentPendingTokens: number;
      forceMaxActivation?: boolean;
      /** ISO timestamp override for lastObservedAt after swap */
      lastObservedAt?: string;
      /** Refreshed chunks with up-to-date messageTokens (see SwapBufferedToActiveInput) */
      bufferedChunks?: SerializedOMChunk[];
      /** ISO timestamp used for updatedAt and lastObservedAt fallback */
      now: string;
    }
  | {
      op: 'omUpdateBufferedReflection';
      tableName: TABLE_NAMES | string;
      id: string;
      reflection: string;
      tokenCount: number;
      inputTokenCount: number;
      reflectedObservationLineCount: number;
      /** ISO timestamp */
      updatedAt: string;
    }
  | {
      op: 'omSwapBufferedReflection';
      tableName: TABLE_NAMES | string;
      currentRecord: SerializedOMCurrentRecord;
      /** ID for the new generation record */
      newId: string;
      /** Token count of the combined new activeObservations */
      tokenCount: number;
      /** ISO timestamp */
      now: string;
    }
  | {
      op: 'omUpdateConfig';
      tableName: TABLE_NAMES | string;
      id: string;
      /** JSON string; deep-merged into the stored config server-side */
      config: string;
      /** ISO timestamp */
      updatedAt: string;
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
