import type { TABLE_NAMES } from '@mastra/core/storage';

export type EqualityFilter = {
  field: string;
  value: string | number | boolean | null;
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
