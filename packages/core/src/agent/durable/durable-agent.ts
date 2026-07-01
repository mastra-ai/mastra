import type { MastraServerCache } from '../../cache/base';
import { InMemoryServerCache } from '../../cache/inmemory';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { Mastra } from '../../mastra';
import { createObservabilityContext, getOrCreateSpan, SpanType, EntityType } from '../../observability';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import type { ChunkType } from '../../stream/types';
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { MessageListInput } from '../message-list';
import type { ToolsInput } from '../types';

import { AGENT_STREAM_TOPIC } from './constants';
import { runDurableStreamUntilIdle, runResumeDurableStreamUntilIdle } from './durable-stream-until-idle';
import { prepareForDurableExecution } from './preparation';
import { endRunSpansWithError, ExtendedRunRegistry, globalRunRegistry } from './run-registry';
import { createDurableAgentStream, emitErrorEvent } from './stream-adapter';
import type {
  AgentFinishEventData,
  AgentStepFinishEventData,
  AgentSuspendedEventData,
  DurableAgenticWorkflowInput,
} from './types';
import { createDurableAgenticWorkflow } from './workflows';

/**
 * Internal flag used by `generate()`/`resumeGenerate()` to tell the stream
 * adapter to close the underlying ReadableStream on SUSPENDED events so that
 * `getFullOutput()` resolves instead of hanging on a suspended run.
 * Not part of the public `DurableAgentStreamOptions` surface.
 */
const CLOSE_ON_SUSPEND = Symbol('mastra.durable.closeOnSuspend');

/**
 * Options for DurableAgent.stream()
 */
export interface DurableAgentStreamOptions<OUTPUT = undefined> {
  /** Custom instructions that override the agent's default instructions for this execution */
  instructions?: AgentExecutionOptions<OUTPUT>['instructions'];
  /** Additional context messages to provide to the agent */
  context?: AgentExecutionOptions<OUTPUT>['context'];
  /** Memory configuration for conversation persistence and retrieval */
  memory?: AgentExecutionOptions<OUTPUT>['memory'];
  /** Unique identifier for this execution run */
  runId?: string;
  /** Request Context containing dynamic configuration and state */
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /** Maximum number of steps to run */
  maxSteps?: number;
  /**
   * Conditions for stopping execution (e.g., step count, token limit).
   *
   * The predicate is non-serializable, so it's parked on the in-process run
   * registry and evaluated by the durable loop on every iteration. Cross-process
   * durable engines (e.g. Inngest after a worker restart) cannot recover the
   * closure and degrade to `maxSteps` only.
   */
  stopWhen?: AgentExecutionOptions<OUTPUT>['stopWhen'];
  /** Additional tool sets that can be used for this execution */
  toolsets?: AgentExecutionOptions<OUTPUT>['toolsets'];
  /** Client-side tools available during execution */
  clientTools?: AgentExecutionOptions<OUTPUT>['clientTools'];
  /** Tool selection strategy */
  toolChoice?: AgentExecutionOptions<OUTPUT>['toolChoice'];
  /** Tool names enabled for this execution */
  activeTools?: AgentExecutionOptions<OUTPUT>['activeTools'];
  /** Model-specific settings like temperature */
  modelSettings?: AgentExecutionOptions<OUTPUT>['modelSettings'];
  /** Require approval for tool calls. Boolean (gate all / none) or a per-call function policy. */
  requireToolApproval?: AgentExecutionOptions<OUTPUT>['requireToolApproval'];
  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;
  /** Maximum number of tool calls to execute concurrently */
  toolCallConcurrency?: number;
  /** Whether to include raw chunks in the stream output */
  includeRawChunks?: boolean;
  /** Maximum processor retries */
  maxProcessorRetries?: number;
  /** Structured output configuration */
  structuredOutput?: AgentExecutionOptions<OUTPUT>['structuredOutput'];
  /** Version overrides for sub-agent delegation */
  versions?: AgentExecutionOptions<OUTPUT>['versions'];
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Callback when step finishes */
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  /** Callback when execution finishes */
  onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
  /** Callback on error */
  onError?: (error: Error) => void | Promise<void>;
  /** Callback when workflow suspends (e.g., for tool approval) */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /** Callback when execution is aborted via abortSignal */
  onAbort?: AgentExecutionOptions<OUTPUT>['onAbort'];
  /** Callback fired after each agentic-loop iteration */
  onIterationComplete?: AgentExecutionOptions<OUTPUT>['onIterationComplete'];
  /** Additional system message appended after context but before user messages. */
  system?: AgentExecutionOptions<OUTPUT>['system'];
  /** When true, background tasks are disabled for this run. */
  disableBackgroundTasks?: AgentExecutionOptions<OUTPUT>['disableBackgroundTasks'];
  /** Tracing options forwarded to the agent/model spans. */
  tracingOptions?: AgentExecutionOptions<OUTPUT>['tracingOptions'];
  /** Per-call actor signal forwarded to FGA checks and tool execution. */
  actor?: AgentExecutionOptions<OUTPUT>['actor'];
  /**
   * Per-invocation tool payload transform policy. The closure rides on the
   * in-process run registry; only the JSON-safe `targets` shadow is serialized
   * for cross-process engines.
   */
  transform?: AgentExecutionOptions<OUTPUT>['transform'];
  /**
   * Per-step preparation hook. Closure-only: stored on the in-process run
   * registry and invoked as a `PrepareStepProcessor` at the start of every
   * iteration. Cross-process resumes lose the hook.
   */
  prepareStep?: AgentExecutionOptions<OUTPUT>['prepareStep'];
  /**
   * Per-call `isTaskComplete` policy. Scorer instances and `onComplete` are
   * closure-only and live on the in-process run registry; the JSON-safe
   * primitives (`strategy`, `timeout`, `parallel`, `suppressFeedback`,
   * `scorerNames`) are serialized for cross-process observability.
   */
  isTaskComplete?: AgentExecutionOptions<OUTPUT>['isTaskComplete'];
  /**
   * Sub-agent delegation hooks (`onDelegationStart`, `onDelegationComplete`,
   * `messageFilter`, etc.). The callbacks are forwarded into `convertTools`
   * at prepare time and burned into the sub-agent `CoreTool` wrappers on the
   * in-process run registry. Cross-process resumes lose the callbacks (only
   * `includeSubAgentToolResultsInModelContext` would be JSON-safe), so a
   * fresh worker degrades to default delegation behaviour.
   */
  delegation?: AgentExecutionOptions<OUTPUT>['delegation'];
  /**
   * When set, `stream()` delegates to the idle-loop wrapper that keeps the
   * outer stream open across background-task continuations — the same
   * behaviour as the now-deprecated `streamUntilIdle()`.
   *
   * Pass `true` for default idle timeout (5 min), or `{ maxIdleMs }` to
   * customise.
   *
   * @example
   * ```typescript
   * const { output, cleanup } = await durableAgent.stream('Research topic', {
   *   untilIdle: true,
   *   memory: { thread: 't1', resource: 'u1' },
   * });
   * ```
   */
  untilIdle?: boolean | { maxIdleMs?: number };
  /** When true, the in-loop background task check step skips waiting (streamUntilIdle sets this) */
  _skipBgTaskWait?: boolean;
  /**
   * External abort signal. The durable agent always installs its own internal
   * `AbortController` for the run; when this signal is provided, its `abort`
   * event is forwarded to the internal controller so either source can cancel
   * the run.
   *
   * Cross-process resumes (e.g. Inngest after a worker restart) cannot
   * recover the signal — call `resume(runId, ..., { abortSignal })` with a
   * fresh signal on each segment if you need abortability post-resume.
   */
  abortSignal?: AbortSignal;
}

/**
 * Result from DurableAgent.stream()
 */
export interface DurableAgentStreamResult<OUTPUT = undefined> {
  /** The streaming output */
  output: MastraModelOutput<OUTPUT>;
  /** The full stream - delegates to output.fullStream for server compatibility */
  readonly fullStream: ReadableStream<any>;
  /** The unique run ID for this execution */
  runId: string;
  /** Thread ID if using memory */
  threadId?: string;
  /** Resource ID if using memory */
  resourceId?: string;
  /** Cleanup function to call when done (unsubscribes from pubsub) */
  cleanup: () => void;
  /**
   * Abort the run. Flips the internal `AbortController` for this run, which
   * surfaces as an `AbortError` inside the durable LLM-execution step and
   * is bridged to the user's `onAbort` callback via the run's pubsub topic.
   *
   * Safe to call after the run has already finished — it's a no-op in that
   * case.
   */
  abort: (reason?: unknown) => void;
}

/**
 * Configuration for DurableAgent - wraps an existing Agent with durable execution
 */
export interface DurableAgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> {
  /**
   * The Agent to wrap with durable execution capabilities.
   * All agent methods (getModel, listTools, etc.) delegate to this agent.
   */
  agent: Agent<TAgentId, TTools, TOutput>;

  /**
   * Optional ID override. Defaults to agent.id.
   */
  id?: TAgentId;

  /**
   * Optional name override. Defaults to agent.name.
   */
  name?: string;

  /**
   * PubSub instance for streaming events.
   * Optional - if not provided, defaults to EventEmitterPubSub.
   */
  pubsub?: PubSub;

  /**
   * Cache instance for storing stream events.
   * Enables resumable streams - clients can disconnect and reconnect
   * without missing events.
   *
   * - If not provided: Inherits from Mastra instance, or uses InMemoryServerCache
   * - If provided: Uses the provided cache backend (e.g., Redis)
   * - If set to `false`: Disables caching (streams are not resumable)
   */
  cache?: MastraServerCache | false;

  /**
   * Maximum steps for the agentic loop.
   * Defaults to the workflow default if not specified.
   */
  maxSteps?: number;

  /**
   * Timeout in milliseconds before automatic cleanup of registry entries
   * after a stream finishes or errors. This provides a grace period for
   * late observers to access the stream.
   *
   * Defaults to 30000 (30 seconds).
   * Set to 0 to disable auto-cleanup (manual cleanup() required).
   */
  cleanupTimeoutMs?: number;
}

/**
 * DurableAgent wraps an existing Agent with durable execution capabilities.
 *
 * Key features:
 * 1. Resumable streams - clients can disconnect and reconnect without missing events
 * 2. Serializable workflow inputs - works with durable execution engines
 * 3. PubSub-based streaming - events flow through pubsub for distribution
 *
 * DurableAgent extends Agent, delegating most methods to the wrapped agent.
 * It overrides stream() to use durable execution with the agentic workflow.
 *
 * Subclasses (EventedAgent, InngestAgent) override executeWorkflow() to
 * customize how the workflow is executed.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { DurableAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = new DurableAgent({ agent });
 *
 * const { output, runId, cleanup } = await durableAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */
export class DurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends Agent<TAgentId, TTools, TOutput> {
  /** The wrapped agent */
  readonly #wrappedAgent: Agent<TAgentId, TTools, TOutput>;

  /** Registry for per-run non-serializable state */
  readonly #runRegistry: ExtendedRunRegistry;

  /** The durable workflow for agent execution */
  #workflow: ReturnType<typeof createDurableAgenticWorkflow> | null = null;

  /** Maximum steps for the agentic loop */
  readonly #maxSteps?: number;

  /** Inner pubsub (before CachingPubSub wrapper) */
  #innerPubsub: PubSub;

  /** Whether the user explicitly provided a pubsub (don't override with mastra.pubsub) */
  readonly #hasCustomPubsub: boolean;

  /** User-provided cache (undefined = inherit from mastra, false = disabled) */
  #cacheConfig: MastraServerCache | false | undefined;

  /** Resolved cache instance (lazily initialized) */
  #resolvedCache: MastraServerCache | null = null;

  /** CachingPubSub instance (lazily initialized) */
  #cachingPubsub: PubSub | null = null;

  /** Mastra instance (set via __setMastra when registered) */
  #mastra: Mastra | undefined;

  /** Active streamUntilIdle wrappers keyed by scope (threadId|resourceId) */
  #activeStreamUntilIdle = new Map<string, () => void>();

  /** Timeout for auto-cleanup after stream finishes (0 = disabled) */
  readonly #cleanupTimeoutMs: number;

  /**
   * Create a new DurableAgent that wraps an existing Agent
   */
  constructor(config: DurableAgentConfig<TAgentId, TTools, TOutput>) {
    const { agent, id: idOverride, name: nameOverride, pubsub, cache, maxSteps, cleanupTimeoutMs } = config;

    // Use provided id/name or fall back to agent.id/agent.name
    const agentId = idOverride ?? agent.id;
    const agentName = nameOverride ?? agent.name ?? agent.id;

    // Call Agent constructor with minimal config - we delegate to the wrapped agent
    super({
      id: agentId as TAgentId,
      name: agentName,
      // Delegate to wrapped agent's instructions
      instructions: ({ requestContext }) => agent.getInstructions({ requestContext }),
      // We need to provide model to satisfy the base class, but we'll delegate to wrapped agent
      model: (agent as any).__model ?? agent.getModel(),
    });

    this.#wrappedAgent = agent;
    this.#runRegistry = new ExtendedRunRegistry();
    this.#maxSteps = maxSteps;
    this.#hasCustomPubsub = !!pubsub;
    this.#innerPubsub = pubsub ?? new EventEmitterPubSub();
    this.#cacheConfig = cache;
    this.#cleanupTimeoutMs = cleanupTimeoutMs ?? 30_000;
  }

  // ===========================================================================
  // Lazy PubSub/Cache initialization (allows inheriting cache from Mastra)
  // ===========================================================================

  /**
   * Get the resolved cache instance.
   * Lazily initialized to allow inheriting from Mastra.
   */
  get cache(): MastraServerCache | null {
    this.#ensurePubsubInitialized();
    return this.#resolvedCache;
  }

  /**
   * Get the PubSub instance.
   * Returns CachingPubSub if caching is enabled, otherwise the inner pubsub.
   */
  get pubsub(): PubSub {
    this.#ensurePubsubInitialized();
    return this.#cachingPubsub!;
  }

  /**
   * Ensure pubsub and cache are initialized.
   * Called lazily on first access to allow inheriting cache from Mastra.
   */
  #ensurePubsubInitialized(): void {
    if (this.#cachingPubsub) return;

    if (this.#cacheConfig === false) {
      // Caching explicitly disabled
      this.#cachingPubsub = this.#innerPubsub;
      this.#resolvedCache = null;
    } else if (this.#innerPubsub instanceof CachingPubSub) {
      // The inner pubsub already provides caching/replay. This happens when the
      // user passes a CachingPubSub to `new Mastra({ pubsub })`: on registration
      // the agent adopts mastra.pubsub as its inner transport. Wrapping it again
      // in a second CachingPubSub that shares the same cache would store every
      // event twice (once per layer, with consecutive indices), so observe()/
      // replay would deliver the buffered prefix doubled (issue #18148). Reuse
      // the existing instance instead of double-wrapping.
      this.#cachingPubsub = this.#innerPubsub;
      this.#resolvedCache = this.#cacheConfig ?? this.#mastra?.serverCache ?? null;
    } else {
      // Resolve cache: user-provided > mastra's cache > default InMemoryServerCache
      const resolvedCache = this.#cacheConfig ?? this.#mastra?.serverCache ?? new InMemoryServerCache();
      this.#resolvedCache = resolvedCache;
      this.#cachingPubsub = new CachingPubSub(this.#innerPubsub, resolvedCache);
    }
  }

  // ===========================================================================
  // Delegate to wrapped agent
  // ===========================================================================

  /**
   * Get the wrapped agent instance.
   */
  get agent(): Agent<TAgentId, TTools, TOutput> {
    return this.#wrappedAgent;
  }

  /**
   * Get the run registry (for testing and advanced usage)
   */
  get runRegistry(): ExtendedRunRegistry {
    return this.#runRegistry;
  }

  /**
   * Get the max steps configured for this agent
   */
  get maxSteps(): number | undefined {
    return this.#maxSteps;
  }

  /**
   * Get the cleanup timeout in milliseconds.
   * Returns 0 if auto-cleanup is disabled.
   */
  get cleanupTimeoutMs(): number {
    return this.#cleanupTimeoutMs;
  }

  // Delegate Agent methods to wrapped agent
  override getModel(options?: any) {
    return this.#wrappedAgent.getModel(options);
  }

  override getInstructions(options?: any) {
    return this.#wrappedAgent.getInstructions(options);
  }

  override getDefaultOptions(options?: any) {
    return this.#wrappedAgent.getDefaultOptions(options);
  }

  override listTools(options?: any) {
    return this.#wrappedAgent.listTools(options);
  }

  override getMemory() {
    return this.#wrappedAgent.getMemory();
  }

  override getVoice() {
    return this.#wrappedAgent.getVoice();
  }

  // ===========================================================================
  // Editor / fork delegation
  //
  // The base Agent serves tools/instructions/model from its own private fields,
  // but a DurableAgent serves all of them from the wrapped agent (see the
  // delegating getters above). The editor applies stored overrides per request
  // by calling `__fork()` and then mutating the fork via `__updateInstructions`
  // / `__updateModel` / `__setTools`, and inspecting it via `__getEditorConfig`
  // / `__getOverridableFields`. If those operated on the DurableAgent's own
  // (unused) base fields the served agent would silently lose its tools and
  // ignore overrides, so forward them to the wrapped agent — it stays the single
  // source of truth.
  // ===========================================================================

  override __getEditorConfig() {
    return this.#wrappedAgent.__getEditorConfig();
  }

  override __getOverridableFields() {
    return this.#wrappedAgent.__getOverridableFields();
  }

  override __updateInstructions(instructions: Parameters<Agent<TAgentId, TTools, TOutput>['__updateInstructions']>[0]) {
    this.#wrappedAgent.__updateInstructions(instructions);
  }

  override __updateModel(config: Parameters<Agent<TAgentId, TTools, TOutput>['__updateModel']>[0]) {
    this.#wrappedAgent.__updateModel(config);
  }

  override __setTools(tools: Parameters<Agent<TAgentId, TTools, TOutput>['__setTools']>[0]) {
    this.#wrappedAgent.__setTools(tools);
  }

  /**
   * Create a per-request clone for applying stored editor overrides.
   *
   * The base `Agent.__fork()` builds a bare `new Agent(...)`, which for a
   * DurableAgent would drop the wrapped agent and every delegating override
   * (tools, model, memory, voice, durable streaming) — the served fork ends up a
   * plain `Agent` with no tools. Instead, fork the wrapped agent (so overrides
   * applied to this fork don't mutate the singleton) and re-wrap it in the same
   * durable subclass, preserving pubsub/cache/run configuration.
   *
   * @internal
   */
  override __fork(): Agent<TAgentId, TTools, TOutput> {
    const innerFork = this.#wrappedAgent.__fork();

    const Ctor = this.constructor as new (
      config: DurableAgentConfig<TAgentId, TTools, TOutput>,
    ) => DurableAgent<TAgentId, TTools, TOutput>;

    const fork = new Ctor({
      agent: innerFork,
      id: this.id,
      name: this.name,
      pubsub: this.#hasCustomPubsub ? this.#innerPubsub : undefined,
      cache: this.#cacheConfig,
      maxSteps: this.#maxSteps,
      cleanupTimeoutMs: this.#cleanupTimeoutMs,
    });

    // Preserve runtime state set after construction (mastra registration and the
    // wired inner pubsub, e.g. mastra.pubsub) without re-triggering registration
    // side effects — mirrors Agent.__fork().
    if (this.#mastra) {
      fork.#mastra = this.#mastra;
    }
    fork.#innerPubsub = this.#innerPubsub;
    fork.source = this.source;
    // `_agentNetworkAppend` is a private base-class flag; copy it via an indexed
    // cast (the same idiom the base uses in `toRawConfig()`) so the fork mirrors
    // `Agent.__fork()` without widening the field's visibility.
    (fork as unknown as { _agentNetworkAppend: unknown })._agentNetworkAppend = (
      this as unknown as { _agentNetworkAppend: unknown }
    )._agentNetworkAppend;

    // DurableAgent intentionally diverges from Agent's `stream` signature, so the
    // re-wrapped fork is bridged to the base `Agent` return type here. The editor's
    // fork-then-mutate contract only relies on the base Agent surface.
    return fork as unknown as Agent<TAgentId, TTools, TOutput>;
  }

  // ===========================================================================
  // Protected methods for subclass overrides
  // ===========================================================================

  /**
   * Get the PubSub instance for use by subclasses.
   * @internal
   */
  protected get pubsubInternal(): PubSub {
    return this.pubsub;
  }

  /**
   * Get the run registry for use by subclasses.
   * @internal
   */
  protected get runRegistryInternal(): ExtendedRunRegistry {
    return this.#runRegistry;
  }

  /**
   * Execute the durable workflow.
   *
   * Subclasses override this method to customize how the workflow is executed:
   * - DurableAgent (this): Runs the workflow directly via createRun + start
   * - EventedAgent: Uses run.startAsync() for fire-and-forget execution
   * - InngestAgent: Uses inngest.send() to trigger Inngest function
   *
   * @param runId - The unique run ID
   * @param workflowInput - The serialized workflow input
   * @internal
   */
  protected async executeWorkflow(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    const workflow = this.getWorkflow();
    const entry = globalRunRegistry.get(runId);
    const requestContext = entry?.requestContext;

    const run = await workflow.createRun({ runId, pubsub: this.pubsub });
    // Parent the workflow run under the AGENT_RUN span so the trace exports under it.
    const result = await run.start({
      inputData: workflowInput,
      requestContext,
      ...createObservabilityContext({ currentSpan: entry?.agentSpan }),
    });

    if (result?.status === 'failed') {
      const error = new Error((result as any).error?.message || 'Workflow execution failed');
      await this.emitError(runId, error);
    }
  }

  /**
   * Create the durable workflow for this agent.
   *
   * Subclasses can override this method to use a different workflow implementation:
   * - DurableAgent (this): Uses createDurableAgenticWorkflow()
   * - InngestAgent: Uses createInngestDurableAgenticWorkflow()
   *
   * @internal
   */
  protected createWorkflow(): ReturnType<typeof createDurableAgenticWorkflow> {
    return createDurableAgenticWorkflow({
      maxSteps: this.#maxSteps,
    });
  }

  /**
   * Emit an error event to pubsub.
   *
   * @param runId - The run ID
   * @param error - The error to emit
   * @internal
   */
  protected async emitError(runId: string, error: Error): Promise<void> {
    // End the root spans on error so the trace exports (mirrors the non-durable map-results-step).
    endRunSpansWithError(runId, error);
    await emitErrorEvent(this.pubsub, runId, error);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Stream a response from the agent using durable execution.
   */
  // @ts-expect-error - Intentionally different signature for durable execution
  async stream(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    // Delegate to the idle-loop wrapper when `untilIdle` is set.
    // Strip `untilIdle` before passing to the wrapper so its internal
    // agent.stream() call doesn't recurse.
    if (options?.untilIdle) {
      const { untilIdle, ...rest } = options;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      return runDurableStreamUntilIdle<TOutput>(
        this as unknown as DurableAgent<any, any, TOutput>,
        messages,
        { ...rest, maxIdleMs },
        {
          activeStreams: this.#activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
      );
    }

    // 1. Prepare for durable execution (non-durable phase)
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#wrappedAgent as Agent<string, any, TOutput>,
      messages,
      options: options as AgentExecutionOptions<TOutput>,
      runId: options?.runId,
      requestContext: options?.requestContext,
      mastra: this.#mastra,
    });

    const { runId, messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;

    // 1a. Install the abort controller for this run. The controller is owned
    // by this DurableAgent instance; the result's abort() method flips it,
    // and the durable LLM-execution step reads `abortSignal` off the registry
    // to thread it into the model call + abort short-circuits. If the caller
    // also supplied an external signal, forward its abort to the internal
    // controller so either source can cancel the run.
    const abortController = new AbortController();
    if (options?.abortSignal) {
      if (options.abortSignal.aborted) {
        abortController.abort((options.abortSignal as AbortSignal & { reason?: unknown }).reason);
      } else {
        options.abortSignal.addEventListener(
          'abort',
          () => abortController.abort((options.abortSignal as AbortSignal & { reason?: unknown }).reason),
          { once: true },
        );
      }
    }
    registryEntry.abortController = abortController;
    registryEntry.abortSignal = abortController.signal;

    // 2. Register non-serializable state (both local and global registries)
    this.#runRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
    globalRunRegistry.set(runId, { ...registryEntry, messageList });

    // Track cleanup state to avoid double cleanup
    let cleanedUp = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    // Schedule automatic registry cleanup after stream ends
    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(() => {
        if (!cleanedUp) {
          this.#runRegistry.cleanup(runId);
          globalRunRegistry.delete(runId);
          this.#clearPubsubTopic(runId);
          cleanedUp = true;
        }
      }, this.#cleanupTimeoutMs);
    };

    // 3. Create the durable agent stream (subscribes to pubsub)
    const {
      output,
      cleanup: streamCleanup,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      messageId,
      model: {
        modelId: workflowInput.modelConfig.modelId,
        provider: workflowInput.modelConfig.provider,
        version: 'v3',
      },
      threadId,
      resourceId,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: async result => {
        await options?.onFinish?.(result);
        scheduleAutoCleanup();
      },
      onError: async error => {
        await options?.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: options?.onSuspended,
      onAbort: async data => {
        try {
          await (options?.onAbort as ((event: any) => void | Promise<void>) | undefined)?.(data);
        } finally {
          scheduleAutoCleanup();
        }
      },
      // onIterationComplete is NOT forwarded here — the dowhile predicate
      // now calls it in-process from globalRunRegistry and honors its return
      // value ({ continue, feedback }). The pubsub ITERATION_COMPLETE event
      // still fires for external observability subscribers.
      closeOnSuspend: (options as any)?.[CLOSE_ON_SUSPEND] === true,
    });

    // 4. Wait for subscription to be ready, then execute workflow
    // This prevents race conditions where events are published before subscription
    const workflowExecution = ready
      .then(() => this.executeWorkflow(runId, workflowInput))
      .catch(error => {
        void this.emitError(runId, error);
      });
    const trackedEntry = globalRunRegistry.get(runId);
    if (trackedEntry) {
      trackedEntry.workflowExecution = workflowExecution;
    }

    // 5. Create cleanup function (cancels auto-cleanup timer if called)
    const cleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (!cleanedUp) {
        streamCleanup();
        this.#runRegistry.cleanup(runId);
        globalRunRegistry.delete(runId);
        this.#clearPubsubTopic(runId);
        cleanedUp = true;
      }
    };

    const abort = (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
    };

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      threadId,
      resourceId,
      cleanup,
      abort,
    };
  }

  /**
   * Resume a suspended workflow execution.
   */
  async resume(
    runId: string,
    resumeData: unknown,
    options?: {
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
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
    },
  ): Promise<DurableAgentStreamResult<TOutput>> {
    // Delegate to the idle-loop wrapper when `untilIdle` is set. Strip
    // `untilIdle` before passing to the wrapper so the inner agent.resume()
    // call (and subsequent agent.stream([]) continuations) don't recurse.
    if (options?.untilIdle) {
      const { untilIdle, ...rest } = options;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      return runResumeDurableStreamUntilIdle<TOutput>(
        this as unknown as DurableAgent<any, any, TOutput>,
        runId,
        resumeData,
        { ...rest, maxIdleMs } as DurableAgentStreamOptions<TOutput> & { maxIdleMs?: number },
        {
          activeStreams: this.#activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
      );
    }

    const entry = this.#runRegistry.get(runId);
    if (!entry) {
      throw new Error(`No registry entry found for run ${runId}. Cannot resume.`);
    }

    // Install a fresh abort controller for the resumed segment. The original
    // controller is gone (the stream that owned it has already settled), so
    // we overwrite the registry slot. If the caller passed an external
    // signal, forward it onto the new internal controller.
    const abortController = new AbortController();
    if (options?.abortSignal) {
      if (options.abortSignal.aborted) {
        abortController.abort((options.abortSignal as AbortSignal & { reason?: unknown }).reason);
      } else {
        options.abortSignal.addEventListener(
          'abort',
          () => abortController.abort((options.abortSignal as AbortSignal & { reason?: unknown }).reason),
          { once: true },
        );
      }
    }
    entry.abortController = abortController;
    entry.abortSignal = abortController.signal;
    const globalEntryForAbort = globalRunRegistry.get(runId);
    if (globalEntryForAbort) {
      globalEntryForAbort.abortController = abortController;
      globalEntryForAbort.abortSignal = abortController.signal;
    }

    const memoryInfo = this.#runRegistry.getMemoryInfo(runId);

    // Track cleanup state to avoid double cleanup
    let cleanedUp = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(() => {
        if (!cleanedUp) {
          this.#runRegistry.cleanup(runId);
          globalRunRegistry.delete(runId);
          this.#clearPubsubTopic(runId);
          cleanedUp = true;
        }
      }, this.#cleanupTimeoutMs);
    };

    const globalEntry = globalRunRegistry.get(runId);
    const resumeModel = globalEntry?.model as any;

    // Skip events already broadcast by the original run (e.g. the SUSPENDED
    // chunk that paused it). Without this, a resume that closes on suspend
    // (resumeGenerate) would immediately close on the replayed SUSPENDED.
    const resumeOffset = await this.#getPubsubOffset(runId);

    const {
      output,
      cleanup: streamCleanup,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      messageId: crypto.randomUUID(),
      model: {
        modelId: resumeModel?.modelId,
        provider: resumeModel?.provider,
        version: 'v3',
      },
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      offset: resumeOffset,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: async result => {
        await options?.onFinish?.(result);
        scheduleAutoCleanup();
      },
      onError: async error => {
        await options?.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: options?.onSuspended,
      closeOnSuspend: (options as any)?.[CLOSE_ON_SUSPEND] === true,
    });

    // Wait for subscription to be ready, then resume workflow
    const workflow = this.getWorkflow();
    const requestContext = globalRunRegistry.get(runId)?.requestContext;

    // Open a fresh AGENT_RUN + MODEL_GENERATION for the resumed segment on the same
    // traceId — the originals were ended as `suspended` and can't be reopened. Post-resume
    // steps + terminal end() target these via the registry override. (Linking = follow-up.)
    const origTraceId = entry.agentSpan?.traceId;
    const origSpanId = entry.agentSpan?.id;
    if (origTraceId && this.#mastra?.observability) {
      try {
        const ag = this.#wrappedAgent as Agent<string, any, any>;
        // Match non-durable Agent.stream() resume-span shape: same name suffix
        // `(resumed)`, forward agent-level tracingPolicy, link to the original
        // span via `resumedFromSpanId` metadata, and carry the resolvedVersionId.
        const rawConfig = typeof (ag as any).toRawConfig === 'function' ? (ag as any).toRawConfig() : undefined;
        const resolvedVersionId = rawConfig?.resolvedVersionId as string | undefined;
        const agentTracingPolicy = typeof ag.getTracingPolicy === 'function' ? ag.getTracingPolicy() : undefined;
        const resumeAgentSpan = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          name: `agent run: '${ag.id}' (resumed)`,
          entityType: EntityType.AGENT,
          entityId: ag.id,
          entityName: ag.name,
          metadata: {
            runId,
            resumed: true,
            ...(origSpanId ? { resumedFromSpanId: origSpanId } : {}),
            ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
          },
          tracingPolicy: agentTracingPolicy,
          tracingOptions: { traceId: origTraceId },
          requestContext,
          mastra: this.#mastra,
        });
        const resumeModelSpan = resumeAgentSpan?.createChildSpan({
          type: SpanType.MODEL_GENERATION,
          name: `llm: '${resumeModel?.modelId ?? ''}'`,
          attributes: { model: resumeModel?.modelId, provider: resumeModel?.provider, streaming: true },
          metadata: { runId, resumed: true },
          requestContext,
        });
        for (const reg of [entry, globalRunRegistry.get(runId)]) {
          if (!reg) continue;
          reg.resumeAgentSpan = resumeAgentSpan;
          reg.resumeModelSpan = resumeModelSpan;
          reg.resumeAgentSpanData = resumeAgentSpan?.exportSpan();
          reg.resumeModelSpanData = resumeModelSpan?.exportSpan();
        }
      } catch (error) {
        // Span bookkeeping must never block resume.
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to open resume spans: ${error}`);
      }
    }

    const workflowExecution = ready
      .then(async () => {
        const run = await workflow.createRun({ runId, pubsub: this.pubsub });
        const result = await run.resume({
          resumeData,
          requestContext,
          ...createObservabilityContext({ currentSpan: entry.resumeAgentSpan ?? entry.agentSpan }),
        });
        if (result?.status === 'failed') {
          const error = new Error((result as any).error?.message || 'Workflow resume failed');
          void this.emitError(runId, error);
        }
      })
      .catch(error => {
        void this.emitError(runId, error);
      });
    const trackedResumeEntry = globalRunRegistry.get(runId);
    if (trackedResumeEntry) {
      trackedResumeEntry.workflowExecution = workflowExecution;
    }

    const cleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (!cleanedUp) {
        streamCleanup();
        this.#runRegistry.cleanup(runId);
        globalRunRegistry.delete(runId);
        this.#clearPubsubTopic(runId);
        cleanedUp = true;
      }
    };

    const abort = (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
    };

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      cleanup,
      abort,
    };
  }

  /**
   * Generate a complete response from the agent using durable execution.
   *
   * Drains the underlying durable stream to completion and returns the same
   * {@link FullOutput} shape as non-durable `Agent.generate`. The underlying
   * workflow is identical to `stream()` — it just collects the final result
   * for callers that don't want to consume chunks themselves.
   *
   * This method intentionally re-implements the `stream()` setup rather than
   * delegating to `this.stream(...)` so that `prepareForDurableExecution` (and
   * downstream `convertTools`) receives `methodType: 'generate'`. Tool
   * factories that vary their `CoreTool` output based on the calling method
   * (e.g. `clientTools` vs server-side tools) rely on this signal — calling
   * `stream()` here would silently pass `methodType: 'stream'`.
   *
   * If the run suspends (e.g. tool approval or `suspend()` from a tool), the
   * returned output's `finishReason` will be `'suspended'` and
   * `suspendPayload` will be populated. Use {@link DurableAgent.resumeGenerate}
   * to continue.
   *
   * Note on suspend persistence: for the base `DurableAgent`, the workflow
   * engine's `run.start()` only resolves after the suspend snapshot is
   * persisted, so awaiting `workflowExecution` on suspend is sufficient for
   * a subsequent `resumeGenerate()` to find the snapshot. Subclasses like
   * `EventedAgent` use a fire-and-forget `run.startAsync()` and therefore
   * cannot rely on this await for snapshot durability — see the
   * `EventedAgent` docs for the recommended pattern.
   */
  // @ts-expect-error - Intentionally different signature for durable execution
  async generate(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<FullOutput<TOutput>> {
    // 1. Prepare for durable execution (non-durable phase)
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#wrappedAgent as Agent<string, any, TOutput>,
      messages,
      options: options as AgentExecutionOptions<TOutput>,
      runId: options?.runId,
      requestContext: options?.requestContext,
      mastra: this.#mastra,
      methodType: 'generate',
    });

    const { runId, messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;

    // 1a. Install the abort controller for this run. The controller is owned
    // by this DurableAgent instance; the result's abort() method flips it,
    // and the durable LLM-execution step reads `abortSignal` off the registry
    // to thread it into the model call + abort short-circuits. If the caller
    // also supplied an external signal, forward its abort to the internal
    // controller so either source can cancel the run.
    const abortController = new AbortController();
    if (options?.abortSignal) {
      if (options.abortSignal.aborted) {
        abortController.abort((options.abortSignal as AbortSignal & { reason?: unknown }).reason);
      } else {
        options.abortSignal.addEventListener(
          'abort',
          () => abortController.abort((options.abortSignal as AbortSignal & { reason?: unknown }).reason),
          { once: true },
        );
      }
    }
    registryEntry.abortController = abortController;
    registryEntry.abortSignal = abortController.signal;

    // 2. Register non-serializable state (both local and global registries)
    this.#runRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
    globalRunRegistry.set(runId, { ...registryEntry, messageList });

    // Track cleanup state to avoid double cleanup
    let cleanedUp = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    // Schedule automatic registry cleanup after stream ends
    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(() => {
        if (!cleanedUp) {
          this.#runRegistry.cleanup(runId);
          globalRunRegistry.delete(runId);
          this.#clearPubsubTopic(runId);
          cleanedUp = true;
        }
      }, this.#cleanupTimeoutMs);
    };

    // 3. Create the durable agent stream (subscribes to pubsub)
    const {
      output,
      cleanup: streamCleanup,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      messageId,
      model: {
        modelId: workflowInput.modelConfig.modelId,
        provider: workflowInput.modelConfig.provider,
        version: 'v3',
      },
      threadId,
      resourceId,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: async result => {
        await options?.onFinish?.(result);
        scheduleAutoCleanup();
      },
      onError: async error => {
        await options?.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: options?.onSuspended,
      onAbort: async data => {
        try {
          await (options?.onAbort as ((event: any) => void | Promise<void>) | undefined)?.(data);
        } finally {
          scheduleAutoCleanup();
        }
      },
      // onIterationComplete is NOT forwarded here — the dowhile predicate
      // now calls it in-process from globalRunRegistry and honors its return
      // value ({ continue, feedback }). The pubsub ITERATION_COMPLETE event
      // still fires for external observability subscribers.
      closeOnSuspend: true,
    });

    // 4. Wait for subscription to be ready, then execute workflow
    // This prevents race conditions where events are published before subscription
    const workflowExecution = ready
      .then(() => this.executeWorkflow(runId, workflowInput))
      .catch(error => {
        void this.emitError(runId, error);
      });
    const trackedEntry = globalRunRegistry.get(runId);
    if (trackedEntry) {
      trackedEntry.workflowExecution = workflowExecution;
    }

    // 5. Create cleanup function (cancels auto-cleanup timer if called)
    const cleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (!cleanedUp) {
        streamCleanup();
        this.#runRegistry.cleanup(runId);
        globalRunRegistry.delete(runId);
        this.#clearPubsubTopic(runId);
        cleanedUp = true;
      }
    };

    let suspended = false;
    try {
      const fullOutput = (await output.getFullOutput()) as FullOutput<TOutput>;
      if (fullOutput.error) {
        throw fullOutput.error;
      }
      suspended = fullOutput.finishReason === 'suspended';
      // On suspend, the SUSPENDED event is emitted from the tool-call step
      // before the workflow engine has persisted the snapshot. Awaiting the
      // workflow execution promise blocks until `run.start()` returns, which
      // happens after the suspend snapshot has been persisted — so a later
      // `resumeGenerate()` can find the snapshot. Subclasses that drive the
      // workflow with a fire-and-forget API (see `EventedAgent`) need their
      // own persistence guarantee here; their `executeWorkflow` promise may
      // resolve before the snapshot lands.
      if (suspended) {
        await globalRunRegistry.get(runId)?.workflowExecution;
      }
      // Fall back to the stream-level runId if MastraModelOutput.runId wasn't
      // populated (no chunk surfaced before suspend).
      if (!fullOutput.runId) {
        (fullOutput as { runId?: string }).runId = runId;
      }
      return fullOutput;
    } finally {
      // Keep the registry entry alive on suspend so `resumeGenerate()` can
      // pick it up. Auto-cleanup is scheduled by FINISH/ERROR/ABORT paths.
      if (!suspended) {
        cleanup();
      }
    }
  }

  /**
   * Resume a suspended durable run and drain it to a single
   * {@link FullOutput}. Mirrors {@link Agent.resumeGenerate} on top of
   * {@link DurableAgent.resume}.
   *
   * Unlike `generate()`, this delegates to `resume()` because resume reads
   * its tools from the existing run-registry entry rather than running
   * `prepareForDurableExecution` again — there is no `methodType` to thread
   * through. The same `EventedAgent` caveat about fire-and-forget snapshot
   * persistence noted on `generate()` applies if the resumed turn suspends.
   */
  async resumeGenerate(
    runId: string,
    resumeData: unknown,
    options?: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2],
  ): Promise<FullOutput<TOutput>> {
    const result = await this.resume(runId, resumeData, {
      ...(options ?? {}),
      [CLOSE_ON_SUSPEND]: true,
    } as Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2]);
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
      if (!suspended) {
        result.cleanup();
      }
    }
  }

  /**
   * Observe an existing stream.
   * Use this to reconnect to a stream after a network disconnection.
   *
   * **Warning:** The returned `cleanup()` function destroys the run's registry
   * entries and cached PubSub events. Only call it when you are done with the
   * run entirely. If the workflow is suspended and you intend to resume later,
   * do not call cleanup — let the auto-cleanup timer handle it after
   * FINISH/ERROR. Auto-cleanup does not fire on SUSPENDED events.
   */
  async observe(
    runId: string,
    options?: {
      offset?: number;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: (result: AgentFinishEventData) => void | Promise<void>;
      onError?: (error: Error) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string }> {
    const memoryInfo = this.#runRegistry.getMemoryInfo(runId);

    // Track cleanup state to avoid double cleanup
    let cleanedUp = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(() => {
        if (!cleanedUp) {
          this.#runRegistry.cleanup(runId);
          globalRunRegistry.delete(runId);
          this.#clearPubsubTopic(runId);
          cleanedUp = true;
        }
      }, this.#cleanupTimeoutMs);
    };

    const {
      output,
      cleanup: streamCleanup,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      messageId: crypto.randomUUID(),
      model: {
        modelId: undefined,
        provider: undefined,
        version: 'v3',
      },
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      offset: options?.offset,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: async result => {
        await options?.onFinish?.(result);
        scheduleAutoCleanup();
      },
      onError: async error => {
        await options?.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: options?.onSuspended,
    });

    // Wait for subscription to be ready
    await ready;

    const cleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (!cleanedUp) {
        streamCleanup();
        this.#runRegistry.cleanup(runId);
        globalRunRegistry.delete(runId);
        this.#clearPubsubTopic(runId);
        cleanedUp = true;
      }
    };

    // observe() doesn't own the run's lifecycle, but for API symmetry the
    // returned `abort` flips the in-process controller currently installed
    // on the registry. If the run already ended (or is running in a
    // different process), this is a best-effort no-op.
    const abort = (reason?: unknown) => {
      const controller = (globalRunRegistry.get(runId) ?? this.#runRegistry.get(runId))?.abortController;
      if (controller && !controller.signal.aborted) {
        controller.abort(reason);
      }
    };

    return {
      output,
      get fullStream() {
        return output.fullStream as ReadableStream<any>;
      },
      runId,
      threadId: memoryInfo?.threadId,
      resourceId: memoryInfo?.resourceId,
      cleanup,
      abort,
    };
  }

  /**
   * Clear cached pubsub events for a run's topic.
   * Only effective when pubsub supports clearTopic (e.g. CachingPubSub).
   */
  #clearPubsubTopic(runId: string): void {
    const pubsub = this.pubsub;
    if ('clearTopic' in pubsub && typeof (pubsub as any).clearTopic === 'function') {
      void (pubsub as any).clearTopic(AGENT_STREAM_TOPIC(runId));
    }
  }

  /**
   * Read the current number of cached events for this run's stream topic.
   * Used by `resume()` as the subscription offset so we don't re-deliver
   * events emitted by the original run (notably the SUSPENDED chunk that
   * paused it).
   */
  async #getPubsubOffset(runId: string): Promise<number> {
    const pubsub = this.pubsub as PubSub & {
      getHistory?: (topic: string) => Promise<unknown[]>;
    };
    if (typeof pubsub.getHistory !== 'function') return 0;
    try {
      const history = await pubsub.getHistory(AGENT_STREAM_TOPIC(runId));
      return Array.isArray(history) ? history.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get the workflow instance for direct execution.
   * Lazily creates the workflow and registers Mastra on it (needed for
   * getAgentById in execution steps).
   */
  getWorkflow() {
    if (!this.#workflow) {
      this.#workflow = this.createWorkflow();
      // Register mastra on the workflow so execution steps can access agents/tools.
      // DurableAgent goes through the normal Agent registration path (not the durable wrapper
      // path that calls addWorkflow), so the workflow isn't registered in Mastra's #workflows.
      // We set mastra directly here instead.
      if (this.#mastra) {
        this.#workflow.__registerMastra(this.#mastra);
        this.#workflow.__registerPrimitives({
          logger: this.#mastra.getLogger(),
          storage: this.#mastra.getStorage(),
        });
      }
    }
    return this.#workflow;
  }

  /**
   * @deprecated Use `stream(messages, { untilIdle: true })` instead.
   *
   * Stream until all background tasks complete and the agent is idle.
   * Mirrors the regular Agent's streamUntilIdle but adapted for durable execution.
   */
  // @ts-expect-error - Intentionally different return type for durable execution
  override async streamUntilIdle<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: DurableAgentStreamOptions<OUTPUT> & { maxIdleMs?: number },
  ): Promise<DurableAgentStreamResult<OUTPUT>> {
    return runDurableStreamUntilIdle<OUTPUT>(
      this as unknown as DurableAgent<any, any, OUTPUT>,
      messages,
      streamOptions,
      {
        activeStreams: this.#activeStreamUntilIdle,
        bgManager: this.#mastra?.backgroundTaskManager,
      },
    );
  }

  /**
   * Prepare for durable execution without starting it.
   */
  async prepare(messages: MessageListInput, options?: AgentExecutionOptions<TOutput>) {
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#wrappedAgent as Agent<string, any, TOutput>,
      messages,
      options,
      // Forward the caller-provided runId (mirrors stream()). Without this,
      // prepareForDurableExecution mints a fresh id, so prepare() registers a
      // different run than requested and a follow-up resume(runId) — e.g. when
      // rehydrating a persisted, suspended run in a fresh process — can't find
      // its registry entry.
      runId: options?.runId,
      requestContext: options?.requestContext,
      mastra: this.#mastra,
    });

    this.#runRegistry.registerWithMessageList(preparation.runId, preparation.registryEntry, preparation.messageList, {
      threadId: preparation.threadId,
      resourceId: preparation.resourceId,
    });
    globalRunRegistry.set(preparation.runId, {
      ...preparation.registryEntry,
      messageList: preparation.messageList,
    });

    return {
      runId: preparation.runId,
      messageId: preparation.messageId,
      workflowInput: preparation.workflowInput,
      registryEntry: preparation.registryEntry,
      threadId: preparation.threadId,
      resourceId: preparation.resourceId,
    };
  }

  /**
   * Get the durable workflows required by this agent.
   * Called by Mastra during agent registration.
   * @internal
   */
  getDurableWorkflows() {
    return [this.getWorkflow()];
  }

  /**
   * Delegate scorer listing to the wrapped agent so that callers querying the
   * durable wrapper still see the underlying agent's scorers.
   */
  async listScorers(
    opts?: Parameters<Agent<TAgentId, TTools, TOutput>['listScorers']>[0],
  ): ReturnType<Agent<TAgentId, TTools, TOutput>['listScorers']> {
    return this.#wrappedAgent.listScorers(opts);
  }

  /**
   * Set the Mastra instance.
   * Called by the durable agent registration path in addAgent().
   * Delegates to __registerMastra so the pubsub wiring and agent
   * registration happen regardless of which entry point is called first.
   * @internal
   */
  __setMastra(mastra: Mastra): void {
    this.__registerMastra(mastra);
  }

  /**
   * Register the Mastra instance.
   * Called by Mastra during agent registration (normal Agent path).
   *
   * Also wires mastra.pubsub as the inner pubsub (if the user didn't provide
   * a custom one), so that the OBSERVE_AGENT_STREAM_ROUTE handler can subscribe
   * to the same PubSub instance that this agent publishes to.
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    super.__registerMastra(mastra);
    this.#mastra = mastra;
    // Also set on wrapped agent
    this.#wrappedAgent.__registerMastra(mastra);

    // Wire mastra.pubsub as the inner pubsub if user didn't provide a custom one.
    // This must happen before CachingPubSub initialization.
    if (!this.#hasCustomPubsub && !this.#cachingPubsub) {
      this.#innerPubsub = mastra.pubsub;
    }
  }
}
