import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData } from '../../../evals/types';
import type {
  ListScoresByEntityIdInput,
  ListScoresByRunIdInput,
  ListScoresByScorerIdInput,
  ListScoresBySpanInput,
  ScoreTenancyFilters,
} from '../../types';
import { StorageDomain } from '../base';

export type { ScoreTenancyFilters };

/**
 * A record of a live-scoring sampling decision. Written for both sampled and
 * declined outcomes so scoring coverage has a computable denominator.
 */
export interface SaveScoringDecisionPayload {
  id?: string;
  scorerId: string;
  decision: 'sampled' | 'declined';
  samplingType?: string;
  samplingRate?: number;
  traceId?: string;
  spanId?: string;
  entityId?: string;
  entityType?: string;
  source?: string;
  resourceId?: string;
  threadId?: string;
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

  /**
   * Record a live-scoring sampling decision (sampled or declined).
   * Default no-op — adapters opt in by overriding.
   */
  async saveScoringDecision(_decision: SaveScoringDecisionPayload): Promise<void> {
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
}
