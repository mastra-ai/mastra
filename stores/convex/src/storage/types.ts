import type { TABLE_NAMES } from '@mastra/core/storage';

export type EqualityFilter = {
  field: string;
  value: string | number | boolean | null;
};

// ============================================================================
// Generic Operations (fallback for unknown patterns)
// ============================================================================

export type GenericStorageRequest =
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
    }
  | {
      op: 'deleteMany';
      tableName: TABLE_NAMES | string;
      ids: string[];
    };

// ============================================================================
// Semantic Operations - Optimized for specific access patterns
// ============================================================================

/** Thread operations - uses by_record_id and by_resource indexes */
export type ThreadStorageRequest =
  | {
      op: 'getThread';
      threadId: string;
    }
  | {
      op: 'listThreadsByResource';
      resourceId: string;
      limit?: number;
      cursor?: string;
      orderBy?: 'createdAt' | 'updatedAt';
      orderDirection?: 'asc' | 'desc';
    };

/** Message operations - uses by_thread and by_thread_created indexes */
export type MessageStorageRequest =
  | {
      op: 'getMessages';
      threadId: string;
      limit?: number;
      cursor?: string;
      orderDirection?: 'asc' | 'desc';
    }
  | {
      op: 'getMessagesByResource';
      resourceId: string;
      limit?: number;
      cursor?: string;
    };

/** Workflow operations - uses by_workflow_run and by_resource indexes */
export type WorkflowStorageRequest =
  | {
      op: 'getWorkflowRun';
      workflowName: string;
      runId: string;
    }
  | {
      op: 'listWorkflowRuns';
      workflowName?: string;
      resourceId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    };

/** Vector operations - uses vector index for similarity search */
export type VectorStorageRequest =
  | {
      op: 'vectorSearch';
      indexName: string;
      queryVector: number[];
      topK: number;
      filter?: Record<string, any>;
      includeVector?: boolean;
      /**
       * Whether to use native Convex vector search (requires vectorIndex in schema).
       * Defaults to true. Set to false to force brute-force search.
       */
      useNativeSearch?: boolean;
    }
  | {
      op: 'getVectorIndexStats';
      indexName: string;
    }
  | {
      op: 'upsertVectors';
      indexName: string;
      vectors: Array<{
        id: string;
        embedding: number[];
        metadata?: Record<string, any>;
      }>;
    };

// Combined request type
export type StorageRequest =
  | GenericStorageRequest
  | ThreadStorageRequest
  | MessageStorageRequest
  | WorkflowStorageRequest
  | VectorStorageRequest;

// ============================================================================
// Response Types
// ============================================================================

export type StorageResponse =
  | {
      ok: true;
      result?: any;
      /** Indicates more batches remain for bulk operations (e.g., clearTable) */
      hasMore?: boolean;
      /** Cursor for pagination */
      cursor?: string;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      details?: Record<string, any>;
    };

// ============================================================================
// Vector Search Result
// ============================================================================

export type VectorSearchResult = {
  id: string;
  score: number;
  metadata?: Record<string, any>;
  vector?: number[];
};
