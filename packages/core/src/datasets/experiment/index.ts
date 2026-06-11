import { MastraError } from '../../error/index.js';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { DatasetRecord } from '../../storage/types';
import { executeTarget } from './executor';
import type { Target, ExecutionResult, ToolReplayExecutionOptions } from './executor';
import { extractToolReplayEvents } from './replay';
import { resolveScorers, resolveStepScorers, runScorersForItem, runStepScorersForItem } from './scorer';
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
  /** Explicit source trace for tool replay (inline items; storage-backed items use metadata.replayTraceId) */
  replayTraceId?: string;
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
export { executeTarget, type Target, type ExecutionResult, type ToolReplayExecutionOptions } from './executor';
export { resolveScorers, runScorersForItem } from './scorer';
// Only the report-facing types are public API; the replay mechanics
// (extraction, state, hooks) are internal to the experiment runner.
export {
  type ToolMockConfig,
  type ToolMockDataConfig,
  type ToolMockExpectation,
  type ToolMockExpectationResult,
  type ToolMockFunction,
  type ToolMockUsage,
  type ToolReplayEvent,
  type ToolReplayMatching,
  type ToolReplayOnMiss,
  type ToolReplayMiss,
  type ToolReplayArgMismatch,
  type ToolReplayReport,
} from './replay';

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
    itemIds,
    experimentId: providedExperimentId,
    name,
    description,
    metadata,
    requestContext: globalRequestContext,
    agentVersion,
    versions,
    toolReplay,
    toolMocks,
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
          replayTraceId: dataItem.replayTraceId,
        };
      });
      datasetVersion = null;
    } else if (datasetId) {
      // Storage-backed data path (existing)
      if (!datasetsStore) {
        throw new Error('DatasetsStorage not configured. Configure storage in Mastra instance.');
      }

      datasetRecord = await datasetsStore.getDatasetById({ id: datasetId });
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
      }));
    } else {
      throw new Error('No data source: provide datasetId or data');
    }

    if (itemIds && itemIds.length > 0) {
      const wanted = new Set(itemIds);
      items = items.filter(item => wanted.has(item.id));
      if (items.length === 0) {
        throw new MastraError({
          id: 'EXPERIMENT_NO_ITEMS',
          text: `No items match itemIds [${itemIds.join(', ')}]${datasetId ? ` in dataset ${datasetId} at version ${datasetVersion}` : ''}`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }
    }
  } catch (err) {
    await markFailedOnSetupError(err);
    throw err; // unreachable, but satisfies TS control flow
  }

  // Phase B — Resolve task function
  let execFn: (item: ExperimentItem, signal?: AbortSignal) => Promise<ExecutionResult>;

  // Tool replay setup: validate target support and build the per-item source-trace
  // resolver. Recorded events come from the source trace's tool spans — replay
  // needs no separate artifact because experiments persist traceId per result.
  let resolveToolReplay: ((item: ExperimentItem) => Promise<ToolReplayExecutionOptions>) | undefined;

  try {
    if ((toolReplay || toolMocks) && (config.task || targetType !== 'agent')) {
      const feature = toolReplay ? 'toolReplay' : 'toolMocks';
      throw new MastraError({
        id: 'EXPERIMENT_TOOL_REPLAY_UNSUPPORTED_TARGET',
        text: `${feature} is only supported for agent targets (got ${config.task ? 'inline task' : `targetType '${targetType}'`})`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    if (toolReplay) {

      const observabilityStore = await storage?.getStore('observability');
      if (!observabilityStore) {
        throw new MastraError({
          id: 'EXPERIMENT_TOOL_REPLAY_NO_OBSERVABILITY',
          text: 'toolReplay requires observability storage to load recorded traces. Configure storage in Mastra instance.',
          domain: 'STORAGE',
          category: 'USER',
        });
      }

      // itemId → traceId from the prior experiment's results
      let recordingByItemId: Map<string, { traceId: string; itemDatasetVersion: number | null }> | undefined;
      if (toolReplay.fromExperimentId) {
        if (!experimentsStore) {
          throw new MastraError({
            id: 'EXPERIMENT_TOOL_REPLAY_NO_EXPERIMENTS_STORE',
            text: 'toolReplay.fromExperimentId requires experiments storage. Configure storage in Mastra instance.',
            domain: 'STORAGE',
            category: 'USER',
          });
        }
        const sourceExperiment = await experimentsStore.getExperimentById({ id: toolReplay.fromExperimentId });
        if (!sourceExperiment) {
          throw new MastraError({
            id: 'EXPERIMENT_TOOL_REPLAY_SOURCE_NOT_FOUND',
            text: `toolReplay.fromExperimentId '${toolReplay.fromExperimentId}' does not match any experiment`,
            domain: 'STORAGE',
            category: 'USER',
          });
        }
        // Replay runs short-circuit tools before any tool span is created, so
        // a replay experiment's traces contain no tool spans — chaining one as
        // a recording source would make every item miss (onMiss 'error') or
        // run fully live (onMiss 'passthrough'). Recordings must come from
        // live runs. Experiment metadata is user-writable, so match the exact
        // marker shape this feature stamps (an object carrying onMiss) rather
        // than bare truthiness — an unrelated user `toolReplay` key must not
        // disqualify a live recording source.
        const sourceMarker = (sourceExperiment.metadata as Record<string, unknown> | null | undefined)?.toolReplay;
        if (typeof sourceMarker === 'object' && sourceMarker !== null && ('onMiss' in sourceMarker || 'mockedTools' in sourceMarker)) {
          throw new MastraError({
            id: 'EXPERIMENT_TOOL_REPLAY_SOURCE_IS_REPLAY',
            text: `Experiment '${toolReplay.fromExperimentId}' is itself a tool replay run; its traces contain no tool spans. Use the original live experiment as fromExperimentId.`,
            domain: 'STORAGE',
            category: 'USER',
          });
        }
        const priorResults = await experimentsStore.listExperimentResults({
          experimentId: toolReplay.fromExperimentId,
          pagination: { page: 0, perPage: false },
        });
        recordingByItemId = new Map(
          priorResults.results
            .filter(r => r.traceId)
            .map(r => [r.itemId, { traceId: r.traceId as string, itemDatasetVersion: r.itemDatasetVersion }]),
        );
      }

      const onMiss = toolReplay.onMiss ?? 'error';
      // Memoized per item so the retry loop doesn't refetch the trace
      const cache = new Map<string, Promise<Omit<ToolReplayExecutionOptions, 'onMiss'> & { found: boolean }>>();
      resolveToolReplay = async (item: ExperimentItem) => {
        let pending = cache.get(item.id);
        if (!pending) {
          pending = (async () => {
            const mapped = recordingByItemId?.get(item.id);
            const traceId =
              item.replayTraceId ??
              (typeof item.metadata?.replayTraceId === 'string' ? item.metadata.replayTraceId : undefined) ??
              mapped?.traceId ??
              null;
            if (!traceId) return { events: [], sourceTraceId: null, found: false };
            const trace = await observabilityStore.getTrace({ traceId });
            // A resolved traceId whose trace is missing/empty is a lost
            // recording (purged retention, unflushed exporter) — distinct from
            // a recording that legitimately contains zero tool calls.
            if (!trace?.spans?.length) return { events: [], sourceTraceId: traceId, found: false };
            // Recording came from a different version of this item — the item
            // was edited after the recording was made.
            const staleRecording =
              mapped?.traceId === traceId &&
              mapped.itemDatasetVersion != null &&
              item.datasetVersion != null &&
              mapped.itemDatasetVersion !== item.datasetVersion;
            return {
              events: extractToolReplayEvents(trace.spans),
              sourceTraceId: traceId,
              found: true,
              ...(staleRecording ? { staleRecording } : {}),
            };
          })();
          cache.set(item.id, pending);
          // Don't cache failures — a transient storage error should be retryable
          pending.catch(() => cache.delete(item.id));
        }
        const { found, ...resolved } = await pending;
        if (!found) {
          // Never run silently live (or silently all-miss) when there is no
          // recording — that defeats the point of replay. If live execution is
          // wanted, run without toolReplay.
          throw new MastraError({
            id: 'EXPERIMENT_TOOL_REPLAY_NO_RECORDING',
            text: resolved.sourceTraceId
              ? `Tool replay recording not found for item ${item.id}: trace ${resolved.sourceTraceId} is missing or empty (purged retention or unflushed exporter?)`
              : `No tool replay recording resolved for item ${item.id}. Inline data items need explicit ids for fromExperimentId mapping; otherwise set replayTraceId on the item.`,
            domain: 'STORAGE',
            category: 'USER',
          });
        }
        return { ...resolved, onMiss, matching: toolReplay.matching ?? 'fifo', replayActive: true };
      };
    }

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
      execFn = async (item, itemSignal) => {
        // Merge global request context with per-item request context (item takes precedence)
        const mergedRequestContext =
          globalRequestContext || item.requestContext ? { ...globalRequestContext, ...item.requestContext } : undefined;
        let itemToolReplay: ToolReplayExecutionOptions | undefined;
        if (resolveToolReplay) {
          // A failed resolution fails the item, not the whole experiment
          try {
            itemToolReplay = await resolveToolReplay(item);
          } catch (err: unknown) {
            if (err instanceof MastraError && err.id === 'EXPERIMENT_TOOL_REPLAY_NO_RECORDING') {
              return {
                output: null,
                error: { message: err.message, code: 'TOOL_REPLAY_NO_RECORDING' },
                traceId: null,
              };
            }
            return {
              output: null,
              error: {
                message: `Failed to load tool replay recording: ${err instanceof Error ? err.message : String(err)}`,
                code: 'TOOL_REPLAY_LOAD_FAILED',
              },
              traceId: null,
            };
          }
        }
        if (toolMocks) {
          // Mocks ride on the same execution options. Mock-only runs get an
          // inactive replay (unmocked tools execute live, nothing misses).
          itemToolReplay = itemToolReplay
            ? { ...itemToolReplay, mocks: toolMocks }
            : { events: [], sourceTraceId: null, onMiss: 'error', replayActive: false, mocks: toolMocks };
        }
        return executeTarget(target, targetType, item, {
          signal: itemSignal,
          requestContext: mergedRequestContext,
          experimentId,
          versions,
          toolReplay: itemToolReplay,
        });
      };
    } else {
      throw new Error('No task: provide targetType+targetId or task');
    }
  } catch (err) {
    await markFailedOnSetupError(err);
    throw err; // unreachable, but satisfies TS control flow
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

  // Mark replay/mock experiments in their metadata so stored runs are
  // distinguishable from live runs (dashboards and score comparisons must
  // never silently mix the two, and such runs are refused as replay sources —
  // their traces lack tool spans for replayed/mocked calls).
  const experimentMetadata =
    toolReplay || toolMocks
      ? {
          ...metadata,
          toolReplay: {
            ...(toolReplay
              ? {
                  fromExperimentId: toolReplay.fromExperimentId,
                  onMiss: toolReplay.onMiss ?? 'error',
                  matching: toolReplay.matching ?? 'fifo',
                }
              : {}),
            ...(toolMocks ? { mockedTools: Object.keys(toolMocks) } : {}),
          },
        }
      : metadata;

  // 5. Create experiment record (if storage available and not pre-created)
  if (experimentsStore) {
    if (!providedExperimentId) {
      // Create new experiment record (sync trigger path)
      await experimentsStore.createExperiment({
        id: experimentId,
        name,
        description,
        metadata: experimentMetadata,
        datasetId: datasetId ?? null,
        datasetVersion,
        targetType: targetType ?? 'agent',
        targetId: targetId ?? 'inline',
        totalItems: items.length,
        agentVersion,
      });
    }
    // Update status to running (both sync and async paths)
    // Also set totalItems — needed for the async path where the experiment
    // was created with totalItems: 0 before items were resolved.
    // The replay marker is re-set here so the async path (record pre-created
    // without it) gets stamped too; runExperiment receives the same metadata,
    // so the replace is lossless.
    await experimentsStore.updateExperiment({
      id: experimentId,
      status: 'running',
      totalItems: items.length,
      startedAt,
      ...(toolReplay ? { metadata: experimentMetadata } : {}),
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
          // Don't retry deterministic tool replay failures — neither the
          // recording (miss) nor its absence (no recording: the resolver
          // memoizes resolved lookups) can change within a run. Checked before
          // the message heuristic so the structured codes stay load-bearing.
          if (
            execResult.error.code === 'TOOL_REPLAY_MISS' ||
            execResult.error.code === 'TOOL_REPLAY_NO_RECORDING' ||
            execResult.error.code === 'TOOL_MOCK_EXPECTATION_FAILED'
          )
            break;
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
          ...(execResult.toolReplay ? { toolReplay: execResult.toolReplay } : {}),
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

        // Persist result with scores (if storage available)
        if (experimentsStore) {
          try {
            // The replay report is persisted in its own column — never inside
            // the stored output — so scorers and consumers see the same output
            // a live run would produce, and reports stay queryable. Failed
            // items (output null) keep their report too: failures are when
            // the report is most needed for debugging over the API.
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
              toolReplay: execResult.toolReplay ?? null,
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
