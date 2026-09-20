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
  publishAbortRequest,
  runDurableStreamUntilIdle,
  runResumeDurableStreamUntilIdle,
  deleteBoundRunRegistryEntry as deleteCoreBoundRunRegistryEntry,
  getBoundRunRegistryEntry,
  globalRunRegistry,
  ON_BEFORE_TOOL_EXECUTION_KEY,
  ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY,
  TOOL_PERMISSION_POLICY_KEY,
  TOOL_PERMISSION_POLICY_REQUIRED_KEY,
  snapshotDurableRequestContextEntries,
} from '@mastra/core/agent/durable';
import type {
  AgentStepFinishEventData,
  AgentSuspendedEventData,
  DurableToolPermissionResolver,
  RunRegistryEntry,
} from '@mastra/core/agent/durable';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import { InMemoryServerCache } from '@mastra/core/cache';
import type { MastraServerCache } from '@mastra/core/cache';
import { CachingPubSub, isRunLocalTopic } from '@mastra/core/events';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraModelOutput, ChunkType, FullOutput, MastraOnFinishCallback } from '@mastra/core/stream';
import type { Workflow } from '@mastra/core/workflows';
import { NonRetriableError } from 'inngest';
import type { Inngest } from 'inngest';

import { InngestPubSub } from '../pubsub';
import type { InngestRun } from '../run';
import { INNGEST_WORKFLOW_LIFECYCLE_REPLAY, InngestWorkflow } from '../workflow';
import {
  assertInngestResponseRecoveryDisabled,
  createInngestDurableAgenticWorkflow,
  createInngestDurableAgenticWorkflowIds,
} from './create-inngest-agentic-workflow';

/**
 * Internal sentinel used by {@link InngestAgent.generate} and
 * {@link InngestAgent.resumeGenerate} to ask the underlying `stream()` /
 * `resume()` implementation to close the consumer stream on a SUSPENDED
 * event, so `getFullOutput()` resolves promptly with `finishReason:
 * 'suspended'` instead of waiting for FINISH/ERROR.
 *
 * Modelled on `CLOSE_ON_SUSPEND` in core `DurableAgent`.
 */
function registerGlobalRunRegistryEntry(runId: string, entry: RunRegistryEntry): void {
  let occupied = false;
  try {
    occupied = getBoundRunRegistryEntry(runId, undefined) !== undefined;
  } catch {
    occupied = true;
  }
  if (occupied) {
    throw new Error(`Durable run ${runId} is already active. Refusing to replace its runtime dependencies.`);
  }
  globalRunRegistry.set(runId, entry);
}

function deleteBoundRunRegistryEntry(
  runId: string,
  runtimeBindingId: string,
  expectedAbortController: AbortController,
): boolean {
  let entry: RunRegistryEntry | undefined;
  try {
    entry = getBoundRunRegistryEntry(runId, runtimeBindingId);
  } catch {
    return false;
  }
  if (!entry || entry.abortController !== expectedAbortController) return false;
  return deleteCoreBoundRunRegistryEntry(runId, runtimeBindingId);
}

const pendingInngestResumeKeys = new Set<string>();

function reserveInngestResume(key: string): () => void {
  if (pendingInngestResumeKeys.has(key)) {
    throw new Error(`Inngest durable-agent resume is already pending for ${key}`);
  }
  pendingInngestResumeKeys.add(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pendingInngestResumeKeys.delete(key);
  };
}

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
  /**
   * Optional early Mastra reference. Durable execution still requires this
   * wrapper to be registered as an agent on the same Mastra instance and that
   * instance to have workflow storage. Normal Mastra registration sets this
   * reference automatically.
   */
  mastra?: Mastra;
  /**
   * Resolve the current tool permission on the worker that executes the
   * durable action. Configure this when policy must survive Inngest replay or
   * process loss. The resolver function itself is never serialized; it should
   * use durable identifiers from `requestContext` to load current policy.
   */
  resolveToolPermission?: InngestToolPermissionResolver;
  /**
   * Application RequestContext keys that may be copied into durable workflow
   * state. Values are bounded JSON snapshots; infrastructure/credential keys
   * are rejected. Use references such as session or project IDs, not secrets.
   */
  durableRequestContextKeys?: readonly string[];
}

export type InngestToolPermissionResolver = DurableToolPermissionResolver;

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
   * Await the returned promise to confirm the request was dispatched; it
   * rejects when binding or transport state cannot provide that guarantee.
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
  /**
   * Fresh context for this resume. JSON-safe entries replace matching values
   * in the allowlisted subset of persisted workflow context. Unallowlisted and
   * credential-like snapshot keys are removed. A `TOOL_PERMISSION_POLICY_KEY`
   * function is never serialized; it only sets a durable policy-required
   * marker. Configure `resolveToolPermission` on the agent to produce allow/ask
   * decisions on a cold worker. Without a resolver, a required policy fails
   * closed.
   */
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /**
   * Monotonically require current policy resolution for this resume. Omit when
   * the run has no host permission policy. There is intentionally no `false`
   * form that could downgrade a persisted requirement.
   */
  requireToolPermissionPolicy?: true;
  /**
   * Per-call actor signal forwarded to FGA checks and tool execution. Must be
   * re-supplied on every resume and is never rehydrated from the snapshot.
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
    resolveToolPermission,
    durableRequestContextKeys,
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
  // Parent and nested workflow IDs are both namespaced to the public durable
  // agent ID. Mastra and Inngest therefore register every agent's complete
  // function tree without allowing one wrapper's transport/cache factory to
  // become the accidental owner for all durable agents.
  const workflowIds = createInngestDurableAgenticWorkflowIds(agentId);
  const workflow = createInngestDurableAgenticWorkflow({
    inngest,
    workflowIds,
    resolveToolPermission,
  });

  // Track whether user provided a custom cache (if not, we'll inherit from mastra)
  let _customCache = cache;

  // Set up pubsub with lazy CachingPubSub creation
  // CachingPubSub is an internal implementation detail - users just configure cache and pubsub separately
  let innerPubsub: PubSub = customPubsub ?? new InngestPubSub(inngest, workflowIds.AGENTIC_LOOP);
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
        if (!innerPubsub.indexedReplay) {
          throw new TypeError(
            'Inngest durable agents require CachingPubSub indexedReplay so agent observers and workflow lifecycle publishers share one exact replay log',
          );
        }
        _cachingPubsub = innerPubsub;
        _customCache = innerPubsub.cache;
      } else {
        _cachingPubsub = new CachingPubSub(innerPubsub, resolveCache(), {
          indexedReplay: INNGEST_WORKFLOW_LIFECYCLE_REPLAY,
        });
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
    // A caller-supplied transport is the live delivery contract for both
    // observers and workflow publishers. Sharing only its cache would make
    // events replayable after reconnect while starving observers that were
    // already attached to the caller's live transport.
    if (customPubsub) return getPubsub();
    // If the caller already supplied a CachingPubSub upstream, defer to it.
    if (defaultPubsub instanceof CachingPubSub) return defaultPubsub;
    // Ensure the agent's CachingPubSub (and its cache) is resolved so workflow
    // events and agent.stream events share the same history backend.
    getPubsub();
    return new CachingPubSub(defaultPubsub, resolveCache(), {
      indexedReplay: INNGEST_WORKFLOW_LIFECYCLE_REPLAY,
      // Run-local `workflow.events.v2.*` watch events carry cumulative step
      // results (often megabytes) and no other instance ever replays them, so
      // they bypass retention while still being delivered live over Inngest
      // realtime (upstream #21572 / issue #20646). This mirrors the in-memory
      // DurableAgent wiring in packages/core/src/agent/durable/durable-agent.ts.
      shouldCache: topic => !isRunLocalTopic(topic),
    });
  });

  // Lazily resolve cache
  function getCache(): MastraServerCache | undefined {
    // Ensure pubsub is initialized (which resolves cache)
    getPubsub();
    return _customCache;
  }

  /**
   * Resolve the workflow instance used for durable dispatch.
   *
   * The public durable-agent examples register the wrapper with Mastra before
   * execution. Fail closed when that contract is missing: direct `inngest.send`
   * would bypass the run's persisted lifecycle tuple and deterministic event ID.
   */
  function getAdmittedWorkflow(): InngestWorkflow {
    if (!mastra || !mastra.getStorage()) {
      throw new TypeError(
        'Inngest durable-agent execution requires registration with a Mastra instance configured with workflow storage',
      );
    }

    let registeredWorkflow: unknown;
    try {
      registeredWorkflow = mastra.getWorkflow(workflowIds.AGENTIC_LOOP);
    } catch {
      // Normalize Mastra's registry lookup error to the durable-agent contract
      // exposed below.
    }
    if (!(registeredWorkflow instanceof InngestWorkflow)) {
      throw new TypeError(
        'Inngest durable-agent execution requires its durable workflow to be registered on the Mastra instance',
      );
    }

    const admittedWorkflow = workflow as InngestWorkflow;
    // This wrapper owns a deterministic per-agent workflow ID. Register the
    // local instance with the same Mastra storage before using InngestRun's
    // canonical admission path.
    admittedWorkflow.__registerMastra(mastra);
    return admittedWorkflow;
  }

  function requestContextFromEntries(entries: unknown): RequestContext {
    const requestContext = new RequestContext();
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return requestContext;

    for (const [key, value] of Object.entries(entries)) {
      requestContext.set(key, value);
    }
    return requestContext;
  }

  /**
   * Make the worker resolver requirement part of the durable run contract.
   * Protocol-v3 workers that receive this marker deny when the configured
   * callback is unavailable. Versioned function IDs keep pre-v3 workers from
   * claiming these events because those workers don't understand the marker.
   */
  function requireWorkerPermissionResolver(workflowInput: any): void {
    if (!resolveToolPermission) return;
    workflowInput.options = {
      ...(workflowInput.options ?? {}),
      permissionPolicyRequired: true,
    };
  }

  /**
   * Remove the live permission closure before Inngest event/storage transport.
   * The JSON-safe marker is monotonic: a caller can require policy evaluation
   * on resume, but cannot clear a requirement persisted by the original run.
   */
  function prepareResumeRequestContext(
    input: RequestContext | undefined,
    requireToolPermissionPolicy: true | undefined,
    persistedEntries: unknown,
  ): RequestContext | undefined {
    const livePolicy = input?.get(TOOL_PERMISSION_POLICY_KEY);
    const policyRequired =
      resolveToolPermission !== undefined ||
      requireToolPermissionPolicy === true ||
      typeof livePolicy === 'function' ||
      (persistedEntries !== null &&
        typeof persistedEntries === 'object' &&
        !Array.isArray(persistedEntries) &&
        (persistedEntries as Record<string, unknown>)[TOOL_PERMISSION_POLICY_REQUIRED_KEY] === true);
    // Same monotonic marker for the awaited revalidation hook: its closure
    // never survives this transport, so the requirement must cross as data or
    // a resumed worker would execute without revalidation.
    const liveOnBeforeToolExecution = input?.get(ON_BEFORE_TOOL_EXECUTION_KEY);
    const hookRequired =
      typeof liveOnBeforeToolExecution === 'function' ||
      input?.get(ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY) === true ||
      (persistedEntries !== null &&
        typeof persistedEntries === 'object' &&
        !Array.isArray(persistedEntries) &&
        (persistedEntries as Record<string, unknown>)[ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY] === true);
    const persistedDurableEntries = snapshotDurableRequestContextEntries(
      requestContextFromEntries(persistedEntries),
      durableRequestContextKeys,
    );
    const freshDurableEntries = snapshotDurableRequestContextEntries(input, durableRequestContextKeys);
    const durableEntries = {
      ...(persistedDurableEntries ?? {}),
      ...(freshDurableEntries ?? {}),
    };
    if (Object.keys(durableEntries).length === 0 && !policyRequired && !hookRequired) return undefined;

    const transported = requestContextFromEntries(durableEntries);
    if (policyRequired) {
      transported.set(TOOL_PERMISSION_POLICY_REQUIRED_KEY, true);
    }
    if (hookRequired) {
      transported.set(ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY, true);
    }
    return transported;
  }

  /**
   * Trigger the workflow through InngestRun so lifecycle identity is admitted
   * before dispatch and the event receives its deterministic dispatch ID.
   */
  async function triggerWorkflow(
    runId: string,
    workflowInput: any,
    tracingOptions?: { traceId: string; parentSpanId: string },
    resourceId?: string,
    actor?: AgentExecutionOptions<TOutput>['actor'],
  ): Promise<void> {
    const run = await getAdmittedWorkflow().createRun({ runId, resourceId });
    await run.startAsync({
      inputData: workflowInput,
      requestContext: requestContextFromEntries(workflowInput.requestContextEntries),
      tracingOptions,
      actor,
    });
  }

  /**
   * Emit an error event to pubsub
   */
  async function emitError(runId: string, error: Error): Promise<void> {
    await emitErrorEvent(getPubsub(), runId, error);
  }

  async function resolveRuntimeBindingId(runId: string): Promise<string | undefined> {
    const localBinding = globalRunRegistry.get(runId)?.runtimeBindingId;

    try {
      const workflowsStore = await mastra?.getStorage()?.getStore('workflows');
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflowIds.AGENTIC_LOOP,
        runId,
      });
      const persistedBinding = snapshot?.context?.input?.runtimeBindingId;
      if (typeof persistedBinding === 'string' && persistedBinding.length > 0) return persistedBinding;
    } catch (error) {
      mastra?.getLogger?.()?.warn?.('Failed to resolve durable run binding for abort request', {
        agentId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return localBinding;
  }

  async function resolveSuspendedRuntimeBindingId(runId: string): Promise<string> {
    const workflowsStore = await mastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) {
      throw new TypeError('Cannot resume Inngest durable-agent run: workflow storage is unavailable');
    }
    const snapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
    });
    if (!snapshot || snapshot.status !== 'suspended') {
      throw new TypeError(`Cannot resume Inngest durable-agent run ${runId}: suspended snapshot not found`);
    }
    const runtimeBindingId = snapshot.context?.input?.runtimeBindingId;
    if (typeof runtimeBindingId !== 'string' || runtimeBindingId.length === 0) {
      throw new TypeError(`Cannot resume Inngest durable-agent run ${runId}: runtime binding is unavailable`);
    }
    return runtimeBindingId;
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
   * Public abort handles surface dispatch failures so callers can retry. The
   * external AbortSignal bridge explicitly contains those rejections after the
   * warning is recorded because event listeners cannot return an awaitable
   * delivery result.
   */
  async function requestRemoteAbort(runId: string, runtimeBindingId: string | undefined): Promise<void> {
    if (!runtimeBindingId) {
      const error = new Error(`Cannot publish Inngest durable agent abort for ${runId} without a runtime binding`);
      mastra?.getLogger?.()?.warn?.(error.message, {
        agentId,
        runId,
      });
      throw error;
    }
    try {
      await publishAbortRequest(getPubsub(), runId, runtimeBindingId);
    } catch (error) {
      mastra?.getLogger?.()?.warn?.('Failed to publish Inngest durable agent abort request', {
        agentId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
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

      // Inngest can move the next operation to another worker. Resolve the
      // effective defaults before preparation so a configured recovery budget
      // is rejected before memory, processors, spans, or dispatch side effects.
      const callerRequestContext = streamOptions?.requestContext;
      const defaultOptions = await agent.getDefaultOptions({
        requestContext: callerRequestContext ?? new RequestContext(),
      });
      const requestContext = callerRequestContext ?? defaultOptions.requestContext;
      assertInngestResponseRecoveryDisabled(streamOptions);
      assertInngestResponseRecoveryDisabled(defaultOptions);

      // 1. Prepare for durable execution
      const preparation = await prepareForDurableExecution<TOutput>({
        agent: agent as Agent<string, any, TOutput>,
        messages,
        options: streamOptions as AgentExecutionOptions<TOutput>,
        resolvedDefaultOptions: defaultOptions as AgentExecutionOptions<TOutput>,
        ...(requestContext ? { requestContext } : {}),
        runId: streamOptions?.runId,
        methodType: (streamOptions as any)?.__methodType ?? 'stream',
        durableRequestContextKeys,
        mastra,
        durableAgentId: agentId,
        durableAgentName: agentName,
      });

      const { runId, messageId, workflowInput, registryEntry, threadId, resourceId } = preparation;
      assertInngestResponseRecoveryDisabled(workflowInput.options);
      const runtimeBindingId = registryEntry.runtimeBindingId;
      if (!runtimeBindingId) {
        throw new TypeError(`Cannot start Inngest durable-agent run ${runId}: runtime binding is missing`);
      }

      // Override agentId and agentName in workflowInput with the durable agent's values
      workflowInput.agentId = agentId;
      workflowInput.agentName = agentName;
      requireWorkerPermissionResolver(workflowInput);
      const streamPubsub = getPubsub();

      // 1a. Install abort controller for this run. The controller is owned by
      // this InngestAgent instance; `result.abort()` flips it, the durable
      // LLM-execution step reads `abortSignal` off the global run registry
      // (when running in the same process) and the consumer stream closes via
      // an ABORT pubsub event when the inner catch detects the signal. If the
      // caller supplied an external signal, forward it onto the internal
      // controller so either source can cancel the run.
      const abortController = new AbortController();
      registryEntry.abortController = abortController;
      registryEntry.abortSignal = abortController.signal;

      // 1b. Register non-serializable state on the global run registry so
      // workflow steps running in the same process can recover it. Admission
      // happens before external listener attachment so a duplicate run cannot
      // leak a listener or publish a tombstone for an execution that never won.
      registerGlobalRunRegistryEntry(runId, registryEntry);
      let detachExternalAbort = () => {};
      if (streamOptions?.abortSignal) {
        const external = streamOptions.abortSignal;
        const forwardExternalAbort = () => {
          abortController.abort((external as AbortSignal & { reason?: unknown }).reason);
          void requestRemoteAbort(runId, runtimeBindingId).catch(() => {});
        };
        if (external.aborted) {
          forwardExternalAbort();
        } else {
          external.addEventListener('abort', forwardExternalAbort, { once: true });
          detachExternalAbort = () => external.removeEventListener('abort', forwardExternalAbort);
        }
      }

      let initialStreamCleanup: (() => void) | undefined;
      try {
        // Preparation opens and exports the AGENT_RUN and MODEL_GENERATION
        // spans. Reuse them so preparation work and durable execution remain
        // on one trace.
        workflowInput.stepIndex = 0;

        // Track cleanup state and global registry entry lifecycle.
        let cleanedUp = false;
        const finalizeGlobalRegistry = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          detachExternalAbort();
          deleteBoundRunRegistryEntry(runId, runtimeBindingId, abortController);
        };

        // 2. Create the durable agent stream (subscribes to pubsub)
        const {
          output,
          cleanup: streamCleanup,
          ready,
        } = createDurableAgentStream<TOutput>({
          pubsub: streamPubsub,
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

        initialStreamCleanup = streamCleanup;

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
        const workflowExecution = ready.then(
          async () => {
            try {
              await triggerWorkflow(runId, workflowInput, tracingOptions, resourceId, streamOptions?.actor);
            } catch (error) {
              // Dispatch acknowledgement can be ambiguous, so preserve the
              // binding and any abort tombstone for a possibly queued worker.
              await emitError(runId, error instanceof Error ? error : new Error(String(error))).catch(() => {});
            }
          },
          async error => {
            // Subscription setup failed before dispatch was attempted. This is
            // definite non-admission, so release the registry/listener state.
            finalizeGlobalRegistry();
            await emitError(runId, error instanceof Error ? error : new Error(String(error))).catch(() => {});
          },
        );
        const trackedEntry = getBoundRunRegistryEntry(runId, runtimeBindingId);
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
          await requestRemoteAbort(runId, runtimeBindingId);
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
      } catch (error) {
        initialStreamCleanup?.();
        detachExternalAbort();
        deleteBoundRunRegistryEntry(runId, runtimeBindingId, abortController);
        throw error;
      }
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

      const releaseResumeReservation = reserveInngestResume(`${workflowIds.AGENTIC_LOOP}:${runId}`);
      let resumeRegistryEntry: RunRegistryEntry | undefined;
      let resumeAbortController: AbortController | undefined;
      let resumeCreatedRegistryEntry = false;
      let previousRuntimeBindingId: string | undefined;
      let previousAbortController: AbortController | undefined;
      let previousAbortSignal: AbortSignal | undefined;
      let previousWorkflowExecution: RunRegistryEntry['workflowExecution'];
      let detachResumeExternalAbort = () => {};
      let resumeSetupRolledBack = false;
      let resumeSubscriptionReady = false;
      let resumeCancelledBeforeReady = false;
      let resumeDispatchStarted = false;
      const rollbackResumeSetup = () => {
        if (resumeSetupRolledBack) return;
        resumeSetupRolledBack = true;
        detachResumeExternalAbort();
        if (
          resumeRegistryEntry &&
          resumeAbortController &&
          globalRunRegistry.get(runId) === resumeRegistryEntry &&
          resumeRegistryEntry.abortController === resumeAbortController
        ) {
          if (resumeCreatedRegistryEntry) {
            globalRunRegistry.delete(runId);
          } else {
            if (previousRuntimeBindingId === undefined) {
              delete (resumeRegistryEntry as Partial<RunRegistryEntry>).runtimeBindingId;
            } else {
              resumeRegistryEntry.runtimeBindingId = previousRuntimeBindingId;
            }
            resumeRegistryEntry.abortController = previousAbortController;
            resumeRegistryEntry.abortSignal = previousAbortSignal;
            resumeRegistryEntry.workflowExecution = previousWorkflowExecution;
          }
        }
      };
      try {
        const runtimeBindingId = await resolveSuspendedRuntimeBindingId(runId);
        const resumePubsub = getPubsub();

        // Install a fresh abort controller scoped to the resumed segment and
        // attach it to the run-registry entry so the durable LLM step (when
        // co-located) can react. The previous run's controller is no longer
        // relevant.
        const abortController = new AbortController();
        resumeAbortController = abortController;
        if (resumeOptions?.abortSignal) {
          const external = resumeOptions.abortSignal;
          const forwardExternalAbort = () => {
            abortController.abort((external as AbortSignal & { reason?: unknown }).reason);
            void requestRemoteAbort(runId, runtimeBindingId).catch(() => {});
          };
          if (external.aborted) {
            forwardExternalAbort();
          } else {
            external.addEventListener('abort', forwardExternalAbort, { once: true });
            detachResumeExternalAbort = () => external.removeEventListener('abort', forwardExternalAbort);
          }
        }
        // Ensure a registry entry exists for this resumed segment. On Inngest,
        // a resume frequently runs in a fresh process where no prior stream()
        // entry is in memory — without this, the abort controller would be
        // silently dropped and the durable LLM step (when co-located) would
        // have nothing to react to.
        let existingEntry = getBoundRunRegistryEntry(runId, runtimeBindingId);
        if (!existingEntry) {
          resumeCreatedRegistryEntry = true;
          existingEntry = {
            // Minimal placeholder fields. The durable LLM step recreates tools
            // and model from the workflow input; this slot exists primarily to
            // carry the abort controller across the resumed segment. The
            // explicit flag tells resolveRuntimeDependencies to rebuild runtime
            // state from the Mastra instance instead of trusting this entry.
            isPlaceholder: true,
            runtimeBindingId,
            tools: {},
            model: undefined as any,
          } as RunRegistryEntry;
          registerGlobalRunRegistryEntry(runId, existingEntry);
        } else {
          previousRuntimeBindingId = existingEntry.runtimeBindingId;
          previousAbortController = existingEntry.abortController;
          previousAbortSignal = existingEntry.abortSignal;
          previousWorkflowExecution = existingEntry.workflowExecution;
          if (existingEntry.runtimeBindingId === undefined) existingEntry.runtimeBindingId = runtimeBindingId;
        }
        resumeRegistryEntry = existingEntry;
        existingEntry.abortController = abortController;
        existingEntry.abortSignal = abortController.signal;

        // Track cleanup state for the resumed segment so terminal events
        // (finish/error/abort/cleanup) always tear down the registry entry.
        let resumeCleanedUp = false;
        const finalizeResumeRegistry = () => {
          if (resumeCleanedUp) return;
          resumeCleanedUp = true;
          detachResumeExternalAbort();
          deleteBoundRunRegistryEntry(runId, runtimeBindingId, abortController);
        };

        // Re-subscribe to the stream
        const {
          output,
          cleanup: streamCleanup,
          ready,
        } = createDurableAgentStream<TOutput>({
          pubsub: resumePubsub,
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

        const dispatch = ready.then(
          async () => {
            if (resumeCancelledBeforeReady) return;
            resumeSubscriptionReady = true;
            const admittedWorkflow = getAdmittedWorkflow();
            const workflowsStore = await mastra!.getStorage()!.getStore('workflows');
            if (!workflowsStore) {
              throw new TypeError('Cannot resume Inngest durable-agent run: workflow storage is unavailable');
            }
            const snapshot = await workflowsStore.loadWorkflowSnapshot({
              workflowName: workflowIds.AGENTIC_LOOP,
              runId,
            });
            if (!snapshot) {
              throw new TypeError(`Cannot resume Inngest durable-agent run ${runId}: snapshot not found`);
            }

            // Resolve the exact suspended leaf. Tool calls use their call id as
            // a resume label, and nested suspensions record the remaining path
            // on the outer step's workflow metadata.
            const suspendedStepIds = Object.keys(snapshot.suspendedPaths ?? {});
            const resumeLabels = snapshot.resumeLabels ?? {};
            const toolCallId = resumeOptions?.toolCallId;
            const expandToLeafPath = (stepId: string): string[] => {
              const stepResult = snapshot.context?.[stepId];
              const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
              return Array.isArray(nestedPath) ? [stepId, ...nestedPath] : [stepId];
            };

            let steps: string[];
            if (toolCallId) {
              const targetStepId = resumeLabels[toolCallId]?.stepId;
              if (!targetStepId) {
                const available = Object.keys(resumeLabels);
                throw new NonRetriableError(
                  `Cannot resume run ${runId}: no suspended tool call with id "${toolCallId}". ` +
                    (available.length > 0
                      ? `Suspended tool call ids: ${available.join(', ')}.`
                      : 'No tool calls are currently suspended.'),
                );
              }
              steps = expandToLeafPath(targetStepId);
            } else {
              const available = Object.keys(resumeLabels);
              if (suspendedStepIds.length > 1 || available.length > 1) {
                throw new NonRetriableError(
                  `Cannot resume run ${runId}: more than one suspension is parked. ` +
                    'Pass "toolCallId" to choose which suspended tool call to resume.' +
                    (available.length > 0 ? ` Suspended tool call ids: ${available.join(', ')}.` : ''),
                );
              }
              steps = suspendedStepIds[0] ? expandToLeafPath(suspendedStepIds[0]) : [];
            }

            // Continue the trace the run suspended in (upstream #21566). The
            // anchor is persisted on the suspend snapshot, so it is stable across
            // dispatch retries and hashes identically on the worker.
            const suspendedTracingContext = snapshot.tracingContext;
            const tracingOptions = suspendedTracingContext?.traceId
              ? {
                  traceId: suspendedTracingContext.traceId,
                  ...(suspendedTracingContext.spanId === undefined
                    ? {}
                    : { parentSpanId: suspendedTracingContext.spanId }),
                }
              : undefined;
            const run = (await admittedWorkflow.createRun({
              runId,
              resourceId: resumeOptions?.resourceId,
            })) as InngestRun;
            resumeDispatchStarted = true;
            await run.resumeAsync({
              resumeData,
              step: steps,
              requestContext: prepareResumeRequestContext(
                resumeOptions?.requestContext,
                resumeOptions?.requireToolPermissionPolicy,
                snapshot.requestContext,
              ),
              // Generic workflows merge snapshot context. Durable agents replace
              // it with the independently allowlisted snapshot/fresh subset above
              // so pre-hardening snapshots can't reintroduce stored credentials.
              __requestContextMode: 'replace',
              actor: resumeOptions?.actor,
              ...(tracingOptions === undefined ? {} : { tracingOptions }),
            });
          },
          async error => {
            rollbackResumeSetup();
            releaseResumeReservation();
            throw error;
          },
        );

        const workflowExecution = dispatch.catch(async error => {
          await emitError(runId, error instanceof Error ? error : new Error(String(error))).catch(() => {});
        });
        void dispatch.finally(releaseResumeReservation).catch(() => {});

        existingEntry.workflowExecution = workflowExecution;

        // A successful resume means Inngest accepted the dispatch. Surface
        // selection, subscription, and send failures to the caller instead of
        // returning a stream for a run that remains parked.
        try {
          await dispatch;
        } catch (error) {
          streamCleanup();
          throw error;
        }

        const abort = async (reason?: unknown) => {
          if (!abortController.signal.aborted) {
            abortController.abort(reason);
          }
          // The step worker is a different process — see `requestRemoteAbort`.
          await requestRemoteAbort(runId, runtimeBindingId);
        };

        const cleanup = () => {
          streamCleanup();
          if (!resumeSubscriptionReady) {
            resumeCancelledBeforeReady = true;
            rollbackResumeSetup();
            releaseResumeReservation();
            return;
          }
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
      } catch (error) {
        // Once dispatch begins its acknowledgement can be ambiguous. Preserve
        // the binding/abort tombstone for a possibly queued worker; definite
        // pre-dispatch failures can release the provisional registry state.
        if (!resumeDispatchStarted) rollbackResumeSetup();
        releaseResumeReservation();
        throw error;
      }
    },

    async prepare(messages, prepareOptions) {
      const callerRequestContext = prepareOptions?.requestContext;
      const defaultOptions = await agent.getDefaultOptions({
        requestContext: callerRequestContext ?? new RequestContext(),
      });
      const requestContext = callerRequestContext ?? defaultOptions.requestContext;
      assertInngestResponseRecoveryDisabled(prepareOptions);
      assertInngestResponseRecoveryDisabled(defaultOptions);
      const preparation = await prepareForDurableExecution<TOutput>({
        agent: agent as Agent<string, any, TOutput>,
        messages,
        options: prepareOptions,
        resolvedDefaultOptions: defaultOptions as AgentExecutionOptions<TOutput>,
        ...(requestContext ? { requestContext } : {}),
        durableRequestContextKeys,
        mastra,
        durableAgentId: agentId,
        durableAgentName: agentName,
      });

      assertInngestResponseRecoveryDisabled(preparation.workflowInput.options);

      // Override with durable agent's id/name
      preparation.workflowInput.agentId = agentId;
      preparation.workflowInput.agentName = agentName;
      requireWorkerPermissionResolver(preparation.workflowInput);

      return {
        runId: preparation.runId,
        messageId: preparation.messageId,
        workflowInput: preparation.workflowInput,
        threadId: preparation.threadId,
        resourceId: preparation.resourceId,
      };
    },

    async observe(runId, observeOptions) {
      const runtimeBindingId = await resolveRuntimeBindingId(runId);

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
        await requestRemoteAbort(runId, runtimeBindingId);
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
