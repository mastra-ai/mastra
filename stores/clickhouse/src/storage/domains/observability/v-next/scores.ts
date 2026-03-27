import type { ClickHouseClient } from '@clickhouse/client';
import { listScoresArgsSchema } from '@mastra/core/storage';
import type { BatchCreateScoresArgs, CreateScoreArgs, ListScoresArgs, ListScoresResponse } from '@mastra/core/storage';

import { TABLE_SCORE_EVENTS } from './ddl';
import { buildPaginationClause, buildScoresFilterConditions, buildSignalOrderByClause } from './filters';
import { CH_INSERT_SETTINGS, CH_SETTINGS, rowToScoreRecord, scoreRecordToRow } from './helpers';

export async function createScore(client: ClickHouseClient, args: CreateScoreArgs): Promise<void> {
  await batchCreateScores(client, { scores: [args.score] });
}

export async function batchCreateScores(client: ClickHouseClient, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;

  await client.insert({
    table: TABLE_SCORE_EVENTS,
    values: args.scores.map(scoreRecordToRow),
    format: 'JSONEachRow',
    clickhouse_settings: CH_INSERT_SETTINGS,
  });
}

export async function listScores(client: ClickHouseClient, args: ListScoresArgs): Promise<ListScoresResponse> {
  const parsed = listScoresArgsSchema.parse(args);
  const filter = buildScoresFilterConditions(parsed.filters, 's');
  const pagination = buildPaginationClause(parsed.pagination);
  const orderBy = buildSignalOrderByClause(['timestamp', 'score'], parsed.orderBy, 's');
  const whereClause = filter.conditions.length ? `WHERE ${filter.conditions.join(' AND ')}` : '';

  const countResult = (await (
    await client.query({
      query: `SELECT count() AS total FROM ${TABLE_SCORE_EVENTS} AS s ${whereClause}`,
      query_params: filter.params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as Array<{ total?: number }>;

  const rows = (await (
    await client.query({
      query: `
        SELECT *
        FROM ${TABLE_SCORE_EVENTS} AS s
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
    scores: rows.map(rowToScoreRecord),
  };
}
