import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  ListFeedbackArgs,
  ListFeedbackResponse,
} from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, toDate, parseJson, parseJsonArray } from './helpers';

type LegacyFeedbackRecord = CreateFeedbackArgs['feedback'] & {
  source?: string | null;
  userId?: string | null;
};

/** Insert a single feedback event. */
export async function createFeedback(db: DuckDBConnection, args: CreateFeedbackArgs): Promise<void> {
  const f = args.feedback as LegacyFeedbackRecord;
  const feedbackSource = f.feedbackSource ?? f.source ?? '';
  const feedbackUserId = f.feedbackUserId ?? f.userId ?? null;
  await db.execute(
    `INSERT INTO feedback_events (
      timestamp, traceId, spanId, experimentId,
      entityType, entityId, entityName, parentEntityType, parentEntityId, parentEntityName, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      feedbackUserId, sourceId, feedbackSource, feedbackType, value, comment, tags, metadata, scope
    )
     VALUES (${[
       v(f.timestamp),
       v(f.traceId),
       v(f.spanId ?? null),
       v(f.experimentId ?? null),
       v(f.entityType ?? null),
       v(f.entityId ?? null),
       v(f.entityName ?? null),
       v(f.parentEntityType ?? null),
       v(f.parentEntityId ?? null),
       v(f.parentEntityName ?? null),
       v(f.rootEntityType ?? null),
       v(f.rootEntityId ?? null),
       v(f.rootEntityName ?? null),
       v(f.userId ?? null),
       v(f.organizationId ?? null),
       v(f.resourceId ?? null),
       v(f.runId ?? null),
       v(f.sessionId ?? null),
       v(f.threadId ?? null),
       v(f.requestId ?? null),
       v(f.environment ?? null),
       v(f.executionSource ?? null),
       v(f.serviceName ?? null),
       v(feedbackUserId),
       v(f.sourceId ?? null),
       v(feedbackSource),
       v(f.feedbackType),
       v(String(f.value)),
       v(f.comment ?? null),
       jsonV(f.tags ?? null),
       jsonV(f.metadata),
       jsonV(f.scope ?? null),
     ].join(', ')})`,
  );
}

/** Insert multiple feedback events in a single statement. */
export async function batchCreateFeedback(db: DuckDBConnection, args: BatchCreateFeedbackArgs): Promise<void> {
  if (args.feedbacks.length === 0) return;

  const tuples = args.feedbacks.map(f => {
    const legacyFeedback = f as LegacyFeedbackRecord;
    const feedbackSource = legacyFeedback.feedbackSource ?? legacyFeedback.source ?? '';
    const feedbackUserId = legacyFeedback.feedbackUserId ?? legacyFeedback.userId ?? null;
    return `(${[
      v(legacyFeedback.timestamp),
      v(legacyFeedback.traceId),
      v(legacyFeedback.spanId ?? null),
      v(legacyFeedback.experimentId ?? null),
      v(legacyFeedback.entityType ?? null),
      v(legacyFeedback.entityId ?? null),
      v(legacyFeedback.entityName ?? null),
      v(legacyFeedback.parentEntityType ?? null),
      v(legacyFeedback.parentEntityId ?? null),
      v(legacyFeedback.parentEntityName ?? null),
      v(legacyFeedback.rootEntityType ?? null),
      v(legacyFeedback.rootEntityId ?? null),
      v(legacyFeedback.rootEntityName ?? null),
      v(legacyFeedback.userId ?? null),
      v(legacyFeedback.organizationId ?? null),
      v(legacyFeedback.resourceId ?? null),
      v(legacyFeedback.runId ?? null),
      v(legacyFeedback.sessionId ?? null),
      v(legacyFeedback.threadId ?? null),
      v(legacyFeedback.requestId ?? null),
      v(legacyFeedback.environment ?? null),
      v(legacyFeedback.executionSource ?? null),
      v(legacyFeedback.serviceName ?? null),
      v(feedbackUserId),
      v(legacyFeedback.sourceId ?? null),
      v(feedbackSource),
      v(legacyFeedback.feedbackType),
      v(String(legacyFeedback.value)),
      v(legacyFeedback.comment ?? null),
      jsonV(legacyFeedback.tags ?? null),
      jsonV(legacyFeedback.metadata),
      jsonV(legacyFeedback.scope ?? null),
    ].join(', ')})`;
  });

  await db.execute(
    `INSERT INTO feedback_events (
      timestamp, traceId, spanId, experimentId,
      entityType, entityId, entityName, parentEntityType, parentEntityId, parentEntityName, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      feedbackUserId, sourceId, feedbackSource, feedbackType, value, comment, tags, metadata, scope
    )
     VALUES ${tuples.join(',\n       ')}`,
  );
}

/** Query feedback events with filtering, ordering, and pagination. */
export async function listFeedback(db: DuckDBConnection, args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>, {
    source: 'feedbackSource',
  });
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
      entityType: (r.entityType as string) ?? null,
      entityId: (r.entityId as string) ?? null,
      entityName: (r.entityName as string) ?? null,
      parentEntityType: (r.parentEntityType as string) ?? null,
      parentEntityId: (r.parentEntityId as string) ?? null,
      parentEntityName: (r.parentEntityName as string) ?? null,
      rootEntityType: (r.rootEntityType as string) ?? null,
      rootEntityId: (r.rootEntityId as string) ?? null,
      rootEntityName: (r.rootEntityName as string) ?? null,
      userId: (r.userId as string) ?? null,
      organizationId: (r.organizationId as string) ?? null,
      resourceId: (r.resourceId as string) ?? null,
      runId: (r.runId as string) ?? null,
      sessionId: (r.sessionId as string) ?? null,
      threadId: (r.threadId as string) ?? null,
      requestId: (r.requestId as string) ?? null,
      environment: (r.environment as string) ?? null,
      executionSource: (r.executionSource as string) ?? null,
      serviceName: (r.serviceName as string) ?? null,
      feedbackUserId: (r.feedbackUserId as string) ?? null,
      sourceId: (r.sourceId as string) ?? null,
      source: r.feedbackSource as string,
      feedbackSource: r.feedbackSource as string,
      feedbackType: r.feedbackType as string,
      value,
      comment: (r.comment as string) ?? null,
      tags: parseJsonArray(r.tags) as string[] | null,
      metadata: parseJson(r.metadata) as Record<string, unknown> | null,
      scope: parseJson(r.scope) as Record<string, unknown> | null,
    };
  }) as ListFeedbackResponse['feedback'];

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    feedback,
  };
}
