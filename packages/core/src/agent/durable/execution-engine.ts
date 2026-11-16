import type { PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import { TOOL_ABORT_GRACE_MS, TOOL_SETTLE_MARGIN_MS } from '../../loop/shared/tool-abort-grace';
import {
  createTimeoutAbortSignal,
  DEADLINE_SAVE_CLAIM_HOLD_MS,
  DEADLINE_SAVE_WAIT_MS,
  isMastraTimeoutError,
  settledOrElapsed,
} from '../../loop/timeout';
import type { Mastra } from '../../mastra';
import type { MastraMemory } from '../../memory/memory';
import { createObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage, WorkflowsStorage } from '../../storage';
import type { ShouldPersistSnapshotFn, WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import { whenRunStepsSettle } from '../run-lease-fence';
import { DurableStepIds } from './constants';
import { ExecutionFence, fencePubSub, resolveLeaseProvider, supportsRunFencing } from './execution-fence';
import type { UntrackedRunLiveness } from './execution-fence';
import { withExecutionStreamPublisher } from './execution-stream-publisher';
import { persistDurableRunInput } from './persist-run-input';
import { ExtendedRunRegistry, getRunRegistryEntry } from './run-registry';
import { emitAbortEvent } from './stream-adapter';
import type { DurableAgenticWorkflowInput, RunRegistryEntry } from './types';
import { createDurableAgenticWorkflow } from './workflows/create-durable-agentic-workflow';
import { deadlineMessageListState, runDurableDeadlineOutputPass } from './workflows/finalize-run';

type DurableWorkflow = ReturnType<typeof createDurableAgenticWorkflow>;

const unfencedStoresWarned = new WeakSet<WorkflowsStorage | MemoryStorage>();

/** Live services and existing Agent subclass hooks, read at invocation time. */
export interface DurableExecutionHost {
  readonly id: string;
  readonly mastra: Mastra | undefined;
  readonly maxSteps: number | undefined;
  readonly logger: IMastraLogger;
  readonly guardrailLogger: IMastraLogger | undefined;
  readonly workflowEngine: 'default' | 'evented';
  readonly storesRunsInJournal: boolean;
  readonly suspendPersistedOnReturn: boolean;
  readonly userShouldPersistSnapshot: ShouldPersistSnapshotFn | undefined;
  readonly pubsub: PubSub;
  getMemory(options: { requestContext: RequestContext }): Promise<MastraMemory | undefined>;
  getMastraInstance(): Mastra | undefined;
  getPubSub(): PubSub | undefined;
  getWorkflow(): DurableWorkflow;
  createWorkflow(): DurableWorkflow;
  resolveWorkflowEngine(): 'default' | 'evented';
  resolveShouldPersistSnapshot(): ShouldPersistSnapshotFn;
  warnOnRiskyPersistencePolicy(): void;
  ensureEngineWorkersStarted(): Promise<void>;
  fenceRunPubSub(fence: ExecutionFence | undefined, abortController?: AbortController): PubSub;
  settleExecution(
    runId: string,
    fence: ExecutionFence | undefined,
    outcome: { status?: string; error?: Error },
  ): Promise<void>;
  deleteRunSnapshots(runId: string): Promise<void>;
  workflowFailureError(error: unknown, fallbackMessage: string): Error;
  workflowExecutionError(error: unknown, fallbackMessage: string): Error;
  emitError(runId: string, error: Error, generation?: number): Promise<void>;
}

export class DurableExecutionEngine {
  readonly runRegistry = new ExtendedRunRegistry();
  readonly #segmentOwner = new Map<string, symbol>();
  readonly #recoveryAttempts = new Map<string, Promise<unknown>>();
  #workflow: DurableWorkflow | null = null;
  #resolvedWorkflowEngine: 'default' | 'evented' | null = null;
  #warnedPersistencePolicy = false;
  #timedOutExecutions = new WeakSet<ExecutionFence>();
  /** Accepted input used to save a turn when its execution reaches the total deadline. */
  #runInputs = new WeakMap<ExecutionFence, DurableAgenticWorkflowInput>();
  /** Recovered entries whose memory is fenced but which are not registered yet. */
  #recoveredEntries = new WeakMap<ExecutionFence, RunRegistryEntry>();
  /** Canceled parked runs whose abort terminal this process already published. */
  #canceledRunTerminals = new Set<string>();

  constructor(protected readonly host: DurableExecutionHost) {}

  async persistInitialInput(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    await persistDurableRunInput(runId, workflowInput, this.host.mastra);
  }

  async redeliverDeadlineError(entry: RunRegistryEntry, fence: ExecutionFence): Promise<boolean> {
    if (!fence.deadlineError) return false;
    if (!entry.deadlineErrorRedelivered) {
      entry.deadlineErrorRedelivered = true;
      await this.host.emitError(fence.runId, fence.deadlineError, fence.generation);
    }
    return true;
  }

  installAbortWithTotalTimeout(
    entry: RunRegistryEntry,
    abortController: AbortController,
    executionFence: ExecutionFence,
  ): void {
    entry.abortController = abortController;
    entry.deadlineErrorRedelivered = false;
    const totalTimeout = createTimeoutAbortSignal({
      parentSignal: abortController.signal,
      timeoutMs: entry.timeoutTotalMs,
      timeoutType: 'total',
      // The controller is per-session, but entry cleanup can also run on registry
      // eviction while calls holding `entry.abortSignal` are still in flight (#26126).
      // Only tear down the timer so `abort()` keeps reaching them.
      detachParentOnCleanup: false,
    });
    entry.abortSignal = totalTimeout.signal;
    if (totalTimeout.timeoutPromise) {
      void totalTimeout.timeoutPromise
        .catch(async error => {
          if (!isMastraTimeoutError(error) || error.timeoutType !== 'total' || totalTimeout.signal?.reason !== error)
            return;
          await this.host.settleExecution(executionFence.runId, executionFence, { status: 'failed', error });
        })
        .catch(error => {
          this.host.logger.warn('Failed to settle durable agent at its total deadline', { error });
        });
    }
    void executionFence.whenSettled.then(() => totalTimeout.cleanup());
    const previousCleanup = entry.cleanup;
    entry.cleanup = () => {
      totalTimeout.cleanup();
      previousCleanup?.();
    };
  }

  abortLocalController(runId: string): void {
    const controller = (this.runRegistry.get(runId) ?? getRunRegistryEntry(runId, this.host.mastra))?.abortController;
    if (controller && !controller.signal.aborted) {
      controller.abort(new Error('Aborted'));
    }
  }

  raceFenceLoss<T>(operation: Promise<T>, executionFence: ExecutionFence): Promise<T> {
    const lost = new Promise<never>((_, reject) => executionFence.onLost(reject));
    // The loser of the race must not surface as an unhandled rejection.
    lost.catch(() => {});
    return Promise.race([operation, lost]);
  }

  beginSegment(runId: string): symbol {
    const segment = Symbol(runId);
    this.#segmentOwner.set(runId, segment);
    return segment;
  }

  releaseSegment(runId: string, segment: symbol, entry: RunRegistryEntry): boolean {
    if (this.#segmentOwner.get(runId) !== segment) return false;
    this.#segmentOwner.delete(runId);
    if (this.runRegistry.get(runId) === entry) this.runRegistry.cleanup(runId);
    return true;
  }

  hasRecoveryAttempt(runId: string): boolean {
    return this.#recoveryAttempts.has(runId);
  }

  startRecoveryAttempt<T>(runId: string, recover: () => Promise<T>): Promise<T> {
    // Defer execution until the map is populated, including synchronous re-entrant callers.
    const attempt = Promise.resolve().then(recover);
    this.#recoveryAttempts.set(runId, attempt);
    const removeAttempt = () => {
      if (this.#recoveryAttempts.get(runId) === attempt) this.#recoveryAttempts.delete(runId);
    };
    void attempt.then(removeAttempt, removeAttempt);
    return attempt;
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
    const workflowsStore = await this.host.mastra?.getStorage()?.getStore('workflows');
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
  async announceCanceledRun(runId: string): Promise<void> {
    try {
      await this.#publishCanceledRunTerminal(runId);
    } catch (error) {
      this.host.mastra?.getLogger?.()?.warn?.(`Failed to publish the abort of canceled run ${runId}`, { runId, error });
    }
  }

  /**
   * Publish the abort terminal of a canceled run once per process. Reserved before the
   * publish, so concurrent callers publish once; released if the publish fails, so the
   * next caller retries it.
   */
  async #publishCanceledRunTerminal(runId: string): Promise<void> {
    if (this.#canceledRunTerminals.has(runId)) return;
    this.#canceledRunTerminals.add(runId);
    if (this.#canceledRunTerminals.size > 1000) {
      this.#canceledRunTerminals.delete(this.#canceledRunTerminals.values().next().value!);
    }
    try {
      await emitAbortEvent(this.host.pubsub, runId, { steps: [], text: '' });
    } catch (error) {
      this.#canceledRunTerminals.delete(runId);
      throw error;
    }
  }

  async isRunCanceledInStorage(runId: string): Promise<boolean> {
    const workflowsStore = await this.host.mastra?.getStorage()?.getStore('workflows');
    const status = await workflowsStore?.loadWorkflowRunStatus({ workflowName: DurableStepIds.AGENTIC_LOOP, runId });
    return status === 'canceled';
  }

  /**
   * A durable run parked on a suspension has no prepared run in this process, so the
   * base abort cannot tell it was parked and never deletes its snapshot. Once a resume
   * is rejected by the abort fence the run can never continue; delete its snapshot rows
   * if they are still suspended so it drops out of `listSuspendedRuns()` (#27619), and
   * publish the abort terminal so observers still attached to the parked run close.
   * Done here rather than at abort time: a run still executing in this process unwinds
   * through its own abort path, which reads the snapshot.
   * A run the abort already marked `canceled` keeps its row, since that row is what
   * stops other servers from resuming it; its abort terminal was published by the
   * abort, and is published here only if that publish failed.
   */
  async deleteFencedSuspendedRun(runId: string): Promise<void> {
    try {
      const workflowsStore = await this.host.mastra?.getStorage()?.getStore('workflows');
      const persisted = await workflowsStore?.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      const snapshot =
        typeof persisted?.snapshot === 'string'
          ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
          : persisted?.snapshot;
      if (snapshot?.status === 'canceled') {
        await this.#publishCanceledRunTerminal(runId);
        return;
      }
      if (snapshot?.status !== 'suspended') return;
      await this.host.deleteRunSnapshots(runId);
      await emitAbortEvent(this.host.pubsub, runId, { steps: [], text: '' });
    } catch (error) {
      this.host.mastra?.getLogger?.()?.warn?.(`Failed to delete snapshot of aborted suspended run ${runId}`, {
        runId,
        error,
      });
    }
  }

  async claimExecution(
    runId: string,
    mode: 'acquire' | 'recover' | 'takeover',
    requestContext?: RequestContext,
    untrackedRun?: UntrackedRunLiveness,
  ): Promise<ExecutionFence> {
    const fence = await ExecutionFence.claim({
      leaseProvider: resolveLeaseProvider(this.host.pubsub),
      workflowsStore: await this.host.mastra?.getStorage()?.getStore('workflows'),
      agentId: this.host.id,
      runId,
      mode,
      untrackedRun,
      logger: this.host.logger,
    });
    if (requestContext) await this.coverMemory(fence, requestContext);
    return fence;
  }

  async coverMemory(fence: ExecutionFence, requestContext: RequestContext, recovering = false): Promise<void> {
    if (fence.generation === undefined) return;
    let store: MemoryStorage | undefined;
    try {
      const memory = await this.host.getMemory({ requestContext });
      store = memory ? await memory.storage.getStore('memory') : undefined;
    } catch (error) {
      this.host.logger.warn(`[DurableAgent] run ${fence.runId}: memory is not fenced, failed to resolve its store`, {
        runId: fence.runId,
        error,
      });
    }
    if (recovering || this.host.mastra?.recoveryConfig?.durableAgents === 'auto') {
      await this.warnIfUnfenced(store, 'memory');
    }
    try {
      await fence.coverMemory(store);
    } catch (error) {
      await fence.settle(async () => {});
      throw error;
    }
  }

  async warnIfUnfenced(
    store: WorkflowsStorage | MemoryStorage | undefined,
    domain: 'workflows' | 'memory',
  ): Promise<boolean> {
    if (!store || (await supportsRunFencing(store).catch(() => true))) return false;
    if (unfencedStoresWarned.has(store)) return true;
    unfencedStoresWarned.add(store);
    const consequence =
      domain === 'workflows'
        ? `Recovery can only tell that a run is still live through the pubsub lease, which works only when every instance shares the pubsub, and writes from an execution that lost its run are not rejected. A run recovered while it is still live can end with the stale execution's output.`
        : `When recovery takes a run over, the memory writes (messages, threads, working memory) of the execution that lost it are not rejected.`;
    this.host.guardrailLogger?.warn(
      `DurableAgent '${this.host.id}': the ${domain} store (${store.constructor.name}) can't fence run writes. ${consequence} ` +
        `Use a storage adapter that supports run fencing.`,
    );
    return true;
  }

  fenceRunPubSub(
    executionFence: ExecutionFence | undefined,
    abortController: AbortController | undefined,
    pubsub: PubSub = this.host.pubsub,
  ): PubSub {
    if (executionFence) {
      pubsub = withExecutionStreamPublisher(pubsub, {
        runId: executionFence.runId,
        agentId: this.host.id,
        mastra: this.host.mastra,
        claim: executionFence.claim,
      });
    }
    if (!executionFence || this.host.resolveWorkflowEngine() !== 'default') return pubsub;
    executionFence.onLost(error => {
      if (abortController && !abortController.signal.aborted) abortController.abort(error);
    });
    return fencePubSub(pubsub, executionFence);
  }

  hasTimedOut(fence: ExecutionFence): boolean {
    return this.#timedOutExecutions.has(fence);
  }

  recordRunInput(fence: ExecutionFence, input: DurableAgenticWorkflowInput): void {
    this.#runInputs.set(fence, input);
  }

  recordRecoveredEntry(fence: ExecutionFence, entry: RunRegistryEntry): void {
    this.#recoveredEntries.set(fence, entry);
  }

  async settleExecution(
    runId: string,
    fence: ExecutionFence | undefined,
    outcome: { status?: string; error?: Error },
  ): Promise<void> {
    const { status, error } = outcome;
    if (fence && this.#timedOutExecutions.has(fence)) return;
    const totalTimeout = isMastraTimeoutError(error) && error.timeoutType === 'total';
    if (fence && totalTimeout) this.#timedOutExecutions.add(fence);
    const reportError = async (reported: Error) => {
      try {
        await this.host.emitError(runId, reported, fence?.generation);
      } catch (publishError) {
        this.host.logger.warn(`Failed to publish error event for run ${runId}`, { runId, error: publishError });
      }
    };
    // Reaching any non-suspended terminal status means the run is done and its
    // persisted snapshot rows will never be resumed. Suspended runs keep their
    // snapshots (and owner records) so `resume()` / `recoverActiveRuns()` can
    // find them.
    const finished = totalTimeout || (status !== undefined && status !== 'suspended');
    const runInput = totalTimeout && fence ? this.#runInputs.get(fence) : undefined;
    // Captured before the error below lets the caller clean the run up.
    const runInputEntry =
      runInput && (getRunRegistryEntry(runId, this.host.mastra) ?? (fence && this.#recoveredEntries.get(fence)));
    let wrote = false;
    let deadlineSave: Promise<void> | undefined;
    const writeTerminalState = async () => {
      wrote = true;
      if (totalTimeout && fence) fence.deadlineError = error;
      if (runInput && runInputEntry && !runInputEntry.tripwire) {
        // The run never reaches its finish step, so the output processors get their pass here, over the
        // steps that completed in time (or just the accepted request). Saves made under the claim the
        // deadline replaced are rejected; this one writes under the replacement. Saves upsert by ID.
        // Like the finish step, memory is saved before the caller sees the run end.
        this.#runInputs.delete(fence!);
        deadlineSave = (async () => {
          // A tool the deadline aborted still gets its grace window to return; wait (bounded) so its step can be saved.
          await settledOrElapsed(
            new Promise<void>(resolve => whenRunStepsSettle(runInputEntry, resolve)),
            TOOL_ABORT_GRACE_MS + TOOL_SETTLE_MARGIN_MS,
          );
          const deadlineSpan = runInputEntry.resumeAgentSpan ?? runInputEntry.agentSpan;
          await runDurableDeadlineOutputPass({
            runId,
            initData: runInput,
            ...deadlineMessageListState(runInputEntry, runInput.messageListState),
            entry: runInputEntry,
            mastra: this.host.mastra,
            tracingContext: deadlineSpan ? { currentSpan: deadlineSpan } : undefined,
            logger: this.host.logger,
          });
        })().catch(saveError => {
          this.host.logger.warn(`Failed to save run ${runId} at its total deadline`, { runId, error: saveError });
        });
        // Saved before the caller sees the run end, unless the store hangs: the deadline must still surface.
        await settledOrElapsed(deadlineSave, DEADLINE_SAVE_WAIT_MS);
      }
      // The observable deadline must not wait for snapshot I/O.
      if (error) await reportError(error);
      if (finished) await this.host.deleteRunSnapshots(runId);
      // The claim is held until the save lands (bounded), so it is not rejected as a stale write.
      if (deadlineSave) await settledOrElapsed(deadlineSave, DEADLINE_SAVE_CLAIM_HOLD_MS);
    };

    if (!fence) return writeTerminalState();
    let settlement;
    try {
      settlement = await fence.settle(writeTerminalState, totalTimeout);
    } catch (settlementError) {
      if (totalTimeout && !wrote && error) await reportError(error);
      throw settlementError;
    }
    // A deadline losing to normal completion or suspension must not publish a
    // second terminal event. Non-timeout bookkeeping failures still surface.
    if (!wrote && error && (settlement === 'orphaned' || (!totalTimeout && settlement === 'owned'))) {
      await reportError(error);
    }
  }

  async deleteRunSnapshots(runId: string): Promise<void> {
    try {
      const workflow = this.host.getWorkflow();
      await workflow.deleteWorkflowRunById(runId, { storageVersion: 1 });
      const workflowsStore = await this.host.mastra?.getStorage()?.getStore('workflows');
      await workflowsStore?.deleteWorkflowRunById({
        runId,
        workflowName: DurableStepIds.AGENTIC_EXECUTION,
        storageVersion: 1,
      });
    } catch (error) {
      this.host.mastra
        ?.getLogger?.()
        ?.warn?.(`[DurableAgent] Failed to delete workflow snapshot rows after terminal state`, { runId, error });
    }
  }

  executeWorkflow(runId: string, input: DurableAgenticWorkflowInput): Promise<{ status?: string } | void> {
    return this.executeDefault(runId, input);
  }

  resolveWorkflowEngine(): 'default' | 'evented' {
    if (this.#resolvedWorkflowEngine) return this.#resolvedWorkflowEngine;
    let engine = this.host.workflowEngine;
    if (engine === 'evented' && !this.host.mastra) {
      engine = 'default';
      this.host.logger.warn(
        `EventedAgent '${this.host.id}' has no Mastra host; running on the default in-process engine. ` +
          `Register the agent on a Mastra instance (with storage) to get evented execution.`,
      );
    } else if (engine === 'evented') {
      // Read `stores` directly rather than `await getStore('workflows')`: engine
      // resolution is synchronous (`getWorkflow()` is), and `getStore()` is only
      // async by signature — it returns `this.stores?.[name]` without awaiting
      // init, so this sees exactly what the engine's own gate sees.
      const storage = this.host.mastra?.getStorage();
      const workflowsStore = storage?.stores?.workflows;
      if (workflowsStore && !(workflowsStore.supportsConcurrentUpdates?.() ?? false)) {
        engine = 'default';
        this.host.logger.warn(
          `EventedAgent '${this.host.id}' is registered with ${storage?.name ?? 'a'} storage, which does not apply concurrent ` +
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

  async ensureEngineWorkersStarted(): Promise<void> {
    if (this.host.resolveWorkflowEngine() === 'evented') {
      await this.host.mastra?.__ensureExecutionWorkersStarted();
    }
  }

  async executeDefault(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<{ status?: string } | void> {
    const workflow = this.host.getWorkflow();
    const entry = getRunRegistryEntry(runId, this.host.mastra);
    const requestContext = entry?.requestContext;
    // Captured now: a later resume() replaces the registry's fence.
    const executionFence = entry?.executionFence;

    // Populate the run row's resourceId column so storage-level resource
    // filters (listSuspendedRuns / listActiveRuns) can narrow the query,
    // mirroring the non-durable agentic loop (loop/workflows/stream.ts).
    const memoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const resourceId = workflowInput.state?.resourceId ?? memoryInfo?.resourceId;

    const run = await workflow.createRun({
      runId,
      resourceId,
      pubsub: this.host.fenceRunPubSub(executionFence, entry?.abortController),
    });
    // Parent the workflow run under the AGENT_RUN span so the trace exports under it.
    let result;
    try {
      result = await this.withSuspensionAfterPersist(runId, () =>
        run.start({
          inputData: workflowInput,
          requestContext,
          actor: workflowInput.options?.actor,
          ...createObservabilityContext({ currentSpan: entry?.agentSpan }),
        }),
      );
      await this.host.settleExecution(runId, executionFence, {
        status: result?.status,
        error:
          result?.status === 'failed'
            ? this.host.workflowFailureError((result as any).error, 'Workflow execution failed')
            : undefined,
      });
      return result;
    } finally {
      if (result?.status !== 'suspended' && workflow.runs.get(runId) === run) {
        workflow.runs.delete(runId);
      }
    }
  }

  async withSuspensionAfterPersist<T>(runId: string, execute: () => Promise<T>): Promise<T> {
    const entry = this.host.suspendPersistedOnReturn ? getRunRegistryEntry(runId, this.host.mastra) : undefined;
    if (!entry) return execute();
    const pending: Array<() => Promise<void>> = [];
    entry.pendingSuspensionEvents = pending;
    let result: T;
    try {
      result = await execute();
    } finally {
      if (entry.pendingSuspensionEvents === pending) delete entry.pendingSuspensionEvents;
    }
    // Only announce a suspension the engine actually persisted; if persisting failed,
    // the run isn't resumable and the queued events would advertise a dead question.
    if ((result as { status?: string } | undefined)?.status === 'suspended') {
      for (const publish of pending) {
        try {
          await publish();
        } catch (error) {
          this.host.logger.warn('Failed to publish deferred suspension event', { runId, error });
        }
      }
    }
    return result;
  }

  createWorkflow(): ReturnType<typeof createDurableAgenticWorkflow> {
    return createDurableAgenticWorkflow({
      maxSteps: this.host.maxSteps,
      // Resolved, not raw: a hostless evented agent falls back to the default
      // in-process engine (see resolveWorkflowEngine).
      engine: this.host.resolveWorkflowEngine(),
      shouldPersistSnapshot: this.host.resolveShouldPersistSnapshot(),
      autoStorageVersion: this.host.storesRunsInJournal,
    });
  }

  readonly recoveryAwarePersistencePolicy: ShouldPersistSnapshotFn = ({ workflowStatus }) => {
    return (
      workflowStatus === 'pending' ||
      workflowStatus === 'paused' ||
      workflowStatus === 'suspended' ||
      (workflowStatus === 'running' &&
        (this.host.mastra?.recoveryConfig?.durableAgents === 'auto' || this.host.mastra?.__shuttingDown === true))
    );
  };

  getWorkflow() {
    if (!this.#workflow) {
      this.host.warnOnRiskyPersistencePolicy();
      this.#workflow = this.host.createWorkflow();
      // Register mastra on the workflow so execution steps can access agents/tools.
      // DurableAgent goes through the normal Agent registration path (not the durable wrapper
      // path that calls addWorkflow), so the workflow isn't registered in Mastra's #workflows.
      // We set mastra directly here instead.
      if (this.host.mastra) {
        this.#workflow.__registerMastra(this.host.mastra);
        this.#workflow.__registerPrimitives({
          logger: this.host.mastra.getLogger(),
          storage: this.host.mastra.getStorage(),
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
        if (this.host.resolveWorkflowEngine() === 'evented') {
          this.host.mastra.__registerInternalWorkflow(this.#workflow, undefined, { distributed: true });
        }
      }
    }
    return this.#workflow;
  }

  warnOnRiskyPersistencePolicy(): void {
    if (this.#warnedPersistencePolicy) return;
    this.#warnedPersistencePolicy = true;
    const predicate = this.host.userShouldPersistSnapshot;
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
      this.host.guardrailLogger?.warn(
        `DurableAgent '${this.host.id}': the custom shouldPersistSnapshot policy does not persist 'suspended'/'paused' snapshots. ` +
          `Suspended runs cannot be resumed — human-in-the-loop flows will break.`,
      );
    }
    if (this.host.mastra?.recoveryConfig?.durableAgents === 'auto' && !probe('running')) {
      this.host.guardrailLogger?.warn(
        `DurableAgent '${this.host.id}': recovery.durableAgents is 'auto' but the custom shouldPersistSnapshot policy does not persist 'running' snapshots. ` +
          `In-flight runs of this agent are invisible to crash recovery (listActiveRuns/recoverActiveRuns).`,
      );
    }
  }
}
