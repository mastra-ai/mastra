import { randomUUID } from 'node:crypto';
import { Spanner } from '@google-cloud/spanner';
import type { Database, Transaction } from '@google-cloud/spanner';
import type { ExecuteSqlRequest, TimestampBounds } from '@google-cloud/spanner/build/src/transaction';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, listMetricsArgsSchema, METRIC_DISTINCT_COLUMNS } from '@mastra/core/storage';
import type {
  AggregationInterval,
  AggregationType,
  BatchCreateMetricsArgs,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  ListMetricsArgs,
  ListMetricsResponse,
  MetricDistinctColumn,
  MetricRecord,
} from '@mastra/core/storage';
import type { SpannerInitMode } from '../../db';
import { quoteIdent } from '../../db/utils';

/** Physical table name. Not exposed by `@mastra/core/storage` (no TABLE_METRICS
 *  constant exists), so the Spanner adapter owns the name itself. Follows the
 *  same `mastra_ai_*` convention as `TABLE_SPANS = 'mastra_ai_spans'`. */
export const TABLE_AI_METRICS = 'mastra_ai_metrics';

/**
 * Ordered column list for `INSERT INTO mastra_ai_metrics (...)`. The order
 * matches the DDL below so the batched insert can render value tuples without
 * having to dictionary-resolve each column.
 */
const METRIC_COLUMNS = [
  'metricId',
  'timestamp',
  'name',
  'value',
  'traceId',
  'spanId',
  'experimentId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'executionSource',
  'serviceName',
  'provider',
  'model',
  'estimatedCost',
  'costUnit',
  'tags',
  'labels',
  'costMetadata',
  'metadata',
  'scope',
  'createdAt',
] as const;

type MetricColumn = (typeof METRIC_COLUMNS)[number];

const JSON_COLUMNS = new Set<MetricColumn>(['tags', 'labels', 'costMetadata', 'metadata', 'scope']);

const TIMESTAMP_COLUMNS = new Set<MetricColumn>(['timestamp', 'createdAt']);

const NUMERIC_COLUMNS = new Set<MetricColumn>(['value', 'estimatedCost']);

/** Plain SCALAR columns that are safe targets for groupBy / equality filters. */
const SCALAR_GROUPBY_COLUMNS = new Set<string>([
  'name',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'rootEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'executionSource',
  'serviceName',
  'provider',
  'model',
  'costUnit',
  'traceId',
  'spanId',
  'experimentId',
]);

const QUOTED_METRIC_COLUMNS_SQL = METRIC_COLUMNS.map(c => quoteIdent(c, 'column name')).join(', ');

/** Build the CREATE TABLE statement for the metrics events table. */
function buildCreateTableDdl(): string {
  const lines: string[] = [];
  for (const col of METRIC_COLUMNS) {
    let type: string;
    if (JSON_COLUMNS.has(col)) type = 'JSON';
    else if (TIMESTAMP_COLUMNS.has(col)) type = 'TIMESTAMP';
    else if (NUMERIC_COLUMNS.has(col)) type = 'FLOAT64';
    else type = 'STRING(MAX)';
    const nullable =
      col === 'metricId' || col === 'timestamp' || col === 'name' || col === 'value' || col === 'createdAt'
        ? ' NOT NULL'
        : '';
    lines.push(`  ${quoteIdent(col, 'column name')} ${type}${nullable}`);
  }
  return `CREATE TABLE ${quoteIdent(TABLE_AI_METRICS, 'table name')} (\n${lines.join(',\n')}\n) PRIMARY KEY (${quoteIdent(
    'metricId',
    'column name',
  )})`;
}

export type MetricIndexDef = {
  name: string;
  columns: string[];
  /**
   * Non-key columns copied into the secondary index so common aggregate reads
   * can be index-only instead of joining back to the base metrics table.
   */
  storing?: string[];
};

/**
 * Default secondary indexes. Every analytical query starts with a name filter
 * and a timestamp range, so the leading composite index is `(name, timestamp DESC)`.
 *
 * Intentionally NOT here: a bare `(timestamp DESC)` index. A monotonically
 * increasing leading column funnels every new row through a single Spanner
 * split until the planner re-splits, capping per-region write throughput
 * regardless of node count. The `(name, ...)` and `(provider, model, ...)`
 * composites give the planner index access for the common queries while
 * smearing writes across many splits via the leading low-cardinality column.
 * Unfiltered "latest metrics" reads fall back to a full scan + sort, which
 * is acceptable because they're bounded by `perPage` and rarely on the
 * dashboard hot path.
 */
export function defaultMetricIndexDefs(): MetricIndexDef[] {
  return [
    {
      name: 'mastra_ai_metrics_name_ts_idx',
      columns: ['name', 'timestamp DESC'],
      storing: [
        'value',
        'estimatedCost',
        'costUnit',
        'provider',
        'model',
        'environment',
        'serviceName',
        'executionSource',
        'entityType',
        'entityName',
      ],
    },
    { name: 'mastra_ai_metrics_traceid_spanid_idx', columns: ['traceId', 'spanId'] },
    { name: 'mastra_ai_metrics_entitytype_entityname_idx', columns: ['entityType', 'entityName'] },
    { name: 'mastra_ai_metrics_orgid_userid_idx', columns: ['organizationId', 'userId'] },
    {
      name: 'mastra_ai_metrics_provider_model_ts_idx',
      columns: ['provider', 'model', 'timestamp DESC'],
      storing: ['name', 'value', 'estimatedCost', 'costUnit'],
    },
    { name: 'mastra_ai_metrics_environment_idx', columns: ['environment'] },
    { name: 'mastra_ai_metrics_service_name_idx', columns: ['serviceName'] },
  ];
}

function renderIndexColumns(columns: string[]): string {
  return columns
    .map(col => {
      if (col.endsWith(' DESC') || col.endsWith(' ASC')) {
        const i = col.lastIndexOf(' ');
        return `${quoteIdent(col.slice(0, i), 'column name')} ${col.slice(i + 1)}`;
      }
      return quoteIdent(col, 'column name');
    })
    .join(', ');
}

function normalizeIndexColumns(columns: string[]): string[] {
  return columns.map(col => (col.endsWith(' ASC') ? col.slice(0, -' ASC'.length) : col));
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function buildCreateIndexDdl(idx: MetricIndexDef): string {
  const cols = renderIndexColumns(idx.columns);
  const storing =
    idx.storing && idx.storing.length > 0
      ? ` STORING (${idx.storing.map(col => quoteIdent(col, 'column name')).join(', ')})`
      : '';
  return `CREATE INDEX ${quoteIdent(idx.name, 'index name')} ON ${quoteIdent(
    TABLE_AI_METRICS,
    'table name',
  )} (${cols})${storing}`;
}

async function tableExists(database: Database, tableName: string): Promise<boolean> {
  const [rows] = await database.run({
    sql: `SELECT 1 AS found FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '' AND TABLE_NAME = @tableName`,
    params: { tableName },
    json: true,
  });
  return (rows as unknown[]).length > 0;
}

async function indexExists(database: Database, indexName: string): Promise<boolean> {
  const [rows] = await database.run({
    sql: `SELECT 1 AS found FROM INFORMATION_SCHEMA.INDEXES WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @indexName`,
    params: { indexName },
    json: true,
  });
  return (rows as unknown[]).length > 0;
}

async function validateMetricIndex(database: Database, expected: MetricIndexDef): Promise<void> {
  if (!(await indexExists(database, expected.name))) {
    throw validateError(
      'METRICS_INDEX_CREATE',
      `Index ${expected.name} on ${TABLE_AI_METRICS} does not exist (initMode='validate' will not create it)`,
      { indexName: expected.name, tableName: TABLE_AI_METRICS },
    );
  }

  const [rows] = await database.run({
    sql: `SELECT COLUMN_NAME, COLUMN_ORDERING
          FROM INFORMATION_SCHEMA.INDEX_COLUMNS
          WHERE TABLE_SCHEMA = '' AND INDEX_NAME = @indexName
          ORDER BY ORDINAL_POSITION`,
    params: { indexName: expected.name },
    json: true,
  });

  const actualRows = rows as Array<{ COLUMN_NAME: string; COLUMN_ORDERING: string | null }>;
  const actualKeyColumns = actualRows
    .filter(row => row.COLUMN_ORDERING !== null)
    .map(
      row =>
        `${row.COLUMN_NAME}${row.COLUMN_ORDERING && row.COLUMN_ORDERING !== 'ASC' ? ` ${row.COLUMN_ORDERING}` : ''}`,
    );
  const expectedKeyColumns = normalizeIndexColumns(expected.columns);
  const keyColumnsMatch =
    actualKeyColumns.length === expectedKeyColumns.length &&
    actualKeyColumns.every((column, index) => column === expectedKeyColumns[index]);
  if (!keyColumnsMatch) {
    throw validateError(
      'METRICS_INDEX_CREATE',
      `Index ${expected.name} column list mismatch (expected [${expectedKeyColumns.join(', ')}], actual [${actualKeyColumns.join(', ')}])`,
      {
        indexName: expected.name,
        tableName: TABLE_AI_METRICS,
        expectedColumns: expectedKeyColumns.join(','),
        actualColumns: actualKeyColumns.join(','),
      },
    );
  }

  const actualStoringColumns = actualRows.filter(row => row.COLUMN_ORDERING === null).map(row => row.COLUMN_NAME);
  const expectedStoringColumns = expected.storing ?? [];
  if (!sameStringSet(actualStoringColumns, expectedStoringColumns)) {
    throw validateError(
      'METRICS_INDEX_CREATE',
      `Index ${expected.name} STORING column list mismatch (expected [${expectedStoringColumns.join(', ')}], actual [${actualStoringColumns.join(', ')}])`,
      {
        indexName: expected.name,
        tableName: TABLE_AI_METRICS,
        expectedStoringColumns: expectedStoringColumns.join(','),
        actualStoringColumns: actualStoringColumns.join(','),
      },
    );
  }
}

function validateError(action: string, message: string, details: Record<string, string>): MastraError {
  return new MastraError({
    id: createStorageErrorId('SPANNER', action, 'VALIDATE_FAILED'),
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    text: message,
    details,
  });
}

/**
 * Create the metrics table + default indexes idempotently. Under
 * `initMode: 'validate'` the function issues no DDL and instead verifies that
 * the table and every default index already exist, throwing a typed user
 * error otherwise. Mirrors the contract `SpannerDB.createTable` exposes for
 * the core tables.
 */
export async function ensureMetricsTable(
  database: Database,
  options: { initMode: SpannerInitMode; skipDefaultIndexes?: boolean },
): Promise<void> {
  const statements: string[] = [];

  const hasTable = await tableExists(database, TABLE_AI_METRICS);
  if (options.initMode === 'validate') {
    if (!hasTable) {
      throw validateError(
        'METRICS_CREATE_TABLE',
        `Table ${TABLE_AI_METRICS} does not exist (initMode='validate' will not create it)`,
        { tableName: TABLE_AI_METRICS },
      );
    }
    if (!options.skipDefaultIndexes) {
      for (const idx of defaultMetricIndexDefs()) {
        await validateMetricIndex(database, idx);
      }
    }
    return;
  }

  if (!hasTable) {
    statements.push(buildCreateTableDdl());
  }
  if (!options.skipDefaultIndexes) {
    for (const idx of defaultMetricIndexDefs()) {
      if (await indexExists(database, idx.name)) continue;
      statements.push(buildCreateIndexDdl(idx));
    }
  }
  if (statements.length === 0) return;
  const [operation] = await database.updateSchema(statements);
  await operation.promise();
}

function decodeMetricRow(row: Record<string, unknown>): MetricRecord {
  const parseJson = (val: unknown): unknown => {
    if (val == null) return undefined;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  };
  const toDate = (val: unknown): Date | null => {
    if (val == null) return null;
    if (val instanceof Date) return new Date(val.getTime());
    if (typeof val === 'string') return new Date(val);
    if (typeof val === 'object' && typeof (val as { value?: unknown }).value === 'string') {
      return new Date((val as { value: string }).value);
    }
    return null;
  };
  return {
    metricId: (row.metricId as string) ?? null,
    timestamp: toDate(row.timestamp)!,
    name: row.name as string,
    value: Number(row.value),
    traceId: (row.traceId as string) ?? null,
    spanId: (row.spanId as string) ?? null,
    experimentId: (row.experimentId as string) ?? null,
    entityType: (row.entityType as MetricRecord['entityType']) ?? null,
    entityId: (row.entityId as string) ?? null,
    entityName: (row.entityName as string) ?? null,
    entityVersionId: (row.entityVersionId as string) ?? null,
    parentEntityVersionId: (row.parentEntityVersionId as string) ?? null,
    parentEntityType: (row.parentEntityType as MetricRecord['parentEntityType']) ?? null,
    parentEntityId: (row.parentEntityId as string) ?? null,
    parentEntityName: (row.parentEntityName as string) ?? null,
    rootEntityVersionId: (row.rootEntityVersionId as string) ?? null,
    rootEntityType: (row.rootEntityType as MetricRecord['rootEntityType']) ?? null,
    rootEntityId: (row.rootEntityId as string) ?? null,
    rootEntityName: (row.rootEntityName as string) ?? null,
    userId: (row.userId as string) ?? null,
    organizationId: (row.organizationId as string) ?? null,
    resourceId: (row.resourceId as string) ?? null,
    runId: (row.runId as string) ?? null,
    sessionId: (row.sessionId as string) ?? null,
    threadId: (row.threadId as string) ?? null,
    requestId: (row.requestId as string) ?? null,
    environment: (row.environment as string) ?? null,
    source: (row.source as string) ?? null,
    executionSource: (row.executionSource as string) ?? null,
    serviceName: (row.serviceName as string) ?? null,
    provider: (row.provider as string) ?? null,
    model: (row.model as string) ?? null,
    estimatedCost: row.estimatedCost === null || row.estimatedCost === undefined ? null : Number(row.estimatedCost),
    costUnit: (row.costUnit as string) ?? null,
    costMetadata: parseJson(row.costMetadata) as MetricRecord['costMetadata'],
    tags: parseJson(row.tags) as MetricRecord['tags'],
    labels: (parseJson(row.labels) as MetricRecord['labels']) ?? {},
    metadata: parseJson(row.metadata) as MetricRecord['metadata'],
    scope: parseJson(row.scope) as MetricRecord['scope'],
  } as MetricRecord;
}

/**
 * Validate a metric column or label key against an identifier-safe regex
 * before embedding it in raw SQL. Spanner accepts JSON_VALUE paths as string
 * parameters in some contexts, but we keep the path literal here so the
 * planner can fold the predicate and we get an easy-to-read query log.
 */
function safeIdent(name: string, kind: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new MastraError({
      id: createStorageErrorId('SPANNER', 'METRICS_FILTER', 'VALIDATE_FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: `Invalid ${kind}: ${name}`,
      details: { [kind.replace(/\s+/g, '')]: name },
    });
  }
  return name;
}

function resolveDistinctColumnSql(distinctColumn: MetricDistinctColumn | undefined): string {
  if (!distinctColumn) {
    throw new Error(`count_distinct aggregation requires a 'distinctColumn' argument`);
  }
  // Defense in depth: schema enum already restricts this, but the value lands
  // in raw SQL so re-check against the system allowlist.
  if (!(METRIC_DISTINCT_COLUMNS as readonly string[]).includes(distinctColumn)) {
    throw new Error(`Invalid distinctColumn: ${distinctColumn}`);
  }
  return quoteIdent(distinctColumn, 'column name');
}

function buildAggregationSql(
  aggregation: AggregationType,
  measure = 'value',
  distinctColumn?: MetricDistinctColumn,
): string {
  switch (aggregation) {
    case 'sum':
      return `SUM(${measure})`;
    case 'avg':
      return `AVG(${measure})`;
    case 'min':
      return `MIN(${measure})`;
    case 'max':
      return `MAX(${measure})`;
    case 'count':
      return `CAST(COUNT(${measure}) AS FLOAT64)`;
    case 'count_distinct':
      // Use exact COUNT(DISTINCT) rather than APPROX_COUNT_DISTINCT for
      // portability: the latter exists in modern Spanner but isn't yet in
      // the local emulator. The cost difference only matters at very high
      // cardinality and the distinctColumn allowlist already excludes ID
      // columns that would blow up the distinct set.
      return `CAST(COUNT(DISTINCT ${resolveDistinctColumnSql(distinctColumn)}) AS FLOAT64)`;
    case 'last':
      // Spanner has no arg_max; ARRAY_AGG(value ORDER BY timestamp DESC LIMIT 1)
      // returns the most recent value per group in a single pass.
      return `(ARRAY_AGG(${measure} ORDER BY \`timestamp\` DESC LIMIT 1))[OFFSET(0)]`;
    default:
      return `SUM(${measure})`;
  }
}

/**
 * Cost aggregation matches what other adapters emit: SUM(estimatedCost) and a
 * shared costUnit if (and only if) all rows in the group carry the same unit.
 * Spanner has no FILTER clause; COUNT(DISTINCT col) ignores NULLs by default,
 * and so does MIN, so the IS-NOT-NULL guard isn't needed.
 */
const COST_SUMMARY_SELECT = `SUM(${quoteIdent('estimatedCost', 'column name')}) AS estimatedCost, CASE WHEN COUNT(DISTINCT ${quoteIdent('costUnit', 'column name')}) = 1 THEN MIN(${quoteIdent('costUnit', 'column name')}) ELSE NULL END AS costUnit`;

function normalizeCostSummaryRow(row: Record<string, unknown>): {
  estimatedCost: number | null;
  costUnit: string | null;
} {
  return {
    estimatedCost: row.estimatedCost == null ? null : Number(row.estimatedCost),
    costUnit: row.costUnit == null ? null : String(row.costUnit),
  };
}

/**
 * Bucket-by-time SQL. Spanner's `TIMESTAMP_TRUNC` only supports calendar parts
 * (MINUTE, HOUR, DAY, ...), so multi-minute buckets are emulated with a
 * `TIMESTAMP_SUB(MOD)` trick that snaps each row down to the nearest
 * 5/15-minute boundary.
 */
function buildTimeBucketSql(interval: AggregationInterval, timestampCol = '`timestamp`'): string {
  switch (interval) {
    case '1m':
      return `TIMESTAMP_TRUNC(${timestampCol}, MINUTE)`;
    case '5m':
      return `TIMESTAMP_SUB(TIMESTAMP_TRUNC(${timestampCol}, MINUTE), INTERVAL MOD(EXTRACT(MINUTE FROM ${timestampCol}), 5) MINUTE)`;
    case '15m':
      return `TIMESTAMP_SUB(TIMESTAMP_TRUNC(${timestampCol}, MINUTE), INTERVAL MOD(EXTRACT(MINUTE FROM ${timestampCol}), 15) MINUTE)`;
    case '1h':
      return `TIMESTAMP_TRUNC(${timestampCol}, HOUR)`;
    case '1d':
      return `TIMESTAMP_TRUNC(${timestampCol}, DAY)`;
    default:
      return `TIMESTAMP_TRUNC(${timestampCol}, HOUR)`;
  }
}

/**
 * Resolve a groupBy entry: a scalar column hits the columns directly; anything
 * else is treated as a label key and routed through `JSON_VALUE(labels, ...)`.
 * Returns both the SELECT expression and the GROUP BY expression because some
 * backends can group by alias and some can't, Spanner cannot, so we re-emit
 * the full expression in GROUP BY.
 */
type ResolvedGroupBy = {
  key: string;
  selectSql: string;
  groupSql: string;
  /** Column name used to read this dimension back out of the row */
  resultKey: string;
};

function resolveGroupBy(groupBy: string[]): ResolvedGroupBy[] {
  return groupBy.map((key, index) => {
    if (SCALAR_GROUPBY_COLUMNS.has(key)) {
      const qcol = quoteIdent(key, 'column name');
      const alias = `gb_${index}`;
      return { key, selectSql: `${qcol} AS ${alias}`, groupSql: qcol, resultKey: alias };
    }
    // Treat as label key. Sanitize identifier first so we can interpolate.
    const labelKey = safeIdent(key, 'label key');
    const alias = `gb_${index}`;
    const expr = `JSON_VALUE(${quoteIdent('labels', 'column name')}, '$.${labelKey}')`;
    return { key, selectSql: `${expr} AS ${alias}`, groupSql: expr, resultKey: alias };
  });
}

/**
 * Build a parameterised WHERE clause for metric filters. Returns the SQL
 * fragment (or an empty string when there are no filters) plus the params /
 * types map ready to merge into a `database.run` call.
 *
 * The intent is to push filters into the storage layer for *every* shape the
 * public API supports: scalar fields, identifier IN lists, timestamp ranges,
 * tag containment, label equality — so the planner can prune partitions
 * before any aggregation runs.
 */
function buildWhereClause(
  filters: Record<string, unknown> | undefined,
  startIndex = 0,
): { clause: string; params: Record<string, unknown>; types: Record<string, string>; nextIndex: number } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  const types: Record<string, string> = {};
  let i = startIndex;
  if (!filters) {
    return { clause: '', params, types, nextIndex: i };
  }

  const bindScalar = (col: string, value: unknown, op = '='): void => {
    const param = `f${i++}`;
    conditions.push(`${quoteIdent(col, 'column name')} ${op} @${param}`);
    if (value instanceof Date) {
      params[param] = value.toISOString();
      types[param] = 'timestamp';
    } else {
      params[param] = value;
    }
  };

  const bindIn = (col: string, values: readonly unknown[]): void => {
    if (values.length === 0) {
      conditions.push('1 = 0');
      return;
    }
    const placeholders: string[] = [];
    for (const v of values) {
      const param = `f${i++}`;
      placeholders.push(`@${param}`);
      params[param] = v;
    }
    conditions.push(`${quoteIdent(col, 'column name')} IN (${placeholders.join(', ')})`);
  };

  // Timestamp range
  const ts = filters.timestamp as
    { start?: Date; end?: Date; startExclusive?: boolean; endExclusive?: boolean } | undefined;
  if (ts?.start) bindScalar('timestamp', ts.start, ts.startExclusive ? '>' : '>=');
  if (ts?.end) bindScalar('timestamp', ts.end, ts.endExclusive ? '<' : '<=');

  // Scalar filters mapped 1:1 to columns
  const scalarKeys = [
    'traceId',
    'spanId',
    'entityType',
    'entityName',
    'entityVersionId',
    'parentEntityVersionId',
    'rootEntityVersionId',
    'userId',
    'organizationId',
    'experimentId',
    'serviceName',
    'environment',
    'parentEntityType',
    'parentEntityName',
    'rootEntityType',
    'rootEntityName',
    'resourceId',
    'runId',
    'sessionId',
    'threadId',
    'requestId',
    'executionSource',
    'source',
    'provider',
    'model',
    'costUnit',
  ] as const;
  for (const k of scalarKeys) {
    const v = filters[k];
    if (v !== undefined && v !== null) bindScalar(k, v);
  }

  // Metric name(s) — drives the leading composite index, so push it explicitly.
  if (Array.isArray(filters.name)) bindIn('name', filters.name as unknown[]);

  // Tags (array containment, AND of all requested tags).
  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    for (const tag of filters.tags as string[]) {
      const param = `f${i++}`;
      params[param] = String(tag);
      conditions.push(
        `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(${quoteIdent('tags', 'column name')})) AS t WHERE JSON_VALUE(t) = @${param})`,
      );
    }
  }

  // Label equality (Record<string, string>). Sanitize keys before embedding.
  const labels = filters.labels as Record<string, string> | undefined;
  if (labels) {
    for (const [key, value] of Object.entries(labels)) {
      const labelKey = safeIdent(key, 'label key');
      const param = `f${i++}`;
      params[param] = String(value);
      conditions.push(`JSON_VALUE(${quoteIdent('labels', 'column name')}, '$.${labelKey}') = @${param}`);
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    types,
    nextIndex: i,
  };
}

/**
 * Compose name + arbitrary-filter where clauses into one merged clause. Used
 * by the OLAP paths that take a required metric name (or list) separately
 * from optional filters.
 */
function combineWhere(
  nameValue: string | string[],
  filterClause: string,
  filterParams: Record<string, unknown>,
  filterTypes: Record<string, string>,
  nextIndex: number,
): { clause: string; params: Record<string, unknown>; types: Record<string, string> } {
  const params: Record<string, unknown> = { ...filterParams };
  const types: Record<string, string> = { ...filterTypes };
  const conditions: string[] = [];

  if (Array.isArray(nameValue)) {
    if (nameValue.length === 0) {
      conditions.push('1 = 0');
    } else {
      const placeholders: string[] = [];
      let i = nextIndex;
      for (const n of nameValue) {
        const param = `n${i++}`;
        placeholders.push(`@${param}`);
        params[param] = n;
      }
      conditions.push(`${quoteIdent('name', 'column name')} IN (${placeholders.join(', ')})`);
    }
  } else {
    const param = `n${nextIndex}`;
    params[param] = nameValue;
    conditions.push(`${quoteIdent('name', 'column name')} = @${param}`);
  }

  if (filterClause) {
    // filterClause already starts with `WHERE `; strip it.
    conditions.push(filterClause.replace(/^WHERE\s+/, ''));
  }

  return { clause: `WHERE ${conditions.join(' AND ')}`, params, types };
}

/**
 * Insert a batch of metric records as a single mutation.
 *
 * Uses the Spanner Mutations API (`tx.insert(table, rows)`) rather than DML
 * because metrics are append-heavy: a single mutation commits the whole batch
 * in one RPC, where the DML equivalent would round-trip per row. At dashboard
 * scales this is several × the throughput, and it also avoids the per-row
 * parameter-binding overhead.
 *
 * Encoding rules for mutations:
 *   - JS `Date` instances are accepted directly for TIMESTAMP columns (the
 *     client serializes via `.toJSON()`).
 *   - Plain objects / arrays are accepted directly for JSON columns (the
 *     client serializes with `JSON.stringify`); the server parses them
 *     because the column schema is JSON.
 *   - Whole-number JS numbers wrapped in `Spanner.float(n)` to force FLOAT64
 *     encoding — without the wrapper the client serializes `100` as a string
 *     and the server rejects it (same root cause as the DML path).
 *   - `null` is passed through and respected per the column's nullability.
 */
export async function batchCreateMetrics(database: Database, args: BatchCreateMetricsArgs): Promise<void> {
  if (args.metrics.length === 0) return;

  const now = new Date();
  // Pre-stringify JSON payloads. The Spanner codec auto-stringifies plain
  // objects for JSON columns but treats arrays as protobuf `list_value`,
  // which the server rejects ("Could not parse list_value ... as JSON")
  // because JSON columns expect a JSON-encoded STRING on the wire. Doing
  // the JSON.stringify up-front sidesteps that fork.
  const encodeJson = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));
  const rows = args.metrics.map(m => ({
    metricId: m.metricId ?? randomUUID(),
    timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp as unknown as string | number),
    name: m.name,
    value: Spanner.float(Number(m.value)),
    traceId: m.traceId ?? null,
    spanId: m.spanId ?? null,
    experimentId: m.experimentId ?? null,
    entityType: m.entityType ?? null,
    entityId: m.entityId ?? null,
    entityName: m.entityName ?? null,
    entityVersionId: m.entityVersionId ?? null,
    parentEntityVersionId: m.parentEntityVersionId ?? null,
    parentEntityType: m.parentEntityType ?? null,
    parentEntityId: m.parentEntityId ?? null,
    parentEntityName: m.parentEntityName ?? null,
    rootEntityVersionId: m.rootEntityVersionId ?? null,
    rootEntityType: m.rootEntityType ?? null,
    rootEntityId: m.rootEntityId ?? null,
    rootEntityName: m.rootEntityName ?? null,
    userId: m.userId ?? null,
    organizationId: m.organizationId ?? null,
    resourceId: m.resourceId ?? null,
    runId: m.runId ?? null,
    sessionId: m.sessionId ?? null,
    threadId: m.threadId ?? null,
    requestId: m.requestId ?? null,
    environment: m.environment ?? null,
    source: m.source ?? null,
    executionSource: m.executionSource ?? null,
    serviceName: m.serviceName ?? null,
    provider: m.provider ?? null,
    model: m.model ?? null,
    estimatedCost: m.estimatedCost == null ? null : Spanner.float(Number(m.estimatedCost)),
    costUnit: m.costUnit ?? null,
    tags: encodeJson(m.tags),
    labels: encodeJson(m.labels ?? {}),
    costMetadata: encodeJson(m.costMetadata),
    metadata: encodeJson(m.metadata),
    scope: encodeJson(m.scope),
    createdAt: now,
  }));

  try {
    await runWithAbortRetry(async () => {
      await database.runTransactionAsync(async (tx: Transaction) => {
        try {
          tx.insert(TABLE_AI_METRICS, rows);
          await tx.commit();
        } catch (err) {
          await tx.rollback().catch(rollbackErr => {
            throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
          });
          throw err;
        }
      });
    });
  } catch (error) {
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'BATCH_CREATE_METRICS', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

async function runWithAbortRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 5;
  let attempt = 0;
  let delay = 50;
  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      attempt++;
      let checkError = error;
      if (checkError instanceof AggregateError && checkError.errors.length > 0) {
        checkError = checkError.errors[0];
      }
      const aborted =
        !!checkError &&
        ((checkError as { code?: number }).code === 10 ||
          /ABORTED/i.test(String((checkError as { message?: unknown })?.message ?? '')));
      if (!aborted || attempt >= maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delay + Math.random() * delay));
      delay *= 2;
    }
  }
}

/** Per-call read options accepted by every read function in this module. */
export type MetricsReadOptions = {
  /**
   * Maximum acceptable staleness in milliseconds for the read. When set to a
   * positive value, the query is issued as a single-use read-only transaction
   * with `maxStaleness`, which lets Spanner serve it from any replica that
   * already has data at least that fresh. The benefit is twofold:
   *
   *   1. Dashboard reads stop competing with leader-region writes for CPU.
   *   2. The planner can route the query to the closest replica, often
   *      shaving 10-50ms off the round-trip vs. a strong read.
   *
   * For metrics specifically, observability dashboards routinely tolerate a
   * few seconds of staleness. `ObservabilitySpanner` defaults to 0 for
   * backwards-compatible strong reads, and callers can opt into bounded
   * staleness with `dashboardStalenessMs`. Note: maxStaleness is only valid
   * for single-use read-only transactions, which is what `database.run` issues.
   */
  stalenessMs?: number;
};

/**
 * Run a single-use read with optional bounded staleness. When `stalenessMs`
 * is positive we attach a `maxStaleness` TimestampBounds; otherwise we issue
 * a strong read against the leader.
 */
async function runQuery(
  database: Database,
  query: ExecuteSqlRequest,
  options?: MetricsReadOptions,
): Promise<unknown[][]> {
  const staleness = options?.stalenessMs;
  if (typeof staleness === 'number' && staleness > 0) {
    const bounds: TimestampBounds = { maxStaleness: staleness };
    return (await database.run(query, bounds)) as unknown as unknown[][];
  }
  return (await database.run(query)) as unknown as unknown[][];
}

/** Paginated listing with the metric-records filter surface. */
export async function listMetrics(
  database: Database,
  args: ListMetricsArgs,
  options?: MetricsReadOptions,
): Promise<ListMetricsResponse> {
  const { filters, pagination, orderBy } = listMetricsArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const { clause, params, types } = buildWhereClause(filters as Record<string, unknown> | undefined);
  const orderField = orderBy?.field ?? 'timestamp';
  const orderDir = (orderBy?.direction ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const tableName = quoteIdent(TABLE_AI_METRICS, 'table name');

  try {
    const [countRows] = await runQuery(
      database,
      {
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${clause}`,
        params,
        types,
        json: true,
      },
      options,
    );
    const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);

    if (total === 0) {
      return { pagination: { total: 0, page, perPage, hasMore: false }, metrics: [] };
    }

    const [rows] = await runQuery(
      database,
      {
        sql: `SELECT ${QUOTED_METRIC_COLUMNS_SQL} FROM ${tableName} ${clause} ORDER BY ${quoteIdent(
          orderField,
          'column name',
        )} ${orderDir}, ${quoteIdent('metricId', 'column name')} ${orderDir} LIMIT @limit OFFSET @offset`,
        params: { ...params, limit: perPage, offset: page * perPage },
        types: { ...types, limit: 'int64', offset: 'int64' },
        json: true,
      },
      options,
    );

    return {
      pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
      metrics: (rows as Array<Record<string, unknown>>).map(decodeMetricRow),
    };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'LIST_METRICS', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

/** Single-value aggregate with optional period-over-period comparison. */
export async function getMetricAggregate(
  database: Database,
  args: GetMetricAggregateArgs,
  options?: MetricsReadOptions,
): Promise<GetMetricAggregateResponse> {
  const aggSql = buildAggregationSql(args.aggregation, 'value', args.distinctColumn);
  const filterResult = buildWhereClause(args.filters as Record<string, unknown> | undefined);
  const combined = combineWhere(
    args.name,
    filterResult.clause,
    filterResult.params,
    filterResult.types,
    filterResult.nextIndex,
  );

  try {
    const tableName = quoteIdent(TABLE_AI_METRICS, 'table name');
    const [rows] = await runQuery(
      database,
      {
        sql: `SELECT ${aggSql} AS value, ${COST_SUMMARY_SELECT} FROM ${tableName} ${combined.clause}`,
        params: combined.params,
        types: combined.types,
        json: true,
      },
      options,
    );
    const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
    const value = row.value == null ? null : Number(row.value);
    const cost = normalizeCostSummaryRow(row);

    // Period comparison piggybacks on the timestamp filter, without one
    // there's no anchor for the shifted window.
    const ts = args.filters?.timestamp;
    if (args.comparePeriod && ts?.start && ts.end) {
      const duration = ts.end.getTime() - ts.start.getTime();
      let prevStart: Date;
      let prevEnd: Date;
      switch (args.comparePeriod) {
        case 'previous_day':
          prevStart = new Date(ts.start.getTime() - 86_400_000);
          prevEnd = new Date(ts.end.getTime() - 86_400_000);
          break;
        case 'previous_week':
          prevStart = new Date(ts.start.getTime() - 604_800_000);
          prevEnd = new Date(ts.end.getTime() - 604_800_000);
          break;
        case 'previous_period':
        default:
          prevStart = new Date(ts.start.getTime() - duration);
          prevEnd = new Date(ts.end.getTime() - duration);
          break;
      }
      const prevFilters = {
        ...args.filters,
        timestamp: { start: prevStart, end: prevEnd, startExclusive: ts.startExclusive, endExclusive: ts.endExclusive },
      };
      const prevFilterResult = buildWhereClause(prevFilters as Record<string, unknown>);
      const prevCombined = combineWhere(
        args.name,
        prevFilterResult.clause,
        prevFilterResult.params,
        prevFilterResult.types,
        prevFilterResult.nextIndex,
      );
      const [prevRows] = await runQuery(
        database,
        {
          sql: `SELECT ${aggSql} AS value, ${COST_SUMMARY_SELECT} FROM ${tableName} ${prevCombined.clause}`,
          params: prevCombined.params,
          types: prevCombined.types,
          json: true,
        },
        options,
      );
      const prevRow = (prevRows as Array<Record<string, unknown>>)[0] ?? {};
      const previousValue = prevRow.value == null ? null : Number(prevRow.value);
      const prevCost = normalizeCostSummaryRow(prevRow);

      let changePercent: number | null = null;
      if (previousValue !== null && previousValue !== 0 && value !== null) {
        changePercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
      }
      let costChangePercent: number | null = null;
      if (prevCost.estimatedCost !== null && prevCost.estimatedCost !== 0 && cost.estimatedCost !== null) {
        costChangePercent = ((cost.estimatedCost - prevCost.estimatedCost) / Math.abs(prevCost.estimatedCost)) * 100;
      }

      return {
        value,
        estimatedCost: cost.estimatedCost,
        costUnit: cost.costUnit,
        previousValue,
        previousEstimatedCost: prevCost.estimatedCost,
        changePercent,
        costChangePercent,
      };
    }

    return { value, estimatedCost: cost.estimatedCost, costUnit: cost.costUnit };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'GET_METRIC_AGGREGATE', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

/** Breakdown by one or more dimensions (columns or label keys). */
export async function getMetricBreakdown(
  database: Database,
  args: GetMetricBreakdownArgs,
  options?: MetricsReadOptions,
): Promise<GetMetricBreakdownResponse> {
  const aggSql = buildAggregationSql(args.aggregation, 'value', args.distinctColumn);
  const filterResult = buildWhereClause(args.filters as Record<string, unknown> | undefined);
  const combined = combineWhere(
    args.name,
    filterResult.clause,
    filterResult.params,
    filterResult.types,
    filterResult.nextIndex,
  );
  const resolvedGroupBy = resolveGroupBy(args.groupBy);
  const selectGroupBy = resolvedGroupBy.map(g => g.selectSql).join(', ');
  const groupByCols = resolvedGroupBy.map(g => g.groupSql).join(', ');
  const orderDir = (args.orderDirection ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const limitClause = typeof args.limit === 'number' ? `LIMIT @limit` : '';
  const params = { ...combined.params } as Record<string, unknown>;
  const types = { ...combined.types } as Record<string, string>;
  if (typeof args.limit === 'number') {
    params.limit = args.limit;
    types.limit = 'int64';
  }

  try {
    const tableName = quoteIdent(TABLE_AI_METRICS, 'table name');
    const [rows] = await runQuery(
      database,
      {
        sql: `SELECT ${selectGroupBy}, ${aggSql} AS value, ${COST_SUMMARY_SELECT} FROM ${tableName} ${combined.clause} GROUP BY ${groupByCols} ORDER BY value ${orderDir} ${limitClause}`,
        params,
        types,
        json: true,
      },
      options,
    );
    const groups = (rows as Array<Record<string, unknown>>).map(row => {
      const dimensions: Record<string, string | null> = {};
      for (const g of resolvedGroupBy) {
        const v = row[g.resultKey];
        dimensions[g.key] = v == null ? null : String(v);
      }
      const cost = normalizeCostSummaryRow(row);
      return {
        dimensions,
        value: Number(row.value ?? 0),
        estimatedCost: cost.estimatedCost,
        costUnit: cost.costUnit,
      };
    });
    return { groups };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'GET_METRIC_BREAKDOWN', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

/** Bucketed time-series, optionally split into multiple series by groupBy. */
export async function getMetricTimeSeries(
  database: Database,
  args: GetMetricTimeSeriesArgs,
  options?: MetricsReadOptions,
): Promise<GetMetricTimeSeriesResponse> {
  const aggSql = buildAggregationSql(args.aggregation, 'value', args.distinctColumn);
  const bucketSql = buildTimeBucketSql(args.interval);
  const filterResult = buildWhereClause(args.filters as Record<string, unknown> | undefined);
  const combined = combineWhere(
    args.name,
    filterResult.clause,
    filterResult.params,
    filterResult.types,
    filterResult.nextIndex,
  );
  const tableName = quoteIdent(TABLE_AI_METRICS, 'table name');

  try {
    if (args.groupBy && args.groupBy.length > 0) {
      const resolvedGroupBy = resolveGroupBy(args.groupBy);
      const selectGroupBy = resolvedGroupBy.map(g => g.selectSql).join(', ');
      const groupByCols = resolvedGroupBy.map(g => g.groupSql).join(', ');
      const [rows] = await runQuery(
        database,
        {
          sql: `SELECT ${bucketSql} AS bucket, ${selectGroupBy}, ${aggSql} AS value, ${COST_SUMMARY_SELECT} FROM ${tableName} ${combined.clause} GROUP BY bucket, ${groupByCols} ORDER BY bucket`,
          params: combined.params,
          types: combined.types,
          json: true,
        },
        options,
      );

      const seriesMap = new Map<
        string,
        {
          name: string;
          costUnits: Set<string>;
          points: { timestamp: Date; value: number; estimatedCost: number | null }[];
        }
      >();
      for (const row of rows as Array<Record<string, unknown>>) {
        const dimValues = resolvedGroupBy.map(g => row[g.resultKey]);
        const seriesKey = JSON.stringify(dimValues);
        const seriesName = dimValues.map(v => (v == null ? '' : String(v))).join('|');
        const cost = normalizeCostSummaryRow(row);
        let entry = seriesMap.get(seriesKey);
        if (!entry) {
          entry = { name: seriesName, costUnits: new Set(), points: [] };
          seriesMap.set(seriesKey, entry);
        }
        if (cost.costUnit) entry.costUnits.add(cost.costUnit);
        entry.points.push({
          timestamp: coerceDate(row.bucket),
          value: Number(row.value ?? 0),
          estimatedCost: cost.estimatedCost,
        });
      }
      return {
        series: Array.from(seriesMap.values()).map(s => ({
          name: s.name,
          costUnit: s.costUnits.size === 1 ? Array.from(s.costUnits)[0]! : null,
          points: s.points,
        })),
      };
    }

    const [rows] = await runQuery(
      database,
      {
        sql: `SELECT ${bucketSql} AS bucket, ${aggSql} AS value, ${COST_SUMMARY_SELECT} FROM ${tableName} ${combined.clause} GROUP BY bucket ORDER BY bucket`,
        params: combined.params,
        types: combined.types,
        json: true,
      },
      options,
    );
    const metricName = Array.isArray(args.name) ? args.name.join(',') : args.name;
    const allUnits = new Set<string>();
    const points = (rows as Array<Record<string, unknown>>).map(row => {
      const cost = normalizeCostSummaryRow(row);
      if (cost.costUnit) allUnits.add(cost.costUnit);
      return {
        timestamp: coerceDate(row.bucket),
        value: Number(row.value ?? 0),
        estimatedCost: cost.estimatedCost,
      };
    });
    return {
      series: [
        {
          name: metricName,
          costUnit: allUnits.size === 1 ? Array.from(allUnits)[0]! : null,
          points,
        },
      ],
    };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'GET_METRIC_TIME_SERIES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

function coerceDate(val: unknown): Date {
  if (val instanceof Date) return new Date(val.getTime());
  if (typeof val === 'string') return new Date(val);
  if (typeof val === 'object' && typeof (val as { value?: unknown }).value === 'string') {
    return new Date((val as { value: string }).value);
  }
  return new Date(String(val));
}

/**
 * Bucketed percentile series. Spanner GoogleSQL exposes `PERCENTILE_CONT`
 * only as an analytic (window) function, which neither the local emulator
 * nor older production releases support inside our query shape. Pulling raw
 * values one-by-one to compute percentiles in JS would round-trip per row.
 *
 * Instead we use `ARRAY_AGG(value ORDER BY value) GROUP BY bucket` to ship
 * one pre-sorted array per bucket, then interpolate every requested
 * percentile in JS. That's:
 *  - one SQL query for any number of percentiles (vs. one-per-p with a
 *    window function), so listing p50/p90/p95/p99 is the same cost as one;
 *  - portable across every Spanner version because ARRAY_AGG is a core
 *    aggregate (not an analytic function);
 *  - exact (linear-interpolation form, matching `PERCENTILE_CONT`'s
 *    definition) rather than HyperLogLog-approximate.
 *
 * The trade-off is that each bucket's array materializes server-side; for
 * pathological queries with millions of points per bucket the row could
 * exceed Spanner's 4MB row limit. Typical dashboard percentile queries
 * (single metric, recent window, modest cardinality) stay well under that.
 */
export async function getMetricPercentiles(
  database: Database,
  args: GetMetricPercentilesArgs,
  options?: MetricsReadOptions,
): Promise<GetMetricPercentilesResponse> {
  const bucketSql = buildTimeBucketSql(args.interval);
  const filterResult = buildWhereClause(args.filters as Record<string, unknown> | undefined);
  const combined = combineWhere(
    args.name,
    filterResult.clause,
    filterResult.params,
    filterResult.types,
    filterResult.nextIndex,
  );
  const tableName = quoteIdent(TABLE_AI_METRICS, 'table name');

  try {
    const [rows] = await runQuery(
      database,
      {
        sql: `SELECT ${bucketSql} AS bucket, ARRAY_AGG(${quoteIdent(
          'value',
          'column name',
        )} ORDER BY ${quoteIdent('value', 'column name')}) AS vals FROM ${tableName} ${combined.clause} GROUP BY bucket ORDER BY bucket`,
        params: combined.params,
        types: combined.types,
        json: true,
      },
      options,
    );

    const bucketArrays = (rows as Array<{ bucket: unknown; vals: unknown[] | null }>).map(row => ({
      timestamp: coerceDate(row.bucket),
      sorted: (row.vals ?? []).map(v => Number(v)).filter(v => Number.isFinite(v)),
    }));

    const series: GetMetricPercentilesResponse['series'] = args.percentiles.map(p => ({
      percentile: p,
      points: bucketArrays.map(({ timestamp, sorted }) => ({
        timestamp,
        value: interpolatePercentile(sorted, p),
      })),
    }));

    return { series };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'GET_METRIC_PERCENTILES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

/**
 * Linear-interpolation percentile, matching SQL `PERCENTILE_CONT` semantics:
 * the rank is `p * (n - 1)`, and the value is the linear blend between the
 * two surrounding sorted values. Empty arrays return 0 to mirror the
 * `Number(row.pvalue ?? 0)` fallback the previous SQL form used.
 */
function interpolatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const clamped = Math.max(0, Math.min(1, p));
  const rank = clamped * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const frac = rank - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

// =============================================================================
// Discovery
// =============================================================================

export async function getMetricNames(
  database: Database,
  args: GetMetricNamesArgs,
  options?: MetricsReadOptions,
): Promise<GetMetricNamesResponse> {
  const params: Record<string, unknown> = {};
  const conditions: string[] = [];
  if (args.prefix) {
    conditions.push(`STARTS_WITH(${quoteIdent('name', 'column name')}, @prefix)`);
    params.prefix = args.prefix;
  }
  let sql = `SELECT DISTINCT ${quoteIdent('name', 'column name')} AS name FROM ${quoteIdent(
    TABLE_AI_METRICS,
    'table name',
  )}`;
  if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ` ORDER BY name`;
  const types: Record<string, string> = {};
  if (typeof args.limit === 'number') {
    sql += ` LIMIT @limit`;
    params.limit = args.limit;
    types.limit = 'int64';
  }
  try {
    const [rows] = await runQuery(database, { sql, params, types, json: true }, options);
    return { names: (rows as Array<{ name: string }>).map(r => r.name) };
  } catch (error) {
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'GET_METRIC_NAMES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

export async function getMetricLabelKeys(
  database: Database,
  args: GetMetricLabelKeysArgs,
  options?: MetricsReadOptions,
): Promise<GetMetricLabelKeysResponse> {
  // Spanner's GoogleSQL JSON functions in the local emulator (and older
  // production releases) don't include JSON_KEYS, so we project the labels
  // JSON as a string and extract distinct top-level keys in the application
  // layer. The DISTINCT keeps the wire payload small even when many rows
  // share the same label schema.
  try {
    const [rows] = await runQuery(
      database,
      {
        sql: `SELECT DISTINCT TO_JSON_STRING(${quoteIdent('labels', 'column name')}) AS labels FROM ${quoteIdent(
          TABLE_AI_METRICS,
          'table name',
        )} WHERE ${quoteIdent('name', 'column name')} = @metricName AND ${quoteIdent('labels', 'column name')} IS NOT NULL`,
        params: { metricName: args.metricName },
        json: true,
      },
      options,
    );
    const keys = new Set<string>();
    for (const row of rows as Array<{ labels: string | null }>) {
      if (!row.labels) continue;
      try {
        const parsed = JSON.parse(row.labels);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const k of Object.keys(parsed)) keys.add(k);
        }
      } catch {
        // Malformed JSON shouldn't happen for a JSON-typed column, but if it
        // does we ignore the row rather than failing the whole discovery.
      }
    }
    return { keys: Array.from(keys).sort() };
  } catch (error) {
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'GET_METRIC_LABEL_KEYS', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

export async function getMetricLabelValues(
  database: Database,
  args: GetMetricLabelValuesArgs,
  options?: MetricsReadOptions,
): Promise<GetMetricLabelValuesResponse> {
  // Sanitize labelKey before embedding in the JSON path. Limits exposure if
  // the validator upstream is ever bypassed.
  const labelKey = safeIdent(args.labelKey, 'label key');
  const path = `'$.${labelKey}'`;
  const params: Record<string, unknown> = { metricName: args.metricName };
  const conditions = [
    `${quoteIdent('name', 'column name')} = @metricName`,
    `JSON_VALUE(${quoteIdent('labels', 'column name')}, ${path}) IS NOT NULL`,
  ];
  if (args.prefix) {
    conditions.push(`STARTS_WITH(JSON_VALUE(${quoteIdent('labels', 'column name')}, ${path}), @prefix)`);
    params.prefix = args.prefix;
  }
  let sql = `SELECT DISTINCT JSON_VALUE(${quoteIdent(
    'labels',
    'column name',
  )}, ${path}) AS val FROM ${quoteIdent(TABLE_AI_METRICS, 'table name')} WHERE ${conditions.join(' AND ')} ORDER BY val`;
  const types: Record<string, string> = {};
  if (typeof args.limit === 'number') {
    sql += ` LIMIT @limit`;
    params.limit = args.limit;
    types.limit = 'int64';
  }
  try {
    const [rows] = await runQuery(database, { sql, params, types, json: true }, options);
    return { values: (rows as Array<{ val: string }>).map(r => r.val) };
  } catch (error) {
    throw new MastraError(
      {
        id: createStorageErrorId('SPANNER', 'GET_METRIC_LABEL_VALUES', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      },
      error,
    );
  }
}

/** Wipes every metric row. Intended for `dangerouslyClearAll()`. */
export async function clearMetrics(database: Database): Promise<void> {
  if (!(await tableExists(database, TABLE_AI_METRICS))) return;
  await database.runTransactionAsync(async (tx: Transaction) => {
    try {
      await tx.runUpdate({
        sql: `DELETE FROM ${quoteIdent(TABLE_AI_METRICS, 'table name')} WHERE TRUE`,
      });
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(rollbackErr => {
        throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
      });
      throw err;
    }
  });
}
