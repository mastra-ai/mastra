import { ErrorCategory } from '@mastra/core/error';
import type { MastraError } from '@mastra/core/error';
import { TABLE_SCHEMAS, TABLE_SCORERS, TABLE_SPANS } from '@mastra/core/storage';

import { safeJsonValue } from '../../../shared/connection';
import type { OracleCreateIndexOptions } from '../../db';
import { createOracleStorageError } from '../../domain-utils';

// Observability persists spans and log events for Studio/API trace inspection,
// keeping large structured payloads in Oracle JSON/CLOB-friendly columns.
export const STORE_NAME = 'ORACLEDB';
export const SPAN_SCHEMA = TABLE_SCHEMAS[TABLE_SPANS];
export const SCORE_SCHEMA = TABLE_SCHEMAS[TABLE_SCORERS];
export const LOG_EVENTS_TABLE = 'mastra_log_events';
const SIMPLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;
const LOWERCASE_SQL_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

export type SpanColumn = keyof typeof SPAN_SCHEMA & string;
export type SpanRow = Record<string, unknown>;
export type LogColumn = (typeof LOG_COLUMNS)[number];
export type LogRow = Record<string, unknown>;
export type SharedContextColumn = 'entityType' | 'entityName' | 'serviceName' | 'environment';
export type ScoreRow = Record<string, unknown>;

export const SPAN_COLUMNS = Object.keys(SPAN_SCHEMA) as SpanColumn[];
export const SPAN_KEY_COLUMNS = new Set<SpanColumn>(['traceId', 'spanId']);
// Column sets are derived once from Mastra schemas so mutation builders can bind each type correctly.
export const SPAN_JSON_COLUMNS = new Set(
  SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.type === 'jsonb'),
) as ReadonlySet<SpanColumn>;
export const SPAN_TIMESTAMP_COLUMNS = new Set(
  SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.type === 'timestamp'),
) as ReadonlySet<SpanColumn>;
export const SPAN_BOOLEAN_COLUMNS = new Set(
  SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.type === 'boolean'),
) as ReadonlySet<SpanColumn>;
export const SPAN_NULLABLE_COLUMNS = SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.nullable);

export const LIGHT_SPAN_COLUMNS = [
  'traceId',
  'spanId',
  'parentSpanId',
  'name',
  'entityType',
  'entityId',
  'entityName',
  'spanType',
  'error',
  'isEvent',
  'startedAt',
  'endedAt',
  'createdAt',
  'updatedAt',
] as const satisfies readonly SpanColumn[];

export const FILTER_TEXT_COLUMNS = [
  'traceId',
  'spanType',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'rootEntityVersionId',
  'experimentId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'serviceName',
] as const satisfies readonly SpanColumn[];

export const LOG_COLUMNS = [
  'logId',
  'timestamp',
  'level',
  'message',
  'data',
  'traceId',
  'spanId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'rootEntityVersionId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'executionSource',
  'source',
  'serviceName',
  'experimentId',
  'tags',
  'metadata',
  'scope',
] as const;

export const LOG_JSON_COLUMNS = new Set<LogColumn>(['data', 'tags', 'metadata', 'scope']);
export const LOG_TEXT_FILTER_COLUMNS = [
  'traceId',
  'spanId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'rootEntityVersionId',
  'experimentId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'serviceName',
] as const satisfies readonly LogColumn[];

export const SCORE_TEXT_FILTER_COLUMNS = [
  'traceId',
  'spanId',
  'runId',
  'entityType',
  'entityId',
  'resourceId',
  'threadId',
] as const;

export const SCORE_METADATA_FILTER_FIELDS = [
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityName',
  'rootEntityVersionId',
  'userId',
  'organizationId',
  'sessionId',
  'requestId',
  'environment',
  'serviceName',
  'executionSource',
] as const;

export function col(columnName: SpanColumn): string {
  if (!SPAN_SCHEMA[columnName]) {
    throw new Error(`Unknown span column: ${columnName}`);
  }
  if (!SIMPLE_IDENTIFIER.test(columnName)) {
    throw new Error(`Invalid span column: ${columnName}`);
  }
  if (LOWERCASE_SQL_IDENTIFIER.test(columnName)) return columnName;
  return `"${columnName}"`;
}

export function logCol(columnName: LogColumn): string {
  if (!LOG_COLUMNS.includes(columnName)) {
    throw new Error(`Unknown log column: ${columnName}`);
  }
  if (!SIMPLE_IDENTIFIER.test(columnName)) {
    throw new Error(`Invalid log column: ${columnName}`);
  }
  return `"${columnName}"`;
}

export function scoreCol(columnName: string): string {
  if (!SCORE_SCHEMA[columnName]) {
    throw new Error(`Unknown score column: ${columnName}`);
  }
  if (!SIMPLE_IDENTIFIER.test(columnName)) {
    throw new Error(`Invalid score column: ${columnName}`);
  }
  if (LOWERCASE_SQL_IDENTIFIER.test(columnName)) return columnName;
  return `"${columnName}"`;
}

export function qcol(tableAlias: string | undefined, columnName: SpanColumn): string {
  const column = col(columnName);
  return tableAlias ? `${tableAlias}.${column}` : column;
}

export function logQcol(tableAlias: string | undefined, columnName: LogColumn): string {
  const column = logCol(columnName);
  return tableAlias ? `${tableAlias}.${column}` : column;
}

export function scoreQcol(tableAlias: string | undefined, columnName: string): string {
  const column = scoreCol(columnName);
  return tableAlias ? `${tableAlias}.${column}` : column;
}

export function getDefaultObservabilityIndexDefinitions(
  indexName: (name: string) => string,
): OracleCreateIndexOptions[] {
  return [
    {
      name: indexName('MASTRA_AI_SPANS_TRACEID_STARTEDAT'),
      table: TABLE_SPANS,
      columns: ['traceId', 'startedAt DESC'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_PARENTSPANID_STARTEDAT'),
      table: TABLE_SPANS,
      columns: ['parentSpanId', 'startedAt DESC'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_NAME'),
      table: TABLE_SPANS,
      columns: ['name'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_SPANTYPE_STARTEDAT'),
      table: TABLE_SPANS,
      columns: ['spanType', 'startedAt DESC'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_ROOT_LOOKUP'),
      table: TABLE_SPANS,
      columns: ['traceId'],
      where: `${col('parentSpanId')} IS NULL`,
    },
    {
      name: indexName('MASTRA_AI_SPANS_ENTITYTYPE_ENTITYID'),
      table: TABLE_SPANS,
      columns: ['entityType', 'entityId'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_ENTITYTYPE_ENTITYNAME'),
      table: TABLE_SPANS,
      columns: ['entityType', 'entityName'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_ORGID_USERID'),
      table: TABLE_SPANS,
      columns: ['organizationId', 'userId'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_TIMESTAMP'),
      table: LOG_EVENTS_TABLE,
      columns: ['"timestamp" DESC'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_TRACE_SPAN_TS'),
      table: LOG_EVENTS_TABLE,
      columns: ['"traceId"', '"spanId"', '"timestamp" DESC'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_LEVEL_TS'),
      table: LOG_EVENTS_TABLE,
      columns: ['"level"', '"timestamp" DESC'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_ENTITY_ID'),
      table: LOG_EVENTS_TABLE,
      columns: ['"entityType"', '"entityId"'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_ORG_USER'),
      table: LOG_EVENTS_TABLE,
      columns: ['"organizationId"', '"userId"'],
    },
  ];
}

export function logEventsTableSql(tableName: string): string {
  return `CREATE TABLE ${tableName} (
  ${logCol('logId')} VARCHAR2(512) PRIMARY KEY,
  ${logCol('timestamp')} TIMESTAMP WITH TIME ZONE NOT NULL,
  ${logCol('level')} VARCHAR2(64) NOT NULL,
  ${logCol('message')} CLOB NOT NULL,
  ${logCol('data')} JSON,
  ${logCol('traceId')} VARCHAR2(512),
  ${logCol('spanId')} VARCHAR2(512),
  ${logCol('entityType')} VARCHAR2(512),
  ${logCol('entityId')} VARCHAR2(512),
  ${logCol('entityName')} VARCHAR2(512),
  ${logCol('entityVersionId')} VARCHAR2(512),
  ${logCol('parentEntityType')} VARCHAR2(512),
  ${logCol('parentEntityId')} VARCHAR2(512),
  ${logCol('parentEntityName')} VARCHAR2(512),
  ${logCol('parentEntityVersionId')} VARCHAR2(512),
  ${logCol('rootEntityType')} VARCHAR2(512),
  ${logCol('rootEntityId')} VARCHAR2(512),
  ${logCol('rootEntityName')} VARCHAR2(512),
  ${logCol('rootEntityVersionId')} VARCHAR2(512),
  ${logCol('userId')} VARCHAR2(512),
  ${logCol('organizationId')} VARCHAR2(512),
  ${logCol('resourceId')} VARCHAR2(512),
  ${logCol('runId')} VARCHAR2(512),
  ${logCol('sessionId')} VARCHAR2(512),
  ${logCol('threadId')} VARCHAR2(512),
  ${logCol('requestId')} VARCHAR2(512),
  ${logCol('environment')} VARCHAR2(512),
  ${logCol('executionSource')} VARCHAR2(512),
  ${logCol('source')} VARCHAR2(512),
  ${logCol('serviceName')} VARCHAR2(512),
  ${logCol('experimentId')} VARCHAR2(512),
  ${logCol('tags')} JSON,
  ${logCol('metadata')} JSON,
  ${logCol('scope')} JSON
)`;
}

// Shared SQL-binding helpers reused by every filter builder across
// spans.ts, logs.ts, and scores-bridge.ts.
export function addBind(binds: Record<string, unknown>, value: unknown): string {
  const name = `p${Object.keys(binds).length}`;
  binds[name] = value;
  return `:${name}`;
}

export function jsonComparableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(safeJsonValue(value));
}

// Shared error helper so every split module (spans/logs/scores-bridge) reports
// observability failures under the same store name and MastraError shape.
export function storageError(
  operation: string,
  reason: string,
  details: Record<string, string | number | boolean | undefined>,
  cause: unknown,
  category: ErrorCategory = ErrorCategory.THIRD_PARTY,
): MastraError {
  return createOracleStorageError({ storeName: STORE_NAME, operation, reason, details, cause, category });
}
