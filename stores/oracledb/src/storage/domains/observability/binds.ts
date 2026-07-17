import type { CreateSpanRecord, LogRecord } from '@mastra/core/storage';
import oracledb from 'oracledb';

import { jsonBindText } from '../../../shared/connection';
import { toDate } from '../../domain-utils';
import type { LogColumn, SpanColumn } from './schema';
import {
  LOG_COLUMNS,
  LOG_JSON_COLUMNS,
  SPAN_BOOLEAN_COLUMNS,
  SPAN_COLUMNS,
  SPAN_JSON_COLUMNS,
  SPAN_SCHEMA,
  SPAN_TIMESTAMP_COLUMNS,
} from './schema';

export type SpanMutationRecord = CreateSpanRecord & { createdAt: Date; updatedAt: Date };
export type LogMutationRecord = LogRecord & { logId: string };

export function isIdentifierLikeColumn(columnName: string): boolean {
  return columnName === 'id' || columnName.endsWith('Id') || columnName.endsWith('_id');
}

export function bindValue(columnName: SpanColumn, value: unknown): unknown {
  if (value === undefined) return null;
  if (SPAN_JSON_COLUMNS.has(columnName)) return jsonBindText(value ?? null);
  if (SPAN_BOOLEAN_COLUMNS.has(columnName)) return value ? 1 : 0;
  if (SPAN_TIMESTAMP_COLUMNS.has(columnName) && value != null) return toDate(value);
  return value ?? null;
}

export function spanRecordBinds(record: SpanMutationRecord): Record<string, unknown> {
  return Object.fromEntries(
    SPAN_COLUMNS.map(columnName => [columnName, bindValue(columnName, record[columnName as keyof SpanMutationRecord])]),
  );
}

export function bindDefsForColumns(columns: readonly SpanColumn[]): NonNullable<oracledb.ExecuteManyOptions['bindDefs']> {
  return Object.fromEntries(columns.map(columnName => [columnName, bindDefForColumn(columnName)])) as Record<
    string,
    oracledb.BindDefinition
  >;
}

export function bindDefForColumn(columnName: SpanColumn): oracledb.BindDefinition {
  const column = SPAN_SCHEMA[columnName];

  switch (column?.type) {
    case 'jsonb':
      // Bound as JSON text (see jsonBindText): the server encodes the OSON
      // image so JDBC-based tools can read it back.
      return { type: oracledb.DB_TYPE_CLOB };
    case 'timestamp':
      return { type: oracledb.DB_TYPE_TIMESTAMP_TZ };
    case 'boolean':
    case 'integer':
    case 'bigint':
    case 'float':
      return { type: oracledb.NUMBER };
    case 'uuid':
    case 'text':
    default:
      return { type: oracledb.STRING, maxSize: isIdentifierLikeColumn(columnName) ? 512 : 4000 };
  }
}

export function logBindValue(columnName: LogColumn, value: unknown): unknown {
  if (value === undefined) return null;
  if (LOG_JSON_COLUMNS.has(columnName)) return jsonBindText(value ?? null);
  if (columnName === 'timestamp') return toDate(value);
  return value ?? null;
}

export function logRecordBinds(record: LogMutationRecord): Record<string, unknown> {
  return Object.fromEntries(
    LOG_COLUMNS.map(columnName => [
      logBindName(columnName),
      logBindValue(columnName, record[columnName as keyof LogMutationRecord]),
    ]),
  );
}

export function logBindName(columnName: LogColumn): string {
  return `b_${columnName}`;
}

export function bindDefsForLogColumns(columns: readonly LogColumn[]): NonNullable<oracledb.ExecuteManyOptions['bindDefs']> {
  return Object.fromEntries(columns.map(columnName => [logBindName(columnName), bindDefForLogColumn(columnName)])) as Record<
    string,
    oracledb.BindDefinition
  >;
}

export function bindDefForLogColumn(columnName: LogColumn): oracledb.BindDefinition {
  if (LOG_JSON_COLUMNS.has(columnName)) return { type: oracledb.DB_TYPE_CLOB };
  if (columnName === 'timestamp') return { type: oracledb.DB_TYPE_TIMESTAMP_TZ };
  if (columnName === 'message') return { type: oracledb.DB_TYPE_CLOB };
  return { type: oracledb.STRING, maxSize: isIdentifierLikeColumn(columnName) ? 512 : 4000 };
}
