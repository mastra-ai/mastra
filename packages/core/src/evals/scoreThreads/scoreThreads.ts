import type { MastraDBMessage } from '../../agent';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Mastra } from '../../mastra';
import type { MastraStorage } from '../../storage';
import { pMap } from '../../utils/p-map';
import type { MastraScorer } from '../base';
import type { ScoreRowData, ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../types';
import { saveScorePayloadSchema } from '../types';

export type ScoreThreadTarget = { threadId: string; resourceId?: string };

export type ScoreThreadBatchResult =
  | { ok: true; index: number; threadId: string; score: ScoreRowData }
  | { ok: false; index: number; threadId: string; error: Error };

/**
 * Materialize a Memory thread's full message history into agent-scorer
 * input/output. User messages become the input; assistant messages become the
 * output — the whole conversation is scored as one unit.
 */
function buildThreadScorerRun(messages: MastraDBMessage[]): {
  input: ScorerRunInputForAgent;
  output: ScorerRunOutputForAgent;
} {
  return {
    input: {
      inputMessages: messages.filter(message => message.role === 'user'),
      rememberedMessages: [],
      systemMessages: [],
      taggedSystemMessages: {},
    },
    output: messages.filter(message => message.role === 'assistant'),
  };
}

/**
 * Run a scorer over an entire Memory thread and persist the score with
 * `threadId` set. Re-scoring the same thread creates a new score record.
 */
export async function scoreThread({
  storage,
  scorer,
  target,
}: {
  storage: MastraStorage;
  scorer: MastraScorer;
  target: ScoreThreadTarget;
}): Promise<ScoreRowData> {
  const memoryStore = await storage.getStore('memory');
  if (!memoryStore) {
    throw new MastraError({
      id: 'MASTRA_MEMORY_STORAGE_NOT_AVAILABLE_FOR_THREAD_SCORING',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Memory storage domain is not available for thread scoring',
    });
  }

  const thread = await memoryStore.getThreadById({ threadId: target.threadId });
  if (!thread) {
    throw new Error(`Thread not found for scoring, threadId: ${target.threadId}`);
  }

  const { messages } = await memoryStore.listMessages({
    threadId: target.threadId,
    ...(target.resourceId ? { resourceId: target.resourceId } : {}),
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });

  if (messages.length === 0) {
    throw new Error(`Thread has no messages to score, threadId: ${target.threadId}`);
  }

  const { input, output } = buildThreadScorerRun(messages);

  const result = await scorer.run({
    input,
    output,
    scoreSource: 'trace',
    targetScope: 'thread',
  });

  const scorerResult = {
    ...result,
    scorer: {
      id: scorer.id,
      name: scorer.name || scorer.id,
      description: scorer.description,
      hasJudge: !!scorer.judge,
    },
    threadId: thread.id,
    resourceId: thread.resourceId,
    entityId: thread.id,
    entityType: 'THREAD',
    entity: { threadId: thread.id, resourceId: thread.resourceId },
    source: 'TEST',
    scorerId: scorer.id,
  };

  const scoresStore = await storage.getStore('scores');
  if (!scoresStore) {
    throw new MastraError({
      id: 'MASTRA_SCORES_STORAGE_NOT_AVAILABLE',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Scores storage domain is not available',
    });
  }

  const payloadToSave = saveScorePayloadSchema.parse(scorerResult);
  const saved = await scoresStore.saveScore(payloadToSave);
  return saved.score;
}

function toBatchResultError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'Unknown scoreThreads error');
}

/**
 * Score a batch of Memory threads with a scorer (fire-and-forget friendly).
 * Per-thread failures are captured in the result list; they never abort the
 * batch.
 */
export async function scoreThreads({
  scorerId,
  targets,
  mastra,
  concurrency = 3,
}: {
  scorerId: string;
  targets: ScoreThreadTarget[];
  mastra: Mastra;
  concurrency?: number;
}): Promise<{ scoredCount: number; failedCount: number; results: ScoreThreadBatchResult[] }> {
  const logger = mastra.getLogger();

  const storage = mastra.getStorage();
  if (!storage) {
    throw new MastraError({
      id: 'MASTRA_STORAGE_NOT_FOUND_FOR_THREAD_SCORING',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: 'Storage not found for thread scoring',
      details: { scorerId },
    });
  }

  const scorer = mastra.getScorerById(scorerId);

  const results = await pMap(
    targets,
    async (target, index): Promise<ScoreThreadBatchResult> => {
      try {
        const score = await scoreThread({ storage, scorer, target });
        return { ok: true, index, threadId: target.threadId, score };
      } catch (error) {
        const mastraError = new MastraError(
          {
            id: 'MASTRA_SCORER_FAILED_TO_RUN_SCORER_ON_THREAD',
            domain: ErrorDomain.SCORER,
            category: ErrorCategory.SYSTEM,
            details: { scorerId, threadId: target.threadId },
          },
          error,
        );
        logger?.trackException(mastraError);
        return { ok: false, index, threadId: target.threadId, error: toBatchResultError(error) };
      }
    },
    { concurrency },
  );

  const scoredCount = results.filter(result => result.ok).length;
  return { scoredCount, failedCount: results.length - scoredCount, results };
}
