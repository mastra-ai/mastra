import crypto from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  ListScoresResponse,
  SaveScorePayload,
  ScoreRowData,
  ScoringEntityType,
  ScoringSource,
} from '@mastra/core/evals';
import { TABLE_SCORERS, ScoresStorage, createStorageErrorId } from '@mastra/core/storage';
import type { StoragePagination } from '@mastra/core/storage';

import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

type StoredScore = Omit<ScoreRowData, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export class ScoresConvex extends ScoresStorage {
  #db: ConvexDB;
  constructor(config: ConvexDomainConfig) {
    super();
    const client = resolveConvexConfig(config);
    this.#db = new ConvexDB(client);
  }

  async init(): Promise<void> {
    // No-op for Convex; schema is managed server-side.
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    const row = await this.#db.load<StoredScore | null>({
      tableName: TABLE_SCORERS,
      keys: { id },
    });
    return row ? this.deserialize(row) : null;
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    const now = new Date();
    const record = {
      ...score,
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    } as StoredScore;

    await this.#db.insert({
      tableName: TABLE_SCORERS,
      record,
    });

    return { score: this.deserialize(record) };
  }

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: ScoringEntityType;
    source?: ScoringSource;
  }): Promise<ListScoresResponse> {
    return this.listScores({
      filters: { scorerId, entityId, entityType, source },
      pagination,
    });
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    return this.listScores({
      filters: { runId },
      pagination,
    });
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    entityId: string;
    entityType: ScoringEntityType;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    return this.listScores({
      filters: { entityId, entityType },
      pagination,
    });
  }

  private async listScores({
    filters,
    pagination,
  }: {
    filters: Partial<Pick<ScoreRowData, 'scorerId' | 'entityId' | 'entityType' | 'runId' | 'source'>>;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    if (pagination.page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('CONVEX', 'LIST_SCORES', 'INVALID_PAGINATION'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        new Error('page must be >= 0'),
      );
    }

    // Build query filters to leverage server-side indexes
    // The server will use by_scorer, by_entity, or by_run indexes based on the filter pattern
    const queryFilters: Array<{ field: string; value: string | number | boolean | null }> = [];

    // Add indexed filters first (these will trigger index usage on server)
    if (filters.scorerId) {
      queryFilters.push({ field: 'scorerId', value: filters.scorerId });
    }
    if (filters.entityId) {
      queryFilters.push({ field: 'entityId', value: filters.entityId });
    }
    if (filters.entityType) {
      queryFilters.push({ field: 'entityType', value: filters.entityType });
    }
    if (filters.runId) {
      queryFilters.push({ field: 'runId', value: filters.runId });
    }

    // Query with filters (server will use appropriate index)
    let rows = await this.#db.queryTable<StoredScore>(
      TABLE_SCORERS,
      queryFilters.length > 0 ? queryFilters : undefined,
    );

    // Apply any remaining filters that aren't handled by indexes (e.g., source)
    if (filters.source) {
      rows = rows.filter(row => row.source === filters.source);
    }

    // Sort by createdAt descending
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const { perPage, page } = pagination;
    const perPageValue = perPage === false ? rows.length : perPage;
    const start = perPage === false ? 0 : page * perPageValue;
    const end = perPage === false ? rows.length : start + perPageValue;
    const slice = rows.slice(start, end).map(row => this.deserialize(row));

    return {
      pagination: {
        total: rows.length,
        page,
        perPage,
        hasMore: perPage === false ? false : end < rows.length,
      },
      scores: slice,
    };
  }

  private deserialize(row: StoredScore): ScoreRowData {
    return {
      ...(row as unknown as ScoreRowData),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
