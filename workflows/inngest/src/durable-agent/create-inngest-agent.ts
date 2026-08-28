/**
 * Factory function to create an Inngest-powered durable agent.
 *
 * This provides a clean API for wrapping a Mastra Agent with Inngest's
 * durable execution engine. The returned object can be registered with
 * Mastra like any other agent, and the required workflow is automatically
 * registered when added to Mastra.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createInngestAgent } from '@mastra/inngest';
 * import { Inngest } from 'inngest';
 *
 * const inngest = new Inngest({
 *   id: 'my-app',
 * });
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createInngestAgent({ agent, inngest });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 *
 * // Use the agent
 * const { output, cleanup } = await durableAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */

import type { Agent, AgentExecutionOptions } from '@mastra/core/agent';
import {
  prepareForDurableExecution,
  createDurableAgentStream,
  emitErrorEvent,
  runDurableStreamUntilIdle,
  runResumeDurableStreamUntilIdle,
  globalRunRegistry,
  publishAbortRequest,
} from '@mastra/core/agent/durable';
import type { AgentStepFinishEventData, AgentSuspendedEventData } from '@mastra/core/agent/durable';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { ActorSignal } from '@mastra/core/auth/ee';
import { InMemoryServerCache } from '@mastra/core/cache';
import type { MastraServerCache } from '@mastra/core/cache';
import { CachingPubSub } from '@mastra/core/events';
import type { Event, PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraModelOutput, ChunkType, FullOutput, MastraOnFinishCallback } from '@mastra/core/stream';
import type { Workflow } from '@mastra/core/workflows';
import { NonRetriableError } from 'inngest';
import type { Inngest } from 'inngest';

import {
  buildDurableResumeEventData,
  buildDurableTriggerEventData,
  mergeResumeRequestContext,
} from '../durable-event-payload';
import { InngestPubSub } from '../pubsub';
import type { InngestWorkflow } from '../workflow';
import { createInngestDurableAgenticWorkflow, InngestDurableStepIds } from './create-inngest-agentic-workflow';

class InngestWorkflowCachingPubSub extends CachingPubSub {
  override publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt' | 'index'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    if (topic.startsWith('workflow.events.v2.')) {
      return super.publish(topic, event, { ...options, localOnly: true });
    }

    return super.publish(topic, event, options);
  }
}

/**
 * Internal sentinel used by {@link InngestAgent.generate} and
 * {@link InngestAgent.resumeGenerate} to ask the underlying `stream()` /
 * `resume()` implementation to close the consumer stream on a SUSPENDED
 * event, so `getFullOutput()` resolves promptly with `finishReason:
 * 'suspended'` instead of waiting for FINISH/ERROR.
 *
 * Modelled on `CLOSE_ON_SUSPEND` in core `DurableAgent`.
 */
const CLOSE_ON_SUSPEND = Symbol('mastra.durable.inngest.closeOnSuspend');

/**
 * Internal symbol used by `generate()` / `resumeGenerate()` to tear down the
 * pubsub subscription on suspend without removing the run-registry entry.
 * The public `cleanup()` does both; this lets the generate wrappers keep the
 * registry alive across `suspend` → `resumeGenerate()` while still releasing
 * the local stream subscription.
 */
const STREAM_CLEANUP = Symbol('mastra.durable.inngest.streamCleanup');

// =============================================================================
// Types
// =============================================================================

/**
 * Options for createInngestAgent factory function.
 */
export interface CreateInngestAgentOptions {
  /** The Mastra Agent to wrap with durable execution */
  agent: Agent<any, any, any>;
  /** Inngest client instance */
  inngest: Inngest;
  /** Optional ID override (defaults to agent.id) */
  id?: string;
  /** Optional name override (defaults to agent.name) */
  name?: string;
  /** Optional PubSub override (defaults to InngestPubSub) */
  pubsub?: PubSub;
  /**
   * Cache instance for storing stream events.
   * Enables resumable streams - clients can disconnect and reconnect
   * without missing events.
   *
   * When provided, the pubsub is wrapped with CachingPubSub.
   */
  cache?: MastraServerCache;
  /** Mastra instance for observability (optional, set automatically when registered with Mastra) */
  mastra?: Mastra;
}

/**
 * Options for InngestAgent.stream().
 *
 * Mirrors `DurableAgentStreamOptions` from `@mastra/core/agent/durable` so that
 * Inngest-backed durable agents accept the same execution surface as the
 * in-memory `DurableAgent`. Most options flow straight through
 * `prepareForDurableExecution` and onto the shared workflow steps; see
 * `.context/durable-agent-parity.md` for the per-option durability matrix.
 */
export interface InngestAgentStreamOptions<OUTPUT = undefined> {
  /** Custom instructions that override the agent's default instructions */
  instructions?: AgentExecutionOptions<OUTPUT>['instructions'];
  /** Additional context messages */
  context?: AgentExecutionOptions<OUTPUT>['context'];
  /** Memory configuration */
  memory?: AgentExecutionOptions<OUTPUT>['memory'];
  /** Unique identifier for this execution run */
  runId?: string;
  /** Request Context */
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /** Maximum number of steps */
  maxSteps?: number;
  /**
   * Stop condition(s) for the agentic loop. Data-shaped conditions are
   * serialized into the workflow snapshot; function-form conditions are stored
   * on the in-process run registry and degrade to "no extra stop" on a
   * cross-worker resume (same as core DurableAgent).
   */
  stopWhen?: AgentExecutionOptions<OUTPUT>['stopWhen'];
  /** Additional tool sets */
  toolsets?: AgentExecutionOptions<OUTPUT>['toolsets'];
  /** Client-side tools */
  clientTools?: AgentExecutionOptions<OUTPUT>['clientTools'];
  /** Tool selection strategy */
  toolChoice?: AgentExecutionOptions<OUTPUT>['toolChoice'];
  /** Tool names enabled for this execution */
  activeTools?: AgentExecutionOptions<OUTPUT>['activeTools'];
  /** Model settings */
  modelSettings?: AgentExecutionOptions<OUTPUT>['modelSettings'];
  /** Require approval for tool calls. Boolean (gate all / none) or a per-call function policy. */
  requireToolApproval?: AgentExecutionOptions<OUTPUT>['requireToolApproval'];
  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;
  /** Maximum concurrent tool calls */
  toolCallConcurrency?: number;
  /** Include raw chunks in output */
  includeRawChunks?: boolean;
  /** Maximum processor retries */
  maxProcessorRetries?: number;
  /** Structured output configuration */
  structuredOutput?: AgentExecutionOptions<OUTPUT>['structuredOutput'];
  /** Version overrides for sub-agent delegation */
  versions?: AgentExecutionOptions<OUTPUT>['versions'];
  /** Additional system message appended after context but before user messages. */
  system?: AgentExecutionOptions<OUTPUT>['system'];
  /** When true, background tasks are disabled for this run. */
  disableBackgroundTasks?: AgentExecutionOptions<OUTPUT>['disableBackgroundTasks'];
  /** Tracing options forwarded to the agent/model spans. */
  tracingOptions?: AgentExecutionOptions<OUTPUT>['tracingOptions'];
  /** Per-call actor signal forwarded to FGA checks and tool execution. */
  actor?: AgentExecutionOptions<OUTPUT>['actor'];
  /**
   * Tool payload transform policy. `targets` is JSON-safe and persisted in the
   * workflow snapshot; `transformToolPayload` is a closure on the run registry
   * and degrades on cross-worker resume.
   */
  transform?: AgentExecutionOptions<OUTPUT>['transform'];
  /**
   * Per-step preparation hook. Stored on the run registry and applied via a
   * processor in the durable LLM step. Closure — degrades on cross-worker
   * resume.
   */
  prepareStep?: AgentExecutionOptions<OUTPUT>['prepareStep'];
  /**
   * Optional completion config (scorers + onComplete + suppressFeedback).
   * JSON-safe parts are serialized; the `onComplete` callback lives on the run
   * registry and degrades on cross-worker resume.
   */
  isTaskComplete?: AgentExecutionOptions<OUTPUT>['isTaskComplete'];
  /**
   * Sub-agent delegation hooks. Forwarded into `convertTools` at prepare time
   * and baked into the sub-agent tool wrappers stored on the run registry.
   * Cross-worker resume on a fresh worker loses the callbacks and degrades to
   * the agent's default delegation.
   */
  delegation?: AgentExecutionOptions<OUTPUT>['delegation'];
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Callback when step finishes */
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  /** Callback when execution finishes */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Callback on error */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  /** Callback when workflow suspends */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /** Callback when execution is aborted via abortSignal or `result.abort()` */
  onAbort?: AgentExecutionOptions<OUTPUT>['onAbort'];
  /** Callback fired after each agentic-loop iteration (observation only) */
  onIterationComplete?: AgentExecutionOptions<OUTPUT>['onIterationComplete'];
  /**
   * Optional external abort signal. Forwarded onto an internal AbortController
   * stored on the run registry. Either the external signal or
   * `result.abort()` will cancel the stream and emit an ABORT event over
   * pubsub.
   */
  abortSignal?: AbortSignal;
  /**
   * When set, `stream()` delegates to the idle-loop wrapper that keeps the
   * outer stream open across background-task continuations.
   *
   * Pass `true` for default idle timeout (5 min), or `{ maxIdleMs }` to
   * customise.
   */
  untilIdle?: boolean | { maxIdleMs?: number };
  /** @internal */
  _skipBgTaskWait?: boolean;
}

/**
 * Result from InngestAgent.stream()
 */
export interface InngestAgentStreamResult<OUTPUT = undefined> {
  /** The streaming output */
  output: MastraModelOutput<OUTPUT>;
  /** The full stream - delegates to output.fullStream for server compatibility */
  readonly fullStream: ReadableStream<any>;
  /** The unique run ID */
  runId: string;
  /** Thread ID if using memory */
  threadId?: string;
  /** Resource ID if using memory */
  resourceId?: string;
  /** Cleanup function */
  cleanup: () => void;
  /**
   * Abort this run. Flips the internal AbortController for this stream so the
   * durable LLM step short-circuits (when the step worker shares the same
   * process) and emits an ABORT event over pubsub so the consumer stream
   * closes. Safe to call after the run has already finished.
   *
   * Also publishes an abort request over pubsub, which is what stops work
   * already running on a step worker — a different process from this one.
   * Await the returned promise to know the request has been dispatched;
   * ignoring it keeps the previous fire-and-forget behaviour.
   */
  abort: (reason?: unknown) => Promise<void>;
}

/**
 * Options for InngestAgent.resume(). Mirrors core DurableAgent.resume().
 */
export interface InngestAgentResumeOptions<OUTPUT = undefined> {
  threadId?: string;
  resourceId?: string;
  /**
   * Resume a specific suspended tool call. The agentic loop suspends tool calls
   * with `resumeLabel: toolCallId`, so this targets that exact leaf instead of
   * inferring one from the run's suspended paths. Required when more than one
   * tool call is suspended concurrently.
   */
  toolCallId?: string;
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /**
   * Per-call actor signal forwarded to FGA checks and tool execution. Must be
   * re-supplied on every resume: it is never rehydrated from the workflow
   * snapshot, so a membership-bypass signal is never persisted.
   */
  actor?: AgentExecutionOptions<OUTPUT>['actor'];
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /** Callback when execution is aborted via abortSignal or `result.abort()` */
  onAbort?: AgentExecutionOptions<OUTPUT>['onAbort'];
  /**
   * Optional abort signal scoped to the resumed segment. Forwarded onto a
   * fresh internal controller installed on the run's registry entry, so
   * `result.abort()` and the external signal can both cancel the resumed
   * iterations.
   */
  abortSignal?: AbortSignal;
  /**
   * When set, keep the resumed segment open after the workflow's initial
   * resume turn finishes and continue streaming follow-up turns until the
   * agent goes idle (no in-flight background tasks for the same memory
   * scope). Same semantics as `stream({ untilIdle })`. Pass an object to
   * tune `maxIdleMs`.
   */
  untilIdle?: boolean | { maxIdleMs?: number };
}

/**
 * An Inngest-powered durable agent.
 *
 * This interface represents an agent that uses Inngest's durable execution engine.
 * It can be registered with Mastra like a regular Agent, and the required workflow
 * is automatically registered.
 *
 * At runtime, a Proxy forwards all Agent method calls (e.g., `generate()`, `listTools()`,
 * `getMemory()`) to the underlying agent. The index signature below reflects this:
 * any property not explicitly declared here is available via the Proxy.
 */
export interface InngestAgent<TOutput = undefined> {
  /** Agent ID */
  readonly id: string;
  /** Agent name */
  readonly name: string;
  /** The underlying Mastra Agent (for Mastra registration) */
  readonly agent: Agent<any, any, TOutput>;
  /** The Inngest client */
  readonly inngest: Inngest;
  /** The cache instance if resumable streams are enabled */
  readonly cache?: MastraServerCache;

  /**
   * The PubSub instance used for streaming events.
   * Returns the CachingPubSub wrapper if caching is enabled.
   * @internal Used by the server's observe endpoint to subscribe to the correct PubSub instance.
   */
  readonly pubsub: PubSub;

  /**
   * Stream a response using Inngest's durable execution.
   */
  stream(
    messages: MessageListInput,
    options?: InngestAgentStreamOptions<TOutput>,
  ): Promise<InngestAgentStreamResult<TOutput>>;

  /**
   * Resume a suspended workflow execution.
   */
  resume(
    runId: string,
    resumeData: unknown,
    options?: InngestAgentResumeOptions<TOutput>,
  ): Promise<InngestAgentStreamResult<TOutput>>;

  /**
   * Prepare for durable execution without starting it.
   */
  prepare(
    messages: MessageListInput,
    options?: AgentExecutionOptions<TOutput>,
  ): Promise<{
    runId: string;
    messageId: string;
    workflowInput: any;
    threadId?: string;
    resourceId?: string;
  }>;

  /**
   * Observe (reconnect to) an existing stream.
   * Use this to resume receiving events after a disconnection.
   *
   * @param runId - The run ID to observe
   * @param options.offset - Resume from this event index (0-based). If omitted, replays all events.
   */
  observe(
    runId: string,
    options?: {
      offset?: number;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<InngestAgentStreamResult<TOutput>, 'threadId' | 'resourceId'> & { runId: string }>;

  /**
   * Get the durable workflows required by this agent.
   * Called by Mastra during agent registration.
   * @internal
   */
  getDurableWorkflows(): Workflow<any, any, any, any, any, any, any>[];

  /**
   * Set the Mastra instance for observability.
   * Called by Mastra during agent registration.
   * @internal
   */
  __setMastra(mastra: Mastra): void;

  /**
   * Drain a durable run to a single {@link FullOutput}. Mirrors
   * {@link DurableAgent.generate}: kicks off the same Inngest durable
   * workflow as {@link InngestAgent.stream}, but threads
   * `methodType: 'generate'` into preparation (so tool/preparation paths
   * that branch on method behave consistently with non-durable
   * `Agent.generate`) and awaits `output.getFullOutput()`.
   *
   * If the run suspends (e.g. tool approval), the returned output's
   * `finishReason` is `'suspended'` — use {@link InngestAgent.resumeGenerate}
   * to continue. The run registry entry is intentionally not cleaned up on
   * suspend so resume can pick it up.
   */
  generate(messages: MessageListInput, options?: InngestAgentStreamOptions<TOutput>): Promise<FullOutput<TOutput>>;

  /**
   * Resume a suspended durable run and drain it to a single
   * {@link FullOutput}. Mirrors {@link DurableAgent.resumeGenerate} on top
   * of {@link InngestAgent.resume}.
   */
  resumeGenerate(
    runId: string,
    resumeData: unknown,
    options?: InngestAgentResumeOptions<TOutput>,
  ): Promise<FullOutput<TOutput>>;

  // ---------------------------------------------------------------------------
  // Agent methods forwarded via Proxy to the underlying Agent at runtime.
  // Declared here so TypeScript can see them without the Proxy indirection.
  // ---------------------------------------------------------------------------

  /** Get the agent's description. Forwarded to the underlying Agent. */
  getDescription(): string;
  /** Get the agent's instructions. Forwarded to the underlying Agent. */
  getInstructions(...args: any[]): any;
  /** List tools available to the agent. Forwarded to the underlying Agent. */
  listTools(...args: any[]): any;
  /** Get the agent's LLM configuration. Forwarded to the underlying Agent. */
  getLLM(...args: any[]): any;
  /** Get the agent's model. Forwarded to the underlying Agent. */
  getModel(...args: any[]): any;
  /** Get the agent's memory instance. Forwarded to the underlying Agent. */
  getMemory(...args: any[]): any;
  /** Check if agent has its own memory. Forwarded to the underlying Agent. */
  hasOwnMemory(): boolean;
  /** Get the agent's workspace. Forwarded to the underlying Agent. */
  getWorkspace(...args: any[]): any;
  /** List sub-agents. Forwarded to the underlying Agent. */
  listAgents(...args: any[]): any;
  /** List workflows. Forwarded to the underlying Agent. */
  listWorkflows(...args: any[]): any;
  /** Get default execution options. Forwarded to the underlying Agent. */
  getDefaultOptions(...args: any[]): any;
  /** Get legacy generate options. Forwarded to the underlying Agent. */
  getDefaultGenerateOptionsLegacy(...args: any[]): any;
  /** Get legacy stream options. Forwarded to the underlying Agent. */
  getDefaultStreamOptionsLegacy(...args: any[]): any;
  /** Get available models. Forwarded to the underlying Agent. */
  getModelList(...args: any[]): any;
  /** Get configured processor workflows. Forwarded to the underlying Agent. */
  getConfiguredProcessorWorkflows(...args: any[]): any;
  /** Get raw agent configuration. Forwarded to the underlying Agent. */
  toRawConfig(...args: any[]): any;
  /** Resume a streaming execution. Forwarded to the underlying Agent. */
  resumeStream(...args: any[]): any;
  /** Approve a pending tool call. Forwarded to the underlying Agent. */
  approveToolCall(...args: any[]): any;
  /** @internal Update the agent's model. Forwarded to the underlying Agent. */
  __updateModel(...args: any[]): any;
  /** @internal Reset to original model. Forwarded to the underlying Agent. */
  __resetToOriginalModel(...args: any[]): any;
  /** @internal Set logger. Forwarded to the underlying Agent. */
  __setLogger(...args: any[]): any;
  /** @internal Register primitives. Forwarded to the underlying Agent. */
  __registerPrimitives(...args: any[]): any;
  /** @internal Register Mastra instance. Forwarded to the underlying Agent. */
  __registerMastra(...args: any[]): any;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an Inngest-powered durable agent from a Mastra Agent.
 *
 * This factory function wraps a regular Mastra Agent with Inngest's durable
 * execution capabilities. The returned InngestAgent can be registered with
 * Mastra, and the required workflow will be automatically registered.
 *
 * @param options - Configuration options
 * @returns An InngestAgent that can be registered with Mastra
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are helpful',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createInngestAgent({ agent, inngest });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 * ```
 */
export function createInngestAgent<TOutput = undefined>(options: CreateInngestAgentOptions): InngestAgent<TOutput> {
  const {
    agent,
    inngest,
    id: idOverride,
    name: nameOverride,
    pubsub: customPubsub,
    cache,
    mastra: mastraOption,
  } = options;

  // Use provided id/name or fall back to agent.id/agent.name
  const agentId = idOverride ?? agent.id;
  const agentName = nameOverride ?? agent.name;

  // Track mastra instance - can be set later when registered with Mastra
  let mastra: Mastra | undefined = mastraOption;

  // Active untilIdle wrappers keyed by scope (threadId|resourceId)
  const activeStreamUntilIdle = new Map<string, () => void>();

  // Late-bound reference to the proxy so stream() can pass it to runDurableStreamUntilIdle
  let proxyRef: InngestAgent<TOutput> | undefined;

  // Create the durable workflow for this agent
  // Mastra's addWorkflow handles deduplication, so creating multiple times is fine
  const workflow = createInngestDurableAgenticWorkflow({ inngest });

  // Track whether user provided a custom cache (if not, we'll inherit from mastra)
  let _customCache = cache;

  // Set up pubsub with lazy CachingPubSub creation
  // CachingPubSub is an internal implementation detail - users just configure cache and pubsub separately
  let innerPubsub: PubSub = customPubsub ?? new InngestPubSub(inngest, InngestDurableStepIds.AGENTIC_LOOP);
  let _cachingPubsub: PubSub | null = null;

  // Resolve the cache that backs CachingPubSub history.
  //
  // Resolution order: user-provided > mastra's serverCache > InMemoryServerCache fallback.
  // The fallback gives single-process observe replay parity with the in-memory durable agent.
  // Cross-process observe still requires a shared cache backend (Redis, etc.) supplied via
  // `cache` or `mastra.serverCache`.
  function resolveCache(): MastraServerCache {
    const resolved = _customCache ?? mastra?.serverCache ?? new InMemoryServerCache();
    _customCache = resolved;
    return resolved;
  }

  // Lazily create CachingPubSub for the agent.
  //
  // We always wrap the inner pubsub with CachingPubSub (mirroring the in-memory DurableAgent
  // at packages/core/src/agent/durable/durable-agent.ts#ensurePubsubInitialized). Without it,
  // `observe()` would only see live events: the bare InngestPubSub.subscribe streams from the
  // current point in the realtime channel, with no history replay, so reconnects and late
  // observers miss everything emitted before they attached.
  //
  // If the inner pubsub is already a CachingPubSub (e.g. a user passed `new Mastra({ pubsub })`
  // with their own caching layer), we reuse it instead of double-wrapping (issue #18148).
  function getPubsub(): PubSub {
    if (!_cachingPubsub) {
      if (innerPubsub instanceof CachingPubSub) {
        _cachingPubsub = innerPubsub;
        _customCache = _customCache ?? mastra?.serverCache;
      } else {
        _cachingPubsub = new CachingPubSub(innerPubsub, resolveCache());
      }
    }
    return _cachingPubsub;
  }

  // Route workflow event publishes through a CachingPubSub backed by the same cache
  // as the agent's pubsub. Each InngestWorkflow function (including nested ones)
  // passes its own workflow-local InngestPubSub as `defaultPubsub`, which we wrap.
  // This keeps per-workflow event channels (`workflow:<workflowId>:<runId>`)
  // workflow-local while sharing the cache that `observe()` reads from for
  // agent-stream replay.
  // The chained `.commit()` builder loses the InngestWorkflow subtype, so cast back.
  (workflow as unknown as InngestWorkflow).__setPubsubFactory(defaultPubsub => {
    // If the caller already supplied a CachingPubSub upstream, defer to it.
    if (defaultPubsub instanceof CachingPubSub) return defaultPubsub;
    // Ensure the agent's CachingPubSub (and its cache) is resolved so workflow
    // events and agent.stream events share the same history backend.
    getPubsub();
    return new InngestWorkflowCachingPubSub(defaultPubsub, resolveCache());
  });

  // Lazily resolve cache
  function getCache(): MastraServerCache | undefined {
    // Ensure pubsub is initialized (which resolves cache)
    getPubsub();
    return _customCache;
  }

  /**
   * Trigger the workflow via Inngest event
   */
  async function triggerWorkflow(
    runId: string,
    workflowInput: any,
    tracingOptions?: { traceId: string; parentSpanId: string },
    actor?: ActorSignal,
  ): Promise<void> {
    const eventName = `workflow.${InngestDurableStepIds.AGENTIC_LOOP}`;

    await inngest.send({
      name: eventName,
      data: buildDurableTriggerEventData({
        inputData: workflowInput,
        runId,
        resourceId: workflowInput.state?.resourceId,
        requestContext: workflowInput.requestContextEntries ?? {},
        tracingOptions,
        actor,
      }),
    });
  }

  /**
   * Emit an error event to pubsub
   */
  async function emitError(runId: string, error: Error): Promise<void> {
    await emitErrorEvent(getPubsub(), runId, error);
  }

  /**
   * Stop a run in whichever worker is executing it.
   *
   * An Inngest agent's steps run on Inngest's infrastructure, essentially never
   * in the process that called `stream()`. The local `AbortController` is
   * therefore invisible to the step worker, and on its own `abort()` cannot
   * stop anything. Publishing an abort request lets the worker flip its own
   * controller and unwind the run gracefully, emitting the terminal stream
   * event consumers wait on — which a hard workflow cancel would skip.
   *
   * Best-effort: the local abort has already happened, and a caller asking to
   * stop a run should not get a rejection because the publish failed.
   */
  async function requestRemoteAbort(runId: string): Promise<void> {
    try {
      await publishAbortRequest(getPubsub(), runId);
    } catch (error) {
      mastra?.getLogger?.()?.warn?.('Failed to publish Inngest durable agent abort request', {
        agentId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Return the InngestAgent object (Agent methods are added by the Proxy below)
  const inngestAgent: Pick<
    InngestAgent<TOutput>,
    | 'id'
    | 'name'
    | 'agent'
    | 'inngest'
    | 'cache'
    | 'pubsub'
    | 'stream'
    | 'resume'
    | 'prepare'
    | 'observe'
    | 'generate'
    | 'resumeGenerate'
    | 'getDurableWorkflows'
    | '__setMastra'
  > = {
    get id() {
      return agentId;
    },

    get name() {
      return agentName;
    },

    get agent() {
      return agent as Agent<any, any, TOutput>;
    },

    get inngest() {
      return inngest;
    },

    get cache() {
      return getCache();
    },

    get pubsub() {
      return getPubsub();
    },

    async stream(messages, streamOptions): Promise<InngestAgentStreamResult<TOutput>> {
      // Delegate to the idle-loop wrapper when `untilIdle` is set.
      if (streamOptions?.untilIdle) {
        const { untilIdle, ...rest } = streamOptions;
        const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
        return runDurableStreamUntilIdle<TOutput>(proxyRef as any, messages, { ...rest, maxIdleMs } as any, {
          activeStreams: activeStreamUntilIdle,
          bgManager: mastra?.backgroundTaskManager,
        }) as Promise<InngestAgentStreamResult<TOutput>>;
      }

      // 1. Prepare for durable execution
      const preparation = await prepareForDurableExecution<TOutput>({
        agent: agent as Agent<string, any, TOutput>,
        messages,
        options: streamOptions as AgentExecutionOptions<TOutput>,
        runId: streamOptions?.runId,
        requestContext: streamOptions?.requestContext,
        methodType: (streamOptions as any)?.__methodType ?? 'stream',
        mastra,
        durableAgentId: agentId,
        durableAgentName: agentName,
      });

      const { runId, messageId, workflowInput, registryEntry, threadId, resourceId } = preparation;

      // Override agentId and agentName in workflowInput with the durable agent's values
      workflowInput.agentId = agentId;
      workflowInput.agentName = agentName;

      // 1a. Install abort controller for this run. The controller is owned by
      // this InngestAgent instance; `result.abort()` flips it, the durable
      // LLM-execution step reads `abortSignal` off the global run registry
      // (when running in the same process) and the consumer stream closes via
      // an ABORT pubsub event when the inner catch detects the signal. If the
      // caller supplied an external signal, forward it onto the internal
      // controller so either source can cancel the run.
      const abortController = new AbortController();
      if (streamOptions?.abortSignal) {
        const external = streamOptions.abortSignal;
        if (external.aborted) {
          abortController.abort((external as AbortSignal & { reason?: unknown }).reason);
        } else {
          external.addEventListener(
            'abort',
            () => abortController.abort((external as AbortSignal & { reason?: unknown }).reason),
            { once: true },
          );
        }
      }
      registryEntry.abortController = abortController;
      registryEntry.abortSignal = abortController.signal;

      // 1b. Register non-serializable state on the global run registry so
      // workflow steps running in the same process can recover it.
      globalRunRegistry.set(runId, registryEntry);

      // 2. The AGENT_RUN and MODEL_GENERATION spans were already opened by the
      // preparation phase and exported onto `workflowInput`. Reusing them (rather
      // than minting new ones here) keeps the whole run on a single trace and
      // keeps the preparation-phase spans — input processors and memory recall —
      // parented under the agent run root.
      workflowInput.stepIndex = 0;

      // Track cleanup state and global registry entry lifecycle.
      let cleanedUp = false;
      const finalizeGlobalRegistry = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        globalRunRegistry.delete(runId);
      };

      // 2. Create the durable agent stream (subscribes to pubsub)
      const {
        output,
        cleanup: streamCleanup,
        ready,
      } = createDurableAgentStream<TOutput>({
        pubsub: getPubsub(),
        runId,
        messageId,
        model: {
          modelId: workflowInput.modelConfig.modelId,
          provider: workflowInput.modelConfig.provider,
          version: 'v3',
        },
        threadId,
        resourceId,
        onChunk: streamOptions?.onChunk,
        onStepFinish: streamOptions?.onStepFinish,
        onFinish: async result => {
          try {
            await streamOptions?.onFinish?.(result);
          } finally {
            finalizeGlobalRegistry();
          }
        },
        onError: async errorArg => {
          try {
            await streamOptions?.onError?.(errorArg);
          } finally {
            finalizeGlobalRegistry();
          }
        },
        onSuspended: streamOptions?.onSuspended,
        onAbort: async data => {
          try {
            await (streamOptions?.onAbort as ((event: any) => void | Promise<void>) | undefined)?.(data);
          } finally {
            finalizeGlobalRegistry();
          }
        },
        onIterationComplete: streamOptions?.onIterationComplete
          ? async data => {
              await (streamOptions.onIterationComplete as (ctx: any) => void | Promise<void>)?.(data);
            }
          : undefined,
        closeOnSuspend: (streamOptions as any)?.[CLOSE_ON_SUSPEND] === true,
      });

      // 3. Wait for subscription to be established, then trigger workflow
      // Pass tracing options so workflow spans are children of the agent span
      const agentSpanData = workflowInput.agentSpanData as { traceId?: string; id?: string } | undefined;
      const tracingOptions =
        agentSpanData?.traceId && agentSpanData?.id
          ? { traceId: agentSpanData.traceId, parentSpanId: agentSpanData.id }
          : undefined;

      // Wait for subscription to be ready before triggering workflow
      // This prevents race conditions where events are published before subscription.
      // Track the trigger promise on the registry so generate() can await suspend
      // snapshot persistence before returning.
      const workflowExecution = ready
        .then(() => triggerWorkflow(runId, workflowInput, tracingOptions, streamOptions?.actor))
        .catch(error => {
          void emitError(runId, error);
        });
      const trackedEntry = globalRunRegistry.get(runId);
      if (trackedEntry) {
        trackedEntry.workflowExecution = workflowExecution;
      }

      // 4. Return stream result - attach extra properties to output for compatibility
      // This allows both destructuring { output, runId, cleanup } AND direct access to fullStream
      const cleanup = () => {
        streamCleanup();
        finalizeGlobalRegistry();
      };
      const abort = async (reason?: unknown) => {
        if (!abortController.signal.aborted) {
          abortController.abort(reason);
        }
        // The step worker is a different process — see `requestRemoteAbort`.
        await requestRemoteAbort(runId);
      };
      const result = {
        output,
        runId,
        threadId,
        resourceId,
        cleanup,
        abort,
        // Also expose fullStream directly for server compatibility
        get fullStream() {
          return output.fullStream;
        },
        // Internal: stream-only cleanup for generate()/resumeGenerate() to
        // release the subscription on suspend without dropping the registry.
        [STREAM_CLEANUP]: streamCleanup,
      };

      return result as InngestAgentStreamResult<TOutput>;
    },

    async resume(runId, resumeData, resumeOptions): Promise<InngestAgentStreamResult<TOutput>> {
      // Delegate to the resume idle-loop wrapper when `untilIdle` is set.
      // After the resumed segment completes, the wrapper runs
      // `agent.stream([], ...)` continuations against the same thread until
      // pending background tasks settle.
      if (resumeOptions?.untilIdle) {
        const { untilIdle, ...rest } = resumeOptions;
        const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
        return runResumeDurableStreamUntilIdle<TOutput>(
          proxyRef as any,
          runId,
          resumeData,
          { ...rest, maxIdleMs } as any,
          {
            activeStreams: activeStreamUntilIdle,
            bgManager: mastra?.backgroundTaskManager,
          },
        ) as Promise<InngestAgentStreamResult<TOutput>>;
      }

      // Install a fresh abort controller scoped to the resumed segment and
      // attach it to the run-registry entry so the durable LLM step (when
      // co-located) can react. The previous run's controller is no longer
      // relevant.
      const abortController = new AbortController();
      if (resumeOptions?.abortSignal) {
        const external = resumeOptions.abortSignal;
        if (external.aborted) {
          abortController.abort((external as AbortSignal & { reason?: unknown }).reason);
        } else {
          external.addEventListener(
            'abort',
            () => abortController.abort((external as AbortSignal & { reason?: unknown }).reason),
            { once: true },
          );
        }
      }
      // Ensure a registry entry exists for this resumed segment. On Inngest,
      // a resume frequently runs in a fresh process where no prior stream()
      // entry is in memory — without this, the abort controller would be
      // silently dropped and the durable LLM step (when co-located) would
      // have nothing to react to.
      let existingEntry = globalRunRegistry.get(runId);
      if (!existingEntry) {
        existingEntry = {
          // Minimal placeholder fields. The durable LLM step recreates tools
          // and model from the workflow input; this slot exists primarily to
          // carry the abort controller across the resumed segment. The
          // explicit flag tells resolveRuntimeDependencies to rebuild runtime
          // state from the Mastra instance instead of trusting this entry.
          isPlaceholder: true,
          tools: {},
          model: undefined as any,
        };
        globalRunRegistry.set(runId, existingEntry);
      }
      existingEntry.abortController = abortController;
      existingEntry.abortSignal = abortController.signal;

      // Track cleanup state for the resumed segment so terminal events
      // (finish/error/abort/cleanup) always tear down the registry entry.
      let resumeCleanedUp = false;
      const finalizeResumeRegistry = () => {
        if (resumeCleanedUp) return;
        resumeCleanedUp = true;
        globalRunRegistry.delete(runId);
      };

      // Re-subscribe to the stream
      const {
        output,
        cleanup: streamCleanup,
        ready,
      } = createDurableAgentStream<TOutput>({
        pubsub: getPubsub(),
        runId,
        messageId: crypto.randomUUID(),
        model: {
          modelId: undefined,
          provider: undefined,
          version: 'v3',
        },
        threadId: resumeOptions?.threadId,
        resourceId: resumeOptions?.resourceId,
        onChunk: resumeOptions?.onChunk,
        onStepFinish: resumeOptions?.onStepFinish,
        onFinish: async result => {
          try {
            await resumeOptions?.onFinish?.(result);
          } finally {
            finalizeResumeRegistry();
          }
        },
        onError: async errorArg => {
          try {
            await resumeOptions?.onError?.(errorArg);
          } finally {
            finalizeResumeRegistry();
          }
        },
        onSuspended: resumeOptions?.onSuspended,
        onAbort: async data => {
          try {
            await (resumeOptions?.onAbort as ((event: any) => void | Promise<void>) | undefined)?.(data);
          } finally {
            finalizeResumeRegistry();
          }
        },
        closeOnSuspend: (resumeOptions as any)?.[CLOSE_ON_SUSPEND] === true,
      });

      // Load the workflow snapshot to build proper resume data
      // This mirrors InngestRun._resume() which loads the snapshot, finds the suspended step,
      // and sends an event to the same trigger name (not a .resume suffix)
      const eventName = `workflow.${InngestDurableStepIds.AGENTIC_LOOP}`;

      const dispatch = ready.then(async () => {
        const workflowsStore = await mastra?.getStorage()?.getStore('workflows');
        const snapshot: any = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: InngestDurableStepIds.AGENTIC_LOOP,
          runId,
        });

        // Resolve which suspended leaf to resume. `resume.steps` is a path: the outer
        // step id followed by the nested step ids beneath it, so a nested suspension has
        // to be expanded from the outer step's recorded `__workflow_meta.path` rather
        // than left as a bare step id (see `Workflow._resume` in
        // packages/core/src/workflows/workflow.ts, which builds the same path).
        const suspendedStepIds = snapshot?.suspendedPaths ? Object.keys(snapshot.suspendedPaths) : [];
        const resumeLabels: Record<string, { stepId?: string } | undefined> = snapshot?.resumeLabels ?? {};
        const toolCallId = resumeOptions?.toolCallId;

        const expandToLeafPath = (stepId: string): string[] => {
          const stepResult = (snapshot?.context ?? {})[stepId];
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return Array.isArray(nestedPath) ? [stepId, ...nestedPath] : [stepId];
        };

        let steps: string[];

        if (toolCallId) {
          // The agentic loop registers each suspended tool call under `resumeLabel:
          // toolCallId`, so a named tool call resolves to exactly one outer step.
          const targetStepId = resumeLabels[toolCallId]?.stepId;
          if (!targetStepId) {
            const available = Object.keys(resumeLabels);
            throw new NonRetriableError(
              `Cannot resume run ${runId}: no suspended tool call with id "${toolCallId}". ` +
                (available.length > 0
                  ? `Suspended tool call ids: ${available.join(', ')}.`
                  : `No tool calls are currently suspended.`),
            );
          }
          steps = expandToLeafPath(targetStepId);
        } else {
          // Without a `toolCallId` there is nothing to disambiguate with, so refuse
          // instead of silently resuming whichever suspension happens to be first.
          const available = Object.keys(resumeLabels);
          if (suspendedStepIds.length > 1 || available.length > 1) {
            throw new NonRetriableError(
              `Cannot resume run ${runId}: more than one suspension is parked. ` +
                `Pass "toolCallId" to choose which suspended tool call to resume.` +
                (available.length > 0 ? ` Suspended tool call ids: ${available.join(', ')}.` : ''),
            );
          }
          steps = suspendedStepIds[0] ? expandToLeafPath(suspendedStepIds[0]) : [];
        }

        const requestContext = mergeResumeRequestContext(snapshot?.requestContext, resumeOptions?.requestContext);
        const tracingOptions = snapshot?.tracingContext
          ? {
              traceId: snapshot.tracingContext.traceId,
              parentSpanId: snapshot.tracingContext.spanId,
            }
          : undefined;

        await inngest.send({
          name: eventName,
          data: buildDurableResumeEventData({
            inputData: resumeData,
            runId,
            resourceId: resumeOptions?.resourceId,
            requestContext,
            tracingOptions,
            actor: resumeOptions?.actor,
            resume: {
              steps,
              resumePayload: resumeData,
              resumePath: steps[0] ? snapshot?.suspendedPaths?.[steps[0]] : undefined,
            },
          }),
        });
      });

      // The registry entry still tracks the whole dispatch so watchers keep seeing
      // dispatch failures as a stream error, exactly as before.
      const workflowExecution = dispatch.catch(error => {
        void emitError(runId, error);
      });
      existingEntry.workflowExecution = workflowExecution;

      // Await the dispatch itself (not workflow completion) so a failure to hand the
      // resume event to Inngest rejects the caller. Previously it was fire-and-forget:
      // resume() resolved successfully while the run stayed parked and resumable, and
      // the only signal was a terminal error on the stream.
      try {
        await dispatch;
      } catch (error) {
        // A run that was never resumed must not keep its registry entry or stream
        // subscription, otherwise a later resume of the same runId is blocked.
        streamCleanup();
        finalizeResumeRegistry();
        throw error;
      }

      const abort = async (reason?: unknown) => {
        if (!abortController.signal.aborted) {
          abortController.abort(reason);
        }
        // The step worker is a different process — see `requestRemoteAbort`.
        await requestRemoteAbort(runId);
      };

      const cleanup = () => {
        streamCleanup();
        finalizeResumeRegistry();
      };

      return {
        output,
        get fullStream() {
          return output.fullStream as ReadableStream<any>;
        },
        runId,
        threadId: resumeOptions?.threadId,
        resourceId: resumeOptions?.resourceId,
        cleanup,
        abort,
        // Internal: stream-only cleanup for resumeGenerate() to release the
        // subscription on suspend without dropping the resumed registry entry.
        [STREAM_CLEANUP]: streamCleanup,
      } as InngestAgentStreamResult<TOutput>;
    },

    async prepare(messages, prepareOptions) {
      const preparation = await prepareForDurableExecution<TOutput>({
        agent: agent as Agent<string, any, TOutput>,
        messages,
        options: prepareOptions,
        requestContext: prepareOptions?.requestContext,
        mastra,
        durableAgentId: agentId,
        durableAgentName: agentName,
      });

      // Override with durable agent's id/name
      preparation.workflowInput.agentId = agentId;
      preparation.workflowInput.agentName = agentName;

      return {
        runId: preparation.runId,
        messageId: preparation.messageId,
        workflowInput: preparation.workflowInput,
        threadId: preparation.threadId,
        resourceId: preparation.resourceId,
      };
    },

    async observe(runId, observeOptions) {
      // Create the stream subscription with offset support
      const {
        output,
        cleanup: streamCleanup,
        ready,
      } = createDurableAgentStream<TOutput>({
        pubsub: getPubsub(),
        runId,
        messageId: crypto.randomUUID(),
        model: {
          modelId: undefined,
          provider: undefined,
          version: 'v3',
        },
        offset: observeOptions?.offset,
        onChunk: observeOptions?.onChunk,
        onStepFinish: observeOptions?.onStepFinish,
        onFinish: observeOptions?.onFinish,
        onError: observeOptions?.onError,
        onSuspended: observeOptions?.onSuspended,
      });

      await ready;

      // `observe()` does not own the run, but it can still stop it: closing the
      // local subscription and publishing an abort request, which reaches the
      // worker actually executing it.
      const abort = async (_reason?: unknown) => {
        streamCleanup();
        await requestRemoteAbort(runId);
      };

      return {
        output,
        get fullStream() {
          return output.fullStream as ReadableStream<any>;
        },
        runId,
        cleanup: streamCleanup,
        abort,
      };
    },

    async generate(messages, generateOptions): Promise<FullOutput<TOutput>> {
      // Delegate to stream() with `methodType: 'generate'` and `closeOnSuspend`
      // so that getFullOutput() resolves promptly on suspend (mirroring
      // DurableAgent.generate). We do NOT pass `untilIdle` through — generate
      // is a one-shot drain, not an idle loop.
      const { untilIdle, ...rest } = generateOptions ?? {};
      void untilIdle;
      const streamOpts = {
        ...rest,
        [CLOSE_ON_SUSPEND]: true,
        __methodType: 'generate',
      } as InngestAgentStreamOptions<TOutput>;
      const result = await proxyRef!.stream(messages, streamOpts);

      let suspended = false;
      try {
        const fullOutput = (await result.output.getFullOutput()) as FullOutput<TOutput>;
        if (fullOutput.error) {
          throw fullOutput.error;
        }
        suspended = fullOutput.finishReason === 'suspended';
        // On suspend, wait for the workflow trigger promise so the suspend
        // snapshot has landed before returning — otherwise a follow-up
        // resumeGenerate() may race the storage write.
        if (suspended) {
          await globalRunRegistry.get(result.runId)?.workflowExecution;
        }
        if (!fullOutput.runId) {
          (fullOutput as { runId?: string }).runId = result.runId;
        }
        return fullOutput;
      } finally {
        // Always release the local stream subscription. On suspend, keep the
        // registry entry alive so resumeGenerate() can pick it up; other
        // outcomes run the full public cleanup (which also finalizes the
        // registry).
        if (suspended) {
          const streamOnlyCleanup = (result as unknown as { [STREAM_CLEANUP]?: () => void })[STREAM_CLEANUP];
          streamOnlyCleanup?.();
        } else {
          result.cleanup();
        }
      }
    },

    async resumeGenerate(runId, resumeData, resumeOptions): Promise<FullOutput<TOutput>> {
      // `resumeGenerate` is a one-shot drain; strip `untilIdle` so the
      // underlying resume() never delegates to the idle-loop wrapper.
      const { untilIdle, ...rest } = resumeOptions ?? {};
      void untilIdle;
      const result = await proxyRef!.resume(runId, resumeData, {
        ...rest,
        [CLOSE_ON_SUSPEND]: true,
      } as InngestAgentResumeOptions<TOutput>);

      let suspended = false;
      try {
        const fullOutput = (await result.output.getFullOutput()) as FullOutput<TOutput>;
        if (fullOutput.error) {
          throw fullOutput.error;
        }
        suspended = fullOutput.finishReason === 'suspended';
        if (suspended) {
          await globalRunRegistry.get(result.runId)?.workflowExecution;
        }
        if (!fullOutput.runId) {
          (fullOutput as { runId?: string }).runId = result.runId;
        }
        return fullOutput;
      } finally {
        if (suspended) {
          const streamOnlyCleanup = (result as unknown as { [STREAM_CLEANUP]?: () => void })[STREAM_CLEANUP];
          streamOnlyCleanup?.();
        } else {
          result.cleanup();
        }
      }
    },

    getDurableWorkflows() {
      return [workflow];
    },

    __setMastra(mastraInstance: Mastra) {
      mastra = mastraInstance;

      // NOTE: Unlike core DurableAgent, we do NOT replace innerPubsub with mastra.pubsub.
      // InngestAgent uses InngestPubSub which handles both publishing (via
      // `inngest.realtime.publish()` in SDK v4) and subscribing (via @inngest/realtime).
      // Replacing it with mastra's EventEmitterPubSub would break streaming because
      // the subscriber would be on a different transport than the publisher.
    },
  };

  // Use a Proxy to forward any unknown property/method calls to the underlying agent
  // This ensures the InngestAgent has all Agent methods (getMemory, etc.) while
  // overriding stream() to use durable execution
  const result = new Proxy(inngestAgent, {
    get(target, prop, receiver) {
      // First check if the property exists on our InngestAgent object
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      // Otherwise, forward to the underlying agent
      const agentValue = (agent as any)[prop];
      if (typeof agentValue === 'function') {
        return agentValue.bind(agent);
      }
      return agentValue;
    },
    has(target, prop) {
      return prop in target || prop in agent;
    },
  }) as InngestAgent<TOutput>;

  // Assign the late-bound reference so stream()'s untilIdle path can use it
  proxyRef = result;
  return result;
}

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Check if an object is an InngestAgent
 */
export function isInngestAgent(obj: any): obj is InngestAgent {
  if (!obj) return false;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    'agent' in obj &&
    'inngest' in obj &&
    typeof obj.stream === 'function' &&
    typeof obj.getDurableWorkflows === 'function'
  );
}
