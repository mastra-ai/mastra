import { ErrorCategory, ErrorDomain, getErrorFromUnknown, MastraError } from '../../error';
import type { PubSub } from '../../events/pubsub';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { ObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage, WorkflowsStorage } from '../../storage';
import type { ShouldPersistSnapshotFn, WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import {
  AGENT_STREAM_TOPIC,
  AgentStreamEventTypes,
  DURABLE_STOP_WHEN_ERROR_ID,
  DurableStepIds,
  markErrorForStreamRejection,
  RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID,
  RECOVER_CHECKPOINT_NOT_AVAILABLE_ERROR_ID,
  RECOVER_RUN_SUSPENDED_ERROR_ID,
  RECOVER_RUN_NOT_ACTIVE_ERROR_ID,
} from './constants';
import { ExecutionFence, fencePubSub, resolveLeaseProvider, supportsRunFencing } from './execution-fence';
import type { UntrackedRunLiveness } from './execution-fence';
import { withExecutionStreamProducer } from './execution-stream-publisher';
import { emitAbortEvent } from './stream-adapter';
import type { AgentStreamEvent, DurableAgenticWorkflowInput, DurableToolCallInput } from './types';
import { createDurableAgenticWorkflow } from './workflows/create-durable-agentic-workflow';
import { readAccumulatedSteps } from './workflows/shared/accumulated-steps';
import { latestMessageListState } from './workflows/shared/message-list-state';

export type DurableWorkflow = ReturnType<typeof createDurableAgenticWorkflow>;
type DurableRun = Awaited<ReturnType<DurableWorkflow['createRun']>>;
export type ExecutionCompletion = { result: Awaited<ReturnType<DurableRun['start']>> } | { error: unknown };
export type ExecutionOutcome = { owner: 'agent'; status?: string; error?: Error } | { owner: 'workers'; error?: Error };

const unfencedStoresWarned = new WeakSet<WorkflowsStorage | MemoryStorage>();

export interface DurableWorkflowOptions {
  maxSteps?: number;
  workflowEngine: 'default' | 'evented';
  storesRunsInJournal: boolean;
  shouldPersistSnapshot?: ShouldPersistSnapshotFn;
  logger: IMastraLogger;
  guardrailLogger?: IMastraLogger;
}

export class DurableExecutionEngine {
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

  /**
   * The transcript as of the crash. The loop snapshot's input only has the one the run
   * started with; later steps keep it in the nested execution workflow's state.
   */
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

  /** Locate the start of the model step that recovery will re-execute, if it was published. */
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

  async loadSuspendedRequestContextValue(
    workflowsStore: WorkflowsStorage,
    runId: string,
    agentId: string,
    key: string,
  ): Promise<unknown> {
    const persisted = await workflowsStore.getWorkflowRunById({
      runId,
      workflowName: DurableStepIds.AGENTIC_LOOP,
    });
    if (!persisted) return undefined;
    const snapshot: WorkflowRunState =
      typeof persisted.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted.snapshot;
    const workflowInput = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
    if (workflowInput?.__workflowKind !== 'durable-agent' || workflowInput.agentId !== agentId) return undefined;
    return workflowInput.requestContextEntries?.[key];
  }

  async loadRecoverableSnapshot(
    workflowsStore: WorkflowsStorage,
    runId: string,
    agentId: string,
    agentName: string,
  ): Promise<{ snapshot: WorkflowRunState; workflowInput: DurableAgenticWorkflowInput }> {
    const persisted = await workflowsStore.getWorkflowRunById({
      runId,
      workflowName: DurableStepIds.AGENTIC_LOOP,
    });
    if (!persisted) {
      throw new MastraError({
        id: RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${agentName}" recover(${runId}): no persisted workflow snapshot found. ` +
          `The run may have already completed or been cleaned up.`,
        details: { agentName, runId },
      });
    }

    const snapshot =
      typeof persisted.snapshot === 'string'
        ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
        : persisted.snapshot;
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
          `DurableAgent "${agentName}" recover(${runId}): no restartable checkpoint has been persisted yet. ` +
          `Enable recovery: { durableAgents: 'auto' } or a shouldPersistSnapshot policy that includes ` +
          `"running" before starting the run. Even with persistence enabled, recovery is unavailable ` +
          `until the first running checkpoint is saved.`,
        details: { agentName, runId, snapshotStatus: snapshot.status },
      });
    }
    const workflowInput = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
    if (!workflowInput || workflowInput.__workflowKind !== 'durable-agent') {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: `DurableAgent "${agentName}" recover(${runId}): persisted snapshot does not contain a durable-agent workflow input.`,
        details: { agentName, runId },
      });
    }

    if (workflowInput.agentId !== agentId) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${agentName}" recover(${runId}): persisted run belongs to agent "${workflowInput.agentId}", not "${agentId}".`,
        details: { agentName, runId, ownerAgentId: workflowInput.agentId },
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
          `DurableAgent "${agentName}" recover(${runId}): run status is "${snapshot.status}", ` +
          `so the run cannot be recovered. Runs suspended on a tool call or an approval are ` +
          `continued with resume(${runId}, ...), not recover().`,
        details: { agentName, runId, snapshotStatus: snapshot.status },
      });
    }

    return { snapshot, workflowInput };
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
  async loadRunSnapshot(runId: string): Promise<WorkflowRunState | undefined> {
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    const persisted = await workflowsStore?.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    return typeof persisted?.snapshot === 'string'
      ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
      : persisted?.snapshot;
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
