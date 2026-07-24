import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, listLogsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse, LogRecord } from '@mastra/core/storage';

import { assertJsonPath, qualifyName } from '../../../vector/identifiers';
import type { OracleDB } from '../../db';
import { parseJsonValue, toDate } from '../../domain-utils';
import { bindDefsForLogColumns, logBindName, logRecordBinds } from './binds';
import type { LogColumn, LogRow } from './schema';
import {
  addBind,
  jsonComparableValue,
  LOG_COLUMNS,
  LOG_EVENTS_TABLE,
  LOG_JSON_COLUMNS,
  LOG_TEXT_FILTER_COLUMNS,
  logCol,
  logQcol,
  STORE_NAME,
  storageError,
} from './schema';

export async function batchCreateLogs(
  db: OracleDB,
  schemaName: string | undefined,
  args: BatchCreateLogsArgs,
): Promise<void> {
  if (args.logs.length === 0) return;

  try {
    const binds = args.logs.map(log =>
      logRecordBinds({
        ...log,
        logId: log.logId ?? randomUUID(),
        executionSource: log.executionSource ?? log.source ?? null,
      }),
    );

    await db.tx(async client => {
      // Logs can be retried by telemetry pipelines; MERGE by logId prevents
      // duplicate rows while preserving insert-only semantics.
      await client.executeMany(logMergeSql(schemaName), binds, {
        bindDefs: bindDefsForLogColumns(LOG_COLUMNS),
      });
    });
  } catch (error) {
    throw storageError('BATCH_CREATE_LOGS', 'FAILED', { count: args.logs.length }, error, ErrorCategory.USER);
  }
}

export async function listLogs(
  db: OracleDB,
  schemaName: string | undefined,
  args: ListLogsArgs,
): Promise<ListLogsResponse> {
  const { mode, filters, pagination, orderBy } = listLogsArgsSchema.parse(args);
  if (mode === 'delta') {
    throw new MastraError({
      id: createStorageErrorId(STORE_NAME, 'LIST_LOGS', 'DELTA_NOT_SUPPORTED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'Oracle observability logs do not support delta polling yet',
    });
  }

  const page = pagination.page;
  const perPage = pagination.perPage;
  const binds: Record<string, unknown> = {};
  const conditions: string[] = [];

  try {
    if (filters) {
      // Scalar filters use normal columns; metadata/scope/tags use JSON
      // predicates so logs remain flexible without a separate document store.
      const logFilters = filters as typeof filters & {
        metadata?: Record<string, unknown> | null;
        scope?: Record<string, unknown> | null;
      };
      addLogDateRangeFilter(conditions, binds, 'l', filters.timestamp);

      if (filters.level !== undefined) {
        const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
        if (levels.length > 0) {
          conditions.push(`${logQcol('l', 'level')} IN (${levels.map(level => addBind(binds, level)).join(', ')})`);
        }
      }

      for (const columnName of LOG_TEXT_FILTER_COLUMNS) {
        const value = filters[columnName as keyof typeof filters];
        if (value !== undefined) {
          conditions.push(`${logQcol('l', columnName)} = ${addBind(binds, value)}`);
        }
      }

      const sourceFilter = filters.executionSource ?? filters.source;
      if (sourceFilter !== undefined) {
        conditions.push(`COALESCE(${logQcol('l', 'executionSource')}, ${logQcol('l', 'source')}) = ${addBind(binds, sourceFilter)}`);
      }

      addLogJsonObjectFilter(conditions, binds, 'l', 'metadata', logFilters.metadata);
      addLogJsonObjectFilter(conditions, binds, 'l', 'scope', logFilters.scope);
      addLogTagsFilter(conditions, binds, 'l', filters.tags);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = await db.oneOrNone<{ count: number | string }>(
      `SELECT COUNT(*) AS "count" FROM ${qualifyName(LOG_EVENTS_TABLE, schemaName)} l ${whereClause}`,
      binds,
    );
    const total = Number(countRow?.count ?? 0);

    if (total === 0) {
      return { logs: [], pagination: { total: 0, page, perPage, hasMore: false } };
    }

    const offset = page * perPage;
    const logs = await db.manyOrNone<LogRow>(
      `${logSelect(LOG_COLUMNS, 'l')} FROM ${qualifyName(LOG_EVENTS_TABLE, schemaName)} l ${whereClause} ORDER BY ${logQcol(
        'l',
        orderBy.field,
      )} ${orderBy.direction}, ${logQcol('l', 'logId')} ${orderBy.direction} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset, limit: perPage },
    );

    return {
      logs: logs.map(row => transformLogRow(row)),
      pagination: {
        total,
        page,
        perPage,
        hasMore: offset + perPage < total,
      },
    };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('LIST_LOGS', 'FAILED', {}, error, ErrorCategory.USER);
  }
}

function logMergeSql(schemaName: string | undefined): string {
  const sourceColumns = LOG_COLUMNS.map(columnName => `:${logBindName(columnName)} AS ${logCol(columnName)}`).join(', ');
  const insertColumns = LOG_COLUMNS.map(columnName => logCol(columnName)).join(', ');
  const insertValues = LOG_COLUMNS.map(columnName => `source.${logCol(columnName)}`).join(', ');

  return `
    MERGE INTO ${qualifyName(LOG_EVENTS_TABLE, schemaName)} target
    USING (SELECT ${sourceColumns} FROM dual) source
    ON (target.${logCol('logId')} = source.${logCol('logId')})
    WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})
  `;
}

function logSelect(columns: readonly LogColumn[], tableAlias?: string): string {
  return `SELECT ${columns.map(columnName => `${logQcol(tableAlias, columnName)} AS "${columnName}"`).join(', ')}`;
}

function transformLogRow(row: LogRow): LogRecord {
  const result: LogRow = {};

  for (const [key, value] of Object.entries(row)) {
    const columnName = key as LogColumn;
    if (LOG_JSON_COLUMNS.has(columnName)) {
      result[key] = parseJsonValue(value);
    } else if (columnName === 'timestamp') {
      result[key] = toDate(value);
    } else {
      result[key] = value;
    }
  }

  return result as LogRecord;
}

function addLogDateRangeFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  range?: { start?: Date; end?: Date; startExclusive?: boolean; endExclusive?: boolean },
): void {
  if (range?.start) {
    conditions.push(`${logQcol(tableAlias, 'timestamp')} ${range.startExclusive ? '>' : '>='} ${addBind(binds, range.start)}`);
  }
  if (range?.end) {
    conditions.push(`${logQcol(tableAlias, 'timestamp')} ${range.endExclusive ? '<' : '<='} ${addBind(binds, range.end)}`);
  }
}

function addLogJsonObjectFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  columnName: 'scope' | 'metadata',
  filter?: Record<string, unknown> | null,
): void {
  if (!filter) return;

  for (const [path, value] of Object.entries(filter)) {
    conditions.push(
      `JSON_VALUE(${logQcol(tableAlias, columnName)}, '${assertJsonPath(
        path,
      )}' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${addBind(binds, jsonComparableValue(value))}`,
    );
  }
}

function addLogTagsFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  tags?: string[] | null,
): void {
  if (!tags?.length) return;

  for (const tag of tags) {
    conditions.push(
      `EXISTS (SELECT 1 FROM JSON_TABLE(${logQcol(
        tableAlias,
        'tags',
      )}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) tag_filter WHERE tag_filter.tag = ${addBind(binds, tag)})`,
    );
  }
}
