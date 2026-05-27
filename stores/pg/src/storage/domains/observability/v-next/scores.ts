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

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SCORE_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { rowToScoreRecord, scoreRecordToRow } from './helpers';
import {
  aggregationSql,
  bucketSql,
  changePercent,
  COMPLEX_GROUP_BY_EXCLUDED,
  dimensionsFromRow,
  resolveGroupBy,
  SCORE_TYPED_COLUMNS,
  seriesNameFromDimensions,
  shiftRange,
} from './olap';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled, encodeDeltaCursor, validateCursorId } from './polling';
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

export async function createScore(client: DbClient, schema: string, args: CreateScoreArgs): Promise<void> {
  const row = scoreRecordToRow(args.score);
  const insert = buildInsert(schema, TABLE_SCORE_EVENTS, [row]);
  if (insert) await client.query(insert.text, insert.values);
}

export async function batchCreateScores(client: DbClient, schema: string, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;
  const rows = args.scores.map(scoreRecordToRow);
  const insert = buildInsert(schema, TABLE_SCORE_EVENTS, rows);
  if (insert) await client.query(insert.text, insert.values);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

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
  const row = await client.oneOrNone<Record<string, any>>(
    `SELECT ${SCORE_SELECT_COLUMNS}
     FROM ${qualifiedTable(schema, TABLE_SCORE_EVENTS)}
     WHERE "scoreId" = $1
     ORDER BY "timestamp" DESC
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
  orderField: 'timestamp',
  orderDir: 'ASC' | 'DESC',
): Promise<ListScoresResponse> {
  const acc = newFilterAccumulator();
  applyScoreFilters(acc, filters);
  const whereClause = whereOrEmpty(acc);

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const count = Number(countRow?.count ?? 0);

  let scores: ScoreRecord[] = [];
  if (count > 0) {
    const rows = await client.manyOrNone<Record<string, any>>(
      `SELECT ${SCORE_SELECT_COLUMNS}
       FROM ${table}
       ${whereClause}
       ORDER BY "${orderField}" ${orderDir}
       LIMIT $${acc.next++} OFFSET $${acc.next++}`,
      [...acc.params, perPage, page * perPage],
    );
    scores = rows.map(rowToScoreRecord);
  }

  const deltaCursor = deltaPollingFeatureEnabled()
    ? await readScoresStreamHeadCursor(client, table, filters)
    : undefined;

  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    scores,
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
  if (after === undefined) {
    const deltaCursor = await readScoresStreamHeadCursor(client, table, filters);
    return { scores: [], delta: { limit, hasMore: false }, deltaCursor };
  }

  const afterId = validateCursorId(after);
  const acc = newFilterAccumulator();
  applyScoreFilters(acc, filters);
  acc.conditions.push(`"cursorId" > $${acc.next++}::bigint`);
  acc.params.push(afterId);

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${SCORE_SELECT_COLUMNS}
     FROM ${table}
     ${whereOrEmpty(acc)}
     ORDER BY "cursorId" ASC
     LIMIT $${acc.next++}`,
    [...acc.params, limit + 1],
  );

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const deltaCursor =
    visible.length > 0
      ? encodeDeltaCursor(visible[visible.length - 1]!.cursorId)
      : await readScoresStreamHeadCursor(client, table, filters);

  return {
    scores: visible.map(rowToScoreRecord),
    delta: { limit, hasMore },
    deltaCursor,
  };
}

async function readScoresStreamHeadCursor(
  client: DbClient,
  table: string,
  filters: ListScoresArgs['filters'],
): Promise<string> {
  const acc = newFilterAccumulator();
  applyScoreFilters(acc, filters);
  const filtered = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table} ${whereOrEmpty(acc)}`,
    acc.params,
  );
  if (filtered?.cursorId != null) return encodeDeltaCursor(filtered.cursorId);

  const head = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table}`,
  );
  return encodeDeltaCursor(head?.cursorId);
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
  const acc = newFilterAccumulator();
  pushScoreIdentity(acc, args.scorerId, args.scoreSource);
  applyScoreFilters(acc, filters);

  const sql = `
    SELECT ${aggregationSql(args.aggregation, '"score"')} AS "value"
    FROM ${qualifiedTable(schema, TABLE_SCORE_EVENTS)}
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

  const sql = `
    SELECT ${resolved.map(e => e.selectSql).join(', ')},
           ${aggregationSql(args.aggregation, '"score"')} AS "value"
    FROM ${qualifiedTable(schema, TABLE_SCORE_EVENTS)}
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

    const sql = `
      SELECT ${bucket} AS bucket,
             ${resolved.map(e => e.selectSql).join(', ')},
             ${aggregationSql(args.aggregation, '"score"')} AS "value"
      FROM ${qualifiedTable(schema, TABLE_SCORE_EVENTS)}
      ${whereOrEmpty(acc)}
      GROUP BY bucket, ${resolved.map(e => e.alias).join(', ')}
      ORDER BY bucket
    `;
    const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

    const seriesMap = new Map<string, { name: string; points: { timestamp: Date; value: number }[] }>();
    for (const row of rows) {
      const dimValues = resolved.map(e => row[e.alias]);
      const seriesKey = JSON.stringify(dimValues);
      let entry = seriesMap.get(seriesKey);
      if (!entry) {
        entry = { name: seriesNameFromDimensions(dimValues), points: [] };
        seriesMap.set(seriesKey, entry);
      }
      entry.points.push({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row.value ?? 0),
      });
    }
    return { series: Array.from(seriesMap.values()) };
  }

  const acc = newFilterAccumulator();
  pushScoreIdentity(acc, args.scorerId, args.scoreSource);
  applyScoreFilters(acc, args.filters);

  const sql = `
    SELECT ${bucket} AS bucket,
           ${aggregationSql(args.aggregation, '"score"')} AS "value"
    FROM ${qualifiedTable(schema, TABLE_SCORE_EVENTS)}
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
          timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
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
  if (!args.percentiles.length) {
    throw new Error('Percentiles must include at least one value between 0 and 1.');
  }
  for (const p of args.percentiles) {
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error(`Percentile value must be a finite number between 0 and 1, got ${p}`);
    }
  }

  const bucket = bucketSql('"timestamp"', args.interval);
  const acc = newFilterAccumulator();
  pushScoreIdentity(acc, args.scorerId, args.scoreSource);
  applyScoreFilters(acc, args.filters);

  const percentileSelect = args.percentiles
    .map((p, i) => `percentile_cont(${p}) WITHIN GROUP (ORDER BY "score") AS p${i}`)
    .join(', ');

  const sql = `
    SELECT ${bucket} AS bucket, ${percentileSelect}
    FROM ${qualifiedTable(schema, TABLE_SCORE_EVENTS)}
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  return {
    series: args.percentiles.map((p, i) => ({
      percentile: p,
      points: rows.map(row => ({
        timestamp: row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket)),
        value: Number(row[`p${i}`] ?? 0),
      })),
    })),
  };
}
