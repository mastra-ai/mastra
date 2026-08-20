import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData } from '../../../evals/types';
import type {
  AggregateScoresInput,
  AggregateScoresResponse,
  ListScoresByEntityIdInput,
  ListScoresByRunIdInput,
  ListScoresByScorerIdInput,
  ListScoresBySpanInput,
  ListScoresFilter,
  ListScoresInput,
  ScoreAggregateRow,
  ScoreAggregationBucket,
  ScoreTenancyFilters,
} from '../../types';
import { StorageDomain } from '../base';

const BUCKET_MS: Record<Exclude<ScoreAggregationBucket, 'month'>, number> = {
  hour: 3600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
};

function bucketStartUTC(date: Date, bucket: ScoreAggregationBucket): string {
  if (bucket === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
  }
  if (bucket === 'week') {
    // ISO weeks start Monday. Unix epoch (1970-01-01) was a Thursday.
    const dayMs = BUCKET_MS.day;
    const days = Math.floor(date.getTime() / dayMs);
    const weekStartDays = days - ((((days + 3) % 7) + 7) % 7);
    return new Date(weekStartDays * dayMs).toISOString();
  }
  const ms = BUCKET_MS[bucket];
  return new Date(Math.floor(date.getTime() / ms) * ms).toISOString();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function groupKeyValue(score: ScoreRowData, dimension: string): string | null {
  if (dimension === 'scorerId') return score.scorerId ?? null;
  if (dimension === 'entityId') return score.entityId ?? null;
  if (dimension.startsWith('metadata:')) {
    const key = dimension.slice('metadata:'.length);
    const value = (score.metadata as Record<string, unknown> | undefined)?.[key];
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return null;
}

export type { ScoreTenancyFilters };

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Returns true when a score row matches every provided filter field (AND semantics). */
export function scoreMatchesFilter(score: ScoreRowData, filter?: ListScoresFilter): boolean {
  if (!filter) return true;
  if (filter.scorerIds && filter.scorerIds.length > 0 && !filter.scorerIds.includes(score.scorerId)) return false;
  if (filter.entityId !== undefined && score.entityId !== filter.entityId) return false;
  if (filter.entityType !== undefined && score.entityType !== filter.entityType) return false;
  if (filter.traceId !== undefined && score.traceId !== filter.traceId) return false;
  if (filter.threadId !== undefined && score.threadId !== filter.threadId) return false;
  if (filter.source !== undefined && score.source !== filter.source) return false;
  const createdAt = new Date(score.createdAt).getTime();
  if (filter.startDate !== undefined && createdAt < filter.startDate.getTime()) return false;
  if (filter.endDate !== undefined && createdAt > filter.endDate.getTime()) return false;
  if (filter.minScore !== undefined && score.score < filter.minScore) return false;
  if (filter.maxScore !== undefined && score.score > filter.maxScore) return false;
  if (filter.metadata) {
    const metadata = score.metadata as Record<string, unknown> | undefined;
    for (const [key, value] of Object.entries(filter.metadata)) {
      if (!metadata || !(key in metadata) || !deepEqual(metadata[key], value)) return false;
    }
  }
  return true;
}

export abstract class ScoresStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'SCORES',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  abstract getScoreById({ id }: { id: string }): Promise<ScoreRowData | null>;

  abstract saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }>;

  abstract listScoresByScorerId(input: ListScoresByScorerIdInput): Promise<ListScoresResponse>;

  abstract listScoresByRunId(input: ListScoresByRunIdInput): Promise<ListScoresResponse>;

  abstract listScoresByEntityId(input: ListScoresByEntityIdInput): Promise<ListScoresResponse>;

  async listScoresBySpan({ traceId, spanId }: ListScoresBySpanInput): Promise<ListScoresResponse> {
    throw new MastraError({
      id: 'SCORES_STORAGE_GET_SCORES_BY_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: { traceId, spanId },
    });
  }

  /**
   * Unified filtered score listing. Adapters should override with a native
   * implementation; the base class has no data access.
   */
  async listScores(_input: ListScoresInput): Promise<ListScoresResponse> {
    throw new MastraError({
      id: 'SCORES_STORAGE_LIST_SCORES_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
    });
  }

  /**
   * Aggregate scores (avg/p50/p95/count/passRate) with optional UTC time
   * bucketing and group-by dimensions. Default implementation composes over
   * `listScores` in memory; adapters can override with native SQL.
   */
  async aggregateScores(input: AggregateScoresInput): Promise<AggregateScoresResponse> {
    const { filter, bucket, groupBy = [], passThreshold = 1, filters } = input;

    const scores: ScoreRowData[] = [];
    let page = 0;
    const perPage = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await this.listScores({ filter, pagination: { page, perPage }, filters });
      scores.push(...result.scores);
      if (!result.pagination.hasMore || result.scores.length === 0) break;
      page += 1;
    }

    const groupsMap = new Map<string, { bucketStart?: string; groups?: (string | null)[]; values: number[] }>();
    for (const score of scores) {
      const bucketStart = bucket ? bucketStartUTC(new Date(score.createdAt), bucket) : undefined;
      const groups = groupBy.length > 0 ? groupBy.map(dim => groupKeyValue(score, dim)) : undefined;
      const key = JSON.stringify([bucketStart ?? null, groups ?? null]);
      let entry = groupsMap.get(key);
      if (!entry) {
        entry = { bucketStart, groups, values: [] };
        groupsMap.set(key, entry);
      }
      entry.values.push(score.score);
    }

    const rows: ScoreAggregateRow[] = Array.from(groupsMap.values()).map(entry => {
      const sorted = [...entry.values].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      const passing = sorted.filter(v => v >= passThreshold).length;
      return {
        ...(entry.bucketStart !== undefined ? { bucketStart: entry.bucketStart } : {}),
        ...(entry.groups !== undefined ? { groups: entry.groups } : {}),
        count,
        avg: count > 0 ? sum / count : 0,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        passRate: count > 0 ? passing / count : 0,
      };
    });

    rows.sort((a, b) => {
      const bucketCmp = (a.bucketStart ?? '').localeCompare(b.bucketStart ?? '');
      if (bucketCmp !== 0) return bucketCmp;
      return JSON.stringify(a.groups ?? []).localeCompare(JSON.stringify(b.groups ?? []));
    });

    return { rows };
  }
}
