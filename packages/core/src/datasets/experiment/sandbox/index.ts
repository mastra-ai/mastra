/**
 * Sandbox Experiment Runner
 *
 * Extends the standard experiment system with per-item lifecycle hooks
 * for workspace isolation, memory replay, and environment setup.
 *
 * Reuses the existing scoring and persistence infrastructure from
 * the standard experiment runner.
 */

import type { Mastra } from '../../../mastra';
import { resolveScorers, runScorersForItem } from '../scorer';
import type { ExperimentSummary, ItemResult, ItemWithScores } from '../types';
import type {
  SandboxExperimentConfig,
  SandboxExperimentItem,
  SandboxExperimentLifecycle,
  SandboxHandle,
  SandboxItemResult,
  SandboxLifecycleContext,
} from './types';

export type {
  SandboxExperimentConfig,
  SandboxExperimentItem,
  SandboxExperimentLifecycle,
  SandboxHandle,
  SandboxItemResult,
  SandboxLifecycleContext,
  WorkspaceSnapshot,
  WorkspaceSnapshotGitRef,
  WorkspaceSnapshotDirectory,
  WorkspaceSnapshotTar,
  WorkspaceSnapshotCurrent,
} from './types';

export { materializeWorkspace, destroyWorkspace, seedThreadMemory } from './workspace';

const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Run a sandbox experiment with per-item lifecycle management.
 *
 * For each item:
 *  1. setup() — materialize workspace, inject memory, configure agent
 *  2. execute() — run the agent against the item
 *  3. teardown() — clean up (always runs, even on failure)
 *  4. score() — run scorers against the output
 *
 * Results are persisted to storage (if configured) and returned as a
 * standard ExperimentSummary for compatibility with existing tooling.
 *
 * @example
 * ```typescript
 * const summary = await runSandboxExperiment(mastra, {
 *   items: myTestItems,
 *   lifecycle: {
 *     async setup(item) {
 *       const dir = await materializeWorkspace(item.workspace);
 *       return { workspacePath: dir };
 *     },
 *     async execute(item, handle, ctx) {
 *       return await myAgent.generate(item.input);
 *     },
 *     async teardown(handle) {
 *       if (handle.workspacePath) await rm(handle.workspacePath, { recursive: true });
 *     },
 *   },
 *   scorers: [outcomeScorer, efficiencyScorer],
 * });
 * ```
 */
export async function runSandboxExperiment<TItem extends SandboxExperimentItem, TOutput = unknown>(
  mastra: Mastra,
  config: SandboxExperimentConfig<TItem, TOutput>,
): Promise<ExperimentSummary> {
  const {
    lifecycle,
    maxConcurrency = DEFAULT_MAX_CONCURRENCY,
    timeout = DEFAULT_TIMEOUT,
    keepSandboxOnFailure = false,
    maxRetries = 0,
    scorers: scorerInput,
    name,
    description,
    metadata,
    agentVersion,
    signal,
  } = config;

  const startedAt = new Date();
  const experimentId = crypto.randomUUID();

  // ── Resolve items ──
  const items = await resolveItems<TItem>(mastra, config);
  if (items.length === 0) {
    throw new Error('No items to run: provide datasetId or items');
  }

  // ── Resolve scorers ──
  const scorers = resolveScorers(mastra, scorerInput);

  // ── Storage setup ──
  const storage = mastra.getStorage();
  const experimentsStore = await storage?.getStore('experiments');

  if (experimentsStore) {
    await experimentsStore.createExperiment({
      id: experimentId,
      name,
      description,
      metadata: { ...metadata, experimentType: 'sandbox' },
      datasetId: config.datasetId ?? null,
      datasetVersion: null,
      targetType: 'agent',
      targetId: 'sandbox',
      totalItems: items.length,
      agentVersion,
    });
    await experimentsStore.updateExperiment({
      id: experimentId,
      status: 'running',
      startedAt,
    });
  }

  // ── Execute items ──
  let succeededCount = 0;
  let failedCount = 0;
  const results: ItemWithScores[] = new Array(items.length);

  const lifecycleCtx: SandboxLifecycleContext = {
    mastra,
    experimentId,
    signal,
  };

  try {
    const pMap = (await import('p-map')).default;

    await pMap(
      items.map((item, idx) => ({ item, idx })),
      async ({ item, idx }) => {
        // Check for cancellation
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const itemId = item.id ?? `sandbox-${idx}`;
        const itemStartedAt = new Date();
        let retryCount = 0;
        let lastError: Error | null = null;
        let output: TOutput | null = null;

        // Retry loop — each retry gets a fresh sandbox
        while (retryCount <= maxRetries) {
          if (retryCount > 0) {
            // Backoff before retry
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
            const jitter = delay * 0.2 * Math.random();
            await new Promise(r => setTimeout(r, delay + jitter));

            // Re-check cancellation before retry
            if (signal?.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }
          }

          const attemptResult = await executeItemWithLifecycle<TItem, TOutput>(
            item,
            lifecycle,
            lifecycleCtx,
            timeout,
            keepSandboxOnFailure,
            itemId,
          );

          if (attemptResult.error) {
            lastError = attemptResult.error;
            // Don't retry abort errors
            if (lastError.message.toLowerCase().includes('abort')) break;
            retryCount++;
          } else {
            output = attemptResult.output;
            lastError = null;
            break;
          }
        }

        const itemCompletedAt = new Date();
        const finalRetryCount = retryCount > 0 ? retryCount - (lastError ? 0 : 1) : 0;

        if (lastError) {
          failedCount++;
        } else {
          succeededCount++;
        }

        const itemResult: ItemResult = {
          itemId,
          itemVersion: 0,
          input: item.input,
          output,
          groundTruth: item.groundTruth ?? null,
          error: lastError ? { message: lastError.message, stack: lastError.stack } : null,
          startedAt: itemStartedAt,
          completedAt: itemCompletedAt,
          retryCount: finalRetryCount,
        };

        // Run scorers
        const itemScores = await runScorersForItem(
          scorers,
          {
            input: item.input,
            groundTruth: item.groundTruth,
            metadata: item.metadata,
          },
          output,
          storage ?? null,
          experimentId,
          'agent',
          'sandbox',
          itemId,
        );

        // Persist result
        if (experimentsStore) {
          try {
            await experimentsStore.addExperimentResult({
              experimentId,
              itemId,
              itemDatasetVersion: null,
              input: item.input,
              output,
              groundTruth: item.groundTruth ?? null,
              error: lastError ? { message: lastError.message, stack: lastError.stack } : null,
              startedAt: itemStartedAt,
              completedAt: itemCompletedAt,
              retryCount: finalRetryCount,
              traceId: null,
            });
          } catch (persistError) {
            console.warn(`Failed to persist sandbox result for item ${itemId}:`, persistError);
          }
        }

        results[idx] = {
          ...itemResult,
          scores: itemScores,
        };
      },
      { concurrency: maxConcurrency },
    );
  } catch {
    // Abort or other fatal error — return partial results
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

  // ── Finalize ──
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERNALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ItemExecutionResult<TOutput> {
  output: TOutput | null;
  error: Error | null;
}

/**
 * Execute a single item through the full lifecycle:
 * setup → execute → teardown (always)
 */
async function executeItemWithLifecycle<TItem extends SandboxExperimentItem, TOutput>(
  item: TItem,
  lifecycle: SandboxExperimentLifecycle<TItem, TOutput>,
  ctx: SandboxLifecycleContext,
  timeout: number,
  keepSandboxOnFailure: boolean,
  itemId: string,
): Promise<ItemExecutionResult<TOutput>> {
  let handle: SandboxHandle = {};
  let output: TOutput | null = null;
  let error: Error | null = null;

  try {
    // Setup with timeout
    handle = await withTimeout(lifecycle.setup(item, ctx), timeout, `Setup timed out for item ${itemId}`);

    // Execute with remaining timeout
    output = await withTimeout(lifecycle.execute(item, handle, ctx), timeout, `Execution timed out for item ${itemId}`);
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    if (keepSandboxOnFailure && handle.workspacePath) {
      console.warn(`Keeping sandbox for failed item ${itemId}: ${handle.workspacePath}`);
    }
  } finally {
    // Teardown always runs
    const teardownResult: SandboxItemResult<TOutput> = {
      output: output ?? undefined,
      error: error ?? undefined,
    };
    try {
      await lifecycle.teardown(handle, teardownResult);
    } catch (teardownError) {
      console.warn(`Teardown error for item ${itemId}:`, teardownError);
    }
  }

  return { output, error };
}

/**
 * Resolve items from config (inline array or dataset ID).
 */
async function resolveItems<TItem extends SandboxExperimentItem>(
  mastra: Mastra,
  config: Pick<SandboxExperimentConfig<TItem, any>, 'items' | 'datasetId'>,
): Promise<TItem[]> {
  if (config.items) {
    return config.items.map((item, idx) => ({
      ...item,
      id: item.id ?? `sandbox-${idx}`,
    }));
  }

  if (config.datasetId) {
    const storage = mastra.getStorage();
    const datasetsStore = await storage?.getStore('datasets');
    if (!datasetsStore) {
      throw new Error('DatasetsStorage not configured');
    }

    const dataset = await datasetsStore.getDatasetById({ id: config.datasetId });
    if (!dataset) {
      throw new Error(`Dataset not found: ${config.datasetId}`);
    }

    const versionItems = await datasetsStore.getItemsByVersion({
      datasetId: config.datasetId,
      version: dataset.version,
    });

    // Cast dataset items to TItem — consumers must ensure the dataset
    // items conform to their expected shape.
    return versionItems.map(v => ({
      id: v.id,
      input: v.input,
      groundTruth: v.groundTruth,
      metadata: v.metadata,
      // Dataset items may carry workspace/environment/memory
      // in requestContext if captured from real sessions.
      ...(v.requestContext as Record<string, unknown> | undefined),
    })) as unknown as TItem[];
  }

  return [];
}

/**
 * Execute a promise with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
