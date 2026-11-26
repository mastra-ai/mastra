import { MastraError } from '../../error/index.js';
import type { MastraScorer } from '../../evals/base';
import type { TrajectoryExpectation } from '../../evals/types';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { Mastra } from '../../mastra';
import type { VersionOverrides } from '../../mastra/types';
import type { Experiment, ExperimentResult } from '../../storage/types';
import { executeTarget } from './executor';
import type { ExecutionResult } from './executor';
import { resolveTarget } from './resolve-target';
import { executeWithRetries } from './retries';
import {
  createScorerResolver,
  EXPERIMENT_ITEM_SCORER_NOT_FOUND,
  experimentScoreKey,
  flushForTrajectoryScorers,
  itemScorerNotFoundError,
  runScorersForItem,
} from './scorer';
import type { ItemToolMock, UnmockedToolPolicy } from './tool-mocks';
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
  /** Item-level static tool mocks (agent targets only). */
  toolMocks?: ItemToolMock[];
  /** Item-level override for undeclared agent tool calls. */
  unmockedToolPolicy?: UnmockedToolPolicy;
}

/**
 * Per-item run options. They match the `runExperiment` options of the same name, so an item behaves the same whichever loop runs it.
 */
export interface ExperimentItemRunOptions {
  /** Model override for agent targets, passed per call to `agent.generate()`. */
  agentModel?: MastraModelConfig;
  /** Default handling for agent tool calls not declared in the item's `toolMocks` (default: `allow`). */
  unmockedToolPolicy?: UnmockedToolPolicy;
  /** Item execution timeout in milliseconds, covering all retries. */
  itemTimeout?: number;
  /** Retries on failure (default: 0). Abort/timeout and tool-mock errors are never retried. */
  maxRetries?: number;
  /** Version overrides for sub-agent delegation. */
  versions?: VersionOverrides;
}

export interface ExecuteExperimentItemArgs extends ExperimentItemRunOptions {
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
 * item `scorerIds` → dataset `scorerIds` → none. Stored scorers are loaded on
 * demand at every level. A scorer that can't be resolved (e.g. a stored scorer
 * deleted after the experiment started) is a deterministic preflight failure
 * ({@link EXPERIMENT_ITEM_SCORER_NOT_FOUND}): the target is not executed and
 * the error is recorded on the row; other items are unaffected.
 *
 * Applies the same per-item run options as the in-process runner (model
 * override, tool mocks, timeout, retries) but excludes its loop-level concerns:
 * hooks, event dispatch, and step scorers.
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
  // Every level loads stored scorers on demand: this may run in a process that never hydrated them.
  // A scorer that can't be resolved fails only this item.
  const resolveScorerEntries = createScorerResolver(mastra);
  let scorers: MastraScorer<any, any, any, any>[];
  let scorerConfigError: ExecutionResult['error'] = null;
  if (item.scorerIds !== undefined && experiment.scorerIds == null) {
    const resolution = await resolveScorerEntries(item.scorerIds);
    scorers = resolution.scorers;
    scorerConfigError = itemScorerNotFoundError('Item', resolution.missingIds);
  } else {
    const source = experiment.scorerIds != null ? 'Experiment' : 'Dataset';
    const resolution = await resolveScorerEntries(experiment.scorerIds ?? args.datasetScorerIds ?? []);
    scorers = resolution.scorers;
    scorerConfigError = itemScorerNotFoundError(source, resolution.missingIds);
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

  const targetType = experiment.targetType;
  const isAgent = targetType === 'agent';
  const signal = args.itemTimeout ? AbortSignal.timeout(args.itemTimeout) : undefined;
  const { execResult, retryCount } = scorerConfigError
    ? { execResult: { output: null, error: scorerConfigError, traceId: null }, retryCount: 0 }
    : await executeWithRetries(
        () =>
          executeTarget(resolved.target, targetType, item, {
            signal,
            requestContext: mergedRequestContext,
            experimentId: experiment.id,
            versions: args.versions,
            agentModel: args.agentModel,
            toolMocks: isAgent ? item.toolMocks : undefined,
            unmockedToolPolicy: isAgent ? (item.unmockedToolPolicy ?? args.unmockedToolPolicy ?? 'allow') : undefined,
          }),
        { maxRetries: args.maxRetries ?? 0, timeoutSignal: signal },
      );

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

    await flushForTrajectoryScorers(mastra, scorers, execResult.traceId);
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
    metadata: item.metadata ?? null,
    error: execResult.error,
    startedAt,
    completedAt,
    retryCount,
    traceId: execResult.traceId,
    toolMockReport: execResult.toolMockReport ?? null,
    organizationId: args.organizationId ?? null,
    projectId: args.projectId ?? null,
  });

  return { result, scores };
}
