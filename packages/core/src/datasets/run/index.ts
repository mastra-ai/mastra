import type { Mastra } from '../../mastra';
import { executeTarget } from './executor';
import type { Target } from './executor';
import { resolveScorers, runScorersForItem } from './scorer';
import type { RunConfig, RunSummary, ItemWithScores, ItemResult } from './types';

// Re-export types and helpers
export type { RunConfig, RunSummary, ItemWithScores, ItemResult, ScorerResult } from './types';
export { executeTarget, type Target, type ExecutionResult } from './executor';
export { resolveScorers, runScorersForItem } from './scorer';

// Re-export analytics
export * from './analytics';

/**
 * Run a dataset against a target with optional scoring.
 *
 * Executes all items in the dataset concurrently (up to maxConcurrency) against
 * the specified target (agent or workflow). Optionally applies scorers to each
 * result and persists both results and scores to storage.
 *
 * @param mastra - Mastra instance for storage and target resolution
 * @param config - Run configuration
 * @returns RunSummary with results and scores
 *
 * @example
 * ```typescript
 * const summary = await runDataset(mastra, {
 *   datasetId: 'my-dataset',
 *   targetType: 'agent',
 *   targetId: 'my-agent',
 *   scorers: [accuracyScorer, latencyScorer],
 *   maxConcurrency: 10,
 * });
 * console.log(`${summary.succeededCount}/${summary.totalItems} succeeded`);
 * ```
 */
export async function runDataset(mastra: Mastra, config: RunConfig): Promise<RunSummary> {
  const {
    datasetId,
    targetType,
    targetId,
    scorers: scorerInput,
    version,
    maxConcurrency = 5,
    signal,
    itemTimeout,
    onItemComplete,
    retainResults = onItemComplete ? false : true,
    maxRetries = 0,
    retryDelay = 1000,
    runId: providedRunId,
  } = config;

  const startedAt = new Date();
  // Use provided runId (async trigger) or generate new one
  const runId = providedRunId ?? crypto.randomUUID();

  // 1. Get storage and resolve components
  const storage = mastra.getStorage();
  const datasetsStore = await storage?.getStore('datasets');
  const runsStore = await storage?.getStore('runs');

  if (!datasetsStore) {
    throw new Error('DatasetsStorage not configured. Configure storage in Mastra instance.');
  }

  // 2. Load dataset and items
  const dataset = await datasetsStore.getDatasetById({ id: datasetId });
  if (!dataset) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  const datasetVersion = version ?? dataset.version;
  const items = await datasetsStore.getItemsByVersion({
    datasetId,
    version: datasetVersion,
  });

  if (items.length === 0) {
    throw new Error(`No items in dataset ${datasetId} at version ${datasetVersion.toISOString()}`);
  }

  // 3. Resolve target
  const target = resolveTarget(mastra, targetType, targetId);
  if (!target) {
    throw new Error(`Target not found: ${targetType}/${targetId}`);
  }

  // 4. Resolve scorers
  const scorers = resolveScorers(mastra, scorerInput);

  // 5. Create run record (if storage available and not pre-created)
  if (runsStore) {
    if (!providedRunId) {
      // Create new run record (sync trigger path)
      await runsStore.createRun({
        id: runId,
        datasetId,
        datasetVersion,
        targetType,
        targetId,
        totalItems: items.length,
      });
    }
    // Update status to running (both sync and async paths)
    await runsStore.updateRun({
      id: runId,
      status: 'running',
      startedAt,
    });
  }

  // 6. Execute items with p-map
  let succeededCount = 0;
  let failedCount = 0;
  const results: (ItemWithScores | undefined)[] = new Array(items.length);

  try {
    const pMap = (await import('p-map')).default;

    await pMap(
      items,
      async (item, index) => {
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

        // Execute target with retry
        let execResult = await executeTarget(target, targetType, item, { signal: itemSignal });
        let retryCount = 0;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (!execResult.error) break;
          if (!isTransientError(execResult.error)) break;
          if (itemSignal?.aborted) break;

          retryCount = attempt + 1;
          const jitter = Math.random() * (retryDelay / 2);
          await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt) + jitter));

          // Re-check abort after delay
          if (itemSignal?.aborted) break;

          execResult = await executeTarget(target, targetType, item, { signal: itemSignal });
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
          expectedOutput: item.expectedOutput ?? null,
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
          runId,
          targetType,
          targetId,
          execResult.scorerInput,
          execResult.scorerOutput,
        );

        // Persist result with scores (if storage available)
        if (runsStore) {
          try {
            await runsStore.addResult({
              runId,
              itemId: item.id,
              itemVersion: item.version,
              input: item.input,
              output: execResult.output,
              expectedOutput: item.expectedOutput ?? null,
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
        }

        const itemWithScores: ItemWithScores = {
          ...itemResult,
          scores: itemScores,
        };

        if (retainResults) {
          results[index] = itemWithScores;
        }

        if (onItemComplete) {
          try {
            await onItemComplete(itemWithScores, index);
          } catch (callbackError) {
            console.warn(`onItemComplete callback error for item ${item.id}:`, callbackError);
          }
        }
      },
      { concurrency: maxConcurrency },
    );
  } catch {
    // Handle abort or other fatal errors — return partial summary instead of throwing
    const completedAt = new Date();

    if (runsStore) {
      await runsStore.updateRun({
        id: runId,
        status: 'failed',
        succeededCount,
        failedCount,
        completedAt,
      });
    }

    const skippedCount = items.length - succeededCount - failedCount;

    return {
      runId,
      status: 'failed' as const,
      totalItems: items.length,
      succeededCount,
      failedCount,
      startedAt,
      completedAt,
      completedWithErrors: false,
      skippedCount,
      results: results.filter((r): r is ItemWithScores => r !== undefined),
    };
  }

  // 7. Finalize run record
  const completedAt = new Date();
  const status = failedCount === items.length ? 'failed' : 'completed';

  if (runsStore) {
    await runsStore.updateRun({
      id: runId,
      status,
      succeededCount,
      failedCount,
      completedAt,
    });
  }

  const skippedCount = items.length - succeededCount - failedCount;

  return {
    runId,
    status,
    totalItems: items.length,
    succeededCount,
    failedCount,
    startedAt,
    completedAt,
    completedWithErrors: status === 'completed' && failedCount > 0,
    skippedCount,
    results: results.filter((r): r is ItemWithScores => r !== undefined),
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

/**
 * Check if an error message indicates a transient failure that should be retried.
 * Never retries abort errors.
 */
function isTransientError(error: string): boolean {
  if (/abort/i.test(error)) return false;
  const patterns = [
    /timeout/i,
    /rate.?limit/i,
    /429/,
    /503/,
    /5\d\d/,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /socket hang up/i,
    /fetch failed/i,
  ];
  return patterns.some(p => p.test(error));
}
