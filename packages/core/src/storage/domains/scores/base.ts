import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData } from '../../../evals/types';
import type {
  ListScoresByBatchIdInput,
  ListScoresByDatasetIdInput,
  ListScoresByEntityIdInput,
  ListScoresByRunIdInput,
  ListScoresByScorerIdInput,
  ListScoresBySpanInput,
  ScoreTenancyFilters,
} from '../../types';
import { StorageDomain } from '../base';

export type { ScoreTenancyFilters };

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
   * List all scores sharing a `batchId` (a batch handle stamped across every
   * per-trace score produced by one batch scoring call). Tenant-scoped via
   * `filters`. Adapters that have not implemented this throw by default.
   */
  async listScoresByBatchId({ batchId }: ListScoresByBatchIdInput): Promise<ListScoresResponse> {
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
  async listScoresByDatasetId({ datasetId }: ListScoresByDatasetIdInput): Promise<ListScoresResponse> {
    throw new MastraError({
      id: 'SCORES_STORAGE_GET_SCORES_BY_DATASET_ID_NOT_IMPLEMENTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: { datasetId },
    });
  }
}
