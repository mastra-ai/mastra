import type { BatchCreateScoresArgs, CreateScoreArgs, ListScoresArgs, ListScoresResponse } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters';
import { v, jsonV, toDate, parseJson } from './helpers';

/** Insert a single score event. */
export async function createScore(db: DuckDBConnection, args: CreateScoreArgs): Promise<void> {
  const s = args.score;
  await db.execute(
    `INSERT INTO score_events (timestamp, traceId, spanId, scorerId, scorerVersion, source, score, reason, experimentId, scoreTraceId, metadata)
     VALUES (${[
       v(s.timestamp),
       v(s.traceId),
       v(s.spanId ?? null),
       v(s.scorerId),
       v(s.scorerVersion ?? null),
       v(s.source ?? null),
       v(s.score),
       v(s.reason ?? null),
       v(s.experimentId ?? null),
       v(s.scoreTraceId ?? null),
       jsonV(s.metadata),
     ].join(', ')})`,
  );
}

/** Insert multiple score events in a single statement. */
export async function batchCreateScores(db: DuckDBConnection, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;

  const tuples = args.scores.map(
    s =>
      `(${[
        v(s.timestamp),
        v(s.traceId),
        v(s.spanId ?? null),
        v(s.scorerId),
        v(s.scorerVersion ?? null),
        v(s.source ?? null),
        v(s.score),
        v(s.reason ?? null),
        v(s.experimentId ?? null),
        v(s.scoreTraceId ?? null),
        jsonV(s.metadata),
      ].join(', ')})`,
  );

  await db.execute(
    `INSERT INTO score_events (timestamp, traceId, spanId, scorerId, scorerVersion, source, score, reason, experimentId, scoreTraceId, metadata)
     VALUES ${tuples.join(',\n       ')}`,
  );
}

/** Query score events with filtering, ordering, and pagination. */
export async function listScores(db: DuckDBConnection, args: ListScoresArgs): Promise<ListScoresResponse> {
  const filters = args.filters ?? {};
  const page = Number(args.pagination?.page ?? 0);
  const perPage = Number(args.pagination?.perPage ?? 10);
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' } as const;

  const { clause: filterClause, params: filterParams } = buildWhereClause(filters as Record<string, unknown>);
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
      scorerId: r.scorerId as string,
      scorerVersion: (r.scorerVersion as string) ?? null,
      source: (r.source as string) ?? null,
      score: Number(r.score),
      reason: (r.reason as string) ?? null,
      experimentId: (r.experimentId as string) ?? null,
      scoreTraceId: (r.scoreTraceId as string) ?? null,
      metadata: parseJson(r.metadata) as Record<string, unknown> | null,
      createdAt: toDate(r.timestamp),
      updatedAt: null,
    };
  });

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    scores,
  };
}
