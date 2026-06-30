import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '../../../evals/types';
import { calculatePagination, normalizePerPage } from '../../base';
import type { StoragePagination } from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type { ScoreTenancyFilters } from './base';
import { ScoresStorage } from './base';

function matchesTenancy(score: ScoreRowData, filters?: ScoreTenancyFilters): boolean {
  if (!filters) return true;
  if (filters.organizationId !== undefined && score.organizationId !== filters.organizationId) return false;
  if (filters.projectId !== undefined && score.projectId !== filters.projectId) return false;
  return true;
}

export class ScoresInMemory extends ScoresStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.scores.clear();
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.db.scores.get(id) ?? null;
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    const newScore = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...score };
    this.db.scores.set(newScore.id, newScore);
    return { score: newScore };
  }

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
    filters,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    const scores = Array.from(this.db.scores.values()).filter(score => {
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

      return baseFilter && matchesTenancy(score, filters);
    });

    // Match the pg/libsql adapters (and the sibling listScoresBySpan), which
    // return scores newest-first.
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

  async listScoresByRunId({
    runId,
    pagination,
    filters,
  }: {
    runId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    const scores = Array.from(this.db.scores.values()).filter(
      score => score.runId === runId && matchesTenancy(score, filters),
    );

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

  async listScoresByBatchId({
    batchId,
    pagination,
    filters,
  }: {
    batchId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    const scores = Array.from(this.db.scores.values()).filter(
      score => score.batchId === batchId && matchesTenancy(score, filters),
    );

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

  async listScoresByDatasetId({
    datasetId,
    pagination,
    filters,
  }: {
    datasetId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    const scores = Array.from(this.db.scores.values()).filter(
      score => score.datasetId === datasetId && matchesTenancy(score, filters),
    );

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

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
    filters,
  }: {
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    const scores = Array.from(this.db.scores.values()).filter(score => {
      const baseFilter = score.entityId === entityId && score.entityType === entityType;

      return baseFilter && matchesTenancy(score, filters);
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
    filters,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    const scores = Array.from(this.db.scores.values()).filter(
      score => score.traceId === traceId && score.spanId === spanId && matchesTenancy(score, filters),
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
