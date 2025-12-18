import crypto from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringEntityType, ScoringSource } from '@mastra/core/evals';
import { TABLE_SCORERS, ScoresStorage, createStorageErrorId } from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';

import type { ConvexAdminClient } from '../client';
import { ConvexDB } from '../db';

type StoredScore = Omit<ScoreRowData, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export class ScoresConvex extends ScoresStorage {
  #db: ConvexDB;
  constructor(client: ConvexAdminClient) {
    super();
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
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

    const rows = await this.#db.queryTable<StoredScore>(TABLE_SCORERS, undefined);
    const filtered = rows
      .filter(row => (filters.scorerId ? row.scorerId === filters.scorerId : true))
      .filter(row => (filters.entityId ? row.entityId === filters.entityId : true))
      .filter(row => (filters.entityType ? row.entityType === filters.entityType : true))
      .filter(row => (filters.runId ? row.runId === filters.runId : true))
      .filter(row => (filters.source ? row.source === filters.source : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const { perPage, page } = pagination;
    const perPageValue = perPage === false ? filtered.length : perPage;
    const start = perPage === false ? 0 : page * perPageValue;
    const end = perPage === false ? filtered.length : start + perPageValue;
    const slice = filtered.slice(start, end).map(row => this.deserialize(row));

    return {
      pagination: {
        total: filtered.length,
        page,
        perPage,
        hasMore: perPage === false ? false : end < filtered.length,
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
