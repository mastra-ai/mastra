/**
 * Score operations for the v-next Postgres observability domain.
 *
 * Writes + basic listing. OLAP methods (`getScoreAggregate`,
 * `getScoreBreakdown`, `getScoreTimeSeries`, `getScorePercentiles`) inherit
 * "not implemented" from the base class and will be added in a follow-up PR.
 */

import { listScoresArgsSchema } from '@mastra/core/storage';
import type {
  BatchCreateScoresArgs,
  CreateScoreArgs,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SCORE_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { rowToScoreRecord, scoreRecordToRow } from './helpers';
import { buildInsert, SCORE_SELECT_COLUMNS } from './sql';

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

export async function listScores(client: DbClient, schema: string, args: ListScoresArgs): Promise<ListScoresResponse> {
  const { filters, pagination, orderBy } = listScoresArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const table = qualifiedTable(schema, TABLE_SCORE_EVENTS);
  const acc = newFilterAccumulator();
  applyCommonFilters(acc, filters);
  applySingleOrArrayFilter(acc, 'scorerId', filters?.scorerId);
  if (filters?.scoreSource ?? filters?.source) {
    acc.conditions.push(`"scoreSource" = $${acc.next++}`);
    acc.params.push(filters.scoreSource ?? filters.source);
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
    return { pagination: { total: 0, page, perPage, hasMore: false }, scores: [] };
  }

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${SCORE_SELECT_COLUMNS}
     FROM ${table}
     ${whereClause}
     ORDER BY "${orderField}" ${orderDir}
     LIMIT $${acc.next++} OFFSET $${acc.next++}`,
    [...acc.params, perPage, page * perPage],
  );

  const scores: ScoreRecord[] = rows.map(rowToScoreRecord);
  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    scores,
  };
}
