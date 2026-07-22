import { MastraError } from '../../error/index.js';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { DatasetRecord } from '../../storage/types';
import { executeTarget } from './executor';
import type { Target, ExecutionResult } from './executor';
import {
  createItemScorerResolver,
  EXPERIMENT_ITEM_SCORER_NOT_FOUND,
  resolveScorers,
  resolveStepScorers,
  runScorersForItem,
  runStepScorersForItem,
} from './scorer';
import { TOOL_MOCK_MISMATCH, TOOL_MOCK_EXHAUSTED } from './tool-mocks';
import type { ItemToolMock } from './tool-mocks';
import type { ExperimentConfig, ExperimentSummary, ItemWithScores, ItemResult } from './types';

/** Unified item shape used within experiment execution (bridges inline + versioned data) */
type ExperimentItem = {
  id: string; // item id (or generated for inline)
  datasetVersion: number | null; // null for inline experiments
  input: unknown;
  groundTruth?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Resume data for suspended workflow steps, keyed by step ID */
  resumeSteps?: Record<string, unknown>;
  /** Flat resume data for single-step suspend workflows */
  resumeData?: unknown;
  /** Item-level static tool mocks (agent targets only) */
  toolMocks?: ItemToolMock[];
  /** Item-level scorer IDs. An empty array explicitly disables scoring. */
  scorerIds?: string[];
};

// Re-export types and helpers
export type {
  DataItem,
  ExperimentConfig,
  ExperimentSummary,
  ItemWithScores,
  ItemResult,
  ScorerResult,
  StartExperimentConfig,
} from './types';
export { executeTarget, type Target, type ExecutionResult } from './executor';
export { EXPERIMENT_ITEM_SCORER_NOT_FOUND, resolveScorers, runScorersForItem } from './scorer';
export {
  ToolMockMatcher,
  TOOL_MOCK_MISMATCH,
  TOOL_MOCK_EXHAUSTED,
  type ItemToolMock,
  type ToolMockMatchArgs,
  type ToolMockReport,
  type ToolMockResolution,
  type ToolMockFailureCode,
} from './tool-mocks';

// Re-export analytics
export * from './analytics';

/**
 * Run a dataset experiment against a target with optional scoring.
 *
 * Executes all items in the dataset concurrently (up to maxConcurrency) against
 * the specified target (agent or workflow). Optionally applies scorers to each
 * result and persists both results and scores to storage.
 *
 * @param mastra - Mastra instance for storage and target resolution
 * @param config - Experiment configuration
 * @returns ExperimentSummary with results and scores
 *
 * @example
 * ```typescript
 * const summary = await runExperiment(mastra, {
 *   datasetId: 'my-dataset',
 *   targetType: 'agent',
 *   targetId: 'my-agent',
 *   scorers: [accuracyScorer, latencyScorer],
 *   maxConcurrency: 10,
 * });
 * console.log(`${summary.succeededCount}/${summary.totalItems} succeeded`);
 * ```
 */
export async function runExperiment(mastra: Mastra, config: ExperimentConfig): Promise<ExperimentSummary> {
  const {
    datasetId,
    targetType,
    targetId,
    scorers: scorerInput,
    version,
    maxConcurrency = 5,
    signal,
    itemTimeout,
    maxRetries = 0,
    experimentId: providedExperimentId,
    name,
    description,
    metadata,
    requestContext: globalRequestContext,
    agentVersion,
    versions,
  } = config;

  const startedAt = new Date();
  // Use provided experimentId (async trigger) or generate new one
  const experimentId = providedExperimentId ?? crypto.randomUUID();

  // 1. Get storage and resolve components
  const storage = mastra.getStorage();
  const datasetsStore = await storage?.getStore('datasets');
  const experimentsStore = await storage?.getStore('experiments');

  // Helper: if the experiment record was pre-created (async path) and we fail
  // during setup (Phase A/B), mark the experiment as failed so it doesn't stay stuck in 'pending'.
  const markFailedOnSetupError = async (err: unknown) => {
    if (providedExperimentId && experimentsStore) {
      try {
        await experimentsStore.updateExperiment({
          id: experimentId,
          status: 'failed',
          completedAt: new Date(),
        });
      } catch (updateErr) {
        mastra.getLogger()?.error(`Failed to mark experiment ${experimentId} as failed: ${updateErr}`);
      }
    }
    throw err;
  };

  // Phase A — Resolve items
  let items: ExperimentItem[];
  let datasetVersion: number | null;
  let datasetRecord: DatasetRecord | null | undefined;

  try {
    if (config.data) {
      // Inline data path — array or factory function
      const rawData = typeof config.data === 'function' ? await config.data() : config.data;
      items = rawData.map(dataItem => {
        const id = dataItem.id ?? crypto.randomUUID();
        return {
          id,
          datasetVersion: null,
          input: dataItem.input,
          groundTruth: dataItem.groundTruth,
          requestContext: dataItem.requestContext,
          metadata: dataItem.metadata,
          resumeSteps: dataItem.resumeSteps,
          resumeData: dataItem.resumeData,
          toolMocks: dataItem.toolMocks,
          scorerIds: dataItem.scorerIds,
        };
      });
      datasetVersion = null;
    } else if (datasetId) {
      // Storage-backed data path (existing)
      if (!datasetsStore) {
        throw new Error('DatasetsStorage not configured. Configure storage in Mastra instance.');
      }

      datasetRecord = await datasetsStore.getDatasetById({ id: datasetId, filters: config.filters });
      if (!datasetRecord) {
        throw new MastraError({
          id: 'DATASET_NOT_FOUND',
          text: `Dataset not found: ${datasetId}`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }

      datasetVersion = version ?? datasetRecord.version;
      const versionItems = await datasetsStore.getItemsByVersion({
        datasetId,
        version: datasetVersion,
      });

      if (versionItems.length === 0) {
        throw new MastraError({
          id: 'EXPERIMENT_NO_ITEMS',
          text: `No items in dataset ${datasetId} at version ${datasetVersion}`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }

      items = versionItems.map(v => ({
        id: v.id,
        datasetVersion: v.datasetVersion,
        input: v.input,
        groundTruth: v.groundTruth,
        requestContext: v.requestContext,
        metadata: v.metadata,
        toolMocks: v.toolMocks,
        scorerIds: v.scorerIds,
      }));
    } else {
      throw new Error('No data source: provide datasetId or data');
    }
  } catch (err) {
    await markFailedOnSetupError(err);
    throw err; // unreachable, but satisfies TS control flow
  }

  // Phase B — Resolve task function
  let execFn: (item: ExperimentItem, signal?: AbortSignal) => Promise<ExecutionResult>;

  try {
    if (config.task) {
      // Inline task path
      const taskFn = config.task;
      execFn = async (item, itemSignal) => {
        try {
          const result = await taskFn({
            input: item.input,
            mastra,
            groundTruth: item.groundTruth,
            metadata: item.metadata,
            signal: itemSignal,
          });
          return { output: result, error: null, traceId: null };
        } catch (err: unknown) {
          return {
            output: null,
            error: {
              message: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            traceId: null,
          };
        }
      };
    } else if (targetType && targetId) {
      // Registry-based target path (existing)
      const resolved = await resolveTarget(mastra, targetType, targetId, agentVersion);
      if (!resolved) {
        throw new Error(`Target not found: ${targetType}/${targetId}`);
      }
      const { target } = resolved;
      execFn = (item, itemSignal) => {
        // Merge global request context with per-item request context (item takes precedence)
        const mergedRequestContext =
          globalRequestContext || item.requestContext ? { ...globalRequestContext, ...item.requestContext } : undefined;
        return executeTarget(target, targetType, item, {
          signal: itemSignal,
          requestContext: mergedRequestContext,
          experimentId,
          versions,
          toolMocks: targetType === 'agent' ? item.toolMocks : undefined,
        });
      };
    } else {
      throw new Error('No task: provide targetType+targetId or task');
    }
  } catch (err) {
    await markFailedOnSetupError(err);
    throw err; // unreachable, but satisfies TS control flow
  }

  // Tool mocks only apply to agent targets. If a dataset carrying toolMocks is reused
  // against a task/workflow/scorer target, the mocks are silently ignored — warn once
  // (not per item) so the misconfiguration is visible without log spam.
  const itemsWithToolMocks = items.filter(item => item.toolMocks?.length).length;
  if (targetType !== 'agent' && itemsWithToolMocks > 0) {
    mastra
      .getLogger()
      ?.warn(
        `Experiment target is "${config.task ? 'task' : targetType}" but ${itemsWithToolMocks} of ${items.length} dataset items declare toolMocks. ` +
          `Tool mocks only apply to agent targets and will be ignored.`,
      );
  }

  // Preserve whether the caller supplied run-level scorers before normalizing.
  // Empty arrays and empty categorized configs intentionally override lower-precedence sources.
  const hasRunLevelScorers = scorerInput !== undefined;
  let stepsConfigInput: Record<string, (MastraScorer<any, any, any, any> | string)[]> | undefined;
  let flatScorerInput: (MastraScorer<any, any, any, any> | string)[] | undefined;
  if (scorerInput !== undefined) {
    if (Array.isArray(scorerInput)) {
      flatScorerInput = scorerInput;
    } else {
      flatScorerInput = [];
      if ('agent' in scorerInput && scorerInput.agent) flatScorerInput.push(...scorerInput.agent);
      if ('workflow' in scorerInput && scorerInput.workflow) flatScorerInput.push(...scorerInput.workflow);
      if ('trajectory' in scorerInput && scorerInput.trajectory) flatScorerInput.push(...scorerInput.trajectory);
      if ('steps' in scorerInput && scorerInput.steps) stepsConfigInput = scorerInput.steps;
    }
  }

  if (flatScorerInput?.length) {
    const seen = new Set<string>();
    flatScorerInput = flatScorerInput.filter(entry => {
      if (typeof entry !== 'string') return true;
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
  }

  const runLevelScorers = hasRunLevelScorers ? resolveScorers(mastra, flatScorerInput) : [];
  const runLevelStepScorers = hasRunLevelScorers ? resolveStepScorers(mastra, stepsConfigInput) : {};
  const resolveItemScorers = createItemScorerResolver(mastra);
  let datasetScorers: MastraScorer<any, any, any, any>[] | undefined;
  const getDatasetScorers = () => {
    if (!datasetScorers) {
      datasetScorers = resolveScorers(mastra, [...new Set(datasetRecord?.scorerIds ?? [])]);
    }
    return datasetScorers;
  };

  // 5. Create experiment record (if storage available and not pre-created)
  if (experimentsStore) {
    if (!providedExperimentId) {
      // Create new experiment record (sync trigger path)
      await experimentsStore.createExperiment({
        id: experimentId,
        name,
        description,
        metadata,
        datasetId: datasetId ?? null,
        datasetVersion,
        targetType: targetType ?? 'agent',
        targetId: targetId ?? 'inline',
        totalItems: items.length,
        agentVersion,
        organizationId: datasetRecord?.organizationId ?? null,
        projectId: datasetRecord?.projectId ?? null,
      });
    }
    // Update status to running (both sync and async paths)
    // Also set totalItems — needed for the async path where the experiment
    // was created with totalItems: 0 before items were resolved.
    await experimentsStore.updateExperiment({
      id: experimentId,
      status: 'running',
      totalItems: items.length,
      startedAt,
    });
  }

  // 6. Execute items with p-map
  let succeededCount = 0;
  let failedCount = 0;
  // Rows whose target run completed but whose persistence to
  // `mastra_experiment_results` failed. Surfaced on the summary so callers
  // can detect the DB being out of sync with the returned results.
  let persistenceFailures = 0;
  // Pre-allocate for deterministic ordering (results[i] matches items[i])
  const results: ItemWithScores[] = new Array(items.length);

  // Throttled progress updates
  const PROGRESS_UPDATE_INTERVAL = 2000;
  let lastProgressUpdate = 0;

  try {
    const pMap = (await import('p-map')).default;

    await pMap(
      items.map((item, idx) => ({ item, idx })),
      async ({ item, idx }) => {
        // Check for cancellation
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const itemStartedAt = new Date();
        let itemScorers: MastraScorer<any, any, any, any>[];
        let itemStepScorers = {} as ReturnType<typeof resolveStepScorers>;
        let scorerConfigError: ExecutionResult['error'] = null;

        if (hasRunLevelScorers) {
          itemScorers = runLevelScorers;
          itemStepScorers = runLevelStepScorers;
        } else if (item.scorerIds !== undefined) {
          const resolution = await resolveItemScorers(item.scorerIds);
          itemScorers = resolution.scorers;
          if (resolution.missingIds.length > 0) {
            scorerConfigError = {
              code: EXPERIMENT_ITEM_SCORER_NOT_FOUND,
              message: `Item scorer configuration references unregistered scorer IDs: ${resolution.missingIds.join(', ')}`,
            };
          }
        } else {
          itemScorers = getDatasetScorers();
        }

        // Compose per-item signal (timeout + run-level abort)
        let itemSignal: AbortSignal | undefined = signal;
        if (itemTimeout) {
          const timeoutSignal = AbortSignal.timeout(itemTimeout);
          itemSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
        }

        // Resolve item scorer configuration before executing the target. Invalid item
        // references are deterministic and therefore skip both target execution and retries.
        let retryCount = 0;
        let execResult: ExecutionResult = scorerConfigError
          ? { output: null, error: scorerConfigError, traceId: null }
          : await execFn(item, itemSignal);

        while (execResult.error && !scorerConfigError && retryCount < maxRetries) {
          // Don't retry abort errors
          if (execResult.error.message.toLowerCase().includes('abort')) break;

          // Don't retry deterministic tool-mock failures — the matcher state cannot
          // change between attempts, so retrying would always fail identically.
          if (execResult.error.code === TOOL_MOCK_MISMATCH || execResult.error.code === TOOL_MOCK_EXHAUSTED) {
            break;
          }

          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
          const jitter = delay * 0.2 * Math.random();
          await new Promise(r => setTimeout(r, delay + jitter));

          // Re-check cancellation before retry
          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          execResult = await execFn(item, itemSignal);
        }

        const itemCompletedAt = new Date();

        // Track success/failure
        if (execResult.error) {
          failedCount++;
        } else {
          succeededCount++;
        }

        // Build item result. `persistenceError` starts null and is set below
        // if `addExperimentResult` throws so callers can detect rows that
        // never landed in storage.
        const itemResult: ItemResult = {
          itemId: item.id,
          itemVersion: item.datasetVersion ?? 0,
          input: item.input,
          output: execResult.output,
          groundTruth: item.groundTruth ?? null,
          error: execResult.error,
          startedAt: itemStartedAt,
          completedAt: itemCompletedAt,
          retryCount,
          persistenceError: null,
          ...(execResult.toolMockReport ? { toolMockReport: execResult.toolMockReport } : {}),
        };

        // Run scorers (inline, after target completes). A scorer-configuration
        // failure skips scoring because the selected source could not be resolved fully.
        let itemScores: Awaited<ReturnType<typeof runScorersForItem>> = [];
        if (!scorerConfigError) {
          const workflowData =
            execResult.stepResults || execResult.stepExecutionPath
              ? {
                  stepResults: execResult.stepResults,
                  stepExecutionPath: execResult.stepExecutionPath,
                  spanId: execResult.spanId,
                }
              : undefined;

          const flatScores = await runScorersForItem(
            itemScorers,
            item,
            execResult.output,
            storage ?? null,
            experimentId,
            targetType ?? 'agent',
            targetId ?? 'inline',
            item.id,
            execResult.scorerInput,
            execResult.scorerOutput,
            execResult.traceId ?? undefined,
            workflowData,
          );

          const stepScores = await runStepScorersForItem(
            itemStepScorers,
            item,
            workflowData,
            storage ?? null,
            experimentId,
            targetType ?? 'agent',
            targetId ?? 'inline',
            item.id,
            execResult.traceId ?? undefined,
          );

          itemScores = [...flatScores, ...stepScores];
        }

        // Persist result with scores (if storage available). A throw here does
        // NOT abort the run — persistence is best-effort and the target run's
        // outcome is already recorded in `itemResult`. Instead we surface the
        // failure on the item (`persistenceError`) and bump the run-level
        // `persistenceFailures` counter so callers can detect rows that never
        // landed in `mastra_experiment_results`.
        if (experimentsStore) {
          try {
            await experimentsStore.addExperimentResult({
              experimentId,
              itemId: item.id,
              itemDatasetVersion: item.datasetVersion,
              input: item.input,
              output: execResult.output,
              groundTruth: item.groundTruth ?? null,
              error: execResult.error,
              startedAt: itemStartedAt,
              completedAt: itemCompletedAt,
              retryCount,
              traceId: execResult.traceId,
              organizationId: datasetRecord?.organizationId ?? null,
              projectId: datasetRecord?.projectId ?? null,
              ...(execResult.toolMockReport ? { toolMockReport: execResult.toolMockReport } : {}),
            });
          } catch (persistError) {
            persistenceFailures++;
            itemResult.persistenceError = {
              message: persistError instanceof Error ? persistError.message : String(persistError),
            };
            // Log the raw error (including stack) internally, but do NOT attach the
            // stack to the returned `persistenceError` — the summary can cross a
            // trust boundary (e.g. UIs, API responses) and stacks leak internal paths.
            mastra
              .getLogger()
              ?.error(
                `Failed to persist experiment result for item ${item.id} in experiment ${experimentId}: ${itemResult.persistenceError.message}`,
                { error: persistError },
              );
          }

          // Throttled progress update
          const now = Date.now();
          if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
            lastProgressUpdate = now;
            try {
              await experimentsStore.updateExperiment({
                id: experimentId,
                succeededCount,
                failedCount,
              });
            } catch {
              // Non-fatal — progress updates are best-effort
            }
          }
        }

        // Store at original index for deterministic ordering
        results[idx] = {
          ...itemResult,
          scores: itemScores,
        };
      },
      { concurrency: maxConcurrency },
    );
  } catch {
    // Handle abort or other fatal errors — return partial summary instead of throwing
    const completedAt = new Date();
    const skippedCount = items.length - succeededCount - failedCount;

    if (experimentsStore) {
      await experimentsStore.updateExperiment({
        id: experimentId,
        status: 'failed',
        succeededCount,
        failedCount,
        skippedCount,
        completedAt,
      });
    }

    return {
      experimentId,
      status: 'failed' as const,
      totalItems: items.length,
      succeededCount,
      failedCount,
      skippedCount,
      persistenceFailures,
      completedWithErrors: false,
      startedAt,
      completedAt,
      results: results.filter(Boolean),
    };
  }

  // 7. Finalize experiment record
  const completedAt = new Date();
  const status = failedCount === items.length ? 'failed' : 'completed';
  const completedWithErrors = status === 'completed' && failedCount > 0;

  const skippedCount = items.length - succeededCount - failedCount;
  if (experimentsStore) {
    await experimentsStore.updateExperiment({
      id: experimentId,
      status,
      succeededCount,
      failedCount,
      skippedCount,
      completedAt,
    });
  }

  return {
    experimentId,
    status,
    totalItems: items.length,
    succeededCount,
    failedCount,
    skippedCount,
    persistenceFailures,
    completedWithErrors,
    startedAt,
    completedAt,
    results,
  };
}

/**
 * Resolve a target from Mastra's registries by type and ID.
 * When `agentVersion` is provided for an agent target, the returned agent
 * will have the versioned config applied (via `applyStoredOverrides`).
 *
 * The result is wrapped in `{ target }` because `Workflow` has a `.then`
 * method for step chaining, which makes it thenable. Returning a thenable
 * from an async function causes the Promise machinery to attempt to unwrap
 * it, which hangs forever since the builder `.then` never invokes its
 * callbacks. Wrapping in a plain object avoids the unwrap.
 */
async function resolveTarget(
  mastra: Mastra,
  targetType: string,
  targetId: string,
  agentVersion?: string,
): Promise<{ target: Target } | null> {
  let resolved: Target | null = null;

  switch (targetType) {
    case 'agent':
      try {
        if (agentVersion) {
          resolved = await mastra.getAgentById(targetId, { versionId: agentVersion });
        } else {
          resolved = mastra.getAgentById(targetId);
        }
      } catch {
        // Try by name if ID lookup fails
        try {
          if (agentVersion) {
            resolved = await mastra.getAgent(targetId, { versionId: agentVersion });
          } else {
            resolved = mastra.getAgent(targetId);
          }
        } catch {
          // leave null
        }
      }
      break;
    case 'workflow':
      try {
        resolved = mastra.getWorkflowById(targetId);
      } catch {
        // Try by name if ID lookup fails
        try {
          resolved = mastra.getWorkflow(targetId);
        } catch {
          // leave null
        }
      }
      break;
    case 'scorer':
      try {
        resolved = mastra.getScorerById(targetId) ?? null;
      } catch {
        // leave null
      }
      break;
    case 'processor':
      // Processors not yet in registry - Phase 4
      break;
    default:
      break;
  }

  return resolved ? { target: resolved } : null;
}
