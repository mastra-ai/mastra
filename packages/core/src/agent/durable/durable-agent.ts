import type { MastraServerCache } from '../../cache/base';
import { InMemoryServerCache } from '../../cache/inmemory';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { Mastra } from '../../mastra';
import { createObservabilityContext, getOrCreateSpan, SpanType, EntityType } from '../../observability';
import { RequestContext } from '../../request-context';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import type { ChunkType, MastraOnFinishCallback } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { deepMerge } from '../../utils';
import type { WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { beginGoalActivity, stopGoalActivity } from '../goal';
import { MessageList } from '../message-list';
import type { MessageListInput } from '../message-list';
import { SaveQueueManager } from '../save-queue';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import type { ToolsInput } from '../types';

import { AGENT_STREAM_TOPIC, DurableStepIds } from './constants';
import { runDurableStreamUntilIdle, runResumeDurableStreamUntilIdle } from './durable-stream-until-idle';
import { prepareForDurableExecution } from './preparation';
import { endRunSpansWithError, ExtendedRunRegistry, globalRunRegistry } from './run-registry';
import { createDurableAgentStream, emitChunkEvent, emitErrorEvent } from './stream-adapter';
import type { AgentStepFinishEventData, AgentSuspendedEventData, DurableAgenticWorkflowInput } from './types';
import { createDurableAgenticWorkflow } from './workflows';

/**
 * Internal flag used by `generate()`/`resumeGenerate()` to tell the stream
 * adapter to close the underlying ReadableStream on SUSPENDED events so that
 * `getFullOutput()` resolves instead of hanging on a suspended run.
 * Not part of the public `DurableAgentStreamOptions` surface.
 */
const CLOSE_ON_SUSPEND = Symbol('mastra.durable.closeOnSuspend');
const RESOLVED_EXECUTION_OPTIONS = Symbol('mastra.durable.resolvedExecutionOptions');

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
  /** Callback when execution finishes — receives rich step data (text, steps, toolResults) */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Callback on error */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
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

type DurableAgentResumeOptions<OUTPUT = undefined> = DurableAgentStreamOptions<OUTPUT> & {
  toolCallId?: string;
};

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

/**
 * Statuses of durable agent runs discoverable via {@link DurableAgent.listActiveRuns}.
 *
 * `running` is the status reported by the workflow engine while the durable
 * agent's agentic loop is actively executing (i.e. between suspend
 * boundaries). Persisted `running` snapshots are the recovery source for runs
 * orphaned by a process restart.
 */
export type DurableAgentActiveRunStatus = Extract<WorkflowRunStatus, 'running'>;

/**
 * Filters for {@link DurableAgent.listActiveRuns}. Mirrors the
 * `listWorkflowRuns` filter contract, plus the agent-level `threadId` /
 * `resourceId` filters used by the base {@link Agent.listSuspendedRuns}.
 */
export interface DurableAgentListActiveRunsOptions {
  /** Only return runs that belong to this memory thread. */
  threadId?: string;
  /** Only return runs that belong to this memory resource. */
  resourceId?: string;
  /** Only return runs created at or after this date. */
  fromDate?: Date;
  /** Only return runs created at or before this date. */
  toDate?: Date;
  /**
   * Number of items per page. Pagination is applied when both `perPage` and
   * `page` are provided; otherwise all matching runs are returned.
   */
  perPage?: number;
  /** Zero-indexed page number. */
  page?: number;
}

/**
 * A durable agent run currently reported as `running` in workflow snapshot
 * storage. These are the runs that a boot-time or operator-initiated
 * recovery would re-drive after a process restart.
 */
export interface DurableAgentActiveRun {
  /** Run ID accepted by {@link DurableAgent.recoverActiveRuns} and workflow `restart`. */
  runId: string;
  status: DurableAgentActiveRunStatus;
  threadId?: string;
  resourceId?: string;
  /** When the run's snapshot was last persisted while running. */
  updatedAt: Date;
}

export interface DurableAgentListActiveRunsResult {
  runs: DurableAgentActiveRun[];
  /** Total number of matching runs, before pagination. */
  total: number;
}

/**
 * Outcome of a single run restart attempted by
 * {@link DurableAgent.recoverActiveRuns}. `success` means `run.restart()`
 * returned; `failed` means it threw and the error was captured so recovery
 * of remaining runs could proceed.
 */
export interface DurableAgentRecoveredRun {
  runId: string;
  status: 'success' | 'failed';
  /** Populated only when `status === 'failed'`. */
  error?: Error;
}

/**
 * Filters for {@link DurableAgent.recoverActiveRuns}. Reuses the
 * {@link DurableAgentListActiveRunsOptions} discovery filters and adds an
 * escape hatch for targeting a specific run ID.
 */
export interface DurableAgentRecoverActiveRunsOptions extends DurableAgentListActiveRunsOptions {
  /**
   * Recover a specific run by ID. When set, the discovery filters and
   * pagination fields are ignored. Useful when the caller already knows the
   * run ID from another source (e.g. their own bookkeeping).
   */
  runId?: string;
}

export interface DurableAgentRecoverActiveRunsResult {
  recovered: DurableAgentRecoveredRun[];
  /** Number of runs that restarted successfully. */
  succeeded: number;
  /** Number of runs whose restart threw. */
  failed: number;
}

/**
 * Options for {@link DurableAgent.recover}, a single-run streamable recovery
 * counterpart to {@link DurableAgent.resume}.
 *
 * `recover()` rebuilds the run's non-serializable state from the persisted
 * workflow snapshot (message list, model, tools, memory, saveQueueManager,
 * request context, agent span) and returns a fresh {@link DurableAgentStreamResult}
 * whose `fullStream` observes the recovered run through pubsub. Callbacks
 * mirror `stream()` / `resume()`.
 */
export interface DurableAgentRecoverOptions<OUTPUT = undefined> {
  /** Callback when chunk is received */
  onChunk?: (chunk: ChunkType<OUTPUT>) => void | Promise<void>;
  /** Callback when a step finishes */
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  /** Callback when the recovered run finishes */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Callback when the recovered run errors */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  /** Callback when the recovered run suspends again */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /**
   * Optional abort signal for the recovered segment. Forwarded onto a fresh
   * internal `AbortController` installed on the run's registry entry, so
   * `result.abort()` and the external signal can both cancel the recovered run.
   */
  abortSignal?: AbortSignal;
}

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

  // ===========================================================================
  // Delegate Agent methods to wrapped agent
  //
  // DurableAgent's super() only passes id, name, instructions, and model.
  // All other private fields (#tools, #memory, #workspace, #processors, etc.)
  // are empty on the DurableAgent instance. Every public/protected method that
  // reads those fields must be overridden to delegate to the wrapped agent.
  // ===========================================================================

  // --- Model & LLM ---
  override getModel(options?: any) {
    return this.#wrappedAgent.getModel(options);
  }

  override getLLM(options?: any) {
    return this.#wrappedAgent.getLLM(options);
  }

  override async getModelList(requestContext?: any) {
    return this.#wrappedAgent.getModelList(requestContext);
  }

  // --- Instructions, description, metadata ---
  override getInstructions(options?: any) {
    return this.#wrappedAgent.getInstructions(options);
  }

  override getDescription() {
    return this.#wrappedAgent.getDescription();
  }

  override getMetadata(options?: any) {
    return this.#wrappedAgent.getMetadata(options);
  }

  override getTracingPolicy() {
    return this.#wrappedAgent.getTracingPolicy();
  }

  // --- Tools ---
  override listTools(options?: any) {
    return this.#wrappedAgent.listTools(options);
  }

  override getConfiguredToolHooks() {
    return this.#wrappedAgent.getConfiguredToolHooks();
  }

  // --- Default options ---
  override getDefaultOptions(options?: any) {
    return this.#wrappedAgent.getDefaultOptions(options);
  }

  async #resolveExecutionOptions(
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamOptions<TOutput>> {
    if ((options as any)?.[RESOLVED_EXECUTION_OPTIONS]) {
      return options!;
    }

    const defaultOptions = await this.getDefaultOptions({ requestContext: options?.requestContext });
    const resolvedOptions = deepMerge(
      (defaultOptions ?? {}) as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as DurableAgentStreamOptions<TOutput>;
    // Actor is a per-call trust signal, so an explicit value replaces the
    // default actor as a whole rather than inheriting any of its fields.
    if (options?.actor !== undefined) {
      resolvedOptions.actor = options.actor;
    }
    if ((options as any)?.[CLOSE_ON_SUSPEND] === true) {
      Object.defineProperty(resolvedOptions, CLOSE_ON_SUSPEND, { value: true, enumerable: true });
    }
    // Preserve the marker when the until-idle wrapper spreads these options.
    Object.defineProperty(resolvedOptions, RESOLVED_EXECUTION_OPTIONS, { value: true, enumerable: true });
    return resolvedOptions;
  }

  override getDefaultGenerateOptionsLegacy(options?: any) {
    return this.#wrappedAgent.getDefaultGenerateOptionsLegacy(options);
  }

  override getDefaultStreamOptionsLegacy(options?: any) {
    return this.#wrappedAgent.getDefaultStreamOptionsLegacy(options);
  }

  override getDefaultNetworkOptions(options?: any) {
    return this.#wrappedAgent.getDefaultNetworkOptions(options);
  }

  // --- Memory ---
  override getMemory(options?: any) {
    return this.#wrappedAgent.getMemory(options);
  }

  override hasOwnMemory(): boolean {
    return this.#wrappedAgent.hasOwnMemory();
  }

  // --- Workspace ---
  override getWorkspace(options?: any) {
    return this.#wrappedAgent.getWorkspace(options);
  }

  override hasOwnWorkspace(): boolean {
    return this.#wrappedAgent.hasOwnWorkspace?.() ?? false;
  }

  // --- Voice ---
  override getVoice(options?: any) {
    return this.#wrappedAgent.getVoice(options);
  }

  override get voice() {
    return this.#wrappedAgent.voice;
  }

  // --- Request context ---
  override get requestContextSchema() {
    return this.#wrappedAgent.requestContextSchema;
  }

  // --- Processors ---
  override async getConfiguredProcessorWorkflows() {
    return this.#wrappedAgent.getConfiguredProcessorWorkflows();
  }

  override async listInputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listInputProcessors(requestContext);
  }

  override async listOutputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listOutputProcessors(requestContext);
  }

  override async listErrorProcessors(requestContext?: any) {
    return this.#wrappedAgent.listErrorProcessors(requestContext);
  }

  override async resolveProcessorById<TId extends string = string>(processorId: TId, requestContext?: any) {
    return this.#wrappedAgent.resolveProcessorById(processorId, requestContext);
  }

  override async listConfiguredInputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listConfiguredInputProcessors(requestContext);
  }

  override async listConfiguredOutputProcessors(requestContext?: any) {
    return this.#wrappedAgent.listConfiguredOutputProcessors(requestContext);
  }

  override async getConfiguredProcessorIds(requestContext?: any) {
    return this.#wrappedAgent.getConfiguredProcessorIds(requestContext);
  }

  // --- Sub-agents ---
  override listAgents(options?: any) {
    return this.#wrappedAgent.listAgents(options);
  }

  override __getStaticAgents() {
    return this.#wrappedAgent.__getStaticAgents();
  }

  override __hasSubAgentsConfigured() {
    return this.#wrappedAgent.__hasSubAgentsConfigured();
  }

  // --- Workflows ---
  override async listWorkflows(options?: any) {
    return this.#wrappedAgent.listWorkflows(options);
  }

  // --- Skills ---
  override async getSkill(skillName: string, options?: any) {
    return this.#wrappedAgent.getSkill(skillName, options);
  }

  override async listSkills(options?: any) {
    return this.#wrappedAgent.listSkills(options);
  }

  // --- Scorers ---
  override async listScorers(options?: any) {
    return this.#wrappedAgent.listScorers(options);
  }

  // --- Background tasks ---
  override getBackgroundTasksConfig() {
    return this.#wrappedAgent.getBackgroundTasksConfig();
  }

  override disableBackgroundTasks() {
    this.#wrappedAgent.disableBackgroundTasks();
  }

  override enableBackgroundTasks() {
    this.#wrappedAgent.enableBackgroundTasks();
  }

  // --- Tool payload transform & goal ---
  override getToolPayloadTransform() {
    return this.#wrappedAgent.getToolPayloadTransform();
  }

  override __getGoalConfig() {
    return this.#wrappedAgent.__getGoalConfig();
  }

  // --- Browser ---
  override get browser() {
    return this.#wrappedAgent.browser;
  }

  override setBrowser(browser: any) {
    this.#wrappedAgent.setBrowser(browser);
  }

  override hasOwnBrowser() {
    return this.#wrappedAgent.hasOwnBrowser();
  }

  // --- Channels ---
  override getChannels() {
    return this.#wrappedAgent.getChannels();
  }

  override setChannels(agentChannels: any) {
    this.#wrappedAgent.setChannels(agentChannels);
  }

  // --- PubSub (base Agent fields — DurableAgent has its own pubsub) ---
  override hasOwnPubSub() {
    return this.#wrappedAgent.hasOwnPubSub();
  }

  // --- Setters called by AgentController — forward to BOTH wrapper and wrapped ---
  // We propagate to both so that:
  //  - The wrapped agent sees the value for its own internal use.
  //  - The DurableAgent's inherited getPubSub()/getMemory()/getWorkspace()
  //    also work (they read #inheritedPubSub / #memory / #workspace set by super).
  override __setMemory(memory: any) {
    super.__setMemory(memory);
    this.#wrappedAgent.__setMemory(memory);
  }

  override __setPubSub(pubsub: any) {
    super.__setPubSub(pubsub);
    this.#wrappedAgent.__setPubSub(pubsub);
  }

  override __setWorkspace(workspace: any) {
    super.__setWorkspace(workspace);
    this.#wrappedAgent.__setWorkspace(workspace);
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
      actor: workflowInput.options?.actor,
      ...createObservabilityContext({ currentSpan: entry?.agentSpan }),
    });
    if (result?.status === 'failed') {
      const error = new Error((result as any).error?.message || 'Workflow execution failed');
      await this.emitError(runId, error);
    }
    // Reaching any non-suspended terminal status means the run is done and its
    // persisted snapshot rows will never be resumed. Delete them so snapshot
    // storage doesn't grow one stale row per completed run. Suspended runs
    // keep their snapshots so `resume()` / `recoverActiveRuns()` can find them.
    if (result?.status && result.status !== 'suspended') {
      await this.deleteRunSnapshots(runId);
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

  /**
   * Delete the persisted workflow snapshot rows for a completed durable run.
   *
   * A durable agent write two rows per run: one for the outer `AGENTIC_LOOP`
   * workflow and one for the nested `AGENTIC_EXECUTION` workflow (persisted
   * under the same `runId`). Once the run reaches a non-suspended terminal
   * state neither row is needed again — leaving them behind fills snapshot
   * storage with stale `pending`/`running` rows for every completed run and
   * pollutes `listActiveRuns` / `recoverActiveRuns` on the next boot.
   *
   * Best-effort: a cleanup failure must never turn a finished run into an
   * error — a stale row is preferable to a broken exit path.
   *
   * @internal
   */
  protected async deleteRunSnapshots(runId: string): Promise<void> {
    try {
      const workflow = this.getWorkflow();
      await workflow.deleteWorkflowRunById(runId);
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      await workflowsStore?.deleteWorkflowRunById({
        runId,
        workflowName: DurableStepIds.AGENTIC_EXECUTION,
      });
    } catch (error) {
      this.#mastra
        ?.getLogger?.()
        ?.warn?.(`[DurableAgent] Failed to delete workflow snapshot rows after terminal state`, { runId, error });
    }
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
    options = await this.#resolveExecutionOptions(options);

    // Delegate to the idle-loop wrapper when `untilIdle` is set.
    // Strip `untilIdle` before passing to the wrapper so its internal
    // agent.stream() call doesn't recurse.
    if (options?.untilIdle) {
      const { untilIdle, ...rest } = options;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      // The idle helper normally resolves defaults for scope discovery. These
      // options are already resolved, so keep its inner stream on the same values.
      const resolvedOptionsAgent = {
        id: this.id,
        getDefaultOptions: () => ({}),
        getMemory: (args?: any) => this.getMemory(args),
        stream: (innerMessages: MessageListInput, innerOptions?: DurableAgentStreamOptions<TOutput>) =>
          this.stream(innerMessages, innerOptions),
      } as unknown as DurableAgent<any, any, TOutput>;
      return runDurableStreamUntilIdle<TOutput>(
        resolvedOptionsAgent,
        messages,
        { ...rest, maxIdleMs },
        {
          activeStreams: this.#activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
      );
    }

    // Enforce agent-level FGA (agents:execute) before durable execution. The
    // base Agent enforces this in its stream()/generate(); durable execution
    // runs a workflow instead and would otherwise skip the gate. This also
    // covers evented subclasses, which inherit stream()/generate().
    await this.requireAgentExecutionFGA({
      requestContext: options?.requestContext,
      memory: options?.memory,
      runId: options?.runId,
      actor: options?.actor,
    });

    // 1. Prepare for durable execution (non-durable phase)
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#wrappedAgent as Agent<string, any, TOutput>,
      messages,
      options: options as AgentExecutionOptions<TOutput>,
      runId: options?.runId,
      requestContext: options?.requestContext,
      optionsAreResolved: true,
      mastra: this.#mastra,
      durableAgentId: this.id,
      durableAgentName: this.name,
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
      onFinish: options?.onFinish,
      onStreamFinished: scheduleAutoCleanup,
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
      structuredOutput: registryEntry.structuredOutput as any,
      outputProcessors: registryEntry.outputProcessors,
      agent: registryEntry.agent,
      messageList,
    });

    // 4. Wait for subscription to be ready, then execute workflow
    // This prevents race conditions where events are published before subscription
    const workflowExecution = ready
      .then(async () => {
        // Emit 'start' chunk before the workflow begins (matches regular agent's stream.ts).
        // Only the initial stream() path emits 'start'; resume() does not.
        await emitChunkEvent(this.pubsub, runId, {
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: { id: workflowInput.agentId, messageId },
        });
        if (this.__getGoalConfig()) {
          await beginGoalActivity({
            mastra: this.#mastra,
            agentId: workflowInput.agentId,
            threadId,
            runId,
            requestContext: globalRunRegistry.get(runId)?.requestContext,
          });
        }
        try {
          return await this.executeWorkflow(runId, workflowInput);
        } finally {
          await stopGoalActivity({ agentId: workflowInput.agentId, runId });
        }
      })
      .catch(error => {
        void this.emitError(runId, error);
      });
    const trackedEntry = globalRunRegistry.get(runId);
    if (trackedEntry) {
      trackedEntry.workflowExecution = workflowExecution;
    }

    // 4b. Register with the thread-stream runtime so subscribeToThread /
    // sendMessage subscribers receive run-registered events and stream parts.
    // Uses the Mastra-level pubsub (this.getPubSub()) — not the internal
    // CachingPubSub (this.pubsub) which carries durable workflow chunks.
    await agentThreadStreamRuntime.registerRun(
      this as unknown as Agent<any, any, any, any>,
      output,
      options as AgentExecutionOptions<TOutput>,
      this.getPubSub(),
    );

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
    options?: DurableAgentResumeOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    let entry = this.#runRegistry.get(runId);
    if (!entry) {
      // A persisted durable run can outlive this process (or the registry TTL).
      // Rebuild the non-serializable runtime state before resuming the stored
      // workflow snapshot. Keep warm resumes on the existing path to avoid
      // racing an active registry entry with a second preparation pass.
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      const persisted = await workflowsStore?.getWorkflowRunById({
        runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      if (!persisted) {
        throw new Error(`No registry entry found for run ${runId}. Cannot resume.`);
      }

      const snapshot =
        typeof persisted.snapshot === 'string'
          ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
          : persisted.snapshot;
      if (snapshot?.status !== 'suspended') {
        throw new Error('This workflow run was not suspended');
      }
      const workflowInput = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
      if (!workflowInput || workflowInput.__workflowKind !== 'durable-agent') {
        throw new MastraError({
          id: 'DURABLE_AGENT_RESUME_INVALID_SNAPSHOT',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: `DurableAgent "${this.name}" resume(${runId}): persisted snapshot does not contain a durable-agent workflow input.`,
          details: { agentName: this.name, runId },
        });
      }
      if (workflowInput.agentId !== this.id) {
        throw new MastraError({
          id: 'DURABLE_AGENT_RESUME_AGENT_MISMATCH',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" resume(${runId}): persisted run belongs to agent "${workflowInput.agentId}", not "${this.id}".`,
          details: { agentName: this.name, runId, ownerAgentId: workflowInput.agentId },
        });
      }

      const messageListMemoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
      const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;
      const snapshotRequestContext = workflowInput.requestContextEntries
        ? new RequestContext<unknown>(Object.entries(workflowInput.requestContextEntries))
        : undefined;
      const memory = threadId
        ? {
            ...options?.memory,
            thread: threadId,
            resource: resourceId ?? options?.memory?.resource,
          }
        : options?.memory;

      await this.prepare([], {
        ...(options as AgentExecutionOptions<TOutput>),
        runId,
        requestContext: options?.requestContext ?? snapshotRequestContext,
        memory,
      });
      entry = this.#runRegistry.get(runId);
    }
    if (!entry) {
      throw new Error(`Failed to rehydrate registry entry for run ${runId}. Cannot resume.`);
    }

    const memoryInfo = this.#runRegistry.getMemoryInfo(runId);
    const registeredMemory = memoryInfo?.threadId
      ? ({
          ...options?.memory,
          thread: memoryInfo.threadId,
          resource: memoryInfo.resourceId ?? options?.memory?.resource,
        } as DurableAgentStreamOptions<TOutput>['memory'])
      : options?.memory;

    const resolvedOptions = (await this.#resolveExecutionOptions({
      ...(options as DurableAgentStreamOptions<TOutput>),
      requestContext:
        options?.requestContext ??
        (entry.requestContext as DurableAgentStreamOptions<TOutput>['requestContext'] | undefined),
      memory: registeredMemory ?? options?.memory,
    })) as DurableAgentResumeOptions<TOutput>;

    // Delegate to the idle-loop wrapper when `untilIdle` is set. Strip
    // `untilIdle` before passing to the wrapper so the inner agent.resume()
    // call (and subsequent agent.stream([]) continuations) don't recurse.
    if (resolvedOptions.untilIdle) {
      const { untilIdle, ...rest } = resolvedOptions;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      const resolvedOptionsAgent = {
        id: this.id,
        getDefaultOptions: () => ({}),
        getMemory: (args?: any) => this.getMemory(args),
        resume: (innerRunId: string, innerResumeData: unknown, innerOptions?: DurableAgentResumeOptions<TOutput>) =>
          this.resume(innerRunId, innerResumeData, innerOptions),
        stream: (innerMessages: MessageListInput, innerOptions?: DurableAgentStreamOptions<TOutput>) =>
          this.stream(innerMessages, innerOptions),
      } as unknown as DurableAgent<any, any, TOutput>;
      return runResumeDurableStreamUntilIdle<TOutput>(
        resolvedOptionsAgent,
        runId,
        resumeData,
        { ...rest, maxIdleMs } as DurableAgentStreamOptions<TOutput> & { maxIdleMs?: number },
        {
          activeStreams: this.#activeStreamUntilIdle,
          bgManager: this.#mastra?.backgroundTaskManager,
        },
      );
    }

    await this.requireAgentExecutionFGA({
      requestContext: resolvedOptions.requestContext,
      memory: resolvedOptions.memory,
      runId,
      snapshotMemoryInfo: memoryInfo,
      actor: resolvedOptions.actor,
    });

    // Install a fresh abort controller for the resumed segment. The original
    // controller is gone (the stream that owned it has already settled), so
    // we overwrite the registry slot. If the caller passed an external
    // signal, forward it onto the new internal controller.
    const abortController = new AbortController();
    if (resolvedOptions.abortSignal) {
      if (resolvedOptions.abortSignal.aborted) {
        abortController.abort((resolvedOptions.abortSignal as AbortSignal & { reason?: unknown }).reason);
      } else {
        resolvedOptions.abortSignal.addEventListener(
          'abort',
          () => abortController.abort((resolvedOptions.abortSignal as AbortSignal & { reason?: unknown }).reason),
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
      onChunk: resolvedOptions.onChunk,
      onStepFinish: resolvedOptions.onStepFinish,
      onFinish: resolvedOptions.onFinish,
      onStreamFinished: scheduleAutoCleanup,
      onError: async error => {
        await resolvedOptions.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: resolvedOptions.onSuspended,
      closeOnSuspend: (resolvedOptions as any)[CLOSE_ON_SUSPEND] === true,
      structuredOutput: entry.structuredOutput as any,
      outputProcessors: entry.outputProcessors,
      agent: globalEntry?.agent ?? entry.agent,
      messageList: globalEntry?.messageList ?? this.#runRegistry.getMessageList(runId),
    });

    // Wait for subscription to be ready, then resume workflow
    const workflow = this.getWorkflow();
    const requestContext = resolvedOptions.requestContext;

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

    // Capture the prior workflow execution BEFORE creating the new promise.
    // If we read it inside the `.then()` callback, the global registry will
    // already point to the NEW promise (assigned synchronously below),
    // causing a self-referential deadlock.
    const priorExecution = globalRunRegistry.get(runId)?.workflowExecution;

    const workflowExecution = ready
      .then(async () => {
        // Wait for the prior workflow execution (stream / previous resume) to
        // fully settle so the snapshot is persisted as 'suspended' before we
        // attempt to resume it.  Without this, the pubsub tool-call-suspended
        // event can arrive (and the consumer can call resumeStream) before the
        // engine has finished writing the snapshot, leading to
        // "This workflow run was not suspended".
        if (priorExecution) {
          await priorExecution.catch(() => {
            /* errors already handled by the prior segment */
          });
        }

        const run = await workflow.createRun({ runId, pubsub: this.pubsub });
        if (this.__getGoalConfig()) {
          await beginGoalActivity({
            mastra: this.#mastra,
            agentId: this.id,
            threadId: memoryInfo?.threadId,
            runId,
            requestContext,
          });
        }
        let result;
        try {
          result = await run.resume({
            resumeData,
            label: resolvedOptions.toolCallId,
            requestContext,
            actor: resolvedOptions.actor,
            ...createObservabilityContext({ currentSpan: entry.resumeAgentSpan ?? entry.agentSpan }),
          });
        } finally {
          await stopGoalActivity({ agentId: this.id, runId });
        }
        if (result?.status === 'failed') {
          const error = new Error((result as any).error?.message || 'Workflow resume failed');
          void this.emitError(runId, error);
        }
        // Same snapshot cleanup as the initial `start()` path: once resume
        // settles on any non-suspended terminal status the persisted rows are
        // no longer needed. A resume that re-suspends must keep them so the
        // next resume/recover can find the snapshot.
        if (result?.status && result.status !== 'suspended') {
          await this.deleteRunSnapshots(runId);
        }
      })
      .catch(error => {
        void this.emitError(runId, error);
      });
    const trackedResumeEntry = globalRunRegistry.get(runId);
    if (trackedResumeEntry) {
      trackedResumeEntry.workflowExecution = workflowExecution;
    }

    // Register the resumed run with the thread-stream runtime so
    // subscribeToThread subscribers are notified of the new stream.
    const resumeStreamOptions: AgentExecutionOptions<TOutput> = {
      ...resolvedOptions,
      runId,
    } as AgentExecutionOptions<TOutput>;
    await agentThreadStreamRuntime.registerRun(
      this as unknown as Agent<any, any, any, any>,
      output,
      resumeStreamOptions,
      this.getPubSub(),
    );

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
   * Recover a single durable run whose in-process agentic loop was orphaned by
   * a process restart. Streamable counterpart to
   * {@link DurableAgent.recoverActiveRuns} — where the bulk API only re-drives
   * the workflow and returns counts, `recover()` rebuilds the run's
   * non-serializable state (message list, model, tools, memory,
   * saveQueueManager, request context, agent span) from the persisted workflow
   * snapshot and returns a fresh {@link DurableAgentStreamResult} whose
   * `fullStream` observes the recovered run through pubsub.
   *
   * Because the rebuilt registry entry carries `memory` + `saveQueueManager`,
   * the durable agentic workflow's terminal step will flush new messages to
   * memory just like a fresh `stream()` call would. The single-run form is
   * useful when operators want to attach listeners to a specific recovered
   * run; for boot-time bulk recovery of every orphaned run, use
   * `recoverActiveRuns()`.
   *
   * @example
   * ```typescript
   * const { fullStream, output, cleanup } = await durableAgent.recover(runId, {
   *   onChunk: chunk => process.stdout.write(chunk.payload?.text ?? ''),
   * });
   * for await (const chunk of fullStream) {
   *   // ...
   * }
   * cleanup();
   * ```
   */
  async recover(
    runId: string,
    options?: DurableAgentRecoverOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    if (!this.#mastra) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_NO_MASTRA',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" recover() requires the agent to be registered on a Mastra instance.`,
        details: { agentName: this.name, runId },
      });
    }

    const workflowsStore = await this.#mastra.getStorage()?.getStore('workflows');
    if (!workflowsStore) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_NO_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${this.name}" recover() requires persistent storage to load the run snapshot. ` +
          `Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL).`,
        details: { agentName: this.name, runId },
      });
    }

    // 1. Load the persisted snapshot for the durable agentic loop workflow.
    const persisted = await workflowsStore.getWorkflowRunById({
      runId,
      workflowName: DurableStepIds.AGENTIC_LOOP,
    });
    if (!persisted) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_SNAPSHOT_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${this.name}" recover(${runId}): no persisted workflow snapshot found. ` +
          `The run may have already completed or been cleaned up.`,
        details: { agentName: this.name, runId },
      });
    }

    const snapshot =
      typeof persisted.snapshot === 'string'
        ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
        : persisted.snapshot;

    const workflowInput = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
    if (!workflowInput || workflowInput.__workflowKind !== 'durable-agent') {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_INVALID_SNAPSHOT',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.SYSTEM,
        text: `DurableAgent "${this.name}" recover(${runId}): persisted snapshot does not contain a durable-agent workflow input.`,
        details: { agentName: this.name, runId },
      });
    }

    // All durable agents share the same workflow name (`durable-agentic-loop`),
    // so a caller with runId in hand could otherwise recover another agent's
    // run. Refuse to rehydrate a snapshot whose agentId doesn't match this
    // instance — the caller must reach the owning agent to recover the run.
    if (workflowInput.agentId !== this.id) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" recover(${runId}): persisted run belongs to agent "${workflowInput.agentId}", not "${this.id}".`,
        details: { agentName: this.name, runId, ownerAgentId: workflowInput.agentId },
      });
    }

    // 2. Rebuild the RequestContext from the persisted JSON-safe snapshot.
    const requestContext: RequestContext = workflowInput.requestContextEntries
      ? new RequestContext(Object.entries(workflowInput.requestContextEntries) as Iterable<readonly [string, unknown]>)
      : new RequestContext();

    // 3. Rebuild MessageList from the persisted state. threadId/resourceId
    //    come from the workflow input's `state` block when present; older
    //    snapshots may only have them under `messageListState.memoryInfo`.
    const messageListMemoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
    const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;
    const messageList = new MessageList({ threadId, resourceId });
    try {
      messageList.deserialize(workflowInput.messageListState);
    } catch (err) {
      // Fresh (never-executed) snapshots may have a minimal `messageListState`;
      // fall back to an empty MessageList so recovery still proceeds. The
      // workflow steps rebuild the real MessageList from serialized input.
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] recover(${runId}) messageList deserialize skipped: ${err}`);
    }

    // 4. Resolve model/memory from the live agent. Tools are rebuilt by the
    //    durable step from `toolsMetadata`, so we only need the live agent's
    //    memory here to enable message persistence at the terminal step.
    const wrapped = this.#wrappedAgent as Agent<string, any, TOutput>;
    let model;
    try {
      model = await wrapped.getModel({ requestContext });
    } catch (err) {
      const logger = this.#mastra?.getLogger?.();
      logger?.warn?.(`[DurableAgent] Failed to resolve model during recover(${runId}): ${err}`);
    }
    let memory;
    try {
      memory = await wrapped.getMemory({ requestContext });
    } catch (err) {
      const logger = this.#mastra?.getLogger?.();
      logger?.warn?.(`[DurableAgent] Failed to resolve memory during recover(${runId}): ${err}`);
    }
    const saveQueueManager = memory
      ? new SaveQueueManager({ logger: this.#mastra?.getLogger?.() as any, memory })
      : undefined;

    // Re-wire background-task state so the recovered segment can wait for
    // pre-crash tasks (via `bg-task-check`), dispatch new background tool
    // calls (via `tool-call`), and inject the background-task system prompt
    // (via `llm-execution`). The manager is storage-backed, so in-flight
    // tasks spawned before the crash are still discoverable via
    // `bgManager.listTasks(...)`.
    const backgroundTasksConfig = this.getBackgroundTasksConfig?.();
    const backgroundTaskManager = this.#mastra?.backgroundTaskManager;

    // Re-resolve processors from the live agent config. `llm-execution` reads
    // `inputProcessors` / `llmRequestInputProcessors` / `outputProcessors` from
    // the global registry, and the terminal `.map(...)` reads `outputProcessors`
    // + `errorProcessors` — without these, the recovered segment would run
    // with no processors even if the agent has some configured.
    let inputProcessors: any[] = [];
    let llmRequestInputProcessors: any[] = [];
    let outputProcessors: any[] = [];
    let errorProcessors: any[] = [];
    try {
      inputProcessors = (await (wrapped as any).listInputProcessors?.(requestContext)) ?? [];
      llmRequestInputProcessors = (await (wrapped as any).__listLLMRequestProcessors?.(requestContext)) ?? [];
      outputProcessors = (await (wrapped as any).listOutputProcessors?.(requestContext)) ?? [];
      errorProcessors = (await (wrapped as any).listErrorProcessors?.(requestContext)) ?? [];
    } catch (err) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] recover(${runId}) processor resolution failed: ${err}`);
    }
    // Fresh empty processorStates for the recovered segment — the pre-crash
    // segment's in-memory processor state is gone, but the terminal state
    // (memory writes, message list) lives on the persisted snapshot.
    const processorStates = new Map<string, any>();

    // 5. Re-open an AGENT_RUN span for the recovered segment. Follow the same
    //    pattern as resume(): reuse the original traceId when possible so the
    //    recovered run stays linked to the original agent trace.
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

    const origAgentSpanData = workflowInput.agentSpanData as { traceId?: string; id?: string } | undefined;
    let recoverAgentSpan: any;
    if (this.#mastra?.observability) {
      try {
        const rawConfig =
          typeof (wrapped as any).toRawConfig === 'function' ? (wrapped as any).toRawConfig() : undefined;
        const resolvedVersionId = rawConfig?.resolvedVersionId as string | undefined;
        const agentTracingPolicy =
          typeof wrapped.getTracingPolicy === 'function' ? wrapped.getTracingPolicy() : undefined;
        recoverAgentSpan = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          name: `agent run: '${wrapped.id}' (recovered)`,
          entityType: EntityType.AGENT,
          entityId: wrapped.id,
          entityName: wrapped.name,
          metadata: {
            runId,
            recovered: true,
            ...(origAgentSpanData?.id ? { recoveredFromSpanId: origAgentSpanData.id } : {}),
            ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
          },
          tracingPolicy: agentTracingPolicy,
          tracingOptions: origAgentSpanData?.traceId ? { traceId: origAgentSpanData.traceId } : undefined,
          requestContext,
          mastra: this.#mastra,
        });
      } catch (err) {
        // Span bookkeeping must never block recovery.
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to open recover span: ${err}`);
      }
    }

    // 6. Assemble a minimal RunRegistryEntry. Fields that the durable steps
    //    would normally populate on the fly (tools, workspace, processor
    //    states, etc.) are left undefined — the workflow's own
    //    `resolveRuntimeDependencies` will fall back to the persisted step
    //    input to reconstruct them, so we only need the fields that the
    //    terminal `.map(...)` step, stream adapter, and processor runners read
    //    from the registry.
    const registryEntry: any = {
      agent: this.#wrappedAgent,
      model,
      memory,
      saveQueueManager,
      requestContext,
      agentSpan: recoverAgentSpan,
      abortController,
      abortSignal: abortController.signal,
      backgroundTaskManager,
      backgroundTasksConfig,
      inputProcessors,
      llmRequestInputProcessors,
      outputProcessors,
      errorProcessors,
      processorStates,
      cleanup: () => {},
    };

    // 7. Register the reconstructed state in both the per-instance and global
    //    registries so the workflow steps + terminal memory flush can find it.
    this.#runRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
    globalRunRegistry.set(runId, { ...registryEntry, messageList });

    // 8. Cleanup plumbing (mirrors stream()/resume()).
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

    // 9. Skip any pubsub events broadcast before recovery started. Persistent
    //    pubsub backends may retain chunks from the pre-crash segment; the
    //    caller only wants events from the recovered segment forward.
    const recoverOffset = await this.#getPubsubOffset(runId);

    const {
      output,
      cleanup: streamCleanup,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      messageId: workflowInput.messageId ?? crypto.randomUUID(),
      model: {
        modelId: workflowInput.modelConfig?.modelId,
        provider: workflowInput.modelConfig?.provider,
        version: 'v3',
      },
      threadId,
      resourceId,
      offset: recoverOffset,
      onChunk: options?.onChunk,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onStreamFinished: scheduleAutoCleanup,
      onError: async error => {
        await options?.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: options?.onSuspended,
      // Recovered runs use the default `closeOnSuspend: false` — a run that
      // suspends again should stay observable so a later resume/recover can
      // pick it up. Callers wanting to close on suspend can call `cleanup()`
      // from `onSuspended`.
      outputProcessors,
      agent: this.#wrappedAgent,
      messageList,
    });

    // 10. Re-drive the workflow from the persisted snapshot in the background
    //     and delete snapshot rows on non-suspended terminals (same contract
    //     as start()/resume()). Errors are also broadcast via `emitError` so
    //     observers on the pubsub topic see the failure. Callers who await
    //     the returned `workflowExecution` (e.g. `recoverActiveRuns()`) see
    //     the raw rejection so they can classify the run as failed.
    const workflow = this.getWorkflow();
    const workflowExecution = ready.then(async () => {
      try {
        const run = await workflow.createRun({ runId, pubsub: this.pubsub });
        const result = await run.restart({
          requestContext,
          ...createObservabilityContext({ currentSpan: recoverAgentSpan }),
        } as any);
        // Snapshot cleanup runs for every non-suspended terminal (success or
        // failed) so storage stays bounded — mirrors the start()/resume()
        // contract.
        if (result?.status && result.status !== 'suspended') {
          await this.deleteRunSnapshots(runId);
        }
        if (result?.status === 'failed') {
          const error = new Error((result as any).error?.message || 'Workflow recover failed');
          void this.emitError(runId, error);
          throw error;
        }
      } catch (error) {
        void this.emitError(runId, error as Error);
        throw error;
      }
    });
    const trackedRecoverEntry = globalRunRegistry.get(runId);
    if (trackedRecoverEntry) {
      trackedRecoverEntry.workflowExecution = workflowExecution;
    }
    // Guard against unhandled rejection warnings for callers who don't await
    // `workflowExecution` (single-run `recover()` returns a stream, not the
    // workflow promise). Errors are already surfaced through `emitError` /
    // the stream's `onError` callback.
    workflowExecution.catch(() => {});

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
   * Override the inherited `resumeStream()` so that callers using the base
   * `Agent` API (including `approveToolCall` / `declineToolCall`) are routed
   * through the durable `resume()` path instead of the regular Agent's
   * snapshot-based resume.
   *
   * Returns just the `MastraModelOutput` (matching the base Agent's return
   * type) while internally delegating to `this.resume()`.
   */
  override async resumeStream(resumeData: any, streamOptions?: any): Promise<MastraModelOutput<TOutput>> {
    const runId = streamOptions?.runId;
    if (!runId) {
      throw new Error('resumeStream() on DurableAgent requires a runId in streamOptions.');
    }
    const { runId: _runId, ...resumeOptions } = streamOptions;
    const result = await this.resume(runId, resumeData, {
      ...resumeOptions,
      // Close the stream when the workflow re-suspends so the caller's
      // `for await` loop terminates. Without this the stream stays open
      // indefinitely when the resumed turn hits another suspend point.
      [CLOSE_ON_SUSPEND]: true,
    } as Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2]);
    return result.output;
  }

  /**
   * Override the inherited `approveToolCall()` to route through the durable
   * `resume()` path.
   */
  override async approveToolCall(
    options: { runId: string; toolCallId?: string } & Record<string, any>,
  ): Promise<MastraModelOutput<any>> {
    return this.resumeStream({ approved: true }, options);
  }

  /**
   * Override the inherited `declineToolCall()` to route through the durable
   * `resume()` path.
   */
  override async declineToolCall(
    options: { runId: string; toolCallId?: string } & Record<string, any>,
  ): Promise<MastraModelOutput<any>> {
    return this.resumeStream({ approved: false }, options);
  }

  override async approveToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    const { runId, ...resumeOptions } = options;
    return this.resumeGenerate(runId, { approved: true }, resumeOptions as any) as any;
  }

  override async declineToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    const { runId, ...resumeOptions } = options;
    return this.resumeGenerate(runId, { approved: false }, resumeOptions as any) as any;
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
    options = await this.#resolveExecutionOptions(options);

    // Enforce agent-level FGA (agents:execute) before durable execution — see
    // stream() above. Durable/evented generate would otherwise skip the gate.
    await this.requireAgentExecutionFGA({
      requestContext: options?.requestContext,
      memory: options?.memory,
      runId: options?.runId,
      actor: options?.actor,
    });

    // 1. Prepare for durable execution (non-durable phase)
    const preparation = await prepareForDurableExecution<TOutput>({
      agent: this.#wrappedAgent as Agent<string, any, TOutput>,
      messages,
      options: options as AgentExecutionOptions<TOutput>,
      runId: options?.runId,
      requestContext: options?.requestContext,
      optionsAreResolved: true,
      mastra: this.#mastra,
      methodType: 'generate',
      durableAgentId: this.id,
      durableAgentName: this.name,
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
      onFinish: options?.onFinish,
      onStreamFinished: scheduleAutoCleanup,
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
      structuredOutput: registryEntry.structuredOutput as any,
      outputProcessors: registryEntry.outputProcessors,
      agent: registryEntry.agent,
      messageList,
    });

    // 4. Wait for subscription to be ready, then execute workflow
    // This prevents race conditions where events are published before subscription
    const workflowExecution = ready
      .then(async () => {
        // Emit 'start' chunk before the workflow begins (matches regular agent's stream.ts).
        // Only the initial generate()/stream() path emits 'start'; resume() does not.
        await emitChunkEvent(this.pubsub, runId, {
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: { id: workflowInput.agentId, messageId },
        });
        if (this.__getGoalConfig()) {
          await beginGoalActivity({
            mastra: this.#mastra,
            agentId: workflowInput.agentId,
            threadId,
            runId,
            requestContext: globalRunRegistry.get(runId)?.requestContext,
          });
        }
        try {
          return await this.executeWorkflow(runId, workflowInput);
        } finally {
          await stopGoalActivity({ agentId: workflowInput.agentId, runId });
        }
      })
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
   * List durable agent runs currently reported as `running` in workflow
   * snapshot storage.
   *
   * A `running` snapshot is a durable agent run whose agentic loop was
   * mid-execution the last time the workflow engine persisted its state. On a
   * healthy process these transition to `suspended` (waiting on
   * tool approval / resume) or a terminal status. On a crashed / restarted
   * process they are orphaned in the `running` state with no in-process
   * driver — this is the discovery API used to enumerate them for recovery
   * (see {@link DurableAgent.recoverActiveRuns} and workflow `restart`).
   *
   * Requires persistent workflow storage. Filters `agentId` against the
   * persisted `DurableAgenticWorkflowInput.agentId`, so runs started by other
   * durable agents sharing the same storage are not surfaced.
   *
   * @example
   * ```typescript
   * const { runs } = await durableAgent.listActiveRuns({ resourceId });
   * for (const run of runs) {
   *   await durableAgent.recoverActiveRuns({ runId: run.runId });
   * }
   * ```
   */
  async listActiveRuns(options: DurableAgentListActiveRunsOptions = {}): Promise<DurableAgentListActiveRunsResult> {
    const { threadId, resourceId, fromDate, toDate, perPage, page } = options;

    if (perPage !== undefined && (!Number.isInteger(perPage) || perPage <= 0)) {
      throw new MastraError({
        id: 'DURABLE_AGENT_LIST_ACTIVE_RUNS_INVALID_PER_PAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" listActiveRuns() requires perPage to be a positive integer.`,
        details: { agentName: this.name, perPage },
      });
    }
    if (page !== undefined && (!Number.isInteger(page) || page < 0)) {
      throw new MastraError({
        id: 'DURABLE_AGENT_LIST_ACTIVE_RUNS_INVALID_PAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" listActiveRuns() requires page to be a non-negative integer.`,
        details: { agentName: this.name, page },
      });
    }

    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');

    if (!workflowsStore) {
      throw new MastraError({
        id: 'DURABLE_AGENT_LIST_ACTIVE_RUNS_NO_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `DurableAgent "${this.name}" listActiveRuns() requires storage to discover running runs. ` +
          `Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL).`,
        details: { agentName: this.name },
      });
    }

    const { runs } = await workflowsStore.listWorkflowRuns({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      status: 'running',
      fromDate,
      toDate,
    });

    const matchedRuns: DurableAgentActiveRun[] = [];
    for (const run of runs) {
      let snapshot = run.snapshot;
      if (typeof snapshot === 'string') {
        try {
          snapshot = JSON.parse(snapshot) as WorkflowRunState;
        } catch {
          continue;
        }
      }
      if (snapshot?.status !== 'running') continue;

      // The persisted workflow input carries the owning agentId. Default-deny:
      // a snapshot without an input or whose agentId does not match this agent
      // is skipped so runs cannot leak across agents sharing the same storage.
      const input = snapshot.context?.input as
        | { agentId?: string; messageListState?: { memoryInfo?: { threadId?: string; resourceId?: string } } }
        | undefined;
      const runAgentId = input?.agentId;
      if (runAgentId !== this.id) continue;

      const memoryInfo = input?.messageListState?.memoryInfo;
      const runThreadId = memoryInfo?.threadId;
      const runResourceId = run.resourceId ?? memoryInfo?.resourceId;
      if (threadId && runThreadId !== threadId) continue;
      if (resourceId && runResourceId !== resourceId) continue;

      matchedRuns.push({
        runId: run.runId,
        status: 'running',
        threadId: runThreadId,
        resourceId: runResourceId,
        updatedAt: run.updatedAt,
      });
    }

    const total = matchedRuns.length;
    const paginatedRuns =
      perPage !== undefined && page !== undefined
        ? matchedRuns.slice(page * perPage, (page + 1) * perPage)
        : matchedRuns;

    return { runs: paginatedRuns, total };
  }

  /**
   * Bulk recover durable agent runs whose in-process agentic loop was orphaned
   * by a process restart. This is the recovery half of the discovery API
   * paired with {@link DurableAgent.listActiveRuns} and is the typical
   * boot-time hook.
   *
   * Each targeted run is delegated to {@link DurableAgent.recover}, which
   * rebuilds the run's non-serializable state (message list, model, memory,
   * save-queue manager, request context, agent span), re-subscribes to the
   * run's pubsub topic, and restarts the workflow in the background. Because
   * `recover()` registers `memory` + `saveQueueManager` on the run entry, the
   * durable agentic workflow's terminal step flushes new messages to memory
   * just like a fresh `stream()` call would.
   *
   * The per-run stream returned by `recover()` is discarded — this method
   * awaits each run's workflow settlement and reports summary counts instead
   * of surfacing live event streams. Callers who want to observe a specific
   * recovered run's events should use {@link DurableAgent.recover} directly
   * (or {@link DurableAgent.observe} with the returned `runId`).
   *
   * Failures are captured per-run so a single bad run does not block
   * recovery of the rest.
   *
   * @example
   * ```typescript
   * // Recover every orphaned run for this agent (typical boot-time hook).
   * const { recovered, succeeded, failed } = await durableAgent.recoverActiveRuns();
   * logger.info('Recovered durable agent runs', { succeeded, failed });
   *
   * // Recover a single run by ID.
   * await durableAgent.recoverActiveRuns({ runId });
   * ```
   */
  async recoverActiveRuns(
    options: DurableAgentRecoverActiveRunsOptions = {},
  ): Promise<DurableAgentRecoverActiveRunsResult> {
    const { runId, ...discoveryOptions } = options;

    let targetRunIds: string[];
    if (runId) {
      targetRunIds = [runId];
    } else {
      const { runs } = await this.listActiveRuns(discoveryOptions);
      targetRunIds = runs.map(r => r.runId);
    }

    const recovered: DurableAgentRecoveredRun[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const targetRunId of targetRunIds) {
      let runError: Error | undefined;
      try {
        // Delegate to the single-run streamable recover path so each run
        // benefits from the rebuilt registry entry (message list, memory,
        // saveQueueManager, request context, agent span) and the pubsub
        // stream / terminal snapshot-cleanup contract stays identical to
        // `recover()`. We don't surface the per-run stream here — bulk
        // callers only care about counts — so we just await the workflow
        // execution promise that `recover()` parks on the registry entry,
        // capture any failure it surfaces via `onError`, and drop the
        // stream.
        const { cleanup } = await this.recover(targetRunId, {
          onError: ({ error }) => {
            runError = error instanceof Error ? error : new Error(String(error));
          },
        });
        try {
          const workflowExecution = globalRunRegistry.get(targetRunId)?.workflowExecution;
          if (workflowExecution) {
            await workflowExecution;
          }
        } finally {
          cleanup();
        }
        if (runError) throw runError;
        recovered.push({ runId: targetRunId, status: 'success' });
        succeeded++;
      } catch (error) {
        const err = runError ?? (error instanceof Error ? error : new Error(String(error)));
        recovered.push({ runId: targetRunId, status: 'failed', error: err });
        failed++;
        this.#mastra
          ?.getLogger?.()
          ?.error?.(`[DurableAgent] Failed to recover run ${targetRunId}: ${err.message}`, { error: err });
      }
    }

    return { recovered, succeeded, failed };
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
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
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
      onFinish: options?.onFinish,
      onStreamFinished: scheduleAutoCleanup,
      onError: async error => {
        await options?.onError?.(error);
        scheduleAutoCleanup();
      },
      onSuspended: options?.onSuspended,
      structuredOutput: this.#runRegistry.get(runId)?.structuredOutput as any,
      outputProcessors: this.#runRegistry.get(runId)?.outputProcessors,
      agent: globalRunRegistry.get(runId)?.agent ?? this.#runRegistry.get(runId)?.agent,
      messageList: globalRunRegistry.get(runId)?.messageList ?? this.#runRegistry.getMessageList(runId),
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
   * Clear retained pubsub state for a run's topic (cached history and, for
   * persistent transports, the underlying stream). Fire-and-forget: the
   * `clearTopic` contract is best-effort and non-throwing.
   *
   * Unlike the evented workflow engine's per-run topic cleanup, this needs no
   * restart guard: cleanup timers arm only on terminal outcomes
   * (FINISH/ERROR/ABORT — never SUSPENDED), `resume()` rejects runs whose
   * snapshot isn't `suspended`, `untilIdle` continuations mint a fresh runId
   * per segment, and cross-process `recover()` can't race a dead process's
   * timer. No supported flow re-engages a runId after its timer is armed.
   */
  #clearPubsubTopic(runId: string): void {
    void this.pubsub.clearTopic(AGENT_STREAM_TOPIC(runId));
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
    const { maxIdleMs, ...options } = streamOptions ?? {};
    return this.stream(messages, {
      ...options,
      untilIdle: maxIdleMs === undefined ? true : { maxIdleMs },
    } as DurableAgentStreamOptions<TOutput>) as unknown as Promise<DurableAgentStreamResult<OUTPUT>>;
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
