import type { ClickHouseClient } from '@clickhouse/client';
import { listFeedbackArgsSchema } from '@mastra/core/storage';
import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  ListFeedbackArgs,
  ListFeedbackResponse,
} from '@mastra/core/storage';

import { TABLE_FEEDBACK_EVENTS } from './ddl';
import { buildFeedbackFilterConditions, buildPaginationClause, buildSignalOrderByClause } from './filters';
import { CH_INSERT_SETTINGS, CH_SETTINGS, feedbackRecordToRow, rowToFeedbackRecord } from './helpers';

export async function createFeedback(client: ClickHouseClient, args: CreateFeedbackArgs): Promise<void> {
  await batchCreateFeedback(client, { feedbacks: [args.feedback] });
}

export async function batchCreateFeedback(client: ClickHouseClient, args: BatchCreateFeedbackArgs): Promise<void> {
  if (args.feedbacks.length === 0) return;

  await client.insert({
    table: TABLE_FEEDBACK_EVENTS,
    values: args.feedbacks.map(feedbackRecordToRow),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

export async function listFeedback(client: ClickHouseClient, args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
  const parsed = listFeedbackArgsSchema.parse(args);
  const filter = buildFeedbackFilterConditions(parsed.filters, 'f');
  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp'], parsed.orderBy, 'f');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  const countResult = (await (
    await client.query({
      query: `SELECT count() AS total FROM ${TABLE_FEEDBACK_EVENTS} AS f ${whereClause}`,
      query_params: filter.params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ total?: number }>;

  const rows = (await (
    await client.query({
      query: `
        SELECT *
        FROM ${TABLE_FEEDBACK_EVENTS} AS f
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}
      `,
      query_params: {
        ...filter.params,
        limit: pagination.limit,
        offset: pagination.offset,
      },
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Record<string, any>[];

  const total = Number(countResult[0]?.total ?? 0);

  return {
    pagination: {
      total,
      page: pagination.page,
      perPage: pagination.perPage,
      hasMore: (pagination.page + 1) * pagination.perPage < total,
    },
    feedback: rows.map(rowToFeedbackRecord),
  };
}
