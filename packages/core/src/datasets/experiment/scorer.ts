import type { MastraScorer } from '../../evals/base';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../../evals/types';
import type { Mastra } from '../../mastra';
import { validateAndSaveScore } from '../../mastra/hooks';
import { EntityType } from '../../observability';
import type { CorrelationContext } from '../../observability';
import type { MastraCompositeStore } from '../../storage/base';
import type { TargetType } from '../../storage/types';
import type { ScorerResult } from './types';

function toScorerTargetEntityType(targetType?: TargetType): EntityType | undefined {
  switch (targetType) {
    case 'agent':
      return EntityType.AGENT;
    case 'workflow':
      return EntityType.WORKFLOW_RUN;
    case 'scorer':
      return EntityType.SCORER;
    default:
      return undefined;
  }
}

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

  // Build correlation context so scorers can emit scores with full experiment context
  const targetCorrelationContext: CorrelationContext = {
    ...(traceId ? { traceId } : {}),
    entityType: toScorerTargetEntityType(targetType),
    entityId: targetId,
    entityName: targetId,
    experimentId: runId,
  };

  const settled = await Promise.allSettled(
    scorers.map(async scorer => {
      const { result, promptMetadata } = await runScorerSafe(
        scorer,
        item,
        output,
        scorerInput,
        scorerOutput,
        targetType,
        traceId,
        targetCorrelationContext,
      );

      // Persist score if storage available and score was computed
      if (storage && result.score !== null) {
        try {
          // Legacy score-store emission. This path is being deprecated.
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
            ...promptMetadata,
          });
        } catch (saveError) {
          // TODO: Remove this warning path once the old scores storage is deprecated.
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

/** Prompt/step metadata returned by scorer.run() for DB persistence. */
interface ScorerPromptMetadata {
  generateScorePrompt?: string;
  generateReasonPrompt?: string;
  preprocessStepResult?: Record<string, unknown>;
  preprocessPrompt?: string;
  analyzeStepResult?: Record<string, unknown>;
  analyzePrompt?: string;
}

/**
 * Run a single scorer safely, catching any errors.
 * Returns both the ScorerResult and prompt metadata for DB persistence.
 */
async function runScorerSafe(
  scorer: MastraScorer<any, any, any, any>,
  item: { input: unknown; groundTruth?: unknown; metadata?: Record<string, unknown> },
  output: unknown,
  scorerInput?: ScorerRunInputForAgent,
  scorerOutput?: ScorerRunOutputForAgent,
  targetType?: TargetType,
  targetTraceId?: string,
  targetCorrelationContext?: CorrelationContext,
): Promise<{ result: ScorerResult; promptMetadata: ScorerPromptMetadata }> {
  try {
    const scoreResult: unknown = await scorer.run({
      input: scorerInput ?? item.input,
      output: scorerOutput ?? output,
      groundTruth: item.groundTruth,
      scoreSource: 'experiment',
      targetScope: 'span',
      targetEntityType: toScorerTargetEntityType(targetType),
      targetTraceId,
      ...(targetCorrelationContext ? { targetCorrelationContext } : {}),
    });

    // Extract fields with typeof guards — scorer run result types use complex
    // conditional generics that don't resolve cleanly with MastraScorer<any,…>.
    if (typeof scoreResult !== 'object' || scoreResult === null) {
      return {
        result: {
          scorerId: scorer.id,
          scorerName: scorer.name,
          score: null,
          reason: null,
          error: `Scorer ${scorer.name} (${scorer.id}) returned invalid result: expected object, got ${scoreResult === null ? 'null' : typeof scoreResult} (${String(scoreResult)})`,
        },
        promptMetadata: {},
      };
    }

    const fields = scoreResult as Record<string, unknown>;
    const score = typeof fields.score === 'number' ? fields.score : null;
    const reason = typeof fields.reason === 'string' ? fields.reason : null;

    const str = (key: string): string | undefined =>
      typeof fields[key] === 'string' ? (fields[key] as string) : undefined;
    const obj = (key: string): Record<string, unknown> | undefined => {
      const val = fields[key];
      return typeof val === 'object' && val !== null ? (val as Record<string, unknown>) : undefined;
    };

    return {
      result: {
        scorerId: scorer.id,
        scorerName: scorer.name,
        score,
        reason,
        error: null,
      },
      promptMetadata: {
        generateScorePrompt: str('generateScorePrompt'),
        generateReasonPrompt: str('generateReasonPrompt'),
        preprocessStepResult: obj('preprocessStepResult'),
        preprocessPrompt: str('preprocessPrompt'),
        analyzeStepResult: obj('analyzeStepResult'),
        analyzePrompt: str('analyzePrompt'),
      },
    };
  } catch (error) {
    return {
      result: {
        scorerId: scorer.id,
        scorerName: scorer.name,
        score: null,
        reason: null,
        error: error instanceof Error ? error.message : String(error),
      },
      promptMetadata: {},
    };
  }
}
