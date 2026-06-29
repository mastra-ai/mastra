import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '../../../evals/types';
import type { StoragePagination } from '../../types';
import { StorageDomain } from '../base';

/** Multi-tenant scope filters for score queries. */
export interface ScoreTenancyFilters {
  organizationId?: string;
  projectId?: string;
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

  abstract listScoresByScorerId({
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
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse>;

  abstract listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse>;

  abstract listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse>;

  async listScoresBySpan({
    traceId,
    spanId,
    pagination: _pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    throw new MastraError({
      id: 'SCORES_STORAGE_GET_SCORES_BY_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: { traceId, spanId },
    });
  }

  /**
   * List all scores sharing a `batchId` (a batch handle stamped across every
   * per-trace score produced by one batch scoring call). Tenant-scoped via
   * `filters`. Adapters that have not implemented this throw by default.
   */
  async listScoresByBatchId({
    batchId,
    pagination: _pagination,
  }: {
    batchId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    throw new MastraError({
      id: 'SCORES_STORAGE_GET_SCORES_BY_BATCH_ID_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: { batchId },
    });
  }

  /**
   * List all scores produced against a curated dataset (`datasetId`), so baseline
   * scores can join back to their dataset items. Tenant-scoped via `filters`.
   * Adapters that have not implemented this throw by default.
   */
  async listScoresByDatasetId({
    datasetId,
    pagination: _pagination,
  }: {
    datasetId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    throw new MastraError({
      id: 'SCORES_STORAGE_GET_SCORES_BY_DATASET_ID_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: { datasetId },
    });
  }
}
