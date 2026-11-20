/**
 * EventedAgent - A durable agent that executes steps through event workers.
 *
 * EventedAgent extends DurableAgent and overrides the execution strategy to use
 * the evented workflow engine. stream() returns without awaiting execution,
 * while the run's completion promise is tracked for safe suspension/resume.
 * Events are streamed via pubsub as the workflow executes.
 */

import type { Mastra } from '../../mastra';
import { createObservabilityContext } from '../../observability';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import type { ToolsInput } from '../types';

import { DurableAgent } from './durable-agent';
import type { DurableAgentConfig } from './durable-agent';

import { EventedExecutionEngine } from './evented-execution-engine';
import { setExecutionClaim } from './execution-fence';
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
      const threadId = workflowInput.state?.threadId ?? memoryInfo?.threadId;
      if (sharedExecution && pubsub && entry?.requestContext && executionFence && threadId) {
        await agentThreadStreamRuntime.claimDurableThreadLease(
          pubsub,
          runId,
          threadId,
          workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
          executionFence.generation,
          executionFence.executionId,
        );
        setExecutionClaim(entry.requestContext, runId, {
          ...executionFence.claim,
          threadId,
          resourceId: workflowInput.state?.resourceId ?? memoryInfo?.resourceId,
        });
      }
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
          result => this.executionEngine.finishExecution(runId, executionFence, sharedExecution, { result }),
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
      await this.settleExecution(runId, executionFence, {
        error: this.executionEngine.workflowExecutionError(error, 'Workflow execution failed'),
      });
    }
  }
}

/**
 * Check if an object is an EventedAgent class instance
 */
export function isEventedAgentClass(obj: any): obj is EventedAgent {
  return obj instanceof EventedAgent;
}
