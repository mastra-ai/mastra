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
import { listSignalDelta, listSignalPage } from './listing';
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
  orderField: 'timestamp' | 'score',
  orderDir: 'ASC' | 'DESC',
): Promise<ListScoresResponse> {
  return listSignalPage({
    client,
    table,
    filters,
    page,
    perPage,
    orderField,
    orderDir,
    includeDeltaCursor: deltaPollingFeatureEnabled(),
    selectColumns: SCORE_SELECT_COLUMNS,
    responseKey: 'scores',
    applyFilters: applyScoreFilters,
    mapRow: rowToScoreRecord,
  });
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

  const percentileSelect = percentileSelectSql(args.percentiles, '"score"');

  const sql = `
    SELECT ${bucket} AS bucket, ${percentileSelect}
    FROM ${qualifiedTable(schema, TABLE_SCORE_EVENTS)}
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  return { series: percentileSeriesFromRows(rows, args.percentiles) };
}
