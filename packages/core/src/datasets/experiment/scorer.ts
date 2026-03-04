import type { MastraScorer } from '../../evals/base';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../evals/types';
import type { Mastra } from '../../mastra';
import { validateAndSaveScore } from '../../mastra/hooks';
import type { MastraCompositeStore } from '../../storage/base';
import type { TargetType } from '../../storage/types';
import type { ScorerResult } from './types';

/**
 * Resolve scorers from mixed array of instances and string IDs.
 * String IDs are looked up from Mastra's scorer registry.
 */
export function resolveScorers(
  mastra: Mastra,
  scorers?: (MastraScorer<any, any, any, any> | string)[],
): MastraScorer<any, any, any, any>[] {
  if (!scorers || scorers.length === 0) return [];

  return scorers
    .map(scorer => {
      if (typeof scorer === 'string') {
        const resolved = mastra.getScorerById(scorer);
        if (!resolved) {
          console.warn(`Scorer not found: ${scorer}`);
          return null;
        }
        return resolved;
      }
      return scorer;
    })
    .filter((s): s is MastraScorer<any, any, any, any> => s !== null);
}

/**
 * Run all scorers for a single item result.
 * Errors are isolated per scorer - one failing scorer doesn't affect others.
 */
export async function runScorersForItem(
  scorers: MastraScorer<any, any, any, any>[],
  item: { input: unknown; groundTruth?: unknown; metadata?: Record<string, unknown> },
  output: unknown,
  storage: MastraCompositeStore | null,
  runId: string,
  targetType: TargetType,
  targetId: string,
  itemId: string,
  scorerInput?: ScorerRunInputForAgent,
  scorerOutput?: ScorerRunOutputForAgent,
  traceId?: string,
): Promise<ScorerResult[]> {
  if (scorers.length === 0) return [];

  const settled = await Promise.allSettled(
    scorers.map(async scorer => {
      const result = await runScorerSafe(scorer, item, output, scorerInput, scorerOutput);

      // Persist score if storage available and score was computed
      if (storage && result.score !== null) {
        try {
          await validateAndSaveScore(storage, {
            scorerId: scorer.id,
            score: result.score,
            reason: result.reason ?? undefined,
            input: item.input,
            output,
            additionalContext: item.metadata,
            entityType: targetType.toUpperCase(),
            entityId: itemId,
            source: 'TEST',
            runId,
            traceId,
            scorer: {
              id: scorer.id,
              name: scorer.name,
              description: scorer.description ?? '',
              hasJudge: !!scorer.judge,
            },
            entity: {
              id: targetId,
              name: targetId,
            },
          });
        } catch (saveError) {
          // Log but don't fail - score persistence is best-effort
          console.warn(`Failed to save score for scorer ${scorer.id}:`, saveError);
        }
      }

      return result;
    }),
  );

  return settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { scorerId: scorers[i]!.id, scorerName: scorers[i]!.name, score: null, reason: null, error: String(s.reason) },
  );
}

/**
 * Run a single scorer safely, catching any errors.
 */
async function runScorerSafe(
  scorer: MastraScorer<any, any, any, any>,
  item: { input: unknown; groundTruth?: unknown; metadata?: Record<string, unknown> },
  output: unknown,
  scorerInput?: ScorerRunInputForAgent,
  scorerOutput?: ScorerRunOutputForAgent,
): Promise<ScorerResult> {
  try {
    const scoreResult = await scorer.run({
      input: scorerInput ?? item.input,
      output: scorerOutput ?? output,
      groundTruth: item.groundTruth,
    });

    // Extract score and reason with proper null handling
    // Scorer run result types are complex generics, so we cast through any
    const score = (scoreResult as any).score;
    const reason = (scoreResult as any).reason;

    return {
      scorerId: scorer.id,
      scorerName: scorer.name,
      score: typeof score === 'number' ? score : null,
      reason: typeof reason === 'string' ? reason : null,
      error: null,
    };
  } catch (error) {
    return {
      scorerId: scorer.id,
      scorerName: scorer.name,
      score: null,
      reason: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
