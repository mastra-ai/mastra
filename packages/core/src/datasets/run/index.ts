import type { Mastra } from '../../mastra';
import type { RunConfig, RunSummary, ItemWithScores, ItemResult } from './types';
import { executeTarget, type Target } from './executor';
import { resolveScorers, runScorersForItem } from './scorer';

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
  const results: ItemWithScores[] = [];

  try {
    const pMap = (await import('p-map')).default;

    await pMap(
      items,
      async item => {
        // Check for cancellation
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const itemStartedAt = new Date();
        const perfStart = performance.now();

        // Execute target
        const execResult = await executeTarget(target, targetType, item);

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
          retryCount: 0,
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
        );

        // Persist result (if storage available)
        if (runsStore) {
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
            retryCount: 0,
            traceId: execResult.traceId,
          });
        }

        results.push({
          ...itemResult,
          scores: itemScores,
        });
      },
      { concurrency: maxConcurrency },
    );
  } catch (error) {
    // Handle abort or other fatal errors
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

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error; // Re-throw abort
    }

    throw error;
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

  return {
    runId,
    status,
    totalItems: items.length,
    succeededCount,
    failedCount,
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
