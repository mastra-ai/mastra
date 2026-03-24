import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  ListFeedbackArgs,
  ListFeedbackResponse,
} from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, toDate, parseJson } from './helpers';

/** Insert a single feedback event. */
export async function createFeedback(db: DuckDBConnection, args: CreateFeedbackArgs): Promise<void> {
  const f = args.feedback;
  await db.execute(
    `INSERT INTO feedback_events (timestamp, traceId, spanId, experimentId, userId, sourceId, source, feedbackType, value, comment, metadata)
     VALUES (${[
       v(f.timestamp),
       v(f.traceId),
       v(f.spanId ?? null),
       v(f.experimentId ?? null),
       v(f.userId ?? null),
       v(f.sourceId ?? null),
       v(f.source),
       v(f.feedbackType),
       v(String(f.value)),
       v(f.comment ?? null),
       jsonV(f.metadata),
     ].join(', ')})`,
  );
}

/** Insert multiple feedback events in a single statement. */
export async function batchCreateFeedback(db: DuckDBConnection, args: BatchCreateFeedbackArgs): Promise<void> {
  if (args.feedbacks.length === 0) return;

  const tuples = args.feedbacks.map(
    f =>
      `(${[
        v(f.timestamp),
        v(f.traceId),
        v(f.spanId ?? null),
        v(f.experimentId ?? null),
        v(f.userId ?? null),
        v(f.sourceId ?? null),
        v(f.source),
        v(f.feedbackType),
        v(String(f.value)),
        v(f.comment ?? null),
        jsonV(f.metadata),
      ].join(', ')})`,
  );

  await db.execute(
    `INSERT INTO feedback_events (timestamp, traceId, spanId, experimentId, userId, sourceId, source, feedbackType, value, comment, metadata)
     VALUES ${tuples.join(',\n       ')}`,
  );
}

/** Query feedback events with filtering, ordering, and pagination. */
export async function listFeedback(db: DuckDBConnection, args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' } as const;

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
      timestamp: toDate(r.timestamp),
      traceId: r.traceId as string,
      spanId: (r.spanId as string) ?? null,
      experimentId: (r.experimentId as string) ?? null,
      userId: (r.userId as string) ?? null,
      sourceId: (r.sourceId as string) ?? null,
      source: r.source as string,
      feedbackType: r.feedbackType as string,
      value,
      comment: (r.comment as string) ?? null,
      metadata: parseJson(r.metadata) as Record<string, unknown> | null,
    };
  });

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    feedback,
  };
}
