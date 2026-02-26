import type { Mastra } from '../../mastra';

/** Unified item shape used within experiment execution (bridges inline + versioned data) */
type ExperimentItem = {
  id: string; // item id (or generated for inline)
  datasetVersion: number | null; // null for inline experiments
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
};
import { executeTarget } from './executor';
import type { Target, ExecutionResult } from './executor';
import { resolveScorers, runScorersForItem } from './scorer';
import type { ExperimentConfig, ExperimentSummary, ItemWithScores, ItemResult } from './types';

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
  } = config;

  const startedAt = new Date();
  // Use provided experimentId (async trigger) or generate new one
  const experimentId = providedExperimentId ?? crypto.randomUUID();

  // 1. Get storage and resolve components
  const storage = mastra.getStorage();
  const datasetsStore = await storage?.getStore('datasets');
  const experimentsStore = await storage?.getStore('experiments');

  // Phase A — Resolve items
  let items: ExperimentItem[];
  let datasetVersion: number | null;

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
        metadata: dataItem.metadata,
      };
    });
    datasetVersion = null;
  } else if (datasetId) {
    // Storage-backed data path (existing)
    if (!datasetsStore) {
      throw new Error('DatasetsStorage not configured. Configure storage in Mastra instance.');
    }

    const dataset = await datasetsStore.getDatasetById({ id: datasetId });
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    datasetVersion = version ?? dataset.version;
    const versionItems = await datasetsStore.getItemsByVersion({
      datasetId,
      version: datasetVersion,
    });

    if (versionItems.length === 0) {
      throw new Error(`No items in dataset ${datasetId} at version ${datasetVersion}`);
    }

    items = versionItems.map(v => ({
      id: v.id,
      datasetVersion: v.datasetVersion,
      input: v.input,
      groundTruth: v.groundTruth,
      metadata: v.metadata,
    }));
  } else {
    throw new Error('No data source: provide datasetId or data');
  }

  // Phase B — Resolve task function
  let execFn: (item: ExperimentItem, signal?: AbortSignal) => Promise<ExecutionResult>;

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
    const target = resolveTarget(mastra, targetType, targetId);
    if (!target) {
      throw new Error(`Target not found: ${targetType}/${targetId}`);
    }
    execFn = (item, itemSignal) => executeTarget(target, targetType, item, { signal: itemSignal });
  } else {
    throw new Error('No task: provide targetType+targetId or task');
  }

  // Resolve scorers
  const scorers = resolveScorers(mastra, scorerInput);

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
      });
    }
    // Update status to running (both sync and async paths)
    await experimentsStore.updateExperiment({
      id: experimentId,
      status: 'running',
      startedAt,
    });
  }

  // 6. Execute items with p-map
  let succeededCount = 0;
  let failedCount = 0;
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
        // Compose per-item signal (timeout + run-level abort)
        let itemSignal: AbortSignal | undefined = signal;
        if (itemTimeout) {
          const timeoutSignal = AbortSignal.timeout(itemTimeout);
          itemSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
        }

        // Retry loop
        let retryCount = 0;
        let execResult = await execFn(item, itemSignal);

        while (execResult.error && retryCount < maxRetries) {
          // Don't retry abort errors
          if (execResult.error.message.toLowerCase().includes('abort')) break;

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

        // Build item result
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
        };

        // Run scorers (inline, after target completes)
        const itemScores = await runScorersForItem(
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
        );

        // Persist result with scores (if storage available)
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
            });
          } catch (persistError) {
            console.warn(`Failed to persist result for item ${item.id}:`, persistError);
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
    completedWithErrors,
    startedAt,
    completedAt,
    results,
  };
}

/**
 * Resolve a target from Mastra's registries by type and ID.
 */
function resolveTarget(mastra: Mastra, targetType: string, targetId: string): Target | null {
  switch (targetType) {
    case 'agent':
      try {
        return mastra.getAgentById(targetId as any);
      } catch {
        // Try by name if ID lookup fails
        try {
          return mastra.getAgent(targetId);
        } catch {
          return null;
        }
      }
    case 'workflow':
      try {
        return mastra.getWorkflowById(targetId as any);
      } catch {
        // Try by name if ID lookup fails
        try {
          return mastra.getWorkflow(targetId);
        } catch {
          return null;
        }
      }
    case 'scorer':
      try {
        return mastra.getScorerById(targetId as any) ?? null;
      } catch {
        return null;
      }
    case 'processor':
      // Processors not yet in registry - Phase 4
      return null;
    default:
      return null;
  }
}
