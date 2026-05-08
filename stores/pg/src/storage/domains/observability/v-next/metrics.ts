/**
 * Metric operations for the v-next Postgres observability domain.
 *
 * This module currently implements writes (`batchCreateMetrics`) and the
 * basic `listMetrics` read path. The OLAP query methods
 * (`getMetricAggregate`, `getMetricBreakdown`, `getMetricTimeSeries`,
 * `getMetricPercentiles`) inherit "not implemented" from the base
 * `ObservabilityStorage` class and will be added in a follow-up PR.
 */

import { listMetricsArgsSchema } from '@mastra/core/storage';
import type { BatchCreateMetricsArgs, ListMetricsArgs, ListMetricsResponse, MetricRecord } from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_METRIC_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { metricRecordToRow, rowToMetricRecord } from './helpers';
import { buildInsert, METRIC_SELECT_COLUMNS } from './sql';

export async function batchCreateMetrics(
  client: DbClient,
  schema: string,
  args: BatchCreateMetricsArgs,
): Promise<void> {
  if (args.metrics.length === 0) return;
  const rows = args.metrics.map(metricRecordToRow);
  const insert = buildInsert(schema, TABLE_METRIC_EVENTS, rows);
  if (insert) await client.query(insert.text, insert.values);
}

export async function listMetrics(
  client: DbClient,
  schema: string,
  args: ListMetricsArgs,
): Promise<ListMetricsResponse> {
  const { filters, pagination, orderBy } = listMetricsArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const table = qualifiedTable(schema, TABLE_METRIC_EVENTS);
  const acc = newFilterAccumulator();
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'name', filters?.name);
  applySingleOrArrayFilter(acc, 'provider', filters?.provider);
  applySingleOrArrayFilter(acc, 'model', filters?.model);
  applySingleOrArrayFilter(acc, 'costUnit', filters?.costUnit);
  if (filters?.labels) {
    acc.conditions.push(`"labels" @> $${acc.next++}::jsonb`);
    acc.params.push(JSON.stringify(filters.labels));
  }

  const whereClause = whereOrEmpty(acc);
  const orderField = orderBy?.field ?? 'timestamp';
  const orderDir = orderBy?.direction ?? 'DESC';

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const count = Number(countRow?.count ?? 0);
  if (count === 0) {
    return { pagination: { total: 0, page, perPage, hasMore: false }, metrics: [] };
  }

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${METRIC_SELECT_COLUMNS}
     FROM ${table}
     ${whereClause}
     ORDER BY "${orderField}" ${orderDir}
     LIMIT $${acc.next++} OFFSET $${acc.next++}`,
    [...acc.params, perPage, page * perPage],
  );

  const metrics: MetricRecord[] = rows.map(rowToMetricRecord);
  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    metrics,
  };
}
