import type { CreateScoreArgs, ListScoresArgs, ListScoresResponse } from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index.js';
import { buildWhereClause, buildOrderByClause, buildPaginationClause } from './filters.js';
import { v, jsonV, toDate, parseJson } from './helpers.js';

export async function createScore(db: DuckDBConnection, args: CreateScoreArgs): Promise<void> {
  const s = args.score;
  await db.execute(
    `INSERT INTO score_events (id, timestamp, traceId, spanId, scorerName, score, reason, experimentId, metadata)
     VALUES (${[
       v(s.id),
       v(s.timestamp),
       v(s.traceId),
       v(s.spanId ?? null),
       v(s.scorerName),
       v(s.score),
       v(s.reason ?? null),
       v(s.experimentId ?? null),
       jsonV(s.metadata),
     ].join(', ')})`,
  );
}

export async function listScores(db: DuckDBConnection, args: ListScoresArgs): Promise<ListScoresResponse> {
  const filters = args.filters ?? {};
  const page = args.pagination?.page ?? 0;
  const perPage = args.pagination?.perPage ?? 10;
  const orderBy = { field: args.orderBy?.field ?? 'timestamp', direction: args.orderBy?.direction ?? 'DESC' };

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
      id: r.id as string,
      timestamp: toDate(r.timestamp),
      traceId: r.traceId as string,
      spanId: (r.spanId as string) ?? null,
      scorerName: r.scorerName as string,
      score: Number(r.score),
      reason: (r.reason as string) ?? null,
      experimentId: (r.experimentId as string) ?? null,
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
