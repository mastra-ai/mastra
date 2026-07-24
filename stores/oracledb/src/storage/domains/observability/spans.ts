import { ErrorCategory } from '@mastra/core/error';
import { TABLE_SPANS, TraceStatus, listTracesArgsSchema, toTraceSpans } from '@mastra/core/storage';
import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateSpanArgs,
  CreateSpanRecord,
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetEntityTypesArgs,
  GetEntityTypesResponse,
  GetEnvironmentsArgs,
  GetEnvironmentsResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTagsArgs,
  GetTagsResponse,
  GetTraceArgs,
  GetTraceLightResponse,
  GetTraceResponse,
  LightSpanRecord,
  ListTracesArgs,
  ListTracesResponse,
  SpanRecord,
  UpdateSpanArgs,
} from '@mastra/core/storage';
import oracledb from 'oracledb';

import { assertJsonPath, qualifyName } from '../../../vector/identifiers';
import type { OracleDB } from '../../db';
import { parseJsonValue, toDate } from '../../domain-utils';
import { bindDefsForColumns, bindValue, spanRecordBinds } from './binds';
import type { LogColumn, SharedContextColumn, SpanColumn, SpanRow } from './schema';
import {
  addBind,
  col,
  FILTER_TEXT_COLUMNS,
  jsonComparableValue,
  LIGHT_SPAN_COLUMNS,
  LOG_EVENTS_TABLE,
  logCol,
  logQcol,
  qcol,
  SPAN_COLUMNS,
  SPAN_KEY_COLUMNS,
  SPAN_SCHEMA,
  storageError,
} from './schema';

export async function createSpan(db: OracleDB, schemaName: string | undefined, args: CreateSpanArgs): Promise<void> {
  const { span } = args;
  try {
    await upsertSpans(db, schemaName, [span]);
  } catch (error) {
    throw storageError(
      'CREATE_SPAN',
      'FAILED',
      {
        spanId: span.spanId,
        traceId: span.traceId,
        spanType: span.spanType,
        name: span.name,
      },
      error,
      ErrorCategory.USER,
    );
  }
}

export async function batchCreateSpans(
  db: OracleDB,
  schemaName: string | undefined,
  args: BatchCreateSpansArgs,
): Promise<void> {
  if (args.records.length === 0) return;

  try {
    await upsertSpans(db, schemaName, args.records);
  } catch (error) {
    throw storageError('BATCH_CREATE_SPANS', 'FAILED', { count: args.records.length }, error, ErrorCategory.USER);
  }
}

export async function getSpan(
  db: OracleDB,
  schemaName: string | undefined,
  args: GetSpanArgs,
): Promise<GetSpanResponse | null> {
  const { traceId, spanId } = args;
  try {
    const row = await db.oneOrNone<SpanRow>(
      `${fullSpanSelect()} FROM ${qualifyName(TABLE_SPANS, schemaName)} WHERE ${col('traceId')} = :traceId AND ${col('spanId')} = :spanId`,
      { traceId, spanId },
    );

    return row ? { span: transformSpanRow<SpanRecord>(row) } : null;
  } catch (error) {
    throw storageError('GET_SPAN', 'FAILED', { traceId, spanId }, error, ErrorCategory.USER);
  }
}

export async function getRootSpan(
  db: OracleDB,
  schemaName: string | undefined,
  args: GetRootSpanArgs,
): Promise<GetRootSpanResponse | null> {
  const { traceId } = args;
  try {
    const row = await db.oneOrNone<SpanRow>(
      `${fullSpanSelect()} FROM ${qualifyName(TABLE_SPANS, schemaName)} WHERE ${col('traceId')} = :traceId AND ${col(
        'parentSpanId',
      )} IS NULL FETCH FIRST 1 ROWS ONLY`,
      { traceId },
    );

    return row ? { span: transformSpanRow<SpanRecord>(row) } : null;
  } catch (error) {
    throw storageError('GET_ROOT_SPAN', 'FAILED', { traceId }, error, ErrorCategory.USER);
  }
}

export async function getTrace(
  db: OracleDB,
  schemaName: string | undefined,
  args: GetTraceArgs,
): Promise<GetTraceResponse | null> {
  const { traceId } = args;
  try {
    const spans = await db.manyOrNone<SpanRow>(
      `${fullSpanSelect()} FROM ${qualifyName(TABLE_SPANS, schemaName)} WHERE ${col('traceId')} = :traceId ORDER BY ${col(
        'startedAt',
      )} ASC, ${col('spanId')} ASC`,
      { traceId },
    );

    if (spans.length === 0) return null;
    return {
      traceId,
      spans: spans.map(row => transformSpanRow<SpanRecord>(row)),
    };
  } catch (error) {
    throw storageError('GET_TRACE', 'FAILED', { traceId }, error, ErrorCategory.USER);
  }
}

export async function getTraceLight(
  db: OracleDB,
  schemaName: string | undefined,
  args: GetTraceArgs,
): Promise<GetTraceLightResponse | null> {
  const { traceId } = args;
  try {
    const spans = await db.manyOrNone<SpanRow>(
      `${lightSpanSelect()} FROM ${qualifyName(TABLE_SPANS, schemaName)} WHERE ${col('traceId')} = :traceId ORDER BY ${col(
        'startedAt',
      )} ASC, ${col('spanId')} ASC`,
      { traceId },
    );

    if (spans.length === 0) return null;
    return {
      traceId,
      spans: spans.map(row => transformSpanRow<LightSpanRecord>(row)),
    };
  } catch (error) {
    throw storageError('GET_TRACE_LIGHT', 'FAILED', { traceId }, error, ErrorCategory.USER);
  }
}

export async function updateSpan(
  db: OracleDB,
  schemaName: string | undefined,
  args: UpdateSpanArgs,
): Promise<void> {
  const { traceId, spanId } = args;
  try {
    await batchUpdateSpans(db, schemaName, { records: [args] });
  } catch (error) {
    throw storageError('UPDATE_SPAN', 'FAILED', { traceId, spanId }, error, ErrorCategory.USER);
  }
}

export async function batchUpdateSpans(
  db: OracleDB,
  schemaName: string | undefined,
  args: BatchUpdateSpansArgs,
): Promise<void> {
  if (args.records.length === 0) return;

  try {
    const now = new Date();
    const groups = new Map<string, { columns: SpanColumn[]; binds: Record<string, unknown>[] }>();

    for (const record of coalesceSpanUpdates(args.records)) {
      const columns = updateColumns(record.updates);
      const data = { ...record.updates, updatedAt: now } as Record<string, unknown>;
      const key = columns.join('\0');
      const group = groups.get(key) ?? { columns, binds: [] };
      group.binds.push({
        traceId: record.traceId,
        spanId: record.spanId,
        ...Object.fromEntries(columns.map(columnName => [columnName, bindValue(columnName, data[columnName])])),
      });
      groups.set(key, group);
    }

    await db.tx(async client => {
      // Group updates by changed column set so executeMany can bind each
      // shape once instead of issuing one UPDATE per span.
      for (const group of groups.values()) {
        await client.executeMany(updateSql(schemaName, group.columns), group.binds, {
          bindDefs: bindDefsForColumns(['traceId', 'spanId', ...group.columns]),
        });
      }
    });
  } catch (error) {
    throw storageError('BATCH_UPDATE_SPANS', 'FAILED', { count: args.records.length }, error, ErrorCategory.USER);
  }
}

export async function batchDeleteTraces(
  db: OracleDB,
  schemaName: string | undefined,
  args: BatchDeleteTracesArgs,
): Promise<void> {
  if (args.traceIds.length === 0) return;

  try {
    await db.tx(async client => {
      await client.executeMany(
        `DELETE FROM ${qualifyName(TABLE_SPANS, schemaName)} WHERE ${col('traceId')} = :traceId`,
        args.traceIds.map(traceId => ({ traceId })),
        { bindDefs: { traceId: { type: oracledb.STRING, maxSize: 512 } } },
      );
      await client.executeMany(
        `DELETE FROM ${qualifyName(LOG_EVENTS_TABLE, schemaName)} WHERE ${logCol('traceId')} = :traceId`,
        args.traceIds.map(traceId => ({ traceId })),
        { bindDefs: { traceId: { type: oracledb.STRING, maxSize: 512 } } },
      );
    });
  } catch (error) {
    throw storageError('BATCH_DELETE_TRACES', 'FAILED', { count: args.traceIds.length }, error, ErrorCategory.USER);
  }
}

export async function listTraces(
  db: OracleDB,
  schemaName: string | undefined,
  args: ListTracesArgs,
): Promise<ListTracesResponse> {
  const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
  const page = pagination.page;
  const perPage = pagination.perPage;
  const binds: Record<string, unknown> = {};
  const conditions = [`r.${col('parentSpanId')} IS NULL`];

  try {
    if (filters) {
      // Trace listings start from root spans. Child-error filters are expressed
      // with EXISTS so users can find failed traces without loading children.
      addDateRangeFilter(conditions, binds, 'r', 'startedAt', filters.startedAt);
      addDateRangeFilter(conditions, binds, 'r', 'endedAt', filters.endedAt);

      for (const columnName of FILTER_TEXT_COLUMNS) {
        const value = filters[columnName as keyof typeof filters];
        if (value !== undefined) {
          conditions.push(`${qcol('r', columnName)} = ${addBind(binds, value)}`);
        }
      }

      addJsonObjectFilter(conditions, binds, 'r', 'scope', filters.scope);
      addJsonObjectFilter(conditions, binds, 'r', 'metadata', filters.metadata);
      addTagsFilter(conditions, binds, 'r', filters.tags);
      addStatusFilter(conditions, 'r', filters.status);
      addChildErrorFilter(conditions, qualifyName(TABLE_SPANS, schemaName), filters.hasChildError);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderClause = traceOrderClause(orderBy.field, orderBy.direction);
    const countRow = await db.oneOrNone<{ count: number | string }>(
      `SELECT COUNT(*) AS "count" FROM ${qualifyName(TABLE_SPANS, schemaName)} r ${whereClause}`,
      binds,
    );
    const total = Number(countRow?.count ?? 0);

    if (total === 0) {
      return {
        pagination: { total: 0, page, perPage, hasMore: false },
        spans: [],
      };
    }

    const offset = page * perPage;
    const spans = await db.manyOrNone<SpanRow>(
      `${spanSelect(SPAN_COLUMNS, 'r')} FROM ${qualifyName(TABLE_SPANS, schemaName)} r ${whereClause} ${orderClause} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset, limit: perPage },
    );

    return {
      pagination: {
        total,
        page,
        perPage,
        hasMore: offset + perPage < total,
      },
      spans: toTraceSpans(spans.map(row => transformSpanRow<SpanRecord>(row))),
    };
  } catch (error) {
    throw storageError('LIST_TRACES', 'FAILED', {}, error, ErrorCategory.USER);
  }
}

export async function getEntityTypes(
  db: OracleDB,
  schemaName: string | undefined,
  _args: GetEntityTypesArgs,
): Promise<GetEntityTypesResponse> {
  try {
    return {
      entityTypes: (await distinctContextValues(db, schemaName, 'entityType')) as GetEntityTypesResponse['entityTypes'],
    };
  } catch (error) {
    throw storageError('GET_ENTITY_TYPES', 'FAILED', {}, error, ErrorCategory.USER);
  }
}

export async function getEntityNames(
  db: OracleDB,
  schemaName: string | undefined,
  args: GetEntityNamesArgs,
): Promise<GetEntityNamesResponse> {
  try {
    const binds: Record<string, unknown> = {};
    const entityTypeFilter = args.entityType ? addBind(binds, args.entityType) : undefined;
    const rows = await db.manyOrNone<{ value: string }>(
      `
        SELECT value AS "value"
        FROM (
          SELECT ${col('entityName')} AS value
          FROM ${qualifyName(TABLE_SPANS, schemaName)}
          WHERE ${col('entityName')} IS NOT NULL
            ${entityTypeFilter ? `AND ${col('entityType')} = ${entityTypeFilter}` : ''}
          UNION
          SELECT ${logCol('entityName')} AS value
          FROM ${qualifyName(LOG_EVENTS_TABLE, schemaName)}
          WHERE ${logCol('entityName')} IS NOT NULL
            ${entityTypeFilter ? `AND ${logCol('entityType')} = ${entityTypeFilter}` : ''}
        )
        ORDER BY value
      `,
      binds,
    );

    return { names: rows.map(row => row.value) };
  } catch (error) {
    throw storageError('GET_ENTITY_NAMES', 'FAILED', { entityType: args.entityType }, error, ErrorCategory.USER);
  }
}

export async function getServiceNames(
  db: OracleDB,
  schemaName: string | undefined,
  _args: GetServiceNamesArgs,
): Promise<GetServiceNamesResponse> {
  try {
    return { serviceNames: await distinctContextValues(db, schemaName, 'serviceName') };
  } catch (error) {
    throw storageError('GET_SERVICE_NAMES', 'FAILED', {}, error, ErrorCategory.USER);
  }
}

export async function getEnvironments(
  db: OracleDB,
  schemaName: string | undefined,
  _args: GetEnvironmentsArgs,
): Promise<GetEnvironmentsResponse> {
  try {
    return { environments: await distinctContextValues(db, schemaName, 'environment') };
  } catch (error) {
    throw storageError('GET_ENVIRONMENTS', 'FAILED', {}, error, ErrorCategory.USER);
  }
}

export async function getTags(
  db: OracleDB,
  schemaName: string | undefined,
  args: GetTagsArgs,
): Promise<GetTagsResponse> {
  try {
    const binds: Record<string, unknown> = {};
    const entityTypeFilter = args.entityType ? addBind(binds, args.entityType) : undefined;
    const rows = await db.manyOrNone<{ value: string }>(
      `
        SELECT value AS "value"
        FROM (
          SELECT span_tags.tag AS value
          FROM ${qualifyName(TABLE_SPANS, schemaName)} s,
               JSON_TABLE(${qcol('s', 'tags')}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) span_tags
          WHERE span_tags.tag IS NOT NULL
            ${entityTypeFilter ? `AND ${qcol('s', 'entityType')} = ${entityTypeFilter}` : ''}
          UNION
          SELECT log_tags.tag AS value
          FROM ${qualifyName(LOG_EVENTS_TABLE, schemaName)} l,
               JSON_TABLE(${logQcol('l', 'tags')}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) log_tags
          WHERE log_tags.tag IS NOT NULL
            ${entityTypeFilter ? `AND ${logQcol('l', 'entityType')} = ${entityTypeFilter}` : ''}
        )
        ORDER BY value
      `,
      binds,
    );

    return { tags: rows.map(row => row.value) };
  } catch (error) {
    throw storageError('GET_TAGS', 'FAILED', { entityType: args.entityType }, error, ErrorCategory.USER);
  }
}

async function upsertSpans(db: OracleDB, schemaName: string | undefined, spans: CreateSpanRecord[]): Promise<void> {
  if (spans.length === 0) return;

  const now = new Date();
  const binds = spans.map(span => spanRecordBinds({ ...span, createdAt: now, updatedAt: now }));

  await db.tx(async client => {
    // MERGE supports both initial span creation and later span completion
    // updates through the same code path.
    await client.executeMany(upsertSql(schemaName), binds, {
      bindDefs: bindDefsForColumns(SPAN_COLUMNS),
    });
  });
}

function upsertSql(schemaName: string | undefined): string {
  const table = qualifyName(TABLE_SPANS, schemaName);
  const sourceColumns = SPAN_COLUMNS.map(columnName => `:${columnName} AS ${col(columnName)}`).join(', ');
  const updateAssignments = SPAN_COLUMNS.filter(
    columnName => !SPAN_KEY_COLUMNS.has(columnName) && columnName !== 'createdAt',
  )
    .map(columnName => `target.${col(columnName)} = source.${col(columnName)}`)
    .join(', ');
  const insertColumns = SPAN_COLUMNS.map(columnName => col(columnName)).join(', ');
  const insertValues = SPAN_COLUMNS.map(columnName => `source.${col(columnName)}`).join(', ');

  return `
    MERGE INTO ${table} target
    USING (SELECT ${sourceColumns} FROM dual) source
    ON (target.${col('traceId')} = source.${col('traceId')} AND target.${col('spanId')} = source.${col('spanId')})
    WHEN MATCHED THEN UPDATE SET ${updateAssignments}
    WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})
  `;
}

function updateSql(schemaName: string | undefined, columns: SpanColumn[]): string {
  const assignments = columns.map(columnName => `${col(columnName)} = :${columnName}`).join(', ');
  return `UPDATE ${qualifyName(TABLE_SPANS, schemaName)} SET ${assignments} WHERE ${col('traceId')} = :traceId AND ${col('spanId')} = :spanId`;
}

function fullSpanSelect(): string {
  return spanSelect(SPAN_COLUMNS);
}

function lightSpanSelect(): string {
  return spanSelect(LIGHT_SPAN_COLUMNS);
}

async function distinctContextValues(
  db: OracleDB,
  schemaName: string | undefined,
  columnName: SharedContextColumn,
): Promise<string[]> {
  // Studio discovery filters need values from both span rows and log rows.
  // UNION keeps the result distinct while allowing Oracle to use normal
  // scalar indexes on the shared observability context columns.
  const rows = await db.manyOrNone<{ value: string }>(
    `
      SELECT value AS "value"
      FROM (
        SELECT ${col(columnName as SpanColumn)} AS value
        FROM ${qualifyName(TABLE_SPANS, schemaName)}
        WHERE ${col(columnName as SpanColumn)} IS NOT NULL
        UNION
        SELECT ${logCol(columnName as LogColumn)} AS value
        FROM ${qualifyName(LOG_EVENTS_TABLE, schemaName)}
        WHERE ${logCol(columnName as LogColumn)} IS NOT NULL
      )
      ORDER BY value
    `,
  );

  return rows.map(row => row.value);
}

type SpanUpdateRecord = BatchUpdateSpansArgs['records'][number];

function coalesceSpanUpdates(records: SpanUpdateRecord[]): SpanUpdateRecord[] {
  // batchUpdateSpans groups records by changed-column shape so executeMany can
  // bind each shape once. That grouping reorders execution relative to the
  // batch's insertion order, so repeated updates to the same (traceId, spanId)
  // pair must be coalesced here first -- in insertion order, merging later
  // updates over earlier ones -- so only the last value for each field within
  // a batch ever reaches Oracle (see CR-10).
  const order: string[] = [];
  const merged = new Map<string, SpanUpdateRecord>();

  for (const record of records) {
    const key = `${record.traceId}\0${record.spanId}`;
    const existing = merged.get(key);
    if (existing) {
      existing.updates = { ...existing.updates, ...record.updates };
    } else {
      order.push(key);
      merged.set(key, { traceId: record.traceId, spanId: record.spanId, updates: { ...record.updates } });
    }
  }

  return order.map(key => merged.get(key) as SpanUpdateRecord);
}

function updateColumns(updates: Record<string, unknown>): SpanColumn[] {
  const columns = SPAN_COLUMNS.filter(
    columnName =>
      !SPAN_KEY_COLUMNS.has(columnName) &&
      columnName !== 'createdAt' &&
      columnName !== 'updatedAt' &&
      Object.prototype.hasOwnProperty.call(updates, columnName) &&
      updates[columnName] !== undefined,
  );

  columns.push('updatedAt');
  return columns;
}

function spanSelect(columns: readonly SpanColumn[], tableAlias?: string): string {
  return `SELECT ${columns.map(columnName => `${qcol(tableAlias, columnName)} AS "${columnName}"`).join(', ')}`;
}

function transformSpanRow<T extends SpanRow>(row: SpanRow): T {
  const result: SpanRow = {};

  for (const [key, value] of Object.entries(row)) {
    const columnName = key as SpanColumn;
    const column = SPAN_SCHEMA[columnName];

    if (!column) {
      result[key] = value;
    } else if (column.type === 'jsonb') {
      result[key] = parseJsonValue(value);
    } else if (column.type === 'timestamp') {
      result[key] = value == null ? null : toDate(value);
    } else if (column.type === 'boolean') {
      result[key] = parseBoolean(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return Boolean(value);
}

function addDateRangeFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  columnName: 'startedAt' | 'endedAt',
  range?: { start?: Date; end?: Date },
): void {
  if (range?.start) {
    conditions.push(`${qcol(tableAlias, columnName)} >= ${addBind(binds, range.start)}`);
  }
  if (range?.end) {
    conditions.push(`${qcol(tableAlias, columnName)} <= ${addBind(binds, range.end)}`);
  }
}

function addJsonObjectFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  columnName: 'scope' | 'metadata',
  filter?: Record<string, unknown> | null,
): void {
  if (!filter) return;

  for (const [path, value] of Object.entries(filter)) {
    conditions.push(
      `JSON_VALUE(${qcol(tableAlias, columnName)}, '${assertJsonPath(
        path,
      )}' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${addBind(binds, jsonComparableValue(value))}`,
    );
  }
}

function addTagsFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  tags?: string[] | null,
): void {
  if (!tags?.length) return;

  for (const tag of tags) {
    conditions.push(
      `EXISTS (SELECT 1 FROM JSON_TABLE(${qcol(
        tableAlias,
        'tags',
      )}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) tag_filter WHERE tag_filter.tag = ${addBind(binds, tag)})`,
    );
  }
}

function addStatusFilter(conditions: string[], tableAlias: string, status?: TraceStatus): void {
  if (status === undefined) return;

  switch (status) {
    case TraceStatus.ERROR:
      conditions.push(jsonValueIsPresent(qcol(tableAlias, 'error')));
      break;
    case TraceStatus.RUNNING:
      conditions.push(`${qcol(tableAlias, 'endedAt')} IS NULL AND ${jsonValueIsAbsent(qcol(tableAlias, 'error'))}`);
      break;
    case TraceStatus.SUCCESS:
      conditions.push(`${qcol(tableAlias, 'endedAt')} IS NOT NULL AND ${jsonValueIsAbsent(qcol(tableAlias, 'error'))}`);
      break;
  }
}

function addChildErrorFilter(conditions: string[], tableName: string, hasChildError?: boolean): void {
  if (hasChildError === undefined) return;

  const childErrorPredicate = `SELECT 1 FROM ${tableName} c WHERE c.${col('traceId')} = r.${col(
    'traceId',
  )} AND ${jsonValueIsPresent(`c.${col('error')}`)}`;
  conditions.push(`${hasChildError ? 'EXISTS' : 'NOT EXISTS'} (${childErrorPredicate})`);
}

function jsonValueIsPresent(expression: string): string {
  return `${expression} IS NOT NULL AND JSON_EXISTS(${expression}, '$?(@ != null)')`;
}

function jsonValueIsAbsent(expression: string): string {
  return `(${expression} IS NULL OR NOT JSON_EXISTS(${expression}, '$?(@ != null)'))`;
}

function traceOrderClause(field: 'startedAt' | 'endedAt', direction: 'ASC' | 'DESC'): string {
  if (field === 'endedAt') {
    const nullsOrder = direction === 'DESC' ? 'NULLS FIRST' : 'NULLS LAST';
    return `ORDER BY r.${col('endedAt')} ${direction} ${nullsOrder}, r.${col('traceId')} ${direction}`;
  }

  return `ORDER BY r.${col('startedAt')} ${direction}, r.${col('traceId')} ${direction}`;
}
