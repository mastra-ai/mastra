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
}
