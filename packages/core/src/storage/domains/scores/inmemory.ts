import type { ScoreRowData, ScoringSource } from '../../../evals/types';
import type { PaginationInfo, StoragePagination } from '../../types';
import { ScoresStorage } from './base';

export type InMemoryScores = Map<string, ScoreRowData>;

export class ScoresInMemory extends ScoresStorage {
  scores: InMemoryScores;

  constructor({ collection }: { collection: InMemoryScores }) {
    super();
    this.scores = collection;
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.scores.get(id) ?? null;
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    const newScore = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...score };
    this.scores.set(newScore.id, newScore);
    return { score: newScore };
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
    entityType?: string;
    source?: ScoringSource;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const scores = Array.from(this.scores.values()).filter(score => {
      let baseFilter = score.scorerId === scorerId;

      if (entityId) {
        baseFilter = baseFilter && score.entityId === entityId;
      }

      if (entityType) {
        baseFilter = baseFilter && score.entityType === entityType;
      }

      if (source) {
        baseFilter = baseFilter && score.source === source;
      }

      return baseFilter;
    });

    return {
      scores: scores.slice(pagination.page * pagination.perPage, (pagination.page + 1) * pagination.perPage),
      pagination: {
        total: scores.length,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: scores.length > (pagination.page + 1) * pagination.perPage,
      },
    };
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const scores = Array.from(this.scores.values()).filter(score => score.runId === runId);
    return {
      scores: scores.slice(pagination.page * pagination.perPage, (pagination.page + 1) * pagination.perPage),
      pagination: {
        total: scores.length,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: scores.length > (pagination.page + 1) * pagination.perPage,
      },
    };
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const scores = Array.from(this.scores.values()).filter(score => {
      const baseFilter = score.entityId === entityId && score.entityType === entityType;

      return baseFilter;
    });

    return {
      scores: scores.slice(pagination.page * pagination.perPage, (pagination.page + 1) * pagination.perPage),
      pagination: {
        total: scores.length,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: scores.length > (pagination.page + 1) * pagination.perPage,
      },
    };
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    const scores = Array.from(this.scores.values()).filter(
      score => score.traceId === traceId && score.spanId === spanId,
    );
    scores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      scores: scores.slice(pagination.page * pagination.perPage, (pagination.page + 1) * pagination.perPage),
      pagination: {
        total: scores.length,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: scores.length > (pagination.page + 1) * pagination.perPage,
      },
    };
  }
}
