import { MastraError } from '../../error/index.js';
import { ScorerRunError } from '../../evals/base';
import type { MastraScorer, ScorerStepName } from '../../evals/base';
import { flushBeforeTraceRead } from '../../evals/flush-before-trace-read';
import type { NotScorableOutcome } from '../../evals/not-scorable';
import { extractTrajectory, extractTrajectoryFromTrace, extractWorkflowTrajectory } from '../../evals/types';
import type {
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
  Trajectory,
  TrajectoryExpectation,
} from '../../evals/types';
import type { Mastra } from '../../mastra';
import { validateAndSaveScore } from '../../mastra/hooks';
import { EntityType } from '../../observability';
import type { CorrelationContext } from '../../observability';
import type { MastraCompositeStore } from '../../storage/base';
import type { TargetType } from '../../storage/types';
import type { StepResult } from '../../workflows';
import type { ExperimentConfig, ScorerResult } from './types';

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

function getItemScorerById(mastra: Mastra, scorerId: string): MastraScorer<any, any, any, any> | null {
  try {
    return mastra.getScorerById(scorerId) ?? null;
  } catch {
    return null;
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

export const EXPERIMENT_ITEM_SCORER_NOT_FOUND = 'EXPERIMENT_ITEM_SCORER_NOT_FOUND';
export const EXPERIMENT_SCORER_NOT_FOUND = 'EXPERIMENT_SCORER_NOT_FOUND';

type ResolvedScorer = MastraScorer<any, any, any, any>;

export interface ScorerResolution {
  /** Resolved scorers in input order, deduplicated by id. */
  scorers: ResolvedScorer[];
  missingIds: string[];
}

export type ScorerResolver = (scorers: (ResolvedScorer | string)[]) => Promise<ScorerResolution>;

/**
 * Create a run-scoped scorer resolver. Instances pass through; string ids are
 * looked up in Mastra's registry, then loaded as stored scorers through the
 * editor (which registers them). Resolutions, including misses, are cached so
 * concurrent items hydrate a stored scorer at most once per run.
 *
 * Only a scorer that doesn't exist is reported in `missingIds`. A failed lookup
 * (for example, storage being unavailable) rejects with its own error and isn't
 * cached, so it isn't mistaken for a bad scorer ID.
 */
export function createScorerResolver(mastra: Mastra): ScorerResolver {
  const resolutionCache = new Map<string, Promise<ResolvedScorer | null>>();

  const resolveById = (scorerId: string): Promise<ResolvedScorer | null> => {
    const cached = resolutionCache.get(scorerId);
    if (cached) return cached;

    const resolution = (async () => {
      let scorer = getItemScorerById(mastra, scorerId);
      if (scorer) return scorer;

      const editor = mastra.getEditor?.();
      if (editor) {
        await editor.scorer.getById(scorerId);
        scorer = getItemScorerById(mastra, scorerId);
      }

      return scorer;
    })();

    resolutionCache.set(scorerId, resolution);
    resolution.catch(() => resolutionCache.delete(scorerId));
    return resolution;
  };

  return async entries => {
    const seen = new Set<string>();
    const unique = entries.filter(entry => {
      if (typeof entry !== 'string') return true;
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
    const resolved = await Promise.all(
      unique.map(async entry =>
        typeof entry === 'string' ? { id: entry, scorer: await resolveById(entry) } : { id: entry.id, scorer: entry },
      ),
    );

    return {
      scorers: resolved.flatMap(({ scorer }) => (scorer ? [scorer] : [])),
      missingIds: resolved.flatMap(({ id, scorer }) => (scorer ? [] : [id])),
    };
  };
}

/**
 * The item error for scorer ids that can't be resolved during a run (e.g. a
 * stored scorer deleted after the experiment started). `null` when none are missing.
 */
export function itemScorerNotFoundError(
  source: 'Experiment' | 'Item' | 'Dataset',
  missingIds: string[],
): { code: string; message: string } | null {
  if (missingIds.length === 0) return null;
  return {
    code: EXPERIMENT_ITEM_SCORER_NOT_FOUND,
    message: `${source} scorer configuration references unregistered scorer IDs: ${missingIds.join(', ')}`,
  };
}

export function experimentScorerNotFoundError(missingIds: string[]): MastraError {
  return new MastraError({
    id: EXPERIMENT_SCORER_NOT_FOUND,
    text: `Experiment scorers not found: ${missingIds.join(', ')}`,
    domain: 'STORAGE',
    category: 'USER',
  });
}

/** Split a run-level scorer config (flat array or categorized) into flat scorers and step scorers. */
export function flattenScorerConfig(scorers: ExperimentConfig['scorers']): {
  flat: (ResolvedScorer | string)[];
  steps?: Record<string, (ResolvedScorer | string)[]>;
} {
  if (scorers === undefined) return { flat: [] };
  if (Array.isArray(scorers)) return { flat: scorers };
  return {
    flat: [
      ...(('agent' in scorers && scorers.agent) || []),
      ...(('workflow' in scorers && scorers.workflow) || []),
      ...(('trajectory' in scorers && scorers.trajectory) || []),
    ],
    steps: ('steps' in scorers && scorers.steps) || undefined,
  };
}

/**
 * Throw {@link EXPERIMENT_SCORER_NOT_FOUND} when any run-level scorer id can't
 * be resolved, so a typo or deleted stored scorer fails before an experiment is created.
 */
export async function assertExperimentScorersExist(
  mastra: Mastra,
  scorers: ExperimentConfig['scorers'],
): Promise<void> {
  const { flat, steps } = flattenScorerConfig(scorers);
  const ids = [...flat, ...Object.values(steps ?? {}).flat()].filter(
    (scorer): scorer is string => typeof scorer === 'string',
  );
  if (ids.length === 0) return;
  const { missingIds } = await createScorerResolver(mastra)(ids);
  if (missingIds.length > 0) throw experimentScorerNotFoundError(missingIds);
}

/**
 * Attempt to extract a Trajectory from the observability trace store.
 * Falls back to undefined if storage is unavailable or the trace has no spans.
 * Callers flush observability first (see `flushForTrajectoryScorers`).
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
  } catch (error) {
    console.warn(
      `Failed to read trace ${traceId}; trajectory scorers get a flat trajectory from the run output instead:`,
      error,
    );
    return undefined;
  }
}

/** Flush before the trace read, only when a trajectory scorer will read the trace. */
export async function flushForTrajectoryScorers(
  mastra: Mastra,
  scorers: MastraScorer<any, any, any, any>[],
  traceId: string | null | undefined,
): Promise<void> {
  if (scorers.some(s => s.type === 'trajectory')) await flushBeforeTraceRead(mastra, traceId);
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
 *
 * `persistScores: false` suppresses score writes while leaving `storage` usable
 * for reads. The two are deliberately separate parameters: `storage` is also the
 * source for trajectory extraction, so nulling it to stop writes would silently
 * downgrade trajectory scorers to the raw-message fallback.
 */
/**
 * Deterministic score id for experiment score rows. Retried executions of the
 * same (experiment, item, attempt, scorer) produce the same id, so the scores
 * store upserts (latest wins) instead of accumulating duplicate rows.
 */
export function experimentScoreId(experimentId: string, itemId: string, attempt: number, scorerId: string): string {
  return `${experimentScoreKey(experimentId, itemId, attempt)}:${scorerId}`;
}

/** Prefix shared by all scores of one (experiment, item, attempt) execution. */
export function experimentScoreKey(experimentId: string, itemId: string, attempt: number): string {
  return `expscore:${experimentId}:${itemId}:${attempt}`;
}

export async function runScorersForItem(
  scorers: MastraScorer<any, any, any, any>[],
  item: {
    input: unknown;
    groundTruth?: unknown;
    expectedTrajectory?: TrajectoryExpectation;
    metadata?: Record<string, unknown>;
  },
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
  persistScores: boolean = true,
  stableScoreKey?: string,
): Promise<ScorerResult[]> {
  if (scorers.length === 0) return [];

  // Pre-extract trajectory once for all trajectory scorers in this batch.
  // Try the trace store first (requires observability storage + traceId), then
  // fall back to the agent's raw MastraDBMessage[] scoring output or the workflow's step results.
  const hasTrajectoryScorer = scorers.some(s => s.type === 'trajectory');
  let trajectoryOutput: Trajectory | undefined;
  if (hasTrajectoryScorer) {
    const traceTrajectory = await extractTrajectoryFromStorage(storage, traceId);
    trajectoryOutput =
      traceTrajectory ??
      (scorerOutput
        ? extractTrajectory(scorerOutput)
        : workflowData?.stepResults
          ? extractWorkflowTrajectory(workflowData.stepResults, workflowData.stepExecutionPath)
          : { steps: [] });
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
        persistScores,
      );

      // Persist only scores from successful scorer runs.
      if (persistScores && storage && result.error === null && result.score !== null) {
        try {
          // Legacy score-store emission. This path is being deprecated.
          await validateAndSaveScore(storage, {
            ...(stableScoreKey ? { id: `${stableScoreKey}:${scorer.id}` } : {}),
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

function extractScorerRunFields(scoreResult: unknown): {
  score: number | null;
  reason: string | null;
  notScorable?: NotScorableOutcome;
  promptMetadata: ScorerPromptMetadata;
} {
  if (typeof scoreResult !== 'object' || scoreResult === null) {
    return { score: null, reason: null, promptMetadata: {} };
  }

  const fields = scoreResult as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof fields[key] === 'string' ? (fields[key] as string) : undefined;
  const obj = (key: string): Record<string, unknown> | undefined => {
    const value = fields[key];
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
  };

  const notScorable = obj('notScorable');

  return {
    score: typeof fields.score === 'number' ? fields.score : null,
    reason: typeof fields.reason === 'string' ? fields.reason : null,
    // `step` is always one of the scorer's own step names; see MastraScorer.
    ...(notScorable && typeof notScorable.step === 'string'
      ? {
          notScorable: {
            step: notScorable.step as ScorerStepName,
            ...(typeof notScorable.reason === 'string' ? { reason: notScorable.reason } : {}),
          },
        }
      : {}),
    promptMetadata: {
      generateScorePrompt: str('generateScorePrompt'),
      generateReasonPrompt: str('generateReasonPrompt'),
      preprocessStepResult: obj('preprocessStepResult'),
      preprocessPrompt: str('preprocessPrompt'),
      analyzeStepResult: obj('analyzeStepResult'),
      analyzePrompt: str('analyzePrompt'),
    },
  };
}

/**
 * Run a single scorer safely, catching any errors.
 * Returns both the ScorerResult and prompt metadata for DB persistence.
 * When trajectoryOutput is provided the scorer receives it as run.output,
 * honoring the type: 'trajectory' contract.
 */
async function runScorerSafe(
  scorer: MastraScorer<any, any, any, any>,
  item: {
    input: unknown;
    groundTruth?: unknown;
    expectedTrajectory?: TrajectoryExpectation;
    metadata?: Record<string, unknown>;
  },
  output: unknown,
  scorerInput?: ScorerRunInputForAgent,
  scorerOutput?: ScorerRunOutputForAgent,
  targetType?: TargetType,
  targetTraceId?: string,
  targetCorrelationContext?: CorrelationContext,
  trajectoryOutput?: Trajectory,
  workflowData?: WorkflowScorerData,
  persistScores: boolean = true,
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
      expectedTrajectory: item.expectedTrajectory,
      scoreSource: 'experiment',
      targetScope: effectiveScope,
      targetEntityType: toScorerTargetEntityType(targetType),
      targetTraceId,
      ...(workflowData?.spanId ? { targetSpanId: workflowData.spanId } : {}),
      ...(targetCorrelationContext ? { targetCorrelationContext } : {}),
      ...(targetMetadata ? { targetMetadata } : {}),
      _internal: { emitObservabilityScore: persistScores },
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

    const { score, reason, notScorable, promptMetadata } = extractScorerRunFields(scoreResult);

    return {
      result: {
        scorerId: scorer.id,
        scorerName: scorer.name,
        score,
        reason,
        error: null,
        ...(notScorable ? { notScorable } : {}),
        targetScope: effectiveScope,
      },
      promptMetadata,
    };
  } catch (error) {
    if (error instanceof ScorerRunError) {
      const { score, reason, promptMetadata } = extractScorerRunFields(error.result);
      return {
        result: {
          scorerId: scorer.id,
          scorerName: scorer.name,
          score,
          reason,
          error: error.message,
          failedStep: error.failedStep,
          completedSteps: error.completedSteps,
          targetScope: trajectoryOutput ? 'trajectory' : 'span',
        },
        promptMetadata,
      };
    }

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
  item: {
    input: unknown;
    groundTruth?: unknown;
    expectedTrajectory?: TrajectoryExpectation;
    metadata?: Record<string, unknown>;
  },
  workflowData: WorkflowScorerData | undefined,
  storage: MastraCompositeStore | null,
  runId: string,
  targetType: TargetType,
  targetId: string,
  itemId: string,
  traceId?: string,
  persistScores: boolean = true,
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
            expectedTrajectory: item.expectedTrajectory,
            scoreSource: 'experiment',
            targetScope: 'span',
            targetEntityType: EntityType.WORKFLOW_STEP,
            targetTraceId: traceId,
            ...(targetCorrelationContext ? { targetCorrelationContext } : {}),
            _internal: { emitObservabilityScore: persistScores },
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
          const { score, reason, notScorable } = extractScorerRunFields(scoreResult);

          // Persist score (best-effort, mirrors runScorersForItem)
          if (persistScores && storage && score !== null) {
            try {
              await validateAndSaveScore(storage, {
                scorerId: scorer.id,
                score,
                reason: reason ?? undefined,
                input: stepInput,
                output: stepOutput,
                additionalContext: { ...item.metadata, stepId },
                entityType: 'STEP',
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
            ...(notScorable ? { notScorable } : {}),
            targetScope: 'span' as const,
            stepId,
          };
        } catch (error) {
          if (error instanceof ScorerRunError) {
            const { score, reason } = extractScorerRunFields(error.result);
            return {
              scorerId: scorer.id,
              scorerName: scorer.name,
              score,
              reason,
              error: error.message,
              failedStep: error.failedStep,
              completedSteps: error.completedSteps,
              targetScope: 'span' as const,
              stepId,
            };
          }

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
