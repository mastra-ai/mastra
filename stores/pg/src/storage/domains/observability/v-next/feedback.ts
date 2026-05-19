/**
 * Feedback operations for the v-next Postgres observability domain.
 *
 * Implements the full ObservabilityStorage feedback surface — write, list,
 * aggregate, breakdown, time series, and percentiles. OLAP aggregates run
 * over `valueNumber` only; string-valued feedback is excluded.
 */

import { listFeedbackArgsSchema } from '@mastra/core/storage';
import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  FeedbackRecord,
  GetFeedbackAggregateArgs,
  GetFeedbackAggregateResponse,
  GetFeedbackBreakdownArgs,
  GetFeedbackBreakdownResponse,
  GetFeedbackPercentilesArgs,
  GetFeedbackPercentilesResponse,
  GetFeedbackTimeSeriesArgs,
  GetFeedbackTimeSeriesResponse,
  ListFeedbackArgs,
  ListFeedbackResponse,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_FEEDBACK_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { feedbackRecordToRow, rowToFeedbackRecord } from './helpers';
import {
  aggregationSql,
  bucketSql,
  changePercent,
  COMPLEX_GROUP_BY_EXCLUDED,
  dimensionsFromRow,
  FEEDBACK_TYPED_COLUMNS,
  resolveGroupBy,
  seriesNameFromDimensions,
  shiftRange,
} from './olap';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled, encodeDeltaCursor, validateCursorId } from './polling';
import { buildInsert, FEEDBACK_SELECT_COLUMNS } from './sql';

// ---------------------------------------------------------------------------
// Filter helpers specific to the feedback signal
// ---------------------------------------------------------------------------

function applyFeedbackFilters(
  acc: ReturnType<typeof newFilterAccumulator>,
  filters: Record<string, any> | undefined,
): void {
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'feedbackType', filters?.feedbackType);
  if (filters?.feedbackSource ?? filters?.source) {
    acc.conditions.push(`"feedbackSource" = $${acc.next++}`);
    acc.params.push(filters.feedbackSource ?? filters.source);
  }
  if (filters?.feedbackUserId) {
    acc.conditions.push(`"feedbackUserId" = $${acc.next++}`);
    acc.params.push(filters.feedbackUserId);
  }
}

/**
 * OLAP queries take an explicit feedbackType / feedbackSource pair as
 * identity. OLAP aggregates also restrict to rows that have a numeric value.
 */
function pushFeedbackIdentity(
  acc: ReturnType<typeof newFilterAccumulator>,
  feedbackType: string,
  feedbackSource: string | undefined,
): void {
  acc.conditions.push(`"feedbackType" = $${acc.next++}`);
  acc.params.push(feedbackType);
  if (feedbackSource !== undefined) {
    acc.conditions.push(`"feedbackSource" = $${acc.next++}`);
    acc.params.push(feedbackSource);
  }
  acc.conditions.push(`"valueNumber" IS NOT NULL`);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createFeedback(client: DbClient, schema: string, args: CreateFeedbackArgs): Promise<void> {
  const row = feedbackRecordToRow(args.feedback);
  const insert = buildInsert(schema, TABLE_FEEDBACK_EVENTS, [row]);
  if (insert) await client.query(insert.text, insert.values);
}

export async function batchCreateFeedback(
  client: DbClient,
  schema: string,
  args: BatchCreateFeedbackArgs,
): Promise<void> {
  if (args.feedbacks.length === 0) return;
  const rows = args.feedbacks.map(feedbackRecordToRow);
  const insert = buildInsert(schema, TABLE_FEEDBACK_EVENTS, rows);
  if (insert) await client.query(insert.text, insert.values);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listFeedback(
  client: DbClient,
  schema: string,
  args: ListFeedbackArgs,
): Promise<ListFeedbackResponse> {
  const { mode, filters, pagination, orderBy, after, limit } = listFeedbackArgsSchema.parse(args);
  const table = qualifiedTable(schema, TABLE_FEEDBACK_EVENTS);

  if (mode === 'delta') {
    assertDeltaPollingEnabled();
    return listFeedbackDelta(client, table, filters, after, limit);
  }

  return listFeedbackPage(
    client,
    table,
    filters,
    pagination.page,
    pagination.perPage,
    orderBy.field,
    orderBy.direction,
  );
}

async function listFeedbackPage(
  client: DbClient,
  table: string,
  filters: ListFeedbackArgs['filters'],
  page: number,
  perPage: number,
  orderField: 'timestamp',
  orderDir: 'ASC' | 'DESC',
): Promise<ListFeedbackResponse> {
  const acc = newFilterAccumulator();
  applyFeedbackFilters(acc, filters);
  const whereClause = whereOrEmpty(acc);

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const count = Number(countRow?.count ?? 0);

  let feedback: FeedbackRecord[] = [];
  if (count > 0) {
    const rows = await client.manyOrNone<Record<string, any>>(
      `SELECT ${FEEDBACK_SELECT_COLUMNS}
       FROM ${table}
       ${whereClause}
       ORDER BY "${orderField}" ${orderDir}
       LIMIT $${acc.next++} OFFSET $${acc.next++}`,
      [...acc.params, perPage, page * perPage],
    );
    feedback = rows.map(rowToFeedbackRecord);
  }

  const deltaCursor = deltaPollingFeatureEnabled()
    ? await readFeedbackStreamHeadCursor(client, table, filters)
    : undefined;

  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    feedback,
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  };
}

async function listFeedbackDelta(
  client: DbClient,
  table: string,
  filters: ListFeedbackArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListFeedbackResponse> {
  if (after === undefined) {
    const deltaCursor = await readFeedbackStreamHeadCursor(client, table, filters);
    return { feedback: [], delta: { limit, hasMore: false }, deltaCursor };
  }

  const afterId = validateCursorId(after);
  const acc = newFilterAccumulator();
  applyFeedbackFilters(acc, filters);
  acc.conditions.push(`"cursorId" > $${acc.next++}::bigint`);
  acc.params.push(afterId);

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${FEEDBACK_SELECT_COLUMNS}
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
      : await readFeedbackStreamHeadCursor(client, table, filters);

  return {
    feedback: visible.map(rowToFeedbackRecord),
    delta: { limit, hasMore },
    deltaCursor,
  };
}

async function readFeedbackStreamHeadCursor(
  client: DbClient,
  table: string,
  filters: ListFeedbackArgs['filters'],
): Promise<string> {
  const acc = newFilterAccumulator();
  applyFeedbackFilters(acc, filters);
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

async function runFeedbackAggregateQuery(
  client: DbClient,
  schema: string,
  args: Pick<GetFeedbackAggregateArgs, 'feedbackType' | 'feedbackSource' | 'aggregation'>,
  filters: Record<string, any> | undefined,
): Promise<number | null> {
  const acc = newFilterAccumulator();
  pushFeedbackIdentity(acc, args.feedbackType, args.feedbackSource);
  applyFeedbackFilters(acc, filters);

  const sql = `
    SELECT ${aggregationSql(args.aggregation, '"valueNumber"')} AS "value"
    FROM ${qualifiedTable(schema, TABLE_FEEDBACK_EVENTS)}
    ${whereOrEmpty(acc)}
  `;
  const row = await client.oneOrNone<{ value: unknown }>(sql, acc.params);
  return row?.value == null ? null : Number(row.value);
}

export async function getFeedbackAggregate(
  client: DbClient,
  schema: string,
  args: GetFeedbackAggregateArgs,
): Promise<GetFeedbackAggregateResponse> {
  const value = await runFeedbackAggregateQuery(client, schema, args, args.filters);

  if (args.comparePeriod && args.filters?.timestamp) {
    const prevRange = shiftRange(args.filters.timestamp, args.comparePeriod);
    if (prevRange) {
      const previousValue = await runFeedbackAggregateQuery(client, schema, args, {
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

export async function getFeedbackBreakdown(
  client: DbClient,
  schema: string,
  args: GetFeedbackBreakdownArgs,
): Promise<GetFeedbackBreakdownResponse> {
  const acc = newFilterAccumulator();
  const resolved = resolveGroupBy(acc, args.groupBy, {
    typedColumns: FEEDBACK_TYPED_COLUMNS,
    excludedColumns: COMPLEX_GROUP_BY_EXCLUDED,
  });
  pushFeedbackIdentity(acc, args.feedbackType, args.feedbackSource);
  applyFeedbackFilters(acc, args.filters);

  const sql = `
    SELECT ${resolved.map(e => e.selectSql).join(', ')},
           ${aggregationSql(args.aggregation, '"valueNumber"')} AS "value"
    FROM ${qualifiedTable(schema, TABLE_FEEDBACK_EVENTS)}
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

export async function getFeedbackTimeSeries(
  client: DbClient,
  schema: string,
  args: GetFeedbackTimeSeriesArgs,
): Promise<GetFeedbackTimeSeriesResponse> {
  const bucket = bucketSql('"timestamp"', args.interval);

  if (args.groupBy && args.groupBy.length > 0) {
    const acc = newFilterAccumulator();
    const resolved = resolveGroupBy(acc, args.groupBy, {
      typedColumns: FEEDBACK_TYPED_COLUMNS,
      excludedColumns: COMPLEX_GROUP_BY_EXCLUDED,
    });
    pushFeedbackIdentity(acc, args.feedbackType, args.feedbackSource);
    applyFeedbackFilters(acc, args.filters);

    const sql = `
      SELECT ${bucket} AS bucket,
             ${resolved.map(e => e.selectSql).join(', ')},
             ${aggregationSql(args.aggregation, '"valueNumber"')} AS "value"
      FROM ${qualifiedTable(schema, TABLE_FEEDBACK_EVENTS)}
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
  pushFeedbackIdentity(acc, args.feedbackType, args.feedbackSource);
  applyFeedbackFilters(acc, args.filters);

  const sql = `
    SELECT ${bucket} AS bucket,
           ${aggregationSql(args.aggregation, '"valueNumber"')} AS "value"
    FROM ${qualifiedTable(schema, TABLE_FEEDBACK_EVENTS)}
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  const seriesName = args.feedbackSource ? `${args.feedbackType}|${args.feedbackSource}` : args.feedbackType;
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

export async function getFeedbackPercentiles(
  client: DbClient,
  schema: string,
  args: GetFeedbackPercentilesArgs,
): Promise<GetFeedbackPercentilesResponse> {
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
  pushFeedbackIdentity(acc, args.feedbackType, args.feedbackSource);
  applyFeedbackFilters(acc, args.filters);

  const percentileSelect = args.percentiles
    .map((p, i) => `percentile_cont(${p}) WITHIN GROUP (ORDER BY "valueNumber") AS p${i}`)
    .join(', ');

  const sql = `
    SELECT ${bucket} AS bucket, ${percentileSelect}
    FROM ${qualifiedTable(schema, TABLE_FEEDBACK_EVENTS)}
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
