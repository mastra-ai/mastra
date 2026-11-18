/**
 * EventedAgent - A durable agent that executes steps through event workers.
 *
 * EventedAgent extends DurableAgent and overrides the execution strategy to use
 * the evented workflow engine. stream() returns without awaiting execution,
 * while the run's completion promise is tracked for safe suspension/resume.
 * Events are streamed via pubsub as the workflow executes.
 */

import type { PubSub } from '../../events/pubsub';
import type { Mastra } from '../../mastra';
import { createObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import type { ToolsInput } from '../types';

import { DurableAgent } from './durable-agent';
import type { DurableAgentConfig } from './durable-agent';

import { EventedExecutionEngine } from './evented-execution-engine';
import { setExecutionClaim } from './execution-fence';
import type { ExecutionFence } from './execution-fence';
import { getRunRegistryEntry } from './run-registry';
import type { DurableAgenticWorkflowInput } from './types';

/**
 * Configuration for EventedAgent - wraps an existing Agent with fire-and-forget execution
 */
export interface EventedAgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends DurableAgentConfig<TAgentId, TTools, TOutput> {}

/**
 * EventedAgent extends DurableAgent to use fire-and-forget execution.
 *
 * This agent type uses the built-in evented workflow engine, which is useful when:
 * - You don't need an external execution engine (like Inngest)
 * - You want fire-and-forget execution with pubsub streaming
 * - You need resumable streams with event caching
 * - You need runs to survive process death: an active run can be picked up by
 *   a fresh process over the same storage via `recover(runId)` /
 *   `recoverActiveRuns()` (running step state is persisted before execution)
 *
 * The key difference from DurableAgent is the execution strategy:
 * - DurableAgent: Runs workflow steps in-process via createRun + start.
 * - EventedAgent: Steps execute via events on `mastra.pubsub`, so any worker
 *   sharing that bus can process them. The agent's stream follows
 *   `mastra.pubsub`, so streaming, suspend/resume, and finish events work even
 *   when the agent was constructed with its own pubsub. Execution is tracked
 *   in the background so resume waits for suspension persistence.
 *
 * Register the EventedAgent on a `Mastra` instance (with storage) to get
 * evented execution — the evented engine needs the host's pubsub, storage,
 * and event workers. Without a host, the agent falls back to the default
 * in-process engine (with a warning), preserving the released behavior of a
 * standalone evented agent. Recovery entry points (`recover`,
 * `listActiveRuns`, `recoverActiveRuns`) still require a host and throw
 * directly without one.
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core';
 * import { Agent } from '@mastra/core/agent';
 * import { EventedAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const eventedAgent = new EventedAgent({ agent });
 *
 * // Register on a Mastra host to get evented execution (a hostless agent
 * // falls back to the default in-process engine).
 * const mastra = new Mastra({
 *   agents: { myAgent: eventedAgent },
 *   storage: new LibSQLStore({ url: 'file:mastra.db' }),
 * });
 *
 * const { output, runId, cleanup } = await eventedAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 *
 * // After a crash/restart, a fresh process over the same storage can resume:
 * // await eventedAgent.recoverActiveRuns();
 * ```
 */
export class EventedAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends DurableAgent<TAgentId, TTools, TOutput> {
  /**
   * Create a new EventedAgent that wraps an existing Agent
   */
  constructor(config: EventedAgentConfig<TAgentId, TTools, TOutput>) {
    super(config);
  }

  /**
   * EventedAgent runs the durable agentic loop on the evented execution
   * engine (pubsub + WorkflowEventProcessor) instead of the default
   * in-process engine.
   * @internal
   */
  protected override get workflowEngine(): 'default' | 'evented' {
    return 'evented';
  }

  protected override createExecutionEngine(mastra?: Mastra): EventedExecutionEngine {
    return new EventedExecutionEngine(this.id, mastra);
  }

  // The evented engine may resolve before the suspended snapshot lands, so
  // closeOnSuspend keeps closing on the SUSPENDED event.
  protected override get suspendPersistedOnReturn(): boolean {
    return false;
  }

  /**
   * The thread lease each live run claimed before it registered, recorded under
   * the identity it claimed with.
   *
   * Deliberately not read back from the run registry when the lease is given
   * back: output-error cleanup can drop that entry while the input write is
   * still in flight, and a resume can replace it with a successor's fence.
   * Either way a second read names no lease, or the wrong one.
   */
  #heldThreadLeases = new Map<
    string,
    {
      pubsub: PubSub;
      threadId: string;
      resourceId: string | undefined;
      generation: number | undefined;
      executionId: string | undefined;
    }
  >();

  /**
   * Resolve the thread this run owns, from the values `executeWorkflow` already
   * captured when it has them and from the registry otherwise.
   */
  #threadClaimTarget(
    runId: string,
    workflowInput: DurableAgenticWorkflowInput,
    pubsub: PubSub | undefined,
    entry: ReturnType<typeof getRunRegistryEntry>,
    executionFence: ExecutionFence | undefined,
  ):
    | {
        pubsub: PubSub;
        requestContext: RequestContext;
        executionFence: ExecutionFence;
        threadId: string;
        resourceId: string | undefined;
      }
    | undefined {
    if (!pubsub || !entry?.requestContext || !executionFence) return undefined;
    const memoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = workflowInput.state?.threadId ?? memoryInfo?.threadId;
    if (!threadId) return undefined;
    return {
      pubsub,
      requestContext: entry.requestContext,
      executionFence,
      threadId,
      resourceId: workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
    };
  }

  /**
   * Take the thread lease for an evented run on a shared transport, keep it
   * renewed while the run is unregistered, and record the identity it was taken
   * with so a failed run gives back the lease it actually holds.
   *
   * `claimDurableThreadLease` throws {@link AgentThreadLeaseConflictError} when
   * another process owns the thread, which is what stops a rejected message
   * before it is written rather than after.
   */
  async #claimEventedThreadLease(
    runId: string,
    workflowInput: DurableAgenticWorkflowInput,
    pubsub: PubSub | undefined,
    entry: ReturnType<typeof getRunRegistryEntry>,
    executionFence: ExecutionFence | undefined,
  ): Promise<void> {
    const target = this.#threadClaimTarget(runId, workflowInput, pubsub, entry, executionFence);
    if (!target) return;
    const { threadId, resourceId } = target;
    const generation = target.executionFence.generation;
    const executionId = target.executionFence.executionId;
    // `prepareExecution` is the engine's own definition of a shared execution;
    // asking it keeps this seam from drifting from the one `executeWorkflow` uses.
    const { sharedExecution } = this.executionEngine.prepareExecution(
      target.pubsub,
      target.executionFence,
      this.workflowEngine,
      this.logger,
      this.guardrailLogger,
    );
    if (!sharedExecution) return;
    await agentThreadStreamRuntime.claimDurableThreadLease(
      target.pubsub,
      runId,
      threadId,
      resourceId,
      generation,
      executionId,
    );
    agentThreadStreamRuntime.holdDurableThreadLease(
      target.pubsub,
      runId,
      threadId,
      resourceId,
      generation,
      executionId,
    );
    this.#heldThreadLeases.set(runId, { pubsub: target.pubsub, threadId, resourceId, generation, executionId });
    setExecutionClaim(target.requestContext, runId, { ...target.executionFence.claim, threadId, resourceId });
  }

  /**
   * Give back the lease this run claimed, naming the owner it took it as.
   * `abandonDurableThreadLease` is owner-guarded, so a claim a successor has
   * since taken over is left alone.
   */
  async #abandonHeldThreadLease(runId: string, failure: string): Promise<void> {
    const held = this.#heldThreadLeases.get(runId);
    if (!held) return;
    this.#heldThreadLeases.delete(runId);
    await agentThreadStreamRuntime
      .abandonDurableThreadLease(held.pubsub, runId, held.threadId, held.resourceId, held.generation, held.executionId)
      .catch(error => this.logger.warn(failure, { runId, error }));
  }

  /**
   * Take the thread lease before the run's input is written, so a message the
   * lease claim rejects is never saved to the thread. See
   * {@link DurableAgent.beforePersistInitialInput}.
   *
   * @internal
   */
  protected override async beforePersistInitialInput(
    runId: string,
    workflowInput: DurableAgenticWorkflowInput,
  ): Promise<void> {
    const entry = getRunRegistryEntry(runId, this.getMastraInstance());
    await this.#claimEventedThreadLease(
      runId,
      workflowInput,
      this.getMastraInstance()?.pubsub ?? this.getPubSub(),
      entry,
      entry?.executionFence,
    );
  }

  /**
   * A run that cannot save its input never starts, so nothing else will give its
   * lease back.
   *
   * @internal
   */
  protected override async persistInitialInput(
    runId: string,
    workflowInput: DurableAgenticWorkflowInput,
  ): Promise<void> {
    try {
      await super.persistInitialInput(runId, workflowInput);
    } catch (error) {
      await this.#abandonHeldThreadLease(
        runId,
        'Failed to release the thread lease of a run that could not save its input',
      );
      throw error;
    }
  }

  /**
   * Execute the durable workflow using the evented engine.
   *
   * The caller tracks this promise in the background without blocking stream(),
   * then cleans up snapshots on a non-suspended terminal status.
   *
   * @param runId - The unique run ID
   * @param workflowInput - The serialized workflow input
   * @internal
   */
  protected override async executeWorkflow(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    // Captured now: a later resume() replaces the registry's fence before this
    // segment's background promise settles.
    const entry = getRunRegistryEntry(runId, this.getMastraInstance());
    const executionFence = entry?.executionFence;
    const pubsub = this.getMastraInstance()?.pubsub ?? this.getPubSub();
    const { sharedExecution, usesRunPubSub } = this.executionEngine.prepareExecution(
      pubsub,
      executionFence,
      this.workflowEngine,
      this.logger,
      this.guardrailLogger,
    );
    if (entry) entry.eventedExecution = sharedExecution;
    try {
      const workflow = this.getWorkflow();
      // The evented engine executes via pubsub events consumed by in-process
      // workers — without them `run.start()` never resolves (it waits on the
      // `workflows-finish` topic). Idempotent; a no-op when the server has
      // already booted the workers.
      await this.executionEngine.ensureEngineWorkersStarted(this.workflowEngine, this.logger);
      // Populate the run row's resourceId column so storage-level resource
      // filters (listSuspendedRuns / listActiveRuns) can narrow the query.
      const memoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      // Claim the thread here as well as before the input write. `resume()` and
      // `recover()` reach this method without a pre-persist hook, and for a run
      // that already claimed, claiming again is a no-op that keeps the thread on
      // the execution claim so terminal settlement can release it.
      await this.#claimEventedThreadLease(runId, workflowInput, pubsub, entry, executionFence);
      // Note: unlike the default engine, evented `createRun` accepts no
      // `pubsub` — the engine always publishes on `mastra.pubsub` so any
      // worker in a fleet can execute a step. The agent's stream still sees
      // those events because its CachingPubSub follows `mastra.pubsub` as its
      // source (wired at registration; see #ensurePubsubInitialized).
      //
      // On the hostless fallback (default engine, see resolveWorkflowEngine)
      // there is no `mastra.pubsub`: the default engine publishes on the
      // pubsub handed to `createRun`, so pass the agent's own transport —
      // otherwise the caller's stream never sees a single event and hangs.
      // This mirrors the previously shipped standalone behavior.
      const run = await this.executionEngine.createRun(workflow, {
        runId,
        resourceId: workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
        ...(usesRunPubSub ? { pubsub: this.fenceRunPubSub(executionFence, entry?.abortController) } : {}),
      });
      // stream() runs executeWorkflow in the background. Track the full run here
      // so an immediate resume waits for the suspension snapshot to be persisted.
      // Pass the caller's requestContext (so config selectors pick the same observability
      // instance the root spans were created with) and parent the run under the AGENT_RUN span.
      await this.executionEngine
        .startRun(
          run,
          workflowInput,
          entry?.requestContext,
          createObservabilityContext({ currentSpan: entry?.agentSpan }),
        )
        .then(
          result => {
            // A suspended run keeps its lease so a resume can take the thread
            // back, but nothing registers a thread run for it here, so this
            // process keeps renewing it for the rest of its life. The workflow
            // event processor bounds that too, but in a dedicated-worker
            // deployment it runs in a worker, which holds no timer to stop —
            // so bound it here, in the process that owns the timer (#30069).
            if ((result as { status?: string } | undefined)?.status === 'suspended' && pubsub) {
              agentThreadStreamRuntime.boundSuspendedRunLeaseRenewal(pubsub, runId);
            }
            return this.executionEngine.finishExecution(runId, executionFence, sharedExecution, { result });
          },
          error => this.executionEngine.finishExecution(runId, executionFence, sharedExecution, { error }),
        )
        .then(outcome => {
          if (outcome.owner === 'agent') return this.settleExecution(runId, executionFence, outcome);
          if (outcome.error) {
            return this.emitError(runId, outcome.error, executionFence?.generation).catch(publishError =>
              this.logger.warn(`Failed to publish error event for run ${runId}`, { runId, error: publishError }),
            );
          }
        });
    } catch (error) {
      // The engine never took this run over, so nothing else will give its
      // thread lease back.
      await this.#abandonHeldThreadLease(runId, 'Failed to release the thread lease of a run that never started');
      await this.settleExecution(runId, executionFence, {
        error: this.executionEngine.workflowExecutionError(error, 'Workflow execution failed'),
      });
    } finally {
      // The run has either handed its lease to the engine or given it back; the
      // recorded identity is no longer needed and must not outlive the setup.
      this.#heldThreadLeases.delete(runId);
    }
  }
}

/**
 * Check if an object is an EventedAgent class instance
 */
export function isEventedAgentClass(obj: any): obj is EventedAgent {
  return obj instanceof EventedAgent;
}
