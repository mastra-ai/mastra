import type { BatchCreateScoresArgs, CreateScoreArgs, ListScoresArgs, ListScoresResponse } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, toDate, parseJson, parseJsonArray } from './helpers';

type LegacyScoreRecord = CreateScoreArgs['score'] & {
  source?: string | null;
};

/** Insert a single score event. */
export async function createScore(db: DuckDBConnection, args: CreateScoreArgs): Promise<void> {
  const s = args.score as LegacyScoreRecord;
  const scoreSource = s.scoreSource ?? s.source ?? null;
  await db.execute(
    `INSERT INTO score_events (
      timestamp, traceId, spanId, experimentId, scoreTraceId,
      entityType, entityId, entityName, parentEntityType, parentEntityId, parentEntityName, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      scorerId, scorerVersion, scoreSource, score, reason, tags, metadata, scope
    )
     VALUES (${[
       v(s.timestamp),
       v(s.traceId),
       v(s.spanId ?? null),
       v(s.experimentId ?? null),
       v(s.scoreTraceId ?? null),
       v(s.entityType ?? null),
       v(s.entityId ?? null),
       v(s.entityName ?? null),
       v(s.parentEntityType ?? null),
       v(s.parentEntityId ?? null),
       v(s.parentEntityName ?? null),
       v(s.rootEntityType ?? null),
       v(s.rootEntityId ?? null),
       v(s.rootEntityName ?? null),
       v(s.userId ?? null),
       v(s.organizationId ?? null),
       v(s.resourceId ?? null),
       v(s.runId ?? null),
       v(s.sessionId ?? null),
       v(s.threadId ?? null),
       v(s.requestId ?? null),
       v(s.environment ?? null),
       v(s.executionSource ?? null),
       v(s.serviceName ?? null),
       v(s.scorerId),
       v(s.scorerVersion ?? null),
       v(scoreSource),
       v(s.score),
       v(s.reason ?? null),
       jsonV(s.tags ?? null),
       jsonV(s.metadata),
       jsonV(s.scope ?? null),
     ].join(', ')})`,
  );
}

/** Insert multiple score events in a single statement. */
export async function batchCreateScores(db: DuckDBConnection, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;

  const tuples = args.scores.map(s => {
    const legacyScore = s as LegacyScoreRecord;
    const scoreSource = legacyScore.scoreSource ?? legacyScore.source ?? null;
    return `(${[
      v(legacyScore.timestamp),
      v(legacyScore.traceId),
      v(legacyScore.spanId ?? null),
      v(legacyScore.experimentId ?? null),
      v(legacyScore.scoreTraceId ?? null),
      v(legacyScore.entityType ?? null),
      v(legacyScore.entityId ?? null),
      v(legacyScore.entityName ?? null),
      v(legacyScore.parentEntityType ?? null),
      v(legacyScore.parentEntityId ?? null),
      v(legacyScore.parentEntityName ?? null),
      v(legacyScore.rootEntityType ?? null),
      v(legacyScore.rootEntityId ?? null),
      v(legacyScore.rootEntityName ?? null),
      v(legacyScore.userId ?? null),
      v(legacyScore.organizationId ?? null),
      v(legacyScore.resourceId ?? null),
      v(legacyScore.runId ?? null),
      v(legacyScore.sessionId ?? null),
      v(legacyScore.threadId ?? null),
      v(legacyScore.requestId ?? null),
      v(legacyScore.environment ?? null),
      v(legacyScore.executionSource ?? null),
      v(legacyScore.serviceName ?? null),
      v(legacyScore.scorerId),
      v(legacyScore.scorerVersion ?? null),
      v(scoreSource),
      v(legacyScore.score),
      v(legacyScore.reason ?? null),
      jsonV(legacyScore.tags ?? null),
      jsonV(legacyScore.metadata),
      jsonV(legacyScore.scope ?? null),
    ].join(', ')})`;
  });

  await db.execute(
    `INSERT INTO score_events (
      timestamp, traceId, spanId, experimentId, scoreTraceId,
      entityType, entityId, entityName, parentEntityType, parentEntityId, parentEntityName, rootEntityType, rootEntityId, rootEntityName,
      userId, organizationId, resourceId, runId, sessionId, threadId, requestId, environment, executionSource, serviceName,
      scorerId, scorerVersion, scoreSource, score, reason, tags, metadata, scope
    )
     VALUES ${tuples.join(',\n       ')}`,
  );
}

/** Query score events with filtering, ordering, and pagination. */
export async function listScores(db: DuckDBConnection, args: ListScoresArgs): Promise<ListScoresResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>, {
    source: 'scoreSource',
  });
  const orderByClause = buildOrderByClause(orderBy);
  const { clause: paginationClause, params: paginationParams } = buildPaginationClause({ page, perPage });

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*) as total FROM score_events ${filterClause}`,
    filterParams,
  );
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await db.query(`SELECT * FROM score_events ${filterClause} ${orderByClause} ${paginationClause}`, [
    ...filterParams,
    ...paginationParams,
  ]);

  const scores = rows.map(row => {
    const r = row as Record<string, unknown>;
    return {
      timestamp: toDate(r.timestamp),
      traceId: r.traceId as string,
      spanId: (r.spanId as string) ?? null,
      experimentId: (r.experimentId as string) ?? null,
      scoreTraceId: (r.scoreTraceId as string) ?? null,
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
      scorerId: r.scorerId as string,
      scorerVersion: (r.scorerVersion as string) ?? null,
      source: (r.scoreSource as string) ?? null,
      scoreSource: (r.scoreSource as string) ?? null,
      score: Number(r.score),
      reason: (r.reason as string) ?? null,
      tags: parseJsonArray(r.tags) as string[] | null,
      metadata: parseJson(r.metadata) as Record<string, unknown> | null,
      scope: parseJson(r.scope) as Record<string, unknown> | null,
    };
  }) as ListScoresResponse['scores'];

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    scores,
  };
}
