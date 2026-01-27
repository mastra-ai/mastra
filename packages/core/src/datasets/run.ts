import { randomUUID } from 'node:crypto';

import type { Agent } from '../agent';
import type { IMastraLogger } from '../logger';
import type { DatasetsStorage } from '../storage/domains/datasets/base';
import type { Workflow } from '../workflows';

import type {
  DatasetItem,
  DatasetRun,
  DatasetRunResult,
  DatasetRunTargetType,
  RunDatasetOptions,
  RunDatasetResult,
} from './types';

export type RunDatasetInternalOptions = RunDatasetOptions & {
  storage: DatasetsStorage;
  getAgent?: (id: string) => Agent | undefined;
  getWorkflow?: (id: string) => Workflow | undefined;
  /** If provided, use this existing run instead of creating a new one */
  existingRun?: DatasetRun;
  /** Pre-fetched items (for async variant to avoid duplicate fetch) */
  existingItems?: DatasetItem[];
};

/**
 * Executes a dataset run against a target (agent, workflow, or custom function).
 * Processes all dataset items with configurable concurrency, tracks progress,
 * and stores results in storage.
 *
 * @param options - Configuration for the dataset run
 * @param options.datasetId - ID of the dataset to run
 * @param options.target - Target to evaluate (agent, workflow, or custom function)
 * @param options.scorerIds - Optional scorer IDs to use for evaluation
 * @param options.name - Optional name for this run
 * @param options.onProgress - Optional callback for progress updates
 * @param options.concurrency - Concurrency limit (default: 1)
 * @param options.asOf - Point-in-time query timestamp
 * @param options.metadata - Custom metadata for the run
 * @param options.storage - Storage adapter for datasets
 * @param options.getAgent - Function to retrieve agent by ID
 * @param options.getWorkflow - Function to retrieve workflow by ID
 * @param options.existingRun - Optional existing run to continue (for async mode)
 * @param options.existingItems - Optional pre-fetched items (for async mode)
 * @returns The completed run record and all results
 */
export async function runDataset(options: RunDatasetInternalOptions): Promise<RunDatasetResult> {
  const {
    datasetId,
    target,
    scorerIds = [],
    name,
    onProgress,
    concurrency = 1,
    asOf,
    metadata,
    storage,
    getAgent,
    getWorkflow,
    existingRun,
    existingItems,
  } = options;

  // Use existing items or fetch them
  let items: DatasetItem[];
  if (existingItems) {
    items = existingItems;
  } else {
    const itemsResponse = await storage.listDatasetItems({
      options: { datasetId, asOf },
      pagination: { page: 1, perPage: false },
    });
    items = itemsResponse.items;
  }

  // Use existing run or create new one
  let run: DatasetRun;
  if (existingRun) {
    run = existingRun;
  } else {
    const targetType: DatasetRunTargetType = resolveTargetType(target);
    const targetId = resolveTargetId(target);
    run = await storage.createDatasetRun({
      datasetId,
      name,
      targetType,
      targetId,
      scorerIds,
      itemCount: items.length,
      metadata,
    });
  }

  const results: DatasetRunResult[] = [];
  let completedCount = 0;

  // Process items with concurrency control
  if (concurrency === 1) {
    // Sequential processing
    for (const item of items) {
      const result = await processItem(item, target, run.id, getAgent, getWorkflow);
      results.push(result);
      await storage.createDatasetRunResult({
        runId: run.id,
        itemId: item.id,
        actualOutput: result.actualOutput,
        traceId: result.traceId,
        status: result.status,
        error: result.error,
        durationMs: result.durationMs,
      });

      completedCount++;
      run = await storage.updateDatasetRun({ id: run.id, payload: { completedCount } });
      onProgress?.(completedCount, items.length);
    }
  } else {
    // Concurrent processing with pool pattern
    const pool: Promise<void>[] = [];
    let itemIndex = 0;

    const processNext = async (): Promise<void> => {
      while (itemIndex < items.length) {
        const currentIndex = itemIndex++;
        const item = items[currentIndex]!;

        const result = await processItem(item, target, run.id, getAgent, getWorkflow);
        results[currentIndex] = result;
        await storage.createDatasetRunResult({
          runId: run.id,
          itemId: item.id,
          actualOutput: result.actualOutput,
          traceId: result.traceId,
          status: result.status,
          error: result.error,
          durationMs: result.durationMs,
        });

        completedCount++;
        run = await storage.updateDatasetRun({ id: run.id, payload: { completedCount } });
        onProgress?.(completedCount, items.length);
      }
    };

    // Start concurrent workers
    for (let i = 0; i < Math.min(concurrency, items.length); i++) {
      pool.push(processNext());
    }

    await Promise.all(pool);
  }

  // Determine final status
  const allFailed = results.length > 0 && results.every(r => r.status === 'error');
  const finalStatus = allFailed ? 'failed' : 'completed';

  run = await storage.updateDatasetRun({
    id: run.id,
    payload: {
      status: finalStatus,
      completedAt: new Date(),
    },
  });

  return { run, results };
}

export type StartDatasetRunAsyncOptions = RunDatasetInternalOptions & {
  logger?: IMastraLogger;
};

/**
 * Starts a dataset run asynchronously (fire-and-forget pattern).
 * Creates the run record and returns immediately while processing continues in background.
 *
 * @param options - Same options as runDataset, plus optional logger
 * @returns The run record (processing continues in background)
 */
export async function startDatasetRunAsync(options: StartDatasetRunAsyncOptions): Promise<{ run: DatasetRun }> {
  const { datasetId, target, scorerIds = [], name, metadata, storage, logger } = options;

  // Fetch items to get count for run record
  const itemsResponse = await storage.listDatasetItems({
    options: { datasetId, asOf: options.asOf },
    pagination: { page: 1, perPage: false },
  });
  const items = itemsResponse.items;

  // Resolve target type and ID for storage
  const targetType: DatasetRunTargetType = resolveTargetType(target);
  const targetId = resolveTargetId(target);

  // Create run record with 'running' status
  const run = await storage.createDatasetRun({
    datasetId,
    name,
    targetType,
    targetId,
    scorerIds,
    itemCount: items.length,
    metadata,
  });

  // Fire-and-forget: execute in background with existing run and items
  runDataset({
    ...options,
    existingRun: run,
    existingItems: items,
  }).catch(err => {
    logger?.error(`Dataset run ${run.id} failed:`, err);
  });

  return { run };
}

/**
 * Processes a single dataset item against the target.
 * Captures output, timing, and any errors.
 */
async function processItem(
  item: DatasetItem,
  target: RunDatasetOptions['target'],
  runId: string,
  getAgent?: (id: string) => Agent | undefined,
  getWorkflow?: (id: string) => Workflow | undefined,
): Promise<DatasetRunResult> {
  const startTime = Date.now();

  try {
    let actualOutput: unknown;
    let traceId: string | undefined;

    if (target.type === 'agent') {
      const agent = getAgent?.(target.agentId);
      if (!agent) {
        throw new Error(`Agent "${target.agentId}" not found`);
      }
      // MessageListInput accepts string as a prompt
      const result = await agent.generate(JSON.stringify(item.input));
      actualOutput = result;
      traceId = result.traceId;
    } else if (target.type === 'workflow') {
      const workflow = getWorkflow?.(target.workflowId);
      if (!workflow) {
        throw new Error(`Workflow "${target.workflowId}" not found`);
      }
      const workflowRun = await workflow.createRun();
      const result = await workflowRun.start({ inputData: item.input as any });
      actualOutput = result;
      // Workflows don't expose traceId in result yet
    } else {
      // Custom function
      actualOutput = await target.fn(item.input);
    }

    return {
      id: randomUUID(),
      runId,
      itemId: item.id,
      actualOutput,
      traceId,
      status: 'success' as const,
      durationMs: Date.now() - startTime,
      createdAt: new Date(),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      id: randomUUID(),
      runId,
      itemId: item.id,
      actualOutput: null,
      status: 'error' as const,
      error,
      durationMs: Date.now() - startTime,
      createdAt: new Date(),
    };
  }
}

/** Resolves target type enum from target config */
function resolveTargetType(target: RunDatasetOptions['target']): DatasetRunTargetType {
  switch (target.type) {
    case 'agent':
      return 'AGENT';
    case 'workflow':
      return 'WORKFLOW';
    case 'custom':
      return 'CUSTOM';
  }
}

/** Resolves target ID (agent/workflow name) from target config */
function resolveTargetId(target: RunDatasetOptions['target']): string | undefined {
  if (target.type === 'agent') {
    return target.agentId;
  }
  if (target.type === 'workflow') {
    return target.workflowId;
  }
  return undefined;
}
