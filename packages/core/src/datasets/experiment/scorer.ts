import type { MastraScorer } from '../../evals/base';
import { extractTrajectory, extractTrajectoryFromTrace } from '../../evals/types';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent, Trajectory } from '../../evals/types';
import type { Mastra } from '../../mastra';
import { validateAndSaveScore } from '../../mastra/hooks';
import { EntityType } from '../../observability';
import type { CorrelationContext } from '../../observability';
import type { MastraCompositeStore } from '../../storage/base';
import type { TargetType } from '../../storage/types';
import type { StepResult } from '../../workflows';
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
 * Attempt to extract a Trajectory from the observability trace store.
 * Falls back to undefined if storage is unavailable or the trace has no spans.
 */
async function extractTrajectoryFromStorage(
  storage: MastraCompositeStore | null,
  traceId?: string,
): Promise<Trajectory | undefined> {
  if (!storage || !traceId) return undefined;
  try {
    const observabilityStore = await storage.getStore('observability');
    if (!observabilityStore) return undefined;
    const trace = await observabilityStore.getTrace({ traceId });
    if (!trace?.spans?.length) return undefined;
    return extractTrajectoryFromTrace(trace.spans);
  } catch {
    return undefined;
  }
}

/**
 * Workflow-specific data forwarded to scorers so they can inspect step-level
 * input/output and the executed step path. Surfaced via `targetMetadata` on
 * the scorer run so existing scorer signatures stay unchanged.
 */
export interface WorkflowScorerData {
  stepResults?: Record<string, StepResult<any, any, any, any>>;
  stepExecutionPath?: string[];
  spanId?: string | null;
}

/**
 * Run all scorers for a single item result.
 * Errors are isolated per scorer - one failing scorer doesn't affect others.
 * Trajectory scorers (scorer.type === 'trajectory') receive a pre-extracted
 * Trajectory as their output, mirroring the dispatch runEvals performs.
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
  workflowData?: WorkflowScorerData,
): Promise<ScorerResult[]> {
  if (scorers.length === 0) return [];

  // Pre-extract trajectory once for all trajectory scorers in this batch.
  // Try the trace store first (requires observability storage + traceId), then
  // fall back to extracting from the raw MastraDBMessage[] scoring output.
  const hasTrajectoryScorer = scorers.some(s => s.type === 'trajectory');
  let trajectoryOutput: Trajectory | undefined;
  if (hasTrajectoryScorer) {
    const traceTrajectory = await extractTrajectoryFromStorage(storage, traceId);
    trajectoryOutput = traceTrajectory ?? (scorerOutput ? extractTrajectory(scorerOutput) : { steps: [] });
  }

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
        scorer.type === 'trajectory' ? trajectoryOutput : undefined,
        workflowData,
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

  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const scorer = scorers[i]!;
    return {
      scorerId: scorer.id,
      scorerName: scorer.name,
      score: null,
      reason: null,
      error: String(s.reason),
      targetScope: scorer.type === 'trajectory' ? 'trajectory' : 'span',
    };
  });
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
 * When trajectoryOutput is provided the scorer receives it as run.output,
 * honoring the type: 'trajectory' contract.
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
  trajectoryOutput?: Trajectory,
  workflowData?: WorkflowScorerData,
): Promise<{ result: ScorerResult; promptMetadata: ScorerPromptMetadata }> {
  try {
    const effectiveOutput = trajectoryOutput ?? scorerOutput ?? output;
    const effectiveScope = trajectoryOutput ? 'trajectory' : 'span';

    // Surface step-level data via targetMetadata so workflow scorers can
    // inspect per-step input/output without changing the scorer signature.
    // Trajectory scorers already receive the Trajectory as their output, so
    // the step metadata is only relevant for non-trajectory workflow scorers.
    const targetMetadata: Record<string, unknown> | undefined =
      !trajectoryOutput && workflowData && (workflowData.stepResults || workflowData.stepExecutionPath)
        ? {
            ...(workflowData.stepResults ? { stepResults: workflowData.stepResults } : {}),
            ...(workflowData.stepExecutionPath ? { stepExecutionPath: workflowData.stepExecutionPath } : {}),
          }
        : undefined;

    const scoreResult: unknown = await scorer.run({
      input: scorerInput ?? item.input,
      output: effectiveOutput,
      groundTruth: item.groundTruth,
      scoreSource: 'experiment',
      targetScope: effectiveScope,
      targetEntityType: toScorerTargetEntityType(targetType),
      targetTraceId,
      ...(workflowData?.spanId ? { targetSpanId: workflowData.spanId } : {}),
      ...(targetCorrelationContext ? { targetCorrelationContext } : {}),
      ...(targetMetadata ? { targetMetadata } : {}),
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
        targetScope: effectiveScope,
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
        targetScope: trajectoryOutput ? 'trajectory' : 'span',
      },
      promptMetadata: {},
    };
  }
}

/**
 * Resolve step-scoped scorers from a `Record<stepId, (MastraScorer | string)[]>`.
 * String IDs are looked up from Mastra's scorer registry; missing IDs are skipped
 * with a warning (matching `resolveScorers`).
 */
export function resolveStepScorers(
  mastra: Mastra,
  stepsConfig?: Record<string, (MastraScorer<any, any, any, any> | string)[]>,
): Record<string, MastraScorer<any, any, any, any>[]> {
  if (!stepsConfig) return {};
  const resolved: Record<string, MastraScorer<any, any, any, any>[]> = {};
  for (const [stepId, scorers] of Object.entries(stepsConfig)) {
    const stepScorers = resolveScorers(mastra, scorers);
    if (stepScorers.length > 0) resolved[stepId] = stepScorers;
  }
  return resolved;
}

/**
 * Run step-scoped scorers for a single workflow item. Mirrors the per-step
 * dispatch in `runEvals`: each scorer runs against `stepResult.payload` and
 * `stepResult.output`, with `targetScope: 'span'` and
 * `targetEntityType: WORKFLOW_STEP`. The returned `ScorerResult` carries the
 * originating `stepId` so callers can disambiguate per-step results in the
 * flat `scores` array. Steps whose result is missing or did not succeed
 * surface as an error `ScorerResult` rather than disappearing silently.
 *
 * Errors are isolated per scorer (consistent with `runScorersForItem`); a
 * failing scorer produces a `ScorerResult` with `error` set, not a throw.
 */
export async function runStepScorersForItem(
  stepScorers: Record<string, MastraScorer<any, any, any, any>[]>,
  item: { input: unknown; groundTruth?: unknown; metadata?: Record<string, unknown> },
  workflowData: WorkflowScorerData | undefined,
  storage: MastraCompositeStore | null,
  runId: string,
  targetType: TargetType,
  targetId: string,
  itemId: string,
  traceId?: string,
): Promise<ScorerResult[]> {
  const stepIds = Object.keys(stepScorers);
  if (stepIds.length === 0) return [];

  const results: ScorerResult[] = [];
  const stepResults = workflowData?.stepResults;

  for (const stepId of stepIds) {
    const scorers = stepScorers[stepId]!;
    const stepResult = stepResults?.[stepId];

    // Skip silently when the step didn't run or didn't succeed — matches runEvals.
    // Surface this as an "error" ScorerResult so consumers can see the skip in the
    // flat results array (rather than disappear without a trace).
    if (!stepResult || stepResult.status !== 'success' || stepResult.output === undefined) {
      for (const scorer of scorers) {
        results.push({
          scorerId: scorer.id,
          scorerName: scorer.name,
          score: null,
          reason: null,
          error: `Step "${stepId}" did not produce a successful output (status: ${stepResult?.status ?? 'missing'})`,
          targetScope: 'span',
          stepId,
        });
      }
      continue;
    }

    const stepInput = stepResult.payload !== undefined ? stepResult.payload : item.input;
    const stepOutput = stepResult.output;

    const targetCorrelationContext: CorrelationContext = {
      ...(traceId ? { traceId } : {}),
      entityType: EntityType.WORKFLOW_STEP,
      entityId: stepId,
      entityName: stepId,
      experimentId: runId,
    };

    const settled = await Promise.allSettled(
      scorers.map(async scorer => {
        try {
          const scoreResult: unknown = await scorer.run({
            input: stepInput,
            output: stepOutput,
            groundTruth: item.groundTruth,
            scoreSource: 'experiment',
            targetScope: 'span',
            targetEntityType: EntityType.WORKFLOW_STEP,
            targetTraceId: traceId,
            ...(targetCorrelationContext ? { targetCorrelationContext } : {}),
          });

          if (typeof scoreResult !== 'object' || scoreResult === null) {
            return {
              scorerId: scorer.id,
              scorerName: scorer.name,
              score: null,
              reason: null,
              error: `Scorer ${scorer.name} (${scorer.id}) returned invalid result on step ${stepId}`,
              targetScope: 'span' as const,
              stepId,
            };
          }
          const fields = scoreResult as Record<string, unknown>;
          const score = typeof fields.score === 'number' ? fields.score : null;
          const reason = typeof fields.reason === 'string' ? fields.reason : null;

          // Persist score (best-effort, mirrors runScorersForItem)
          if (storage && score !== null) {
            try {
              await validateAndSaveScore(storage, {
                scorerId: scorer.id,
                score,
                reason: reason ?? undefined,
                input: stepInput,
                output: stepOutput,
                additionalContext: { ...item.metadata, stepId },
                entityType: 'WORKFLOW_STEP',
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
              console.warn(`Failed to save score for step scorer ${scorer.id} on ${stepId}:`, saveError);
            }
          }

          return {
            scorerId: scorer.id,
            scorerName: scorer.name,
            score,
            reason,
            error: null,
            targetScope: 'span' as const,
            stepId,
          };
        } catch (error) {
          return {
            scorerId: scorer.id,
            scorerName: scorer.name,
            score: null,
            reason: null,
            error: error instanceof Error ? error.message : String(error),
            targetScope: 'span' as const,
            stepId,
          };
        }
      }),
    );

    for (let i = 0; i < settled.length; i++) {
      const s = settled[i]!;
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        const scorer = scorers[i]!;
        results.push({
          scorerId: scorer.id,
          scorerName: scorer.name,
          score: null,
          reason: null,
          error: String(s.reason),
          targetScope: 'span',
          stepId,
        });
      }
    }
  }

  // targetType/targetId are intentionally accepted but only used for persistence
  // entity context; the dispatch itself is workflow-step scoped.
  void targetType;
  return results;
}
