import type { TABLE_NAMES, TABLE_SCHEMAS, StorageColumn } from '@mastra/core/storage';
import {
  TABLE_MESSAGES,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
  safelyParseJSON,
  TABLE_SPANS,
  TABLE_AGENT_VERSIONS,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_PROMPT_BLOCKS,
  TABLE_PROMPT_BLOCK_VERSIONS,
  TABLE_SCORER_DEFINITIONS,
  TABLE_SCORER_DEFINITION_VERSIONS,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  TABLE_MCP_SERVERS,
  TABLE_MCP_SERVER_VERSIONS,
  TABLE_WORKSPACES,
  TABLE_WORKSPACE_VERSIONS,
  TABLE_SKILLS,
  TABLE_SKILL_VERSIONS,
  TABLE_SKILL_BLOBS,
} from '@mastra/core/storage';

export const TABLE_ENGINES: Record<TABLE_NAMES, string> = {
  [TABLE_MESSAGES]: `MergeTree()`,
  [TABLE_WORKFLOW_SNAPSHOT]: `ReplacingMergeTree()`,
  [TABLE_TRACES]: `MergeTree()`,
  [TABLE_THREADS]: `ReplacingMergeTree()`,
  [TABLE_SCORERS]: `MergeTree()`,
  [TABLE_RESOURCES]: `ReplacingMergeTree()`,
  // ReplacingMergeTree(updatedAt) deduplicates rows with the same (traceId, spanId) sorting key,
  // keeping the row with the highest updatedAt value. Combined with ORDER BY (traceId, spanId),
  // this provides eventual uniqueness for the (traceId, spanId) composite key.
  [TABLE_SPANS]: `ReplacingMergeTree(updatedAt)`,
  mastra_agents: `ReplacingMergeTree()`,
  [TABLE_AGENT_VERSIONS]: `MergeTree()`,
  [TABLE_DATASETS]: `ReplacingMergeTree()`,
  [TABLE_DATASET_ITEMS]: `ReplacingMergeTree()`,
  [TABLE_DATASET_VERSIONS]: `MergeTree()`,
  [TABLE_EXPERIMENTS]: `ReplacingMergeTree()`,
  [TABLE_EXPERIMENT_RESULTS]: `MergeTree()`,
  [TABLE_PROMPT_BLOCKS]: `ReplacingMergeTree()`,
  [TABLE_PROMPT_BLOCK_VERSIONS]: `MergeTree()`,
  [TABLE_SCORER_DEFINITIONS]: `ReplacingMergeTree()`,
  [TABLE_SCORER_DEFINITION_VERSIONS]: `MergeTree()`,
  [TABLE_MCP_CLIENTS]: `ReplacingMergeTree()`,
  [TABLE_MCP_CLIENT_VERSIONS]: `MergeTree()`,
  [TABLE_MCP_SERVERS]: `ReplacingMergeTree()`,
  [TABLE_MCP_SERVER_VERSIONS]: `MergeTree()`,
  [TABLE_WORKSPACES]: `ReplacingMergeTree()`,
  [TABLE_WORKSPACE_VERSIONS]: `MergeTree()`,
  [TABLE_SKILLS]: `ReplacingMergeTree()`,
  [TABLE_SKILL_VERSIONS]: `MergeTree()`,
  [TABLE_SKILL_BLOBS]: `ReplacingMergeTree()`,
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

// List of fields that should be parsed as JSON
const JSON_FIELDS = ['content', 'attributes', 'metadata', 'input', 'output', 'error', 'scope', 'links'];

// Fields that should be null instead of empty string when empty
const NULLABLE_STRING_FIELDS = ['parentSpanId', 'error'];

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
  if (row.startedAt) {
    row.startedAt = new Date(row.startedAt);
  }
  if (row.endedAt) {
    row.endedAt = new Date(row.endedAt);
  }

  // Parse JSONB fields if they're JSON strings
  for (const field of JSON_FIELDS) {
    if (row[field] && typeof row[field] === 'string') {
      row[field] = safelyParseJSON(row[field]);
    }
  }

  // Convert empty strings to null for nullable fields
  for (const field of NULLABLE_STRING_FIELDS) {
    if (row[field] === '') {
      row[field] = null;
    }
  }

  return row;
}

export function transformRows<R>(rows: any[]): R[] {
  return rows.map((row: any) => transformRow<R>(row));
}
