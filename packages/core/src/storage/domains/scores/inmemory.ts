import type { ScoreRowData, ScoringSource } from '../../../evals/types';
import { calculatePagination, normalizePerPage } from '../../base';
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

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? scores.length : start + perPage;

    return {
      scores: scores.slice(start, end),
      pagination: {
        total: scores.length,
        page: page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : scores.length > end,
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

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER); // false → MAX_SAFE_INTEGER
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? scores.length : start + perPage;

    return {
      scores: scores.slice(start, end),
      pagination: {
        total: scores.length,
        page: page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : scores.length > end,
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

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? scores.length : start + perPage;

    return {
      scores: scores.slice(start, end),
      pagination: {
        total: scores.length,
        page: page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : scores.length > end,
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

    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? scores.length : start + perPage;

    return {
      scores: scores.slice(start, end),
      pagination: {
        total: scores.length,
        page: page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : scores.length > end,
      },
    };
  }
}
