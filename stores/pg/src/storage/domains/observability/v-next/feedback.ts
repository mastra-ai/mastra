/**
 * Feedback operations for the v-next Postgres observability domain.
 *
 * Writes + basic listing. OLAP methods inherit "not implemented" from the
 * base class and will be added in a follow-up PR.
 */

import { listFeedbackArgsSchema } from '@mastra/core/storage';
import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  FeedbackRecord,
  ListFeedbackArgs,
  ListFeedbackResponse,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_FEEDBACK_EVENTS } from './ddl';
import { applyCommonFilters, applySingleOrArrayFilter, newFilterAccumulator, whereOrEmpty } from './filters';
import { feedbackRecordToRow, rowToFeedbackRecord } from './helpers';
import { buildInsert, FEEDBACK_SELECT_COLUMNS } from './sql';

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

export async function listFeedback(
  client: DbClient,
  schema: string,
  args: ListFeedbackArgs,
): Promise<ListFeedbackResponse> {
  const { filters, pagination, orderBy } = listFeedbackArgsSchema.parse(args);
  const page = pagination?.page ?? 0;
  const perPage = pagination?.perPage ?? 10;

  const table = qualifiedTable(schema, TABLE_FEEDBACK_EVENTS);
  const acc = newFilterAccumulator();
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

  const whereClause = whereOrEmpty(acc);
  const orderField = orderBy?.field ?? 'timestamp';
  const orderDir = orderBy?.direction ?? 'DESC';

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const count = Number(countRow?.count ?? 0);
  if (count === 0) {
    return { pagination: { total: 0, page, perPage, hasMore: false }, feedback: [] };
  }

  const rows = await client.manyOrNone<Record<string, any>>(
    `SELECT ${FEEDBACK_SELECT_COLUMNS}
     FROM ${table}
     ${whereClause}
     ORDER BY "${orderField}" ${orderDir}
     LIMIT $${acc.next++} OFFSET $${acc.next++}`,
    [...acc.params, perPage, page * perPage],
  );

  const feedback: FeedbackRecord[] = rows.map(rowToFeedbackRecord);
  return {
    pagination: { total: count, page, perPage, hasMore: (page + 1) * perPage < count },
    feedback,
  };
}
