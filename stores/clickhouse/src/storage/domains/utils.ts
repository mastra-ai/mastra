import type { TABLE_NAMES, TABLE_SCHEMAS, StorageColumn } from '@mastra/core/storage';
import {
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_EVALS,
  TABLE_SCORERS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
  safelyParseJSON,
  TABLE_AI_SPANS,
} from '@mastra/core/storage';

export const TABLE_ENGINES: Record<TABLE_NAMES, string> = {
  [TABLE_MESSAGES]: `MergeTree()`,
  [TABLE_WORKFLOW_SNAPSHOT]: `ReplacingMergeTree()`,
  [TABLE_TRACES]: `MergeTree()`,
  [TABLE_THREADS]: `ReplacingMergeTree()`,
  [TABLE_EVALS]: `MergeTree()`,
  [TABLE_SCORERS]: `MergeTree()`,
  [TABLE_RESOURCES]: `ReplacingMergeTree()`,
  // TODO: verify this is the correct engine for ai spans when implementing clickhouse storage
  [TABLE_AI_SPANS]: `ReplacingMergeTree()`,
};

export const COLUMN_TYPES: Record<StorageColumn['type'], string> = {
  text: 'String',
  timestamp: 'DateTime64(3)',
  uuid: 'String',
  jsonb: 'String',
  integer: 'Int64',
  float: 'Float64',
  bigint: 'Int64',
  boolean: 'Bool',
};

export type IntervalUnit =
  | 'NANOSECOND'
  | 'MICROSECOND'
  | 'MILLISECOND'
  | 'SECOND'
  | 'MINUTE'
  | 'HOUR'
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR';

export type ClickhouseConfig = {
  url: string;
  username: string;
  password: string;
  ttl?: {
    [TableKey in TABLE_NAMES]?: {
      row?: { interval: number; unit: IntervalUnit; ttlKey?: string };
      columns?: Partial<{
        [ColumnKey in keyof (typeof TABLE_SCHEMAS)[TableKey]]: {
          interval: number;
          unit: IntervalUnit;
          ttlKey?: string;
        };
      }>;
    };
  };
};

export function transformRow<R>(row: any): R {
  if (!row) {
    return row;
  }

  if (row.createdAt) {
    row.createdAt = new Date(row.createdAt);
  }
  if (row.updatedAt) {
    row.updatedAt = new Date(row.updatedAt);
  }

  // Parse content field if it's a JSON string
  if (row.content && typeof row.content === 'string') {
    row.content = safelyParseJSON(row.content);
  }

  return row;
}

export function transformRows<R>(rows: any[]): R[] {
  return rows.map((row: any) => transformRow<R>(row));
}
