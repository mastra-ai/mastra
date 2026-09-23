/**
 * Score operations for the v-next Postgres observability domain.
 *
 * Implements the full ObservabilityStorage score surface — write, list,
 * aggregate, breakdown, time series, and percentiles.
 */

import { listScoresArgsSchema } from '@mastra/core/storage';
import type {
  BatchCreateScoresArgs,
  CreateScoreArgs,
  DeleteScoresArgs,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SCORE_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { rowToScoreRecord, scoreRecordToRow } from './helpers';
import { listSignalDelta, readSignalStreamHeadCursor } from './listing';
import {
  aggregationSql,
  bucketDate,
  bucketSql,
  changePercent,
  collectSeriesByDimensions,
  COMPLEX_GROUP_BY_EXCLUDED,
  dimensionsFromRow,
  percentileSelectSql,
  percentileSeriesFromRows,
  resolveGroupBy,
  seriesNameFromDimensions,
  shiftRange,
  validatePercentiles,
} from './olap';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled } from './polling';
import { SCORE_TYPED_COLUMNS } from './signal-schema';
import { buildInsert, SCORE_SELECT_COLUMNS } from './sql';

// ---------------------------------------------------------------------------
// Filter helpers specific to the score signal
// ---------------------------------------------------------------------------

function applyScoreFilters(
  acc: ReturnType<typeof newFilterAccumulator>,
  filters: Record<string, any> | undefined,
): void {
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'scorerId', filters?.scorerId);
  if (filters?.scoreSource ?? filters?.source) {
    acc.conditions.push(`"scoreSource" = $${acc.next++}`);
    acc.params.push(filters.scoreSource ?? filters.source);
  }
  if (filters?.metadata && Object.keys(filters.metadata).length > 0) {
    // Per-top-level-key exact equality (jsonb `=` normalizes formatting), matching in-memory semantics
    for (const [key, value] of Object.entries(filters.metadata)) {
      acc.conditions.push(`"metadata"->($${acc.next++}::text) = $${acc.next++}::jsonb`);
      acc.params.push(key, JSON.stringify(value ?? null));
    }
  }
}

/** OLAP queries take an explicit scorerId / scoreSource pair as identity. */
function pushScoreIdentity(
  acc: ReturnType<typeof newFilterAccumulator>,
  scorerId: string,
  scoreSource: string | undefined,
): void {
  acc.conditions.push(`"scorerId" = $${acc.next++}`);
  acc.params.push(scorerId);
  if (scoreSource !== undefined) {
    acc.conditions.push(`"scoreSource" = $${acc.next++}`);
    acc.params.push(scoreSource);
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function scoreRewriteConflict(row: Record<string, unknown>): string {
  const replacementColumns = Object.keys(row).filter(column => column !== 'scoreId' && column !== 'timestamp');
  return `ON CONFLICT ("scoreId", "timestamp") DO UPDATE SET ${[
    ...replacementColumns.map(column => `"${column}" = EXCLUDED."${column}"`),
    '"cursorId" = EXCLUDED."cursorId"',
    '"xactId" = EXCLUDED."xactId"',
  ].join(', ')}`;
}

function collapseExactScoreConflicts(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const records = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const timestamp = new Date(row.timestamp as string | number | Date).toISOString();
    const key = `${String(row.scoreId)}\u0000${timestamp}`;
    records.delete(key);
    records.set(key, row);
  }
  return [...records.values()];
}

export async function createScore(client: DbClient, schema: string, args: CreateScoreArgs): Promise<void> {
  const row = scoreRecordToRow(args.score);
  const insert = buildInsert(schema, TABLE_SCORE_EVENTS, [row], scoreRewriteConflict(row));
  if (insert) await client.query(insert.text, insert.values);
}

export async function batchCreateScores(client: DbClient, schema: string, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;
  const rows = collapseExactScoreConflicts(args.scores.map(scoreRecordToRow));
  const insert = buildInsert(schema, TABLE_SCORE_EVENTS, rows, scoreRewriteConflict(rows[0]!));
  if (insert) await client.query(insert.text, insert.values);
}

// ---------------------------------------------------------------------------
// Deletes
// ---------------------------------------------------------------------------

/**
 * Delete score events by scoreId. Optional `organizationId` and `resourceId`
 * values are ANDed into the predicate to restrict deletion to records with
 * matching scope fields.
 */
export async function deleteScores(client: DbClient, schema: string, args: DeleteScoresArgs): Promise<void> {
  if (args.scoreIds.length === 0) return;
  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const values: unknown[] = [...args.scoreIds];
  const placeholders = args.scoreIds.map((_, i) => `$${i + 1}`).join(', ');
  const conditions = [`"scoreId" IN (${placeholders})`];
  if (args.organizationId !== undefined) {
    values.push(args.organizationId);
    conditions.push(`"organizationId" = $${values.length}`);
  }
  if (args.resourceId !== undefined) {
    values.push(args.resourceId);
    conditions.push(`"resourceId" = $${values.length}`);
  }
  await client.query(`DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`, values);
}

// ---------------------------------------------------------------------------
// Current-score predicate and page reads
// ---------------------------------------------------------------------------

export function latestScorePredicate(table: string, alias = 's'): string {
  return `NOT EXISTS (
    SELECT 1 FROM ${table} newer
    WHERE newer."scoreId" = ${alias}."scoreId"
      AND newer."cursorId" > ${alias}."cursorId"
  )`;
}

function applyLatestScorePredicate(acc: ReturnType<typeof newFilterAccumulator>, table: string): void {
  acc.conditions.push(latestScorePredicate(table));
}

export async function listScores(client: DbClient, schema: string, args: ListScoresArgs): Promise<ListScoresResponse> {
  const { mode, filters, pagination, orderBy, after, limit } = listScoresArgsSchema.parse(args);
  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);

  if (mode === 'delta') {
    assertDeltaPollingEnabled();
    return listScoresDelta(client, table, filters, after, limit);
  }

  return listScoresPage(client, table, filters, pagination.page, pagination.perPage, orderBy.field, orderBy.direction);
}

export async function getScoreById(client: DbClient, schema: string, scoreId: string): Promise<ScoreRecord | null> {
  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const row = await client.oneOrNone<Record<string, any>>(
    `SELECT ${SCORE_SELECT_COLUMNS}
     FROM ${table}
     WHERE "scoreId" = $1
     ORDER BY "cursorId" DESC
     LIMIT 1`,
    [scoreId],
  );
  return row ? rowToScoreRecord(row) : null;
}

async function listScoresPage(
  client: DbClient,
  table: string,
  filters: ListScoresArgs['filters'],
  page: number,
  perPage: number,
  orderField: 'timestamp' | 'score',
  orderDir: 'ASC' | 'DESC',
): Promise<ListScoresResponse> {
  const acc = newFilterAccumulator();
  applyScoreFilters(acc, filters);
  applyLatestScorePredicate(acc, table);
  const whereClause = whereOrEmpty(acc);

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} s ${whereClause}`,
    acc.params,
  );
  const total = Number(countRow?.count ?? 0);

  let scores: ScoreRecord[] = [];
  if (total > 0) {
    const safeOrderField = parseSqlIdentifier(orderField, 'order field');
    const rows = await client.manyOrNone<Record<string, any>>(
      `SELECT ${SCORE_SELECT_COLUMNS}
       FROM ${table} s
       ${whereClause}
       ORDER BY "${safeOrderField}" ${orderDir}, "cursorId" ${orderDir}
       LIMIT $${acc.next++} OFFSET $${acc.next++}`,
      [...acc.params, perPage, page * perPage],
    );
    scores = rows.map(rowToScoreRecord);
  }

  const deltaCursor = deltaPollingFeatureEnabled()
    ? await readSignalStreamHeadCursor({ client, table, filters, applyFilters: applyScoreFilters })
    : undefined;

  return {
    scores,
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  };
}

async function listScoresDelta(
  client: DbClient,
  table: string,
  filters: ListScoresArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListScoresResponse> {
  return listSignalDelta({
    client,
    table,
    filters,
    after,
    limit,
    selectColumns: SCORE_SELECT_COLUMNS,
    responseKey: 'scores',
    applyFilters: applyScoreFilters,
    mapRow: rowToScoreRecord,
  });
}

// ---------------------------------------------------------------------------
// OLAP — aggregate
// ---------------------------------------------------------------------------

async function runScoreAggregateQuery(
  client: DbClient,
  schema: string,
  args: Pick<GetScoreAggregateArgs, 'scorerId' | 'scoreSource' | 'aggregation'>,
  filters: Record<string, any> | undefined,
): Promise<number | null> {
  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const acc = newFilterAccumulator();
  pushScoreIdentity(acc, args.scorerId, args.scoreSource);
  applyScoreFilters(acc, filters);
  applyLatestScorePredicate(acc, table);

  const sql = `
    SELECT ${aggregationSql(args.aggregation, '"score"')} AS "value"
    FROM ${table} s
    ${whereOrEmpty(acc)}
  `;
  const row = await client.oneOrNone<{ value: unknown }>(sql, acc.params);
  return row?.value == null ? null : Number(row.value);
}

export async function getScoreAggregate(
  client: DbClient,
  schema: string,
  args: GetScoreAggregateArgs,
): Promise<GetScoreAggregateResponse> {
  const value = await runScoreAggregateQuery(client, schema, args, args.filters);

  if (args.comparePeriod && args.filters?.timestamp) {
    const prevRange = shiftRange(args.filters.timestamp, args.comparePeriod);
    if (prevRange) {
      const previousValue = await runScoreAggregateQuery(client, schema, args, {
        ...(args.filters ?? {}),
        timestamp: prevRange,
      });
      return {
        value,
        previousValue,
        changePercent: changePercent(value, previousValue),
      };
    }
  }
  return { value };
}

// ---------------------------------------------------------------------------
// OLAP — breakdown
// ---------------------------------------------------------------------------

export async function getScoreBreakdown(
  client: DbClient,
  schema: string,
  args: GetScoreBreakdownArgs,
): Promise<GetScoreBreakdownResponse> {
  const acc = newFilterAccumulator();
  // Score breakdowns only support typed columns (no jsonb labels).
  const resolved = resolveGroupBy(acc, args.groupBy, {
    typedColumns: SCORE_TYPED_COLUMNS,
    excludedColumns: COMPLEX_GROUP_BY_EXCLUDED,
  });
  pushScoreIdentity(acc, args.scorerId, args.scoreSource);
  applyScoreFilters(acc, args.filters);
  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  applyLatestScorePredicate(acc, table);

  const sql = `
    SELECT ${resolved.map(e => e.selectSql).join(', ')},
           ${aggregationSql(args.aggregation, '"score"')} AS "value"
    FROM ${table} s
    ${whereOrEmpty(acc)}
    GROUP BY ${resolved.map(e => e.alias).join(', ')}
    ORDER BY "value" DESC NULLS LAST
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  return {
    groups: rows.map(row => ({
      dimensions: dimensionsFromRow(row, resolved),
      value: Number(row.value ?? 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// OLAP — time series
// ---------------------------------------------------------------------------

export async function getScoreTimeSeries(
  client: DbClient,
  schema: string,
  args: GetScoreTimeSeriesArgs,
): Promise<GetScoreTimeSeriesResponse> {
  const bucket = bucketSql('"timestamp"', args.interval);

  if (args.groupBy && args.groupBy.length > 0) {
    const acc = newFilterAccumulator();
    const resolved = resolveGroupBy(acc, args.groupBy, {
      typedColumns: SCORE_TYPED_COLUMNS,
      excludedColumns: COMPLEX_GROUP_BY_EXCLUDED,
    });
    pushScoreIdentity(acc, args.scorerId, args.scoreSource);
    applyScoreFilters(acc, args.filters);
    const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
    applyLatestScorePredicate(acc, table);

    const sql = `
      SELECT ${bucket} AS bucket,
             ${resolved.map(e => e.selectSql).join(', ')},
             ${aggregationSql(args.aggregation, '"score"')} AS "value"
      FROM ${table} s
      ${whereOrEmpty(acc)}
      GROUP BY bucket, ${resolved.map(e => e.alias).join(', ')}
      ORDER BY bucket
    `;
    const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

    return {
      series: collectSeriesByDimensions(
        rows,
        resolved,
        dimValues => ({
          name: seriesNameFromDimensions(dimValues),
          points: [] as { timestamp: Date; value: number }[],
        }),
        (entry, row) => {
          entry.points.push({
            timestamp: bucketDate(row.bucket),
            value: Number(row.value ?? 0),
          });
        },
      ),
    };
  }

  const acc = newFilterAccumulator();
  pushScoreIdentity(acc, args.scorerId, args.scoreSource);
  applyScoreFilters(acc, args.filters);
  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  applyLatestScorePredicate(acc, table);

  const sql = `
    SELECT ${bucket} AS bucket,
           ${aggregationSql(args.aggregation, '"score"')} AS "value"
    FROM ${table} s
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  const seriesName = args.scoreSource ? `${args.scorerId}|${args.scoreSource}` : args.scorerId;
  return {
    series: [
      {
        name: seriesName,
        points: rows.map(row => ({
          timestamp: bucketDate(row.bucket),
          value: Number(row.value ?? 0),
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// OLAP — percentiles
// ---------------------------------------------------------------------------

export async function getScorePercentiles(
  client: DbClient,
  schema: string,
  args: GetScorePercentilesArgs,
): Promise<GetScorePercentilesResponse> {
  validatePercentiles(args.percentiles);

  const bucket = bucketSql('"timestamp"', args.interval);
  const acc = newFilterAccumulator();
  pushScoreIdentity(acc, args.scorerId, args.scoreSource);
  applyScoreFilters(acc, args.filters);
  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  applyLatestScorePredicate(acc, table);

  const percentileSelect = percentileSelectSql(args.percentiles, '"score"');

  const sql = `
    SELECT ${bucket} AS bucket, ${percentileSelect}
    FROM ${table} s
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  return { series: percentileSeriesFromRows(rows, args.percentiles) };
}
