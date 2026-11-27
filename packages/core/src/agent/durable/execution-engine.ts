import { ErrorCategory, ErrorDomain, MastraError, getErrorFromUnknown } from '../../error';
import type { PubSub } from '../../events/pubsub';
import { reachesOtherProcesses } from '../../events/reach';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { ObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage, WorkflowsStorage } from '../../storage';
import { warnUnsupportedEventedSetup } from '../../workflows/evented/setup-warning';
import type { ShouldPersistSnapshotFn, WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  AGENT_STREAM_TOPIC,
  AgentStreamEventTypes,
  DURABLE_STOP_WHEN_ERROR_ID,
  DurableStepIds,
  RECOVER_ALREADY_IN_PROGRESS_ERROR_ID,
  RECOVER_CHECKPOINT_NOT_AVAILABLE_ERROR_ID,
  RECOVER_RUN_NOT_ACTIVE_ERROR_ID,
  RECOVER_RUN_SUSPENDED_ERROR_ID,
  RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID,
  markErrorForStreamRejection,
  RECOVER_SHUTDOWN_ERROR_ID,
} from './constants';
import type { UntrackedRunLiveness } from './execution-fence';
import {
  DurableExecutionFenceError,
  EXECUTION_UNVERIFIED_ERROR_ID,
  ExecutionFence,
  fencePubSub,
  readRunGeneration,
  resolveLeaseProvider,
  supportsRunFencing,
  RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID,
} from './execution-fence';
import { withExecutionStreamProducer } from './execution-stream-publisher';
import { openStepsOfCrashedSegment } from './segment-spans';
import { createSupersededEventFilter, emitAbortEvent, newestLogIndex } from './stream-adapter';
import type {
  DurableAgentActiveRun,
  DurableAgentListActiveRunsOptions,
  DurableAgentListActiveRunsResult,
  AgentStreamEvent,
  DurableAgenticWorkflowInput,
  DurableToolCallInput,
} from './types';
import {
  createDurableAgenticWorkflow,
  defaultShouldPersistSnapshot,
} from './workflows/create-durable-agentic-workflow';
import { MAP_FINAL_OUTPUT_STEP_ID } from './workflows/durable-loop-builder';
import { readAccumulatedSteps } from './workflows/shared/accumulated-steps';
import { latestMessageListState } from './workflows/shared/message-list-state';

export type DurableWorkflow = ReturnType<typeof createDurableAgenticWorkflow>;
type DurableRun = Awaited<ReturnType<DurableWorkflow['createRun']>>;
export type ExecutionCompletion = { result: Awaited<ReturnType<DurableRun['start']>> } | { error: unknown };
export type ExecutionOutcome = { owner: 'agent'; status?: string; error?: Error } | { owner: 'workers'; error?: Error };

/** Recoveries in progress in this process, keyed by agent and run. */
const localRecoveryClaims = new Map<string, string>();

const unfencedStoresWarned = new WeakSet<WorkflowsStorage | MemoryStorage>();

// Bound hydrated snapshots independently of the caller's filtered result page (#21501).
const ACTIVE_RUNS_STORAGE_BATCH_SIZE = 100;

export interface DurableWorkflowOptions {
  maxSteps?: number;
  workflowEngine: 'default' | 'evented';
  storesRunsInJournal: boolean;
  shouldPersistSnapshot?: ShouldPersistSnapshotFn;
  logger: IMastraLogger;
  guardrailLogger?: IMastraLogger;
}

export class DefaultAgentExecutionEngine {
  #workflow: DurableWorkflow | null = null;
  #resolvedWorkflowEngine: 'default' | 'evented' | null = null;
  #warnedPersistencePolicy = false;
  /** Canceled parked runs whose abort terminal this process already published. */
  #canceledRunTerminals = new Set<string>();

  constructor(
    protected readonly id: string,
    protected mastra?: Mastra,
  ) {}
  registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }
  get workflow(): DurableWorkflow | null {
    return this.#workflow;
  }

  get executionMode(): 'blocking' | 'background' {
    return 'blocking';
  }

  /** Whether execution returns a suspended result only after its snapshot is persisted. */
  get suspendPersistedOnReturn(): boolean {
    return true;
  }

  /**
   * Whether this process runs the run's steps, which keep its registered MessageList in sync.
   * Otherwise its readers take each step's response messages from the stream.
   */
  get executesStepsLocally(): boolean {
    return true;
  }

  async readReplayFloor(
    pubsub: PubSub,
    runId: string,
    offset: number | undefined,
  ): Promise<{
    minGeneration?: number;
    keepReplayEvent: (event: AgentStreamEvent) => boolean;
    attachedAtLogIndex: number | undefined;
  }> {
    const history = (await pubsub.getHistory(AGENT_STREAM_TOPIC(runId), 0)) as AgentStreamEvent[];
    const keepReplayEvent = createSupersededEventFilter(history);
    const attachedAtLogIndex = newestLogIndex(history);
    if (!offset) return { keepReplayEvent, attachedAtLogIndex };
    // The floor is the highest generation among the events the client already
    // consumed, i.e. everything below its offset. It is a blunt instrument:
    // `keepReplayEvent` already drops exactly the ranges a later execution
    // declared abandoned, so the floor only exists to stop a stale frame from
    // a lost execution reaching a client that has moved past it.
    //
    // A floor read off the log can only be too low, never too high, and too
    // low is covered by `keepReplayEvent`. So whenever the log holds anything
    // below the offset, use it. Requiring the indices below the offset to be
    // contiguous would be stricter but wrong: one hole from a failed append
    // (possible on the non-atomic composed fallback) would fall through to the
    // run's current generation and discard committed output from an earlier
    // generation that was never superseded.
    //
    // Storage is consulted only when the log holds nothing below the offset,
    // which is the case where there is genuinely no evidence. Indices are
    // opaque cursors seeded per log (see MastraServerCache.listPushIndexed),
    // so a log recreated after expiry numbers above an old offset and lands
    // here rather than answering from the wrong segment.
    let first: number | undefined;
    let floor: number | undefined;
    for (const event of history) {
      const index = event.index;
      if (typeof index !== 'number' || index >= offset) continue;
      if (first === undefined || index < first) first = index;
      const generation = event.generation;
      if (typeof generation === 'number' && (floor === undefined || generation > floor)) floor = generation;
    }
    if (first !== undefined) {
      return { minGeneration: floor, keepReplayEvent, attachedAtLogIndex };
    }
    return { minGeneration: await readRunGeneration(this.mastra, runId), keepReplayEvent, attachedAtLogIndex };
  }

  async loadSuspendedIteration(
    workflowsStore: WorkflowsStorage | undefined,
    runId: string,
  ): Promise<{ toolCalls: DurableToolCallInput[]; resumedText?: { priorText: string; stepText: string } }> {
    const outerRun = await workflowsStore?.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    if (!outerRun) return { toolCalls: [] };
    const outerSnapshot: WorkflowRunState =
      typeof outerRun.snapshot === 'string' ? JSON.parse(outerRun.snapshot) : outerRun.snapshot;
    const iteration = outerSnapshot.context?.[DurableStepIds.AGENTIC_EXECUTION];
    const nestedRunId = iteration?.metadata?.nestedRunId ?? runId;
    const persisted = await workflowsStore?.getWorkflowRunById({
      runId: nestedRunId,
      workflowName: DurableStepIds.AGENTIC_EXECUTION,
    });
    if (!persisted) return { toolCalls: [] };

    const snapshot =
      typeof persisted.snapshot === 'string'
        ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
        : persisted.snapshot;
    const llmStep = snapshot.context?.[DurableStepIds.LLM_EXECUTION];
    if (llmStep?.status !== 'success') return { toolCalls: [] };
    // The step records hold completed iterations (in workflow state, or in the
    // nested input on runs that never seeded them); the LLM output holds the
    // current iteration, which has not reached the accumulator yet.
    const accumulatedSteps: Array<{ text?: string; toolCalls?: DurableToolCallInput[]; finishReason?: string }> =
      readAccumulatedSteps(snapshot.value, snapshot.context.input);
    const toolCalls: DurableToolCallInput[] = [
      ...accumulatedSteps.flatMap(step => step.toolCalls ?? []),
      ...(llmStep.output.toolCalls ?? []),
    ];
    // The text streamed before the suspension belongs to the resumed run's text, as on the
    // plain Agent, which restores it from its own snapshot (#27504).
    const stepText: string = llmStep.output.text ?? '';
    const priorText = accumulatedSteps
      .filter(step => step.finishReason !== 'retry')
      .map(step => step.text ?? '')
      .join('');

    return { toolCalls, resumedText: { priorText, stepText } };
  }

  /** Capture the history boundary so a resumed reader skips its prior segment. */
  async getPubsubOffset(pubsub: PubSub, runId: string): Promise<number | 'latest'> {
    const historyPubsub = pubsub as PubSub & {
      getHistory?: (topic: string) => Promise<unknown[]>;
    };
    if (typeof historyPubsub.getHistory !== 'function') return 'latest';
    try {
      const history = await historyPubsub.getHistory(AGENT_STREAM_TOPIC(runId));
      if (!Array.isArray(history) || history.length === 0) return 'latest';
      // Indices are opaque cursors, not list positions: a log recreated after
      // expiry is epoch-seeded (see MastraServerCache.listPushIndexed), so the
      // boundary is one past the newest numbered frame. Using the history
      // length here would sit below every seeded index and replay the prior
      // segment — including its terminal event — into the resumed reader.
      let newest = -1;
      for (const event of history) {
        const index = (event as { index?: unknown })?.index;
        if (typeof index === 'number' && index > newest) newest = index;
      }
      return newest >= 0 ? newest + 1 : 'latest';
    } catch {
      return 'latest';
    }
  }

  async loadLatestMessageListState(
    workflowsStore: WorkflowsStorage,
    runId: string,
    fallbackSnapshot: WorkflowRunState,
  ): Promise<unknown> {
    let latest: unknown;
    try {
      // Evented iterations have their own run id; the parent records the active one.
      const nestedRunId = fallbackSnapshot.context?.[DurableStepIds.AGENTIC_EXECUTION]?.metadata?.nestedRunId;
      const nested = await workflowsStore.getWorkflowRunById({
        runId: typeof nestedRunId === 'string' ? nestedRunId : runId,
        workflowName: DurableStepIds.AGENTIC_EXECUTION,
      });
      const snapshot = typeof nested?.snapshot === 'string' ? JSON.parse(nested.snapshot) : nested?.snapshot;
      latest = snapshot && latestMessageListState(snapshot);
    } catch {
      // Fall back to the supplied snapshot.
    }
    latest ??= latestMessageListState(fallbackSnapshot);
    return latest;
  }

  async listActiveRuns(
    agentId: string,
    agentName: string,
    options: DurableAgentListActiveRunsOptions,
  ): Promise<DurableAgentListActiveRunsResult> {
    const { threadId, resourceId, fromDate, toDate, perPage, page } = options;

    if (perPage !== undefined && (!Number.isInteger(perPage) || perPage <= 0)) {
      throw new MastraError({
        id: 'DURABLE_AGENT_LIST_ACTIVE_RUNS_INVALID_PER_PAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${agentName}" listActiveRuns() requires perPage to be a positive integer.`,
        details: { agentName, perPage },
      });
    }
    if (page !== undefined && (!Number.isInteger(page) || page < 0)) {
      throw new MastraError({
        id: 'DURABLE_AGENT_LIST_ACTIVE_RUNS_INVALID_PAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${agentName}" listActiveRuns() requires page to be a non-negative integer.`,
        details: { agentName, page },
      });
    }

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');

    if (!workflowsStore) {
      throw new MastraError({
        id: 'DURABLE_AGENT_LIST_ACTIVE_RUNS_NO_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${agentName}" listActiveRuns() requires storage to discover running runs. ` +
          `Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL). See https://mastra.ai/docs/storage`,
        details: { agentName },
      });
    }

    // Scan every candidate for an exact filtered total, but retain only the requested page.
    const runs: DurableAgentActiveRun[] = [];
    const start = perPage !== undefined && page !== undefined ? page * perPage : 0;
    const end = perPage !== undefined && page !== undefined ? start + perPage : Infinity;
    let total = 0;
    for await (const { run, snapshot } of this.listRunningSnapshots(workflowsStore, {
      resourceId,
      fromDate,
      toDate,
    })) {
      // The persisted workflow input carries the owning agentId. Default-deny:
      // a snapshot without an input or whose agentId does not match this agent
      // is skipped so runs cannot leak across agents sharing the same storage.
      const input = snapshot.context?.input as
        | { agentId?: string; messageListState?: { memoryInfo?: { threadId?: string; resourceId?: string } } }
        | undefined;
      const runAgentId = input?.agentId;
      if (runAgentId !== agentId) continue;

      const memoryInfo = input?.messageListState?.memoryInfo;
      const runThreadId = memoryInfo?.threadId;
      const runResourceId = run.resourceId ?? memoryInfo?.resourceId;
      if (threadId && runThreadId !== threadId) continue;
      if (resourceId && runResourceId !== resourceId) continue;

      const index = total++;
      if (index < start || index >= end) continue;
      runs.push({
        runId: run.runId,
        status: 'running',
        threadId: runThreadId,
        resourceId: runResourceId,
        updatedAt: run.updatedAt,
      });
    }

    return { runs, total };
  }

  async *listRunningSnapshots(
    workflowsStore: WorkflowsStorage,
    options: { resourceId?: string; fromDate?: Date; toDate?: Date },
  ) {
    for (let storagePage = 0; ; storagePage++) {
      const { runs, total } = await workflowsStore.listWorkflowRuns({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        status: 'running',
        ...options,
        perPage: ACTIVE_RUNS_STORAGE_BATCH_SIZE,
        page: storagePage,
      });
      for (const run of runs) {
        let snapshot = run.snapshot;
        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot) as WorkflowRunState;
          } catch {
            continue;
          }
        }
        if (snapshot?.status === 'running') yield { run, snapshot };
      }
      // Stop also when an adapter ignores pagination and returns everything.
      if (runs.length !== ACTIVE_RUNS_STORAGE_BATCH_SIZE) break;
      if ((storagePage + 1) * ACTIVE_RUNS_STORAGE_BATCH_SIZE >= total) break;
    }
  }

  /**
   * Whether the run's persisted snapshot is still `running`. Without storage,
   * or with an unreadable snapshot, answers true so `recover()` reports why.
   */
  async isRunningSnapshot(runId: string): Promise<boolean> {
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) return true;
    const persisted = await workflowsStore.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    if (!persisted) return false;
    if (typeof persisted.snapshot !== 'string') return persisted.snapshot?.status === 'running';
    try {
      return (JSON.parse(persisted.snapshot) as WorkflowRunState)?.status === 'running';
    } catch {
      return true;
    }
  }

  untrackedRunLiveness(runId: string, workflowInput: DurableAgenticWorkflowInput) {
    const memoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = workflowInput.state?.threadId ?? memoryInfo?.threadId;
    if (!threadId) return undefined;
    const resourceId = workflowInput.state?.resourceId ?? memoryInfo?.resourceId;
    return {
      isLive: (threadPubSub: PubSub | undefined) =>
        agentThreadStreamRuntime.isRunHoldingThreadLease(threadPubSub, runId, threadId, resourceId),
      ttlMs: agentThreadStreamRuntime.threadLeaseTtlMs,
    };
  }

  raceFenceLoss<T>(operation: Promise<T>, executionFence: ExecutionFence): Promise<T> {
    const lost = new Promise<never>((_, reject) => executionFence.onLost(reject));
    // The loser of the race must not surface as an unhandled rejection.
    lost.catch(() => {});
    return Promise.race([operation, lost]);
  }

  /**
   * Record the abort of a parked run in shared storage, so a resume on any server
   * refuses it. The in-process resume fence only covers this process. The status
   * moves from `suspended` to `canceled` with a guarded write: a resume that claimed
   * the run first has already moved it to `running`, and that run is stopped by the
   * abort request instead. Stores that cannot enforce the guard atomically get the
   * same check on a best-effort basis, so a finished or running run is never marked
   * canceled. Stores without concurrent updates (some don't implement
   * `updateWorkflowState`) get the canceled status by rewriting the run's snapshot,
   * which every store supports. Resolves whether this call canceled the parked run.
   * Storage errors propagate: an abort acknowledged without this write would not stop
   * another server from resuming the run.
   */
  async cancelParkedRun(runId: string): Promise<boolean> {
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) return false;
    const workflowName = DurableStepIds.AGENTIC_LOOP;
    if (workflowsStore.supportsConcurrentUpdates()) {
      if ((await workflowsStore.loadWorkflowRunStatus({ workflowName, runId })) !== 'suspended') return false;
      const updated = await workflowsStore.updateWorkflowState({
        workflowName,
        runId,
        opts: { status: 'canceled', expectedStatus: 'suspended' },
      });
      return updated !== undefined;
    }
    const run = await workflowsStore.getWorkflowRunById({ runId, workflowName });
    const snapshot = typeof run?.snapshot === 'string' ? (JSON.parse(run.snapshot) as WorkflowRunState) : run?.snapshot;
    if (snapshot?.status !== 'suspended') return false;
    const written = await workflowsStore.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId: run?.resourceId,
      snapshot: { ...snapshot, status: 'canceled' },
      expectedStatus: 'suspended',
    });
    return written !== false;
  }

  /**
   * Publish the abort terminal for a parked run this call just canceled. The bus is
   * shared, so observers on every server close now, whichever server later refuses
   * the approval. Only the call that won the cancel publishes. A failed publish does
   * not undo the abort: the cancel is already stored, and a refused resume on this
   * server retries the publish.
   */
  async announceCanceledRun(runId: string, pubsub: PubSub): Promise<void> {
    try {
      await this.publishCanceledRunTerminal(runId, pubsub);
    } catch (error) {
      this.mastra?.getLogger?.()?.warn?.(`Failed to publish the abort of canceled run ${runId}`, { runId, error });
    }
  }

  /**
   * Publish the abort terminal of a canceled run once per process. Reserved before the
   * publish, so concurrent callers publish once; released if the publish fails, so the
   * next caller retries it.
   */
  async publishCanceledRunTerminal(runId: string, pubsub: PubSub): Promise<void> {
    if (this.#canceledRunTerminals.has(runId)) return;
    this.#canceledRunTerminals.add(runId);
    if (this.#canceledRunTerminals.size > 1000) {
      this.#canceledRunTerminals.delete(this.#canceledRunTerminals.values().next().value!);
    }
    try {
      await emitAbortEvent(pubsub, runId, { steps: [], text: '' });
    } catch (error) {
      this.#canceledRunTerminals.delete(runId);
      throw error;
    }
  }

  async isRunCanceledInStorage(runId: string): Promise<boolean> {
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    const status = await workflowsStore?.loadWorkflowRunStatus({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
    return status === 'canceled';
  }

  async claimExecution(
    runId: string,
    mode: 'acquire' | 'recover' | 'takeover',
    pubsub: PubSub,
    logger: IMastraLogger,
    untrackedRun?: UntrackedRunLiveness,
  ): Promise<ExecutionFence> {
    const fence = await ExecutionFence.claim({
      leaseProvider: resolveLeaseProvider(pubsub),
      workflowsStore: await this.mastra?.getStorage()?.getStore('workflows'),
      agentId: this.id,
      runId,
      mode,
      untrackedRun,
      logger: logger,
    });
    return fence;
  }

  async warnIfUnfenced(
    store: WorkflowsStorage | MemoryStorage | undefined,
    domain: 'workflows' | 'memory',
    guardrailLogger: IMastraLogger | undefined,
  ): Promise<boolean> {
    if (!store || (await supportsRunFencing(store).catch(() => true))) return false;
    if (unfencedStoresWarned.has(store)) return true;
    unfencedStoresWarned.add(store);
    const consequence =
      domain === 'workflows'
        ? `Recovery can only tell that a run is still live through the pubsub lease, which works only when every instance shares the pubsub, and writes from an execution that lost its run are not rejected. A run recovered while it is still live can end with the stale execution's output.`
        : `When recovery takes a run over, the memory writes (messages, threads, working memory) of the execution that lost it are not rejected.`;
    guardrailLogger?.warn(
      `DurableAgent '${this.id}': the ${domain} store (${store.constructor.name}) can't fence run writes. ${consequence} ` +
        `Use a storage adapter that supports run fencing.`,
    );
    return true;
  }

  fenceRunPubSub(
    executionFence: ExecutionFence | undefined,
    abortController: AbortController | undefined,
    pubsub: PubSub,
    workflowEngine: 'default' | 'evented',
    logger: IMastraLogger,
  ): PubSub {
    if (executionFence)
      pubsub = withExecutionStreamProducer(pubsub, {
        runId: executionFence.runId,
        agentId: this.id,
        mastra: this.mastra,
        claim: executionFence.claim,
      });
    if (!executionFence || this.resolveWorkflowEngine(workflowEngine, logger) !== 'default') return pubsub;
    executionFence.onLost(error => {
      if (abortController && !abortController.signal.aborted) abortController.abort(error);
    });
    return fencePubSub(pubsub, executionFence);
  }

  async deleteRunSnapshots(runId: string, workflow: DurableWorkflow): Promise<void> {
    try {
      await workflow.deleteWorkflowRunById(runId);
      const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
      await workflowsStore?.deleteWorkflowRunById({
        runId,
        workflowName: DurableStepIds.AGENTIC_EXECUTION,
      });
    } catch (error) {
      this.mastra
        ?.getLogger?.()
        ?.warn?.(`[DurableAgent] Failed to delete workflow snapshot rows after terminal state`, { runId, error });
    }
  }

  resolveWorkflowEngine(workflowEngine: 'default' | 'evented', logger: IMastraLogger): 'default' | 'evented' {
    if (this.#resolvedWorkflowEngine) return this.#resolvedWorkflowEngine;
    let engine = workflowEngine;
    if (engine === 'evented' && !this.mastra) {
      engine = 'default';
      logger.warn(
        `EventedAgent '${this.id}' has no Mastra host; running on the default in-process engine. ` +
          `Register the agent on a Mastra instance (with storage) to get evented execution.`,
      );
    } else if (engine === 'evented') {
      // Read `stores` directly rather than `await getStore('workflows')`: engine
      // resolution is synchronous (`getWorkflow()` is), and `getStore()` is only
      // async by signature — it returns `this.stores?.[name]` without awaiting
      // init, so this sees exactly what the engine's own gate sees.
      const storage = this.mastra?.getStorage();
      const workflowsStore = storage?.stores?.workflows;
      if (workflowsStore && !(workflowsStore.supportsConcurrentUpdates?.() ?? false)) {
        engine = 'default';
        logger.warn(
          `EventedAgent '${this.id}' is registered with ${storage?.name ?? 'a'} storage, which does not apply concurrent ` +
            `workflow updates atomically (\`supportsConcurrentUpdates()\`); running the durable loop on the default ` +
            `in-process engine instead. In-flight runs will not resume on their own after a process restart. Use a ` +
            `storage adapter that supports atomic concurrent updates (for example @mastra/libsql, @mastra/pg or ` +
            `@mastra/mysql) to get evented execution.`,
        );
      }
    }
    this.#resolvedWorkflowEngine = engine;
    return engine;
  }

  async ensureEngineWorkersStarted(workflowEngine: 'default' | 'evented', logger: IMastraLogger): Promise<void> {
    if (this.resolveWorkflowEngine(workflowEngine, logger) === 'evented') {
      await this.mastra?.__ensureExecutionWorkersStarted();
    }
  }

  createWorkflow(options: DurableWorkflowOptions): ReturnType<typeof createDurableAgenticWorkflow> {
    return createDurableAgenticWorkflow({
      maxSteps: options.maxSteps,
      // Resolved, not raw: a hostless evented agent falls back to the default
      // in-process engine (see resolveWorkflowEngine).
      engine: this.resolveWorkflowEngine(options.workflowEngine, options.logger),
      shouldPersistSnapshot: this.resolveShouldPersistSnapshot(options.shouldPersistSnapshot),
      autoStorageVersion: options.storesRunsInJournal,
    });
  }

  readonly recoveryAwarePersistencePolicy: ShouldPersistSnapshotFn = ({ workflowStatus }) => {
    return (
      workflowStatus === 'pending' ||
      workflowStatus === 'paused' ||
      workflowStatus === 'suspended' ||
      (workflowStatus === 'running' &&
        (this.mastra?.recoveryConfig?.durableAgents === 'auto' || this.mastra?.__shuttingDown === true))
    );
  };

  getWorkflow(options: DurableWorkflowOptions) {
    if (!this.#workflow) {
      if (options.storesRunsInJournal) {
        // Workflow creation is synchronous; inspect the registered store without initializing it.
        const storage = this.mastra?.getStorage();
        const workflowsStore = storage?.stores?.workflows;
        if (workflowsStore && !workflowsStore.supportsRunJournal()) {
          options.guardrailLogger?.warn(
            `DurableAgent '${this.id}' sets storageVersion: 2, which ${storage?.name ?? 'the configured'} storage ` +
              `doesn't support yet; storing new runs as version 1.`,
          );
        }
      }
      this.#workflow = this.createWorkflow(options);
      this.warnOnRiskyPersistencePolicy(options.shouldPersistSnapshot, options.guardrailLogger);
      // Register mastra on the workflow so execution steps can access agents/tools.
      // DurableAgent goes through the normal Agent registration path (not the durable wrapper
      // path that calls addWorkflow), so the workflow isn't registered in Mastra's #workflows.
      // We set mastra directly here instead.
      if (this.mastra) {
        this.#workflow.__registerMastra(this.mastra);
        this.#workflow.__registerPrimitives({
          logger: this.mastra.getLogger(),
          storage: this.mastra.getStorage(),
        });
        // Evented engine: the WorkflowEventProcessor resolves workflows by id
        // from Mastra's registries, so the loop workflow must be discoverable
        // there. Register it as an (unscoped) internal workflow — it's a
        // per-agent singleton. Without this, every run's events would be
        // unresolvable and the run would hang. Uses the resolved engine so
        // this stays consistent with the workflow instance just created.
        //
        // `distributed`: every process sharing this Mastra setup registers the
        // same loop, so a dedicated worker process can run it. Keeping its
        // events local would strand runs started in a process without workers.
        if (this.resolveWorkflowEngine(options.workflowEngine, options.logger) === 'evented') {
          this.mastra.__registerInternalWorkflow(this.#workflow, undefined, { distributed: true });
        }
      }
    }
    return this.#workflow;
  }

  warnOnRiskyPersistencePolicy(
    predicate: ShouldPersistSnapshotFn | undefined,
    guardrailLogger: IMastraLogger | undefined,
  ): void {
    if (this.#warnedPersistencePolicy) return;
    this.#warnedPersistencePolicy = true;
    if (!predicate) return;
    const probe = (workflowStatus: WorkflowRunStatus): boolean => {
      try {
        return predicate({ workflowStatus, stepResults: {} });
      } catch {
        // The predicate depends on data the probe can't fake — assume it
        // persists rather than emitting a false-positive warning.
        return true;
      }
    };
    if (!probe('suspended') || !probe('paused')) {
      guardrailLogger?.warn(
        `DurableAgent '${this.id}': the custom shouldPersistSnapshot policy does not persist 'suspended'/'paused' snapshots. ` +
          `Suspended runs cannot be resumed — human-in-the-loop flows will break.`,
      );
    }
    if (this.mastra?.recoveryConfig?.durableAgents === 'auto' && !probe('running')) {
      guardrailLogger?.warn(
        `DurableAgent '${this.id}': recovery.durableAgents is 'auto' but the custom shouldPersistSnapshot policy does not persist 'running' snapshots. ` +
          `In-flight runs of this agent are invisible to crash recovery (listActiveRuns/recoverActiveRuns).`,
      );
    }
  }
  workflowFailureError(workflowError: unknown, fallbackMessage: string): Error {
    const serialized = (workflowError ?? {}) as {
      code?: unknown;
      id?: unknown;
      message?: unknown;
      details?: { name?: unknown; message?: unknown };
    };
    if (serialized.code === DURABLE_STOP_WHEN_ERROR_ID || serialized.id === DURABLE_STOP_WHEN_ERROR_ID) {
      const error = new Error(
        typeof serialized.details?.message === 'string'
          ? serialized.details.message
          : typeof serialized.message === 'string'
            ? serialized.message
            : fallbackMessage,
      );
      error.name = typeof serialized.details?.name === 'string' ? serialized.details.name : 'Error';
      return markErrorForStreamRejection(error);
    }
    return new Error(typeof serialized.message === 'string' ? serialized.message : fallbackMessage);
  }
  workflowExecutionError(workflowError: unknown, fallbackMessage: string): Error {
    const serialized = (workflowError ?? {}) as { code?: unknown; id?: unknown };
    if (serialized.code === DURABLE_STOP_WHEN_ERROR_ID || serialized.id === DURABLE_STOP_WHEN_ERROR_ID) {
      return this.workflowFailureError(workflowError, fallbackMessage);
    }
    return getErrorFromUnknown(workflowError, { fallbackMessage });
  }

  /**
   * Mark `runId` as being recovered by this process, and return the release.
   * A second `recover()` of the same run in this process fails fast instead
   * of contending for the claim. Across processes the run's execution claim
   * picks the winner.
   */
  claimLocalRecovery(agentId: string, agentName: string, runId: string): () => void {
    const key = JSON.stringify([agentId, runId]);
    if (localRecoveryClaims.has(key)) {
      throw new MastraError({
        id: RECOVER_ALREADY_IN_PROGRESS_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${agentName}" recover(${runId}): this process is already recovering this run.`,
        details: { agentName, runId },
      });
    }
    // Duplicate recovery takes precedence over a live execution. Even force
    // recovery must not replace an execution still running in this process.
    const localExecution = ExecutionFence.getLocalActive(runId);
    if (localExecution && !localExecution.isLost()) {
      throw new MastraError({
        id: RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${agentName}" recover(${runId}): this process is still executing the run. Wait for it to finish instead of recovering it.`,
        details: { agentName, runId },
      });
    }
    const token = crypto.randomUUID();
    localRecoveryClaims.set(key, token);
    return () => {
      if (localRecoveryClaims.get(key) === token) localRecoveryClaims.delete(key);
    };
  }

  async recoveryStore(runId: string, agentName: string, guardrailLogger: IMastraLogger): Promise<WorkflowsStorage> {
    if (!this.mastra) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_NO_MASTRA',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${agentName}" recover() requires the agent to be registered on a Mastra instance.`,
        details: { agentName, runId },
      });
    }
    this.assertRecoveryActive();
    const store = await this.mastra.getStorage()?.getStore('workflows');
    if (!store) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_NO_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${agentName}" recover() requires persistent storage to load the run snapshot. ` +
          `Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL).`,
        details: { agentName, runId },
      });
    }
    await this.warnIfUnfenced(store, 'workflows', guardrailLogger);
    return store;
  }

  assertRecoveryActive(): void {
    if (this.mastra?.__shuttingDown) {
      throw new MastraError({
        id: RECOVER_SHUTDOWN_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: 'Durable recovery stopped because Mastra is shutting down',
      });
    }
  }

  shouldReportRecoveryFailure(error: unknown): boolean {
    const id = (error as { id?: string } | undefined)?.id;
    return (
      id !== RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID &&
      id !== RECOVER_CHECKPOINT_NOT_AVAILABLE_ERROR_ID &&
      id !== RECOVER_RUN_SUSPENDED_ERROR_ID &&
      id !== RECOVER_RUN_NOT_ACTIVE_ERROR_ID &&
      id !== RECOVER_SHUTDOWN_ERROR_ID
    );
  }

  async restartRun(
    workflow: DurableWorkflow,
    fence: ExecutionFence,
    pubsub: PubSub,
    workflowEngine: 'default' | 'evented',
    logger: IMastraLogger,
    resourceId: string | undefined,
    requestContext: RequestContext,
    observabilityContext: ObservabilityContext,
  ) {
    fence.throwIfLost();
    this.assertRecoveryActive();
    await this.ensureEngineWorkersStarted(workflowEngine, logger);
    fence.throwIfLost();
    this.assertRecoveryActive();
    const run = await this.raceFenceLoss(workflow.createRun({ runId: fence.runId, resourceId, pubsub }), fence);
    fence.throwIfLost();
    this.assertRecoveryActive();
    const result = await this.raceFenceLoss(run.restart({ requestContext, ...observabilityContext }), fence);
    fence.throwIfLost();
    return result;
  }

  async recoverySupersededFrom(
    workflowsStore: WorkflowsStorage,
    runId: string,
    parentSnapshot: WorkflowRunState,
    getPubsub: () => PubSub,
    getLogger: () => IMastraLogger,
  ): Promise<number | undefined> {
    try {
      const nestedRunId = parentSnapshot.context?.[DurableStepIds.AGENTIC_EXECUTION]?.metadata?.nestedRunId;
      const nested = await workflowsStore.getWorkflowRunById({
        runId: typeof nestedRunId === 'string' ? nestedRunId : runId,
        workflowName: DurableStepIds.AGENTIC_EXECUTION,
      });
      const snapshot = typeof nested?.snapshot === 'string' ? JSON.parse(nested.snapshot) : nested?.snapshot;
      if (!snapshot || snapshot.context?.[DurableStepIds.LLM_EXECUTION]?.status === 'success') return;
      const stepIndex = snapshot.context?.input?.iterationCount;
      if (typeof stepIndex !== 'number') return;
      const history = (await getPubsub().getHistory(AGENT_STREAM_TOPIC(runId), 0)) as AgentStreamEvent[];
      const starts = history.filter(
        event =>
          (event.type === AgentStreamEventTypes.ITERATION_START || event.type === AgentStreamEventTypes.STEP_START) &&
          event.stepIndex === stepIndex,
      );
      const latestGeneration = starts.reduce<number | undefined>(
        (latest, event) =>
          typeof event.generation === 'number' ? Math.max(latest ?? event.generation, event.generation) : latest,
        undefined,
      );
      return (
        starts.find(
          event => event.type === AgentStreamEventTypes.ITERATION_START && event.generation === latestGeneration,
        ) ?? starts.find(event => event.generation === latestGeneration)
      )?.index;
    } catch (error) {
      getLogger().warn(`[DurableAgent] recover(${runId}) couldn't locate the uncheckpointed stream tail`, { error });
    }
  }

  async loadRecoverableSnapshot(
    workflowsStore: WorkflowsStorage,
    runId: string,
    agent: { id: string; name: string },
  ): Promise<{
    snapshot: WorkflowRunState;
    workflowInput: DurableAgenticWorkflowInput;
    finishPublishedBeforeCrash: boolean;
    originalSpansEnded: boolean;
    openStepsOf: string[] | undefined;
  }> {
    const persisted = await this.loadPersistedRunSnapshot(workflowsStore, runId);
    if (!persisted) {
      throw new MastraError({
        id: RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${agent.name}" recover(${runId}): no persisted workflow snapshot found. ` +
          `The run may have already completed or been cleaned up.`,
        details: { agentName: agent.name, runId },
      });
    }

    const { snapshot } = persisted;
    if (
      snapshot?.status === 'pending' &&
      snapshot.context != null &&
      typeof snapshot.context === 'object' &&
      !Array.isArray(snapshot.context) &&
      !Object.prototype.hasOwnProperty.call(snapshot.context, 'input')
    ) {
      throw new MastraError({
        id: RECOVER_CHECKPOINT_NOT_AVAILABLE_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${agent.name}" recover(${runId}): no restartable checkpoint has been persisted yet. ` +
          `Enable recovery: { durableAgents: 'auto' } or a shouldPersistSnapshot policy that includes ` +
          `"running" before starting the run. Even with persistence enabled, recovery is unavailable ` +
          `until the first running checkpoint is saved.`,
        details: { agentName: agent.name, runId, snapshotStatus: snapshot.status },
      });
    }
    const workflowInput = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
    if (!workflowInput || workflowInput.__workflowKind !== 'durable-agent') {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: `DurableAgent "${agent.name}" recover(${runId}): persisted snapshot does not contain a durable-agent workflow input.`,
        details: { agentName: agent.name, runId },
      });
    }

    if (workflowInput.agentId !== agent.id) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${agent.name}" recover(${runId}): persisted run belongs to agent "${workflowInput.agentId}", not "${agent.id}".`,
        details: { agentName: agent.name, runId, ownerAgentId: workflowInput.agentId },
      });
    }

    // Recovery re-drives the run with `restart()`, which the engine only accepts
    // for runs that were active when the process stopped (`running`/`waiting`, or
    // a nested `pending` run) plus the terminal snapshots `_restart` short-circuits
    // (`success`/`failed`/`tripwire`). Every other status would otherwise surface
    // as a single "This workflow run was not active" error chunk, asynchronously,
    // long after `recover()` resolved. Reject up front and say what to do instead:
    // a run suspended on a tool call or an approval is continued with `resume()`.
    // Checked again after the claim, since the run may suspend between discovery
    // and the claim.
    const restartable =
      snapshot.status === 'running' ||
      snapshot.status === 'waiting' ||
      snapshot.status === 'success' ||
      snapshot.status === 'failed' ||
      snapshot.status === 'tripwire' ||
      (snapshot.status === 'pending' &&
        snapshot.context != null &&
        Object.prototype.hasOwnProperty.call(snapshot.context, 'input'));
    if (!restartable) {
      throw new MastraError({
        // A suspended run is not orphaned: it waits for resume().
        id: snapshot.status === 'suspended' ? RECOVER_RUN_SUSPENDED_ERROR_ID : RECOVER_RUN_NOT_ACTIVE_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${agent.name}" recover(${runId}): run status is "${snapshot.status}", ` +
          `so the run cannot be recovered. Runs suspended on a tool call or an approval are ` +
          `continued with resume(${runId}, ...), not recover().`,
        details: { agentName: agent.name, runId, snapshotStatus: snapshot.status },
      });
    }

    const finishPublishedBeforeCrash = snapshot.context?.[MAP_FINAL_OUTPUT_STEP_ID]?.status === 'success';
    const results = Object.values(snapshot.context ?? {}) as Array<{ status?: string; resumedAt?: number } | undefined>;
    // The default engine keeps the suspended result until the resumed step finishes.
    const stepSuspended = results.some(result => result?.status === 'suspended');
    // Spans from a segment after resume lived only in the lost process.
    const resumed = stepSuspended || results.some(result => result?.resumedAt != null);
    return {
      snapshot,
      workflowInput,
      finishPublishedBeforeCrash,
      originalSpansEnded: finishPublishedBeforeCrash || resumed,
      // The suspension ended the step it saved, so the crash left none open.
      openStepsOf: stepSuspended ? [] : openStepsOfCrashedSegment(snapshot.requestContext, runId),
    };
  }

  async loadSuspendedRequestContextValue(
    workflowsStore: WorkflowsStorage,
    runId: string,
    agent: { id: string },
    key: string,
  ): Promise<unknown> {
    const persisted = await this.loadPersistedRunSnapshot(workflowsStore, runId);
    if (!persisted) return undefined;
    const workflowInput = persisted.snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
    if (workflowInput?.__workflowKind !== 'durable-agent' || workflowInput.agentId !== agent.id) return undefined;
    return workflowInput.requestContextEntries?.[key];
  }

  async loadPersistedRunSnapshot(workflowsStore: WorkflowsStorage, runId: string) {
    const persisted = await workflowsStore.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    if (!persisted) return undefined;
    const snapshot =
      typeof persisted.snapshot === 'string'
        ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
        : persisted.snapshot;
    return { snapshot };
  }

  async loadRunSnapshot(runId: string): Promise<WorkflowRunState | undefined> {
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    return workflowsStore ? (await this.loadPersistedRunSnapshot(workflowsStore, runId))?.snapshot : undefined;
  }
  createRun(workflow: DurableWorkflow, options: Parameters<DurableWorkflow['createRun']>[0]): Promise<DurableRun> {
    return workflow.createRun(options);
  }

  releaseRun(workflow: DurableWorkflow, runId: string, run: DurableRun, status: string | undefined): void {
    if (status !== 'suspended' && workflow.runs.get(runId) === run) {
      workflow.runs.delete(runId);
    }
  }

  finishExecution(
    _runId: string,
    _executionFence: ExecutionFence | undefined,
    _sharedExecution: boolean,
    completion: ExecutionCompletion,
  ): ExecutionOutcome {
    if ('error' in completion) {
      return { owner: 'agent', error: this.workflowExecutionError(completion.error, 'Workflow execution failed') };
    }
    return {
      owner: 'agent',
      status: completion.result?.status,
      error:
        completion.result?.status === 'failed'
          ? this.workflowFailureError(completion.result.error, 'Workflow execution failed')
          : undefined,
    };
  }

  startRun(
    run: DurableRun,
    workflowInput: DurableAgenticWorkflowInput,
    requestContext: RequestContext | undefined,
    observabilityContext: ObservabilityContext,
  ) {
    return run.start({
      inputData: workflowInput,
      requestContext,
      actor: workflowInput.options?.actor,
      ...observabilityContext,
    });
  }
  resolveShouldPersistSnapshot(predicate?: ShouldPersistSnapshotFn): ShouldPersistSnapshotFn {
    return predicate ?? this.recoveryAwarePersistencePolicy;
  }
  prepareExecution(
    _pubsub: PubSub | undefined,
    _fence: ExecutionFence | undefined,
    _workflowEngine: 'default' | 'evented',
    _logger: IMastraLogger,
    _guardrailLogger: IMastraLogger | undefined,
  ): { sharedExecution: boolean; usesRunPubSub: boolean } {
    return { sharedExecution: false, usesRunPubSub: true };
  }
}

/**
 * Evented engine variant. Lives in this module, right after its parent, so the
 * `extends` never runs while `DefaultAgentExecutionEngine` is still loading:
 * this module's imports lead back to `Agent`, which imports both engines.
 */
export class EventedAgentExecutionEngine extends DefaultAgentExecutionEngine {
  #warnedUnfencedSharedExecution = false;

  override get executionMode(): 'blocking' | 'background' {
    return 'background';
  }

  // Evented execution can return before the suspended snapshot lands.
  override get suspendPersistedOnReturn(): boolean {
    return false;
  }

  // Workers elsewhere run the steps when this instance runs none (e.g. `MASTRA_WORKERS=false`).
  // Read after the run started its local workers, if it has any.
  override get executesStepsLocally(): boolean {
    return this.mastra?.__hasLocalWorkflowExecution() ?? true;
  }

  override prepareExecution(
    pubsub: PubSub | undefined,
    fence: ExecutionFence | undefined,
    workflowEngine: 'default' | 'evented',
    logger: IMastraLogger,
    guardrailLogger: IMastraLogger | undefined,
  ): { sharedExecution: boolean; usesRunPubSub: boolean } {
    const engine = this.resolveWorkflowEngine(workflowEngine, logger);
    const sharedTransport = engine === 'evented' && pubsub !== undefined && reachesOtherProcesses(pubsub);
    if (sharedTransport && this.mastra) {
      const mastra = this.mastra;
      // The store resolves asynchronously and this path is sync. The warning never gates the run.
      void Promise.resolve(mastra.getStorage()?.getStore('workflows'))
        .catch(() => undefined)
        .then(store => warnUnsupportedEventedSetup(mastra, store))
        .catch(() => {});
    }
    const sharedExecution = sharedTransport && fence?.generation !== undefined;
    if (sharedTransport && !sharedExecution && !this.#warnedUnfencedSharedExecution) {
      this.#warnedUnfencedSharedExecution = true;
      guardrailLogger?.warn(
        `EventedAgent '${this.id}': shared execution without storage-backed run fencing keeps its existing ` +
          'behavior: API shutdown or loss can interrupt remote workers. Use a shared fencing-capable storage adapter ' +
          'to keep workers running independently of the API process.',
      );
    }
    return { sharedExecution, usesRunPubSub: engine === 'default' };
  }

  override finishExecution(
    runId: string,
    executionFence: ExecutionFence | undefined,
    sharedExecution: boolean,
    completion: ExecutionCompletion,
  ): ExecutionOutcome {
    if (!sharedExecution) return super.finishExecution(runId, executionFence, sharedExecution, completion);
    executionFence?.detach();
    if ('error' in completion) {
      // With no successor, only the disconnected observer can close its stream.
      if (
        completion.error instanceof DurableExecutionFenceError &&
        completion.error.id === EXECUTION_UNVERIFIED_ERROR_ID
      ) {
        return { owner: 'workers', error: completion.error };
      }
      this.mastra?.getLogger()?.warn('Evented durable observer disconnected; workers retain settlement authority', {
        runId,
        error: completion.error,
      });
    }
    return { owner: 'workers' };
  }

  override resolveShouldPersistSnapshot(_predicate?: ShouldPersistSnapshotFn): ShouldPersistSnapshotFn {
    return defaultShouldPersistSnapshot;
  }
  override warnOnRiskyPersistencePolicy(
    predicate: ShouldPersistSnapshotFn | undefined,
    guardrailLogger: IMastraLogger | undefined,
  ): void {
    if (predicate)
      guardrailLogger?.warn(
        `EventedAgent '${this.id}': ignoring the shouldPersistSnapshot option. ` +
          'The evented engine requires the full snapshot set (pending|paused|suspended|running) — ' +
          `the initial 'running' write creates the base row that suspend-merges and multi-worker coordination build on.`,
      );
  }
}
