import { MastraError } from '../../error/index.js';
import type { MastraScorer } from '../../evals/base';
import type { TrajectoryExpectation } from '../../evals/types';
import type { Mastra } from '../../mastra';
import type { Experiment, ExperimentResult } from '../../storage/types';
import { executeTarget } from './executor';
import type { ExecutionResult } from './executor';
import { resolveTarget } from './resolve-target';
import {
  createItemScorerResolver,
  EXPERIMENT_ITEM_SCORER_NOT_FOUND,
  experimentScoreKey,
  resolveScorers,
  runScorersForItem,
} from './scorer';
import type { ScorerResult } from './types';

/** Item shape consumed by {@link executeExperimentItem}. */
export interface ExperimentItemInput {
  id: string;
  datasetVersion: number | null;
  input: unknown;
  groundTruth?: unknown;
  /** Per-item expected trajectory forwarded to trajectory scorers as `run.expectedTrajectory` */
  expectedTrajectory?: TrajectoryExpectation;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Item-level scorer IDs. An empty array explicitly disables scoring. */
  scorerIds?: string[];
}

export interface ExecuteExperimentItemArgs {
  mastra: Mastra;
  /** The experiment record. Must carry a non-null target. */
  experiment: Experiment;
  item: ExperimentItemInput;
  /** Dataset-level scorer IDs (lowest-precedence scorer source). */
  datasetScorerIds?: string[] | null;
  /** Zero-based repetition index. Defaults to `0`. */
  attempt?: number;
  /** Request context merged with the item's own request context (item wins). */
  requestContext?: Record<string, unknown>;
  /** Tenancy denormalized onto the result row. */
  organizationId?: string | null;
  projectId?: string | null;
}

export interface ExecuteExperimentItemOutput {
  result: ExperimentResult;
  scores: ScorerResult[];
}

/**
 * Execute one experiment item: resolve the experiment's target, run it against
 * the item, run the resolved scorers, and upsert the result row keyed by
 * `(experimentId, itemId, attempt)` so a retried caller (e.g. a retried
 * Temporal activity) converges on a single row.
 *
 * Scorer precedence mirrors the in-process runner: experiment `scorerIds` →
 * item `scorerIds` → dataset `scorerIds` → none. An item scorer reference to
 * an unregistered scorer is a deterministic preflight failure
 * ({@link EXPERIMENT_ITEM_SCORER_NOT_FOUND}): the target is not executed and
 * the error is recorded on the row.
 *
 * Deliberately excludes the runner's loop-level concerns: hooks, event
 * dispatch, tool mocks, and internal retries — retries/timeouts belong to the
 * caller's orchestrator.
 */
export async function executeExperimentItem(args: ExecuteExperimentItemArgs): Promise<ExecuteExperimentItemOutput> {
  const { mastra, experiment, item } = args;
  const attempt = args.attempt ?? 0;

  if (experiment.targetType === null || experiment.targetId === null) {
    throw new MastraError({
      id: 'EXPERIMENT_HAS_NO_TARGET',
      text: `Experiment ${experiment.id} has no target; results must be ingested via submitExperimentResult`,
      domain: 'STORAGE',
      category: 'USER',
    });
  }

  const resolved = await resolveTarget(
    mastra,
    experiment.targetType,
    experiment.targetId,
    experiment.agentVersion ?? undefined,
  );
  if (!resolved) {
    throw new MastraError({
      id: 'EXPERIMENT_TARGET_NOT_FOUND',
      text: `Target not found: ${experiment.targetType} "${experiment.targetId}"`,
      domain: 'STORAGE',
      category: 'USER',
    });
  }

  // Scorer precedence: experiment scorerIds → item scorerIds → dataset scorerIds → none.
  let scorers: MastraScorer<any, any, any, any>[] = [];
  let scorerConfigError: ExecutionResult['error'] = null;
  if (experiment.scorerIds != null) {
    scorers = resolveScorers(mastra, [...new Set(experiment.scorerIds)]);
  } else if (item.scorerIds !== undefined) {
    const resolution = await createItemScorerResolver(mastra)(item.scorerIds);
    scorers = resolution.scorers;
    if (resolution.missingIds.length > 0) {
      scorerConfigError = {
        code: EXPERIMENT_ITEM_SCORER_NOT_FOUND,
        message: `Item scorer configuration references unregistered scorer IDs: ${resolution.missingIds.join(', ')}`,
      };
    }
  } else {
    scorers = resolveScorers(mastra, [...new Set(args.datasetScorerIds ?? [])]);
  }

  // Resolve the experiments store before executing the target so a
  // misconfigured storage layer fails fast, before the target is billed or
  // any score rows are written.
  const storage = mastra.getStorage();
  const experimentsStore = await storage?.getStore('experiments');
  if (!experimentsStore) {
    throw new MastraError({
      id: 'EXPERIMENTS_STORAGE_NOT_CONFIGURED',
      text: 'ExperimentsStorage not configured. Configure storage in the Mastra instance.',
      domain: 'STORAGE',
      category: 'USER',
    });
  }

  const startedAt = new Date();

  const mergedRequestContext =
    args.requestContext || item.requestContext ? { ...args.requestContext, ...item.requestContext } : undefined;

  const execResult: ExecutionResult = scorerConfigError
    ? { output: null, error: scorerConfigError, traceId: null }
    : await executeTarget(resolved.target, experiment.targetType, item, {
        requestContext: mergedRequestContext,
        experimentId: experiment.id,
      });

  const completedAt = new Date();

  let scores: ScorerResult[] = [];
  if (!scorerConfigError) {
    const workflowData =
      execResult.stepResults || execResult.stepExecutionPath
        ? {
            stepResults: execResult.stepResults,
            stepExecutionPath: execResult.stepExecutionPath,
            spanId: execResult.spanId,
          }
        : undefined;

    scores = await runScorersForItem(
      scorers,
      item,
      execResult.output,
      storage ?? null,
      experiment.id,
      experiment.targetType,
      experiment.targetId,
      item.id,
      execResult.scorerInput,
      execResult.scorerOutput,
      execResult.traceId ?? undefined,
      workflowData,
      true,
      // Retried runs of the same (experiment, item, attempt) overwrite their
      // previous score rows instead of accumulating duplicates.
      experimentScoreKey(experiment.id, item.id, attempt),
    );
  }

  const result = await experimentsStore.upsertExperimentResult({
    experimentId: experiment.id,
    itemId: item.id,
    attempt,
    itemDatasetVersion: item.datasetVersion,
    input: item.input,
    output: execResult.output,
    groundTruth: item.groundTruth ?? null,
    error: execResult.error,
    startedAt,
    completedAt,
    retryCount: 0,
    traceId: execResult.traceId,
    organizationId: args.organizationId ?? null,
    projectId: args.projectId ?? null,
  });

  return { result, scores };
}
