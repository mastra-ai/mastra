import type { ListScoresResponse, SaveScorePayload, ScoreRowData } from '@mastra/core/evals';
import { ScoresStorage } from '@mastra/core/storage';
import type { StoragePagination } from '@mastra/core/storage';

/**
 * A scores domain that accepts writes and keeps nothing.
 *
 * mastracode's `outcome` and `efficiency` scorers persist every result through
 * the scores domain (`validateAndSaveScore` → `getStore('scores')`), but nothing
 * in mastracode reads scores back. Writing them to libsql grew mastra.db without
 * bound, and an in-memory store would grow the heap for the life of the process
 * instead (each payload carries the system prompt, messages, input and output).
 * Disabling the domain is not an option: core throws
 * MASTRA_SCORES_STORAGE_NOT_AVAILABLE on every scorer run when it is missing.
 */
export class DiscardingScoresStorage extends ScoresStorage {
  async getScoreById(): Promise<ScoreRowData | null> {
    return null;
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    const now = new Date();
    return { score: { ...score, id: score.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now } as ScoreRowData };
  }

  async listScoresByScorerId({ pagination }: { pagination: StoragePagination }): Promise<ListScoresResponse> {
    return empty(pagination);
  }

  async listScoresByRunId({ pagination }: { pagination: StoragePagination }): Promise<ListScoresResponse> {
    return empty(pagination);
  }

  async listScoresByEntityId({ pagination }: { pagination: StoragePagination }): Promise<ListScoresResponse> {
    return empty(pagination);
  }

  async listScoresBySpan({ pagination }: { pagination: StoragePagination }): Promise<ListScoresResponse> {
    return empty(pagination);
  }
}

function empty(pagination: StoragePagination): ListScoresResponse {
  return { pagination: { total: 0, page: pagination.page, perPage: pagination.perPage, hasMore: false }, scores: [] };
}
