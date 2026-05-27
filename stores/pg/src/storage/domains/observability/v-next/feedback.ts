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
import { listSignalDelta, listSignalPage } from './listing';
import {
  aggregationSql,
  bucketDate,
  bucketSql,
  changePercent,
  collectSeriesByDimensions,
  COMPLEX_GROUP_BY_EXCLUDED,
  dimensionsFromRow,
  FEEDBACK_TYPED_COLUMNS,
  percentileSelectSql,
  percentileSeriesFromRows,
  resolveGroupBy,
  seriesNameFromDimensions,
  shiftRange,
  validatePercentiles,
} from './olap';
import { assertDeltaPollingEnabled, deltaPollingFeatureEnabled } from './polling';
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
  return listSignalPage({
    client,
    table,
    filters: filters as Record<string, any> | undefined,
    page,
    perPage,
    orderField,
    orderDir,
    includeDeltaCursor: deltaPollingFeatureEnabled(),
    selectColumns: FEEDBACK_SELECT_COLUMNS,
    responseKey: 'feedback',
    applyFilters: applyFeedbackFilters,
    mapRow: rowToFeedbackRecord,
  });
}

async function listFeedbackDelta(
  client: DbClient,
  table: string,
  filters: ListFeedbackArgs['filters'],
  after: string | undefined,
  limit: number,
): Promise<ListFeedbackResponse> {
  return listSignalDelta({
    client,
    table,
    filters: filters as Record<string, any> | undefined,
    after,
    limit,
    selectColumns: FEEDBACK_SELECT_COLUMNS,
    responseKey: 'feedback',
    applyFilters: applyFeedbackFilters,
    mapRow: rowToFeedbackRecord,
  });
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

export async function getFeedbackPercentiles(
  client: DbClient,
  schema: string,
  args: GetFeedbackPercentilesArgs,
): Promise<GetFeedbackPercentilesResponse> {
  validatePercentiles(args.percentiles);

  const bucket = bucketSql('"timestamp"', args.interval);
  const acc = newFilterAccumulator();
  pushFeedbackIdentity(acc, args.feedbackType, args.feedbackSource);
  applyFeedbackFilters(acc, args.filters);

  const percentileSelect = percentileSelectSql(args.percentiles, '"valueNumber"');

  const sql = `
    SELECT ${bucket} AS bucket, ${percentileSelect}
    FROM ${qualifiedTable(schema, TABLE_FEEDBACK_EVENTS)}
    ${whereOrEmpty(acc)}
    GROUP BY bucket
    ORDER BY bucket
  `;
  const rows = await client.manyOrNone<Record<string, unknown>>(sql, acc.params);

  return { series: percentileSeriesFromRows(rows, args.percentiles) };
}
