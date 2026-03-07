import type { CreateFeedbackArgs, ListFeedbackArgs, ListFeedbackResponse } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index.js';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters.js';
import { v, jsonV, toDate, parseJson } from './helpers.js';

export async function createFeedback(db: DuckDBConnection, args: CreateFeedbackArgs): Promise<void> {
  const f = args.feedback;
  await db.execute(
    `INSERT INTO feedback_events (id, timestamp, traceId, spanId, source, feedbackType, value, comment, experimentId, metadata)
     VALUES (${[
       v(f.id),
       v(f.timestamp),
       v(f.traceId),
       v(f.spanId ?? null),
       v(f.source),
       v(f.feedbackType),
       v(String(f.value)),
       v(f.comment ?? null),
       v(f.experimentId ?? null),
       jsonV(f.metadata),
     ].join(', ')})`,
  );
}

export async function listFeedback(db: DuckDBConnection, args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
  const filters = args.filters ?? {};
  const page = args.pagination?.page ?? 0;
  const perPage = args.pagination?.perPage ?? 10;
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' };

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>);
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*) as total FROM feedback_events ${filterClause}`,
    filterParams,
  );
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await db.query(`SELECT * FROM feedback_events ${filterClause} ${orderByClause} ${paginationClause}`, [
    ...filterParams,
    ...paginationParams,
  ]);

  const feedback = rows.map(row => {
    const r = row as Record<string, unknown>;
    const rawValue = r.value;
    let value: number | string = rawValue as string;
    const numValue = Number(rawValue);
    if (!isNaN(numValue)) value = numValue;

    return {
      id: r.id as string,
      timestamp: toDate(r.timestamp),
      traceId: r.traceId as string,
      spanId: (r.spanId as string) ?? null,
      source: r.source as string,
      feedbackType: r.feedbackType as string,
      value,
      comment: (r.comment as string) ?? null,
      experimentId: (r.experimentId as string) ?? null,
      metadata: parseJson(r.metadata) as Record<string, unknown> | null,
      createdAt: toDate(r.timestamp),
      updatedAt: null,
    };
  });

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    feedback,
  };
}
