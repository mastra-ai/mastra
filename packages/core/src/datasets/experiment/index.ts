import type { Mastra } from '../../mastra';
import type { DatasetItem } from '../../storage/types';
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
  } = config;

  const startedAt = new Date();
  // Use provided experimentId (async trigger) or generate new one
  const experimentId = providedExperimentId ?? crypto.randomUUID();

  // 1. Get storage and resolve components
  const storage = mastra.getStorage();
  const datasetsStore = await storage?.getStore('datasets');
  const experimentsStore = await storage?.getStore('experiments');

  // Phase A — Resolve items
  let items: DatasetItem[];
  let datasetVersion: Date;

  if (config.data) {
    // Inline data path — array or factory function
    const rawData = typeof config.data === 'function' ? await config.data() : config.data;
    const now = new Date();
    items = rawData.map(dataItem => ({
      id: dataItem.id ?? crypto.randomUUID(),
      datasetId: config.datasetId ?? 'inline',
      version: now,
      input: dataItem.input,
      groundTruth: dataItem.groundTruth,
      metadata: dataItem.metadata,
      createdAt: now,
      updatedAt: now,
    }));
    datasetVersion = now;
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
    items = await datasetsStore.getItemsByVersion({
      datasetId,
      version: datasetVersion,
    });

    if (items.length === 0) {
      throw new Error(`No items in dataset ${datasetId} at version ${datasetVersion.toISOString()}`);
    }
  } else {
    throw new Error('No data source: provide datasetId or data');
  }

  // Phase B — Resolve task function
  let execFn: (item: DatasetItem, signal?: AbortSignal) => Promise<ExecutionResult>;

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
        const message = err instanceof Error ? err.message : String(err);
        return { output: null, error: message, traceId: null };
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
        datasetId: datasetId ?? 'inline',
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
        const perfStart = performance.now();

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
          if (execResult.error.toLowerCase().includes('abort')) break;

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

        const latency = performance.now() - perfStart;
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
          itemVersion: item.version,
          input: item.input,
          output: execResult.output,
          groundTruth: item.groundTruth ?? null,
          latency,
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
          execResult.scorerInput,
          execResult.scorerOutput,
        );

        // Persist result with scores (if storage available)
        if (experimentsStore) {
          try {
            await experimentsStore.addExperimentResult({
              experimentId,
              itemId: item.id,
              itemVersion: item.version,
              input: item.input,
              output: execResult.output,
              groundTruth: item.groundTruth ?? null,
              latency,
              error: execResult.error,
              startedAt: itemStartedAt,
              completedAt: itemCompletedAt,
              retryCount,
              traceId: execResult.traceId,
              scores: itemScores,
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

  if (experimentsStore) {
    await experimentsStore.updateExperiment({
      id: experimentId,
      status,
      succeededCount,
      failedCount,
      completedAt,
    });
  }

  return {
    experimentId,
    status,
    totalItems: items.length,
    succeededCount,
    failedCount,
    skippedCount: 0,
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
