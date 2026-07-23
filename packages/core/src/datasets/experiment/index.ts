import { MastraError } from '../../error/index.js';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { DatasetRecord } from '../../storage/types';
import { executeTarget, raceWithSignal } from './executor';
import type { Target, ExecutionResult } from './executor';
import { resolveScorers, resolveStepScorers, runScorersForItem, runStepScorersForItem } from './scorer';
import { TOOL_MOCK_MISMATCH, TOOL_MOCK_EXHAUSTED } from './tool-mocks';
import type { ItemToolMock } from './tool-mocks';
import type { ExperimentConfig, ExperimentSummary, ItemWithScores, ItemResult } from './types';

/** Unified item shape used within experiment execution (bridges inline + versioned data) */
type ExperimentItem = {
  id: string; // item id (or generated for inline)
  datasetVersion: number | null; // null for inline experiments
  input: unknown;
  groundTruth?: unknown;
  timeout?: number;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Resume data for suspended workflow steps, keyed by step ID */
  resumeSteps?: Record<string, unknown>;
  /** Flat resume data for single-step suspend workflows */
  resumeData?: unknown;
  /** Item-level static tool mocks (agent targets only) */
  toolMocks?: ItemToolMock[];
};

function executionFailure(error: unknown): ExecutionResult {
  return {
    output: null,
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    ...(error instanceof Error && error.name === 'AbortError' ? { aborted: true } : {}),
    traceId: null,
  };
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

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
export { resolveScorers, runScorersForItem } from './scorer';
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
          timeout: dataItem.timeout,
          requestContext: dataItem.requestContext,
          metadata: dataItem.metadata,
          resumeSteps: dataItem.resumeSteps,
          resumeData: dataItem.resumeData,
          toolMocks: dataItem.toolMocks,
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
        timeout: v.timeout,
        requestContext: v.requestContext,
        metadata: v.metadata,
        toolMocks: v.toolMocks,
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
          const taskPromise = Promise.resolve(
            taskFn({
              input: item.input,
              mastra,
              groundTruth: item.groundTruth,
              metadata: item.metadata,
              signal: itemSignal,
            }),
          );
          const result = itemSignal ? await raceWithSignal(taskPromise, itemSignal) : await taskPromise;
          return { output: result, error: null, traceId: null };
        } catch (err: unknown) {
          return executionFailure(err);
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

  // Normalize categorized scorer config (AgentScorerConfig | WorkflowScorerConfig) to a flat
  // array so the existing merge/dedup/resolve logic below is unchanged.
  // Trajectory dispatch is handled per-scorer in runScorerSafe based on scorer.type.
  // Step scorers are kept separate (keyed by step ID) and dispatched per-step
  // after the flat scorers run, mirroring runEvals.
  let stepsConfigInput: Record<string, (MastraScorer<any, any, any, any> | string)[]> | undefined;
  const flatScorerInput: (MastraScorer<any, any, any, any> | string)[] | undefined = (() => {
    if (!scorerInput) return undefined;
    if (Array.isArray(scorerInput)) return scorerInput;
    // Categorized shape — flatten flat-style buckets into one array, keep steps separate
    const flat: (MastraScorer<any, any, any, any> | string)[] = [];
    if ('agent' in scorerInput && scorerInput.agent) flat.push(...scorerInput.agent);
    if ('workflow' in scorerInput && scorerInput.workflow) flat.push(...scorerInput.workflow);
    if ('trajectory' in scorerInput && scorerInput.trajectory) flat.push(...scorerInput.trajectory);
    if ('steps' in scorerInput && scorerInput.steps) {
      stepsConfigInput = scorerInput.steps;
    }
    return flat;
  })();

  // Merge dataset-attached scorers with explicitly provided scorers, then deduplicate
  let mergedScorerInput = flatScorerInput;
  const datasetScorerIds = datasetRecord?.scorerIds ?? [];
  if (datasetScorerIds.length > 0) {
    mergedScorerInput = [...(flatScorerInput ?? []), ...datasetScorerIds];
  }
  if (mergedScorerInput && mergedScorerInput.length > 0) {
    const seen = new Set<string>();
    mergedScorerInput = mergedScorerInput.filter(entry => {
      if (typeof entry === 'string') {
        if (seen.has(entry)) return false;
        seen.add(entry);
        return true;
      }
      // Keep all scorer instances — they are resolved by reference, not by ID
      return true;
    });
  }

  // Resolve scorers
  const scorers = resolveScorers(mastra, mergedScorerInput);
  // Resolve per-step scorers (keyed by step ID) for workflow targets
  const stepScorers = resolveStepScorers(mastra, stepsConfigInput);

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
        // Compose one per-item signal before the first attempt so timeout is a whole-item budget.
        const effectiveTimeout = item.timeout ?? itemTimeout;
        let itemSignal: AbortSignal | undefined = signal;
        if (effectiveTimeout) {
          const timeoutSignal = AbortSignal.timeout(effectiveTimeout);
          itemSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
        }

        // Retry loop
        let retryCount = 0;
        let execResult = await execFn(item, itemSignal);
        if (signal?.aborted) {
          throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        }

        while (execResult.error && retryCount < maxRetries) {
          if (signal?.aborted) {
            throw signal.reason ?? new DOMException('Aborted', 'AbortError');
          }

          // The item deadline and explicit abort errors are non-retryable.
          if (itemSignal?.aborted || execResult.aborted) break;

          // Don't retry deterministic tool-mock failures — the matcher state cannot
          // change between attempts, so retrying would always fail identically.
          if (execResult.error.code === TOOL_MOCK_MISMATCH || execResult.error.code === TOOL_MOCK_EXHAUSTED) {
            break;
          }

          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          const jitter = delay * 0.2 * Math.random();
          try {
            await waitForRetry(delay + jitter, itemSignal);
          } catch (error) {
            if (signal?.aborted) {
              throw signal.reason ?? error;
            }
            execResult = executionFailure(error);
            break;
          }

          if (itemSignal?.aborted) {
            execResult = executionFailure(itemSignal.reason);
            break;
          }

          retryCount++;
          execResult = await execFn(item, itemSignal);
          if (signal?.aborted) {
            throw signal.reason ?? new DOMException('Aborted', 'AbortError');
          }
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

        // Run scorers (inline, after target completes)
        const workflowData =
          execResult.stepResults || execResult.stepExecutionPath
            ? {
                stepResults: execResult.stepResults,
                stepExecutionPath: execResult.stepExecutionPath,
                spanId: execResult.spanId,
              }
            : undefined;

        const flatScores = await runScorersForItem(
          scorers,
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

        // Per-step scorer dispatch (mirrors runEvals). Only meaningful for workflow
        // targets; for non-workflow targets stepScorers will be empty.
        const stepScores = await runStepScorersForItem(
          stepScorers,
          item,
          workflowData,
          storage ?? null,
          experimentId,
          targetType ?? 'agent',
          targetId ?? 'inline',
          item.id,
          execResult.traceId ?? undefined,
        );

        const itemScores = [...flatScores, ...stepScores];

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
