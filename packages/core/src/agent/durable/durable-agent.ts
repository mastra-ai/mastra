import type { MastraServerCache } from '../../cache/base';
import { InMemoryServerCache } from '../../cache/inmemory';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import { isRunLocalTopic } from '../../events/topics';
import { getRunStreamSlot, getScopeStreamSlot } from '../../loop/shared/stream-until-idle-helpers';
import { createTimeoutAbortSignal } from '../../loop/timeout';
import type { Mastra } from '../../mastra';
import { createObservabilityContext, getOrCreateSpan, SpanType, EntityType } from '../../observability';
import { RequestContext } from '../../request-context';
import type { DeclaredAgentSchedule } from '../../schedules/define';
import { toStandardSchema } from '../../schema';
import type { MemoryStorage, WorkflowsStorage } from '../../storage';
import { runOutsideRunFenceScope } from '../../storage/run-fencing';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import type { ChunkType, MastraOnFinishCallback, MastraStreamTransformOptions } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { deepMerge } from '../../utils';
import type { ShouldPersistSnapshotFn, WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { beginGoalActivity, stopGoalActivity } from '../goal';
import { MessageList } from '../message-list';
import type { MessageListInput } from '../message-list';
import { SaveQueueManager } from '../save-queue';
import { AgentThreadLeaseConflictError, agentThreadStreamRuntime } from '../thread-stream-runtime';
import type { AgentThreadRunRegistration } from '../thread-stream-runtime';
import type { AgentAbortThreadOptions, AgentModelManagerConfig, ToolsInput } from '../types';

import { publishAbortRequest } from './abort-transport';
import { AGENT_STREAM_TOPIC, DurableStepIds } from './constants';
import { runDurableStreamUntilIdle, runResumeDurableStreamUntilIdle } from './durable-stream-until-idle';
import {
  ExecutionFence,
  fencePubSub,
  RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID,
  resolveLeaseProvider,
  RUN_ACTIVE_ERROR_ID,
  setExecutionClaim,
  supportsRunFencing,
} from './execution-fence';
import type { UntrackedRunLiveness } from './execution-fence';
import { prepareForDurableExecution } from './preparation';
import type { PreparationResult } from './preparation';
import { endRunSpansWithError, ExtendedRunRegistry, globalRunRegistry } from './run-registry';
import {
  createDurableAgentStream,
  emitChunkEvent,
  emitErrorEvent,
  emitFinishEvent,
  emitOwnershipClaimedEvent,
} from './stream-adapter';
import type { DurableAgentStreamResult as DurableStreamAdapterResult } from './stream-adapter';
import type {
  AgentAbortEventData,
  AgentStepFinishEventData,
  AgentSuspendedEventData,
  DurableAgenticWorkflowInput,
  RegistryModelListEntry,
  RunRegistryEntry,
  SerializableModelListEntry,
} from './types';
import { createDurableAgenticWorkflow } from './workflows';
import { MAP_FINAL_OUTPUT_STEP_ID } from './workflows/durable-loop-builder';

const RESOLVED_EXECUTION_OPTIONS = Symbol('mastra.durable.resolvedExecutionOptions');
/** Recoveries in progress in this process, keyed by agent and run. */
const localRecoveryClaims = new Map<string, string>();
const RECOVER_ALREADY_IN_PROGRESS_ERROR_ID = 'DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS';
const RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID = 'DURABLE_AGENT_RECOVER_SNAPSHOT_NOT_FOUND';
const RECOVER_RUN_SUSPENDED_ERROR_ID = 'DURABLE_AGENT_RECOVER_RUN_SUSPENDED';
/** Stores already reported as unable to fence run writes, so each is warned about once per process. */
const unfencedStoresWarned = new WeakSet<WorkflowsStorage | MemoryStorage>();

/** Why `recover()` refused a run that is not orphaned, or `undefined` for a real failure. */
function recoverySkip(error: unknown): Pick<DurableAgentRecoveredRun, 'reason' | 'retryAt'> | undefined {
  const { id, details } = (error ?? {}) as { id?: unknown; details?: { retryAt?: unknown } };
  switch (id) {
    case RUN_ACTIVE_ERROR_ID:
      return typeof details?.retryAt === 'number'
        ? { reason: 'run-active', retryAt: details.retryAt }
        : { reason: 'run-active' };
    case RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID:
      return { reason: 'run-active-locally' };
    case RECOVER_ALREADY_IN_PROGRESS_ERROR_ID:
      return { reason: 'already-in-progress' };
    default:
      return undefined;
  }
}

interface RehydratedRecoveryState {
  requestContext: RequestContext;
  threadId?: string;
  resourceId?: string;
  messageList: MessageList;
  recoverAgentSpan: any;
  registryEntry: any;
}

/**
 * Bind live fallback model instances to the persisted ids that llm-execution
 * looks them up by (#22594).
 *
 * Identity first: explicit ids are stable across resolutions, so an exact-id
 * match is definitive regardless of resolver ordering. Position is only
 * trusted among the leftover entries on both sides — regenerated-uuid ids,
 * which can never match a persisted id — and only when those residues line up
 * 1:1. Anything still unbound degrades to config-based resolution in the
 * llm-execution step. (A renamed explicit id is indistinguishable from a
 * fresh uuid and lands in the positional residue — an inherent limit of the
 * persisted contract.)
 */
interface RebindModelListResult {
  modelList: RegistryModelListEntry[] | undefined;
  boundById: number;
  boundByPosition: number;
  unbound: number;
}

function rebindRecoveredModelList(
  persisted: SerializableModelListEntry[],
  enabledLive: AgentModelManagerConfig[],
): RebindModelListResult {
  // Phase 1: bind by identity. Explicit ids are stable across resolutions, so
  // an exact match is definitive regardless of resolver order. Each live entry
  // binds at most once (first unused occurrence wins for duplicate ids).
  const pool = [...enabledLive];
  const bound = persisted.map(entry => {
    const i = pool.findIndex(live => live.id === entry.id);
    return i === -1 ? undefined : pool.splice(i, 1)[0];
  });
  const boundById = bound.filter(Boolean).length;

  // Phase 2: the leftovers on both sides carry regenerated uuids that can
  // never match, so position is the only signal left. Zip them — but only
  // when they pair 1:1; anything else risks mis-binding and stays unbound.
  if (persisted.length - boundById === pool.length) {
    for (let i = 0; i < bound.length; i++) {
      bound[i] ??= pool.shift();
    }
  }

  // Emit in persisted order: the persisted id wins (llm-execution looks live
  // models up by it), everything else comes from the bound live entry — same
  // field mapping as preparation.ts.
  const modelList: RegistryModelListEntry[] = [];
  persisted.forEach((entry, i) => {
    const live = bound[i];
    if (live) {
      modelList.push({
        id: entry.id,
        model: live.model,
        maxRetries: live.maxRetries ?? 0,
        enabled: true,
        headers: live.headers,
      });
    }
  });

  return {
    modelList: modelList.length ? modelList : undefined,
    boundById,
    boundByPosition: modelList.length - boundById,
    unbound: persisted.length - modelList.length,
  };
}

/**
 * How many candidate `running` rows `listActiveRuns()` fetches from storage
 * per batch. Bounds peak memory to one batch of hydrated snapshots instead of
 * every matching row's snapshot at once (#21501).
 */
const LIST_ACTIVE_RUNS_STORAGE_BATCH_SIZE = 100;

/**
 * Options for DurableAgent.stream()
 */
export interface DurableAgentStreamOptions<OUTPUT = undefined> {
  /** Signal chunks to hide from this caller's stream. Does not affect generated results. */
  hideSignals?: AgentExecutionOptions<OUTPUT>['hideSignals'];
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
  /** Provider-specific options forwarded to the model (serialized into the durable workflow input) */
  providerOptions?: AgentExecutionOptions<OUTPUT>['providerOptions'];
  /** Require approval for tool calls. Boolean (gate all / none) or a per-call function policy. */
  requireToolApproval?: AgentExecutionOptions<OUTPUT>['requireToolApproval'];
  /** Automatically resume suspended tools */
  autoResumeSuspendedTools?: boolean;
  /** Maximum number of tool calls to execute concurrently, or an object with `limit`/`strategy` */
  toolCallConcurrency?: AgentExecutionOptions<OUTPUT>['toolCallConcurrency'];
  /** Whether to include raw chunks in the stream output */
  includeRawChunks?: boolean;
  /** Experimental transforms applied whenever `fullStream` is consumed. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  /** Maximum processor retries */
  maxProcessorRetries?: number;
  /** Structured output configuration */
  structuredOutput?: AgentExecutionOptions<OUTPUT>['structuredOutput'];
  /** Whether to return detailed scoring data in the response */
  returnScorerData?: boolean;
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
  /** Execution-scoped background dispatch policy for delegated agents. */
  backgroundTaskPolicy?: AgentExecutionOptions<OUTPUT>['backgroundTaskPolicy'];
  /** Tracing options forwarded to the agent/model spans. */
  tracingOptions?: AgentExecutionOptions<OUTPUT>['tracingOptions'];
  /** Per-call actor signal forwarded to FGA checks and tool execution. */
  actor?: AgentExecutionOptions<OUTPUT>['actor'];
  /** MCP protocol context forwarded to tools for in-process durable runs. */
  mcp?: AgentExecutionOptions<OUTPUT>['mcp'];
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
  /**
   * Whether this caller's stream closes when the run suspends (e.g. for tool
   * approval). Defaults to `false`: the stream stays open across suspension so
   * a later resume can continue streaming on this same reader.
   *
   * Set to `true` so `fullStream`, `text`, and `getFullOutput()` resolve at the
   * suspension boundary (matching non-durable `Agent.stream()`), letting callers
   * such as AG-UI or A2A react instead of hanging. Resume the run with
   * `resumeStream()`/`resume()` — those always return a fresh stream.
   */
  closeOnSuspend?: boolean;
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
   *
   * Also publishes an abort request over pubsub so the abort reaches the
   * process executing the run, which in a load-balanced deployment is usually
   * not this one. That process flips its own controller and unwinds normally;
   * the workflow run is never hard-cancelled, so the terminal `finish` event
   * still reaches stream consumers. Await the returned promise to know the
   * request has been dispatched; ignoring it keeps the previous
   * fire-and-forget behaviour.
   */
  abort: (reason?: unknown) => Promise<void>;
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

  /**
   * Overrides the snapshot-persistence policy for this agent's durable
   * workflows. Returning false for a status skips that snapshot write.
   *
   * The default policy always persists `pending | paused | suspended`
   * (required for human-in-the-loop `resume()`), and persists `running`
   * only when the Mastra instance is configured with
   * `recovery: { durableAgents: 'auto' }` — `running` checkpoints exist
   * solely so `listActiveRuns()` / `recover()` / `recoverActiveRuns()` can
   * see in-flight runs after a crash.
   *
   * Footguns when providing a custom predicate:
   * - Excluding `paused` / `suspended` breaks human-in-the-loop resume.
   * - Excluding `running` makes the agent invisible to crash recovery.
   * A guardrail warning is logged for both cases (detected by probing the
   * predicate with an empty `stepResults`, so predicates that read
   * `stepResults` may probe inaccurately — the warning is best-effort).
   *
   * EventedAgent and InngestAgent own their persistence policy and ignore
   * this option with a warning.
   */
  shouldPersistSnapshot?: ShouldPersistSnapshotFn;

  /**
   * Per-topic opt-out of the replay cache.
   *
   * Return `false` to publish a topic straight through to the underlying
   * PubSub without recording it in the cache. Subscribers of that topic then
   * receive live events only and cannot resume from an offset. Use this to
   * trade replay for minimum publish latency on hot topics when the cache is
   * remote (e.g. cross-region Redis). Run-local topics are always excluded,
   * regardless of this option.
   */
  shouldCache?: (topic: string) => boolean;
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
 * of remaining runs could proceed; `skipped` means the run was not orphaned.
 */
export interface DurableAgentRecoveredRun {
  runId: string;
  status: 'success' | 'failed' | 'skipped';
  /** Set when `status` is `failed`. */
  error?: Error;
  /**
   * Set when `status` is `skipped`:
   * - `run-active`: another execution, possibly in another process, is live.
   *   Check again at `retryAt`.
   * - `run-active-locally`: this process is executing the run.
   * - `already-in-progress`: this process is already recovering the run.
   */
  reason?: 'run-active' | 'run-active-locally' | 'already-in-progress';
  /** Epoch ms after which the live execution's claim lapses unless it is renewed. Set for `run-active`. */
  retryAt?: number;
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
  /** Experimental transforms applied whenever `fullStream` is consumed. */
  experimentalTransform?: MastraStreamTransformOptions<OUTPUT>;
  /** Callback when a step finishes */
  onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
  /** Callback when the recovered run finishes */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Callback when the recovered run errors */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  /** Callback when the recovered run is aborted */
  onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
  /** Callback when the recovered run suspends again */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /**
   * Optional abort signal for the recovered segment. Forwarded onto a fresh
   * internal `AbortController` installed on the run's registry entry, so
   * `result.abort()` and the external signal can both cancel the recovered run.
   */
  abortSignal?: AbortSignal;
  /**
   * Take the run over even while another execution is live. The other
   * execution loses the run and stops; its writes are rejected when the
   * workflows store supports run fencing. Without `force`, `recover()` throws
   * `DURABLE_AGENT_RUN_ACTIVE` for a live run.
   */
  force?: boolean;
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

  /**
   * The engine the workflow instance actually runs on, resolved on first use
   * (see {@link DurableAgent.resolveWorkflowEngine}). `null` until resolved.
   */
  #resolvedWorkflowEngine: 'default' | 'evented' | null = null;

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

  /** User-supplied per-topic cache policy (see DurableAgentConfig.shouldCache) */
  readonly #shouldCache: ((topic: string) => boolean) | undefined;

  /**
   * User-supplied snapshot-persistence policy
   * (see DurableAgentConfig.shouldPersistSnapshot). Protected so subclasses
   * that pin their own policy (EventedAgent) can detect and warn when set.
   */
  protected readonly userShouldPersistSnapshot: ShouldPersistSnapshotFn | undefined;

  /** Whether the one-time persistence-policy guardrail warnings have run */
  #warnedPersistencePolicy = false;

  /**
   * Create a new DurableAgent that wraps an existing Agent
   */
  constructor(config: DurableAgentConfig<TAgentId, TTools, TOutput>) {
    const {
      agent,
      id: idOverride,
      name: nameOverride,
      pubsub,
      cache,
      maxSteps,
      cleanupTimeoutMs,
      shouldCache,
      shouldPersistSnapshot,
    } = config;

    // Use provided id/name or fall back to agent.id/agent.name
    const agentId = idOverride ?? agent.id;
    const agentName = nameOverride ?? agent.name ?? agent.id;

    // Call Agent constructor with minimal config - we delegate to the wrapped agent
    super({
      id: agentId as TAgentId,
      name: agentName,
      // Delegate to wrapped agent's instructions
      instructions: ({ requestContext }) => agent.getInstructions({ requestContext }),
      // Preserve dynamic model resolution until a request context is available.
      model: ({ requestContext }) => agent.getModel({ requestContext }),
    });

    this.#wrappedAgent = agent;
    this.#runRegistry = new ExtendedRunRegistry();
    this.#maxSteps = maxSteps;
    this.#hasCustomPubsub = !!pubsub;
    this.#innerPubsub = pubsub ?? new EventEmitterPubSub();
    this.#cacheConfig = cache;
    this.#cleanupTimeoutMs = cleanupTimeoutMs ?? 30_000;
    this.#shouldCache = shouldCache;
    this.userShouldPersistSnapshot = shouldPersistSnapshot;
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
   * Mark `runId` as being recovered by this process, and return the release.
   * A second `recover()` of the same run in this process fails fast instead
   * of contending for the claim. Across processes the run's execution claim
   * picks the winner.
   */
  #claimLocalRecovery(runId: string): () => void {
    const key = JSON.stringify([this.id, runId]);
    if (localRecoveryClaims.has(key)) {
      throw new MastraError({
        id: RECOVER_ALREADY_IN_PROGRESS_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" recover(${runId}): this process is already recovering this run.`,
        details: { agentName: this.name, runId },
      });
    }
    const token = crypto.randomUUID();
    localRecoveryClaims.set(key, token);
    return () => {
      if (localRecoveryClaims.get(key) === token) localRecoveryClaims.delete(key);
    };
  }

  /**
   * Liveness of a run without an execution claim, i.e. one started before runs
   * were claimed: a live run keeps renewing its thread's lease. A run without a
   * thread has no signal and counts as not live.
   */
  #untrackedRunLiveness(runId: string, workflowInput: DurableAgenticWorkflowInput): UntrackedRunLiveness | undefined {
    const memoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = workflowInput.state?.threadId ?? memoryInfo?.threadId;
    if (!threadId) return undefined;
    const resourceId = workflowInput.state?.resourceId ?? memoryInfo?.resourceId;
    return {
      isLive: () => agentThreadStreamRuntime.isRunHoldingThreadLease(this.getPubSub(), runId, threadId, resourceId),
      ttlMs: agentThreadStreamRuntime.threadLeaseTtlMs,
    };
  }

  /**
   * Whether the run's persisted snapshot is still `running`. Without storage,
   * or with an unreadable snapshot, answers true so `recover()` reports why.
   */
  async #isRunningSnapshot(runId: string): Promise<boolean> {
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
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

  async #loadRecoverableSnapshot(
    workflowsStore: WorkflowsStorage,
    runId: string,
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

    if (workflowInput.agentId !== this.id) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" recover(${runId}): persisted run belongs to agent "${workflowInput.agentId}", not "${this.id}".`,
        details: { agentName: this.name, runId, ownerAgentId: workflowInput.agentId },
      });
    }

    // A suspended run is not orphaned: it waits for resume(), and restarting
    // it would fail inside the workflow engine. Checked again after the claim,
    // since the run may suspend between discovery and the claim.
    if (snapshot.status === 'suspended') {
      throw new MastraError({
        id: RECOVER_RUN_SUSPENDED_ERROR_ID,
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" recover(${runId}): the run is suspended. Call resume() to continue it.`,
        details: { agentName: this.name, runId },
      });
    }

    return { snapshot, workflowInput };
  }

  /**
   * Rebuild and register the stream for a claimed recovery attempt. Rolls back
   * every partial registration and releases the claim if setup fails.
   */
  async #setupRecoveredStream({
    runId,
    workflowInput,
    requestContext,
    threadId,
    resourceId,
    messageList,
    registryEntry,
    options,
    scheduleAutoCleanup,
    executionFence,
  }: {
    runId: string;
    workflowInput: DurableAgenticWorkflowInput;
    requestContext: RequestContext;
    threadId?: string;
    resourceId?: string;
    messageList: MessageList;
    registryEntry: any;
    options?: DurableAgentRecoverOptions<TOutput>;
    scheduleAutoCleanup: () => void;
    executionFence: ExecutionFence;
  }): Promise<{
    stream: DurableStreamAdapterResult<TOutput>;
    threadRegistration?: AgentThreadRunRegistration;
  }> {
    let streamCleanup: (() => void) | undefined;
    let streamOutput: MastraModelOutput<TOutput> | undefined;
    let threadRegistration: AgentThreadRunRegistration | undefined;
    try {
      executionFence.throwIfLost();
      registryEntry.messageList = messageList;
      this.#runRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
      globalRunRegistry.set(runId, registryEntry);

      // Persistent backends may retain chunks from the pre-crash segment.
      const recoverOffset = await this.#getPubsubOffset(runId);
      executionFence.throwIfLost();
      const stream = createDurableAgentStream<TOutput>({
        pubsub: this.pubsub,
        runId,
        minGeneration: executionFence.generation,
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
        experimentalTransform: options?.experimentalTransform,
        onStepFinish: options?.onStepFinish,
        onFinish: options?.onFinish,
        onStreamFinished: scheduleAutoCleanup,
        onError: async error => {
          await options?.onError?.(error);
          scheduleAutoCleanup();
        },
        onAbort: async data => {
          try {
            await options?.onAbort?.(data);
          } finally {
            scheduleAutoCleanup();
          }
        },
        onSuspended: options?.onSuspended,
        // Keep recovered runs observable if they suspend again so a later
        // resume or recovery can pick them up.
        messageList,
        structuredOutput: registryEntry.structuredOutput,
        requestContext: registryEntry.requestContext,
        returnScorerData: workflowInput.options?.returnScorerData,
      });
      streamCleanup = stream.cleanup;
      streamOutput = stream.output;
      await this.#raceFenceLoss(stream.ready, executionFence);

      const recoverStreamOptions: AgentExecutionOptions<TOutput> = {
        runId,
        requestContext,
        ...(threadId
          ? {
              memory: {
                thread: threadId,
                ...(resourceId ? { resource: resourceId } : {}),
              },
            }
          : {}),
      } as AgentExecutionOptions<TOutput>;
      executionFence.throwIfLost();
      threadRegistration = await agentThreadStreamRuntime.registerRun(
        this as unknown as Agent<any, any, any, any>,
        stream.output,
        recoverStreamOptions,
        this.getPubSub(),
        {
          strict: true,
          continuation: 'across-suspension',
          validate: () => executionFence.throwIfLost(),
          generation: executionFence.generation,
          ownershipLost: () => executionFence.isLost(),
        },
      );
      executionFence.throwIfLost();
      return { stream, threadRegistration };
    } catch (error) {
      const settlement = await executionFence.settle(async () => {});
      try {
        // A superseded execution leaves the thread lease to the new owner,
        // which holds it under the same runId.
        await threadRegistration?.rollback({ releaseLease: settlement !== 'superseded' });
      } catch (rollbackError) {
        this.#mastra
          ?.getLogger?.()
          ?.warn?.(`[DurableAgent] recover(${runId}) failed to roll back thread registration: ${rollbackError}`);
      }
      if (streamOutput) {
        agentThreadStreamRuntime.closeRunContinuation(streamOutput, this.getPubSub());
      }
      streamCleanup?.();
      if (this.#runRegistry.get(runId) === registryEntry) {
        this.#runRegistry.cleanup(runId);
      }
      if (globalRunRegistry.get(runId) === registryEntry) {
        globalRunRegistry.delete(runId);
      }
      if (settlement !== 'superseded') {
        await this.#reportRecoveryFailure(runId, error, executionFence.generation);
      }
      throw error;
    }
  }

  async #reportRecoveryFailure(runId: string, error: unknown, generation: number | undefined): Promise<boolean> {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    if (normalizedError instanceof AgentThreadLeaseConflictError) {
      return false;
    }

    try {
      await this.emitError(runId, normalizedError, generation);
      return true;
    } catch (reportingError) {
      this.#mastra
        ?.getLogger?.()
        ?.warn?.(`[DurableAgent] recover(${runId}) failed to publish terminal error: ${reportingError}`);
      return false;
    }
  }

  /**
   * Settle `operation`, or throw the loss error as soon as the execution loses
   * its claim. A superseded recovery then unwinds even when the work it waits
   * on ignores the abort signal.
   */
  #raceFenceLoss<T>(operation: Promise<T>, executionFence: ExecutionFence): Promise<T> {
    const lost = new Promise<never>((_, reject) => executionFence.onLost(reject));
    // The loser of the race must not surface as an unhandled rejection.
    lost.catch(() => {});
    return Promise.race([operation, lost]);
  }

  /** Rebuilds process-local recovery state from the persisted durable workflow input. */
  async #rehydrateRecoveryState({
    runId,
    workflowInput,
    abortController,
    executionFence,
  }: {
    runId: string;
    workflowInput: DurableAgenticWorkflowInput;
    abortController: AbortController;
    executionFence: ExecutionFence;
  }): Promise<RehydratedRecoveryState> {
    const requestContext: RequestContext = workflowInput.requestContextEntries
      ? new RequestContext(Object.entries(workflowInput.requestContextEntries) as Iterable<readonly [string, unknown]>)
      : new RequestContext();

    const messageListMemoryInfo = (
      workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
    )?.memoryInfo;
    const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
    const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;

    // `requestContextEntries` contains caller state captured before preparation
    // installed the run's framework-managed memory context. Rebuild that entry
    // from persisted run state so recovery never inherits a caller/parent thread.
    if (threadId && resourceId) {
      requestContext.set('MastraMemory', {
        thread: { id: threadId },
        resourceId,
        memoryConfig: workflowInput.state?.memoryConfig,
      });
    } else {
      requestContext.delete('MastraMemory');
    }

    const messageList = new MessageList({ threadId, resourceId });
    try {
      messageList.deserialize(workflowInput.messageListState);
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] recover(${runId}) messageList deserialize skipped: ${error}`);
    }

    const wrapped = this.#wrappedAgent as Agent<string, any, TOutput>;
    let model;
    try {
      model = await wrapped.getModel({ requestContext });
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to resolve model during recover(${runId}): ${error}`);
    }
    executionFence.throwIfLost();

    // Restore the live fallback model list the run was prepared with (#22594).
    // The persisted (enabled-only, ordered) list is the source of truth for
    // the run's shape; the live resolution is the only source of real model
    // instances. Ids regenerate on every resolution (`toFallbackEntry` assigns
    // `mdl.id ?? randomUUID()`), so live entries must be rebound to the
    // persisted ids that llm-execution looks models up by — identity first,
    // position only for the unidentifiable residue (see
    // rebindRecoveredModelList).
    let modelList: RegistryModelListEntry[] | undefined;
    const persistedModelList = workflowInput.modelList;
    if (persistedModelList?.length) {
      try {
        const liveModelList = await wrapped.getModelList(requestContext);
        const enabledLive = (liveModelList ?? []).filter(entry => entry.enabled !== false);
        const rebound = rebindRecoveredModelList(persistedModelList, enabledLive);
        modelList = rebound.modelList;
        if (rebound.unbound > 0) {
          this.#mastra
            ?.getLogger?.()
            ?.warn?.(
              `[DurableAgent] recover(${runId}) model list drifted (persisted ${persistedModelList.length} enabled entries, resolved ${enabledLive.length}); ` +
                `bound ${rebound.boundById} by id, ${rebound.boundByPosition} by position; ${rebound.unbound} will resolve from serialized config`,
            );
        }
      } catch (error) {
        this.#mastra
          ?.getLogger?.()
          ?.warn?.(`[DurableAgent] Failed to resolve model list during recover(${runId}): ${error}`);
      }
    }
    executionFence.throwIfLost();

    let memory;
    try {
      memory = await wrapped.getMemory({ requestContext });
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to resolve memory during recover(${runId}): ${error}`);
    }
    executionFence.throwIfLost();

    const saveQueueManager = memory
      ? new SaveQueueManager({ logger: this.#mastra?.getLogger?.() as any, memory })
      : undefined;
    const backgroundTasksConfig = this.getBackgroundTasksConfig?.();
    const backgroundTaskManager = this.#mastra?.backgroundTaskManager;

    let inputProcessors: any[] = [];
    let llmRequestInputProcessors: any[] = [];
    let outputProcessors: any[] = [];
    let errorProcessors: any[] = [];
    try {
      inputProcessors = (await (wrapped as any).listInputProcessors?.(requestContext)) ?? [];
      llmRequestInputProcessors = (await (wrapped as any).__listLLMRequestProcessors?.(requestContext)) ?? [];
      outputProcessors = (await (wrapped as any).listOutputProcessors?.(requestContext)) ?? [];
      errorProcessors = (await (wrapped as any).listErrorProcessors?.(requestContext)) ?? [];
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] recover(${runId}) processor resolution failed: ${error}`);
    }
    executionFence.throwIfLost();

    const processorStates = new Map<string, any>();
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
      } catch (error) {
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] Failed to open recover span: ${error}`);
      }
    }
    executionFence.throwIfLost();

    const registryEntry = {
      // Restore the original run's flag from the persisted snapshot so a
      // warm resume after recovery keeps returning scoringData without the
      // caller re-passing the option.
      returnScorerData: workflowInput.options?.returnScorerData,
      mastra: this.#mastra,
      model,
      modelList,
      memory,
      saveQueueManager,
      requestContext,
      agentSpan: recoverAgentSpan,
      // abortController/abortSignal are installed by
      // #installAbortWithTotalTimeout below, with the run-level budget
      // composed in.
      // Restore the run-level execution budget from the persisted snapshot so
      // a recovered session is bounded like the original one (#21724).
      timeoutTotalMs: workflowInput.options?.modelSettings?.timeout?.totalMs,
      // Rebuild the live structured output config from the persisted JSON Schema
      // so the recovered stream still emits `object-result` chunks.
      structuredOutput: workflowInput.options?.structuredOutput?.schema
        ? {
            ...workflowInput.options.structuredOutput,
            schema: toStandardSchema(workflowInput.options.structuredOutput.schema),
          }
        : undefined,
      backgroundTaskManager,
      backgroundTasksConfig,
      inputProcessors,
      llmRequestInputProcessors,
      outputProcessors,
      errorProcessors,
      processorStates,
      drainPendingSignals: (scope?: 'pending' | 'pre-run') => wrapped.__getDrainPendingSignals()(runId, scope),
      cleanup: () => {},
    };
    this.#installAbortWithTotalTimeout(registryEntry as unknown as RunRegistryEntry, abortController);

    return {
      requestContext,
      threadId,
      resourceId,
      messageList,
      recoverAgentSpan,
      registryEntry,
    };
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
      if (this.#mastra) this.#innerPubsub.__setSource(this.#mastra.pubsub);
      if (this.#shouldCache) {
        // The existing wrapper owns the caching policy; a per-agent filter
        // cannot be applied without double-wrapping, so it is ignored.
        this.logger.warn(
          `[DurableAgent:${this.id}] 'shouldCache' is ignored because the configured pubsub is already a CachingPubSub. Pass 'shouldCache' to that CachingPubSub instead.`,
        );
      }
    } else {
      // Resolve cache: user-provided > mastra's cache > default InMemoryServerCache
      const resolvedCache = this.#cacheConfig ?? this.#mastra?.serverCache ?? new InMemoryServerCache();
      this.#resolvedCache = resolvedCache;
      // Run-local topics must never reach the cache. This wrapper sits *above*
      // the `mastra.pubsub` proxy that tags publishes `localOnly`, so that flag
      // is set too late for `CachingPubSub` to observe it — the policy has to be
      // declared here instead. Without it, per-run `workflow.events.v2.*` watch
      // events (cumulative step results, often megabytes) are RPUSHed into a
      // shared store that no other instance can ever read from (issue #20646).
      //
      // `source: mastra.pubsub` makes the cache follow the Mastra-level bus.
      // The evented engine publishes agent-stream events there (from whichever
      // worker executes a step) instead of through this agent's pubsub, so
      // without the source wiring those events are never cached and — when the
      // agent has a custom pubsub on a different transport — never reach the
      // stream's subscribers at all: streams would resolve with null
      // finish/suspend data (Phase 2 Item 5). When agent and Mastra share the
      // underlying transport, the follower only caches (fixing replay) and
      // never double-delivers.
      const userShouldCache = this.#shouldCache;
      this.#cachingPubsub = new CachingPubSub(this.#innerPubsub, resolvedCache, {
        shouldCache: topic => !isRunLocalTopic(topic) && (userShouldCache?.(topic) ?? true),
        source: this.#mastra?.pubsub,
      });
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
   * File-based schedules live on the wrapped agent: `assembleAgentFromFsEntry`
   * attaches them to the inner `Agent` before it is wrapped for durable
   * execution, and `#declaredSchedules` is private to each instance. Without
   * this delegate the wrapper would report none of its own and Mastra would
   * never sync a durable agent's `schedules/` directory.
   */
  public override getDeclaredSchedules(): DeclaredAgentSchedule[] {
    return this.#wrappedAgent.getDeclaredSchedules();
  }

  /**
   * Mirrors {@link getDeclaredSchedules} so attaching schedules to an
   * already-wrapped agent lands on the instance the getter reads from.
   */
  public override __setDeclaredSchedules(schedules: DeclaredAgentSchedule[]): void {
    this.#wrappedAgent.__setDeclaredSchedules(schedules);
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

  override async getConfiguredErrorProcessorIds(requestContext?: any) {
    return this.#wrappedAgent.getConfiguredErrorProcessorIds(requestContext);
  }

  override async __resolveRunErrorProcessors(requestContext: any, overrides?: any) {
    return this.#wrappedAgent.__resolveRunErrorProcessors(requestContext, overrides);
  }

  override async __listLLMRequestProcessors(requestContext?: any, errorProcessorOverrides?: any) {
    return this.#wrappedAgent.__listLLMRequestProcessors(requestContext, errorProcessorOverrides);
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
   * Raw stored config lives on the wrapped agent for the same reason as the
   * mutators above: durable preparation and tracing read
   * `resolvedVersionId` from the wrapped agent's rawConfig, and the editor
   * stamps it on the outer fork via `__setRawConfig` after
   * `applyStoredOverrides`. Without this delegation the stamp lands on the
   * (unread) DurableAgent-level field and version metadata silently
   * disappears from spans and suspend snapshots.
   */
  override toRawConfig(): Record<string, unknown> | undefined {
    return this.#wrappedAgent.toRawConfig();
  }

  override __setRawConfig(rawConfig: Record<string, unknown>): void {
    this.#wrappedAgent.__setRawConfig(rawConfig);
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
      shouldCache: this.#shouldCache,
      shouldPersistSnapshot: this.userShouldPersistSnapshot,
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
   * Get the run registry for use by subclasses.
   * @internal
   */
  protected get runRegistryInternal(): ExtendedRunRegistry {
    return this.#runRegistry;
  }

  /**
   * Which workflow execution engine the durable agentic loop runs on.
   * Subclasses override this (EventedAgent → 'evented').
   * @internal
   */
  protected get workflowEngine(): 'default' | 'evented' {
    return 'default';
  }

  /**
   * Resolve the engine this agent's workflow instance actually runs on.
   *
   * An evented agent without a Mastra host cannot execute evented runs — the
   * evented engine's `createRun` requires the host's registries, storage, and
   * event workers. Before the evented engine was re-enabled, a hostless
   * EventedAgent silently streamed on the default in-process engine; that is
   * released behavior, so we preserve it here as a fallback (with a warning)
   * instead of throwing.
   *
   * The same applies to a host whose storage cannot apply concurrent workflow
   * updates atomically. The evented engine advances a run from concurrent
   * workers, so `createRun()` refuses to start on such a store. Letting that
   * throw would turn a working durable agent into a hard failure on upgrade
   * for stores like Redis, so durable agents degrade to the in-process engine
   * the same way a hostless one does. A workflow that opts into the evented
   * engine directly (by declaring a `schedule`) still gets the error, because
   * there is no other engine it could have meant.
   *
   * The result is memoized: `getWorkflow()` caches the created workflow, so
   * an agent that first streamed hostless keeps its default-engine workflow
   * even if it is registered on a Mastra instance afterwards — identical to
   * the previously shipped behavior. The cache is deliberately not
   * invalidated.
   *
   * @internal
   */
  protected resolveWorkflowEngine(): 'default' | 'evented' {
    if (this.#resolvedWorkflowEngine) return this.#resolvedWorkflowEngine;
    let engine = this.workflowEngine;
    if (engine === 'evented' && !this.#mastra) {
      engine = 'default';
      this.logger.warn(
        `EventedAgent '${this.id}' has no Mastra host; running on the default in-process engine. ` +
          `Register the agent on a Mastra instance (with storage) to get evented execution.`,
      );
    } else if (engine === 'evented') {
      // Read `stores` directly rather than `await getStore('workflows')`: engine
      // resolution is synchronous (`getWorkflow()` is), and `getStore()` is only
      // async by signature — it returns `this.stores?.[name]` without awaiting
      // init, so this sees exactly what the engine's own gate sees.
      const storage = this.#mastra?.getStorage();
      const workflowsStore = storage?.stores?.workflows;
      if (workflowsStore && !(workflowsStore.supportsConcurrentUpdates?.() ?? false)) {
        engine = 'default';
        this.logger.warn(
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

  /**
   * Evented-engine runs execute via pubsub events consumed by in-process
   * workers — without them `run.start()`/`resume()`/`restart()` never
   * resolve (they wait on the `workflows-finish` topic). No-op on the
   * default engine; idempotent on Mastra's side.
   * @internal
   */
  protected async ensureEngineWorkersStarted(): Promise<void> {
    if (this.resolveWorkflowEngine() === 'evented') {
      await this.#mastra?.__ensureExecutionWorkersStarted();
    }
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
      pubsub: this.fenceRunPubSub(executionFence, entry?.abortController),
    });
    // Parent the workflow run under the AGENT_RUN span so the trace exports under it.
    const result = await run.start({
      inputData: workflowInput,
      requestContext,
      actor: workflowInput.options?.actor,
      ...createObservabilityContext({ currentSpan: entry?.agentSpan }),
    });
    await this.settleExecution(runId, executionFence, {
      status: result?.status,
      error:
        result?.status === 'failed'
          ? new Error((result as any).error?.message || 'Workflow execution failed')
          : undefined,
    });
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
      // Resolved, not raw: a hostless evented agent falls back to the default
      // in-process engine (see resolveWorkflowEngine).
      engine: this.resolveWorkflowEngine(),
      shouldPersistSnapshot: this.resolveShouldPersistSnapshot(),
    });
  }

  /**
   * Resolve the effective snapshot-persistence policy for this agent's
   * workflows: the user-supplied predicate when set, otherwise the
   * recovery-aware default. Subclasses that own their persistence policy
   * (EventedAgent) override this to pin their required policy.
   *
   * @internal
   */
  protected resolveShouldPersistSnapshot(): ShouldPersistSnapshotFn {
    return this.userShouldPersistSnapshot ?? this.#recoveryAwarePersistencePolicy;
  }

  /**
   * Default snapshot-persistence policy for plain durable agents.
   *
   * Always persists `pending | paused | suspended` — those records are the
   * resume artifacts human-in-the-loop flows depend on. Persists `running`
   * only when crash recovery is enabled (`recovery.durableAgents: 'auto'`):
   * `running` checkpoints exist solely to feed `listActiveRuns()` /
   * `recover()` / `recoverActiveRuns()`, and are pure write amplification
   * when nothing consumes them (issue #23915).
   *
   * Reads the recovery config lazily (per persist call, via the Mastra
   * reference) so the policy stays correct regardless of whether the
   * workflow was built before or after Mastra registration.
   */
  readonly #recoveryAwarePersistencePolicy: ShouldPersistSnapshotFn = ({ workflowStatus }) => {
    return (
      workflowStatus === 'pending' ||
      workflowStatus === 'paused' ||
      workflowStatus === 'suspended' ||
      (workflowStatus === 'running' && this.#mastra?.recoveryConfig?.durableAgents === 'auto')
    );
  };

  /**
   * Emit an error event to pubsub.
   *
   * @param runId - The run ID
   * @param error - The error to emit
   * @param generation - Claim generation of the execution reporting the error
   * @internal
   */
  protected async emitError(runId: string, error: Error, generation?: number): Promise<void> {
    // End the root spans on error so the trace exports (mirrors the non-durable map-results-step).
    endRunSpansWithError(runId, error);
    await runOutsideRunFenceScope(() => emitErrorEvent(this.pubsub, runId, error, generation));
  }

  /**
   * Claim the run's execution fence (#23734): `acquire` for a new execution
   * segment, `takeover` when recovering an orphaned run. With a
   * `requestContext`, the claim also covers the run's memory store (see
   * {@link DurableAgent.#coverMemory}).
   */
  async #claimExecution(
    runId: string,
    mode: 'acquire' | 'recover' | 'takeover',
    requestContext?: RequestContext,
    untrackedRun?: UntrackedRunLiveness,
  ): Promise<ExecutionFence> {
    const fence = await ExecutionFence.claim({
      leaseProvider: resolveLeaseProvider(this.pubsub),
      workflowsStore: await this.#mastra?.getStorage()?.getStore('workflows'),
      agentId: this.id,
      runId,
      mode,
      untrackedRun,
      logger: this.logger,
    });
    if (requestContext) await this.#coverMemory(fence, requestContext);
    return fence;
  }

  /**
   * Raise the memory store the run writes to to the fence's claim before the
   * run touches memory. Settles the fence if a newer claim already covers
   * memory. Memory that cannot be resolved stays unfenced: the run's own
   * memory writes fail the same way.
   */
  async #coverMemory(fence: ExecutionFence, requestContext: RequestContext): Promise<void> {
    if (fence.generation === undefined) return;
    let store: MemoryStorage | undefined;
    try {
      const memory = await this.getMemory({ requestContext });
      store = memory ? await memory.storage.getStore('memory') : undefined;
    } catch (error) {
      this.logger.warn(`[DurableAgent] run ${fence.runId}: memory is not fenced, failed to resolve its store`, {
        runId: fence.runId,
        error,
      });
    }
    if (this.#mastra?.recoveryConfig?.durableAgents === 'auto') this.#warnIfUnfenced(store, 'memory');
    try {
      await fence.coverMemory(store);
    } catch (error) {
      await fence.settle(async () => {});
      throw error;
    }
  }

  /**
   * Warn, once per store, that a store recovery relies on can't fence run
   * writes (#23734). Returns whether it can't.
   */
  #warnIfUnfenced(store: WorkflowsStorage | MemoryStorage | undefined, domain: 'workflows' | 'memory'): boolean {
    if (!store || supportsRunFencing(store)) return false;
    if (unfencedStoresWarned.has(store)) return true;
    unfencedStoresWarned.add(store);
    const consequence =
      domain === 'workflows'
        ? `Recovery can only tell that a run is still live through the pubsub lease, which works only when every instance shares the pubsub, and writes from an execution that lost its run are not rejected. A run recovered while it is still live can end with the stale execution's output.`
        : `When recovery takes a run over, the memory writes (messages, threads, working memory) of the execution that lost it are not rejected.`;
    this.guardrailLogger?.warn(
      `DurableAgent '${this.id}': the ${domain} store (${store.constructor.name}) can't fence run writes. ${consequence} ` +
        `Use a storage adapter that supports run fencing.`,
    );
    return true;
  }

  /**
   * The pubsub a run's workflow publishes on, bound to its execution.
   *
   * Once the execution loses the run, `abortController` is aborted so the LLM
   * stream and tool calls stop, and the execution's publishes are dropped:
   * the run's topics are shared with the new owner's consumers, which must not
   * see this execution's chunks or the `finish` its abort produces.
   *
   * The evented engine publishes on `mastra.pubsub` instead of this pubsub, so
   * nothing could drop that `finish`. Its runs are not aborted and fail at
   * their next ownership check.
   *
   * @internal
   */
  protected fenceRunPubSub(
    executionFence: ExecutionFence | undefined,
    abortController: AbortController | undefined,
    pubsub: PubSub = this.pubsub,
  ): PubSub {
    if (!executionFence || this.resolveWorkflowEngine() !== 'default') return pubsub;
    executionFence.onLost(error => {
      if (abortController && !abortController.signal.aborted) abortController.abort(error);
    });
    return fencePubSub(pubsub, executionFence);
  }

  /**
   * End an execution segment: publish the error of a failed segment and delete
   * the snapshots of a run that reached a non-suspended terminal status.
   *
   * With an execution fence these writes happen only while the segment still
   * owns the run, and the fence is released afterwards. A superseded segment
   * writes nothing — the run belongs to the execution that took it over. A
   * segment that lost its lease without being replaced still reports its error
   * but keeps the snapshots so the run stays recoverable.
   *
   * Never rejects: a pubsub that is already closing (for example during
   * shutdown) must not turn a run's own failure into an unhandledRejection.
   *
   * @internal
   */
  protected async settleExecution(
    runId: string,
    fence: ExecutionFence | undefined,
    outcome: { status?: string; error?: Error },
  ): Promise<void> {
    const { status, error } = outcome;
    const reportError = async (reported: Error) => {
      try {
        await this.emitError(runId, reported, fence?.generation);
      } catch (publishError) {
        this.logger.warn(`Failed to publish error event for run ${runId}`, { runId, error: publishError });
      }
    };
    // Reaching any non-suspended terminal status means the run is done and its
    // persisted snapshot rows will never be resumed. Suspended runs keep their
    // snapshots (and owner records) so `resume()` / `recoverActiveRuns()` can
    // find them.
    const finished = status !== undefined && status !== 'suspended';
    let wrote = false;
    const writeTerminalState = async () => {
      wrote = true;
      if (error) await reportError(error);
      if (finished) await this.deleteRunSnapshots(runId);
    };

    if (!fence) return writeTerminalState();
    const settlement = await fence.settle(writeTerminalState);
    // `wrote` is false when the fence could not verify ownership, or when it
    // was already settled by this segment's normal completion and a later step
    // (for example goal bookkeeping) failed.
    if (!wrote && error && settlement !== 'superseded') await reportError(error);
  }

  /**
   * Abort the thread's active run.
   *
   * The base implementation flips the run's prepared `AbortController`, which a
   * durable run never has: its controller lives on this agent's run registry,
   * and the steps reading it may execute in another process. Without the abort
   * request below, aborting a thread whose active run is durable records an
   * intent nothing reads and lets the run stream on.
   */
  abortThreadStream(options: AgentAbortThreadOptions): boolean {
    const scopeKey = `${options.threadId ?? ''}|${options.resourceId ?? ''}`;
    const wrapperClose = getScopeStreamSlot(this.#activeStreamUntilIdle, scopeKey, options.expectedRunId);
    if (wrapperClose) {
      wrapperClose();
      return true;
    }

    // Resolve the run before the base call: aborting releases the thread lease,
    // after which the thread no longer has an active run to look up.
    const runId = agentThreadStreamRuntime.getActiveThreadRunId(options, this.getPubSub());
    const aborted = super.abortThreadStream(options);
    if (!aborted || !runId) return aborted;

    this.#abortDurableRun(runId);
    return true;
  }

  /**
   * Abort a run by id.
   *
   * Same gap as {@link abortThreadStream}. The abort request goes out whether
   * or not this process knows the run: a durable run is routinely executed by
   * another process, which is the one holding the controller that has to be
   * flipped. A request nobody is listening for is a no-op, exactly like
   * aborting a run that already finished, and a run that has not started yet
   * is still covered by the intent the base implementation records.
   */
  abortRunStream(runId: string): boolean {
    const wrapperClose = getRunStreamSlot(this.#activeStreamUntilIdle, runId);
    if (wrapperClose) {
      wrapperClose();
      return true;
    }

    const aborted = super.abortRunStream(runId);
    this.#abortDurableRun(runId);

    return aborted || this.#isRunExecuting(runId);
  }

  /** Whether this process can see `runId` executing, in its registries or on the thread runtime. */
  #isRunExecuting(runId: string): boolean {
    return (
      this.#runRegistry.get(runId) !== undefined ||
      globalRunRegistry.get(runId) !== undefined ||
      agentThreadStreamRuntime.hasThreadRun(runId, this.getPubSub())
    );
  }

  /**
   * Stop `runId` wherever it is executing: the controller this process holds
   * for it, if it holds one, plus the abort request that reaches the process
   * actually running the steps. Mirrors the `abort()` handed out with a stream
   * result, which flips the same pair without gating on what this process
   * happens to know about the run.
   */
  #abortDurableRun(runId: string): void {
    const controller = (this.#runRegistry.get(runId) ?? globalRunRegistry.get(runId))?.abortController;
    if (controller && !controller.signal.aborted) {
      controller.abort(new Error('Aborted'));
    }
    // Best-effort, like `requestRemoteAbort` itself: the caller gets the local
    // abort synchronously and a failed publish is logged, not thrown.
    void this.requestRemoteAbort(runId);
  }

  /**
   * Abort a durable run, in this process and in whichever process is executing it.
   *
   * A durable run's work happens inside a workflow run that may be executing on
   * a different pod (load-balanced deployment) or a different machine entirely
   * (Inngest step worker). The local `AbortController` only reaches steps that
   * happen to run in *this* process, so on its own `abort()` silently does
   * nothing for exactly the deployments durable agents exist to serve.
   *
   * Publishing an abort *request* over pubsub closes that gap: the executing
   * process flips its own controller and unwinds the run the same way an
   * in-process abort does, emitting the usual terminal `finish` event with
   * reason `abort`. Hard-cancelling the workflow run would also stop the work,
   * but it tears execution down before that terminal event is published — and
   * a stream consumer that never receives a terminal event waits forever.
   *
   * Best-effort by design. The local abort has already happened by the time
   * this is called, and a caller asking to stop a run should not be handed a
   * rejection because a pubsub publish failed. A request nobody hears is a
   * no-op, exactly like aborting a run that already finished.
   *
   * @internal
   */
  protected async requestRemoteAbort(runId: string): Promise<void> {
    try {
      await publishAbortRequest(this.pubsub, runId);
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.('Failed to publish durable agent abort request', {
        agentId: this.id,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Install `abortController` on a registry entry with the run-level execution
   * budget (`modelSettings.timeout.totalMs`, #21724 parity port) composed in.
   *
   * Every durable step reads `abortSignal` off the registry, so composing here
   * bounds the whole session — every loop iteration, tool call and retry.
   * Pass-through when no budget is configured. The budget is armed per
   * execution session (stream/generate/resume), matching the main loop where
   * each session gets a fresh timer. The timer is torn down via the entry's
   * `cleanup` slot, which every settle path invokes through the run registry.
   */
  #installAbortWithTotalTimeout(entry: RunRegistryEntry, abortController: AbortController): void {
    entry.abortController = abortController;
    const totalTimeout = createTimeoutAbortSignal({
      parentSignal: abortController.signal,
      timeoutMs: entry.timeoutTotalMs,
      timeoutType: 'total',
    });
    entry.abortSignal = totalTimeout.signal;
    const previousCleanup = entry.cleanup;
    entry.cleanup = () => {
      totalTimeout.cleanup();
      previousCleanup?.();
    };
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

    // 1. Claim the run before preparing it, so a run that is already executing
    // fails before any span or memory write is made for this call.
    const runId = options?.runId ?? crypto.randomUUID();
    const requestContext = options?.requestContext ?? new RequestContext();
    const executionFence = await this.#claimExecution(runId, 'acquire', requestContext);

    // 1a. Prepare for durable execution (non-durable phase)
    let preparation: PreparationResult<TOutput>;
    try {
      preparation = await prepareForDurableExecution<TOutput>({
        agent: this.#wrappedAgent as Agent<string, any, TOutput>,
        messages,
        options: options as AgentExecutionOptions<TOutput>,
        runId,
        requestContext,
        optionsAreResolved: true,
        mastra: this.#mastra,
        durableAgentId: this.id,
        durableAgentName: this.name,
      });
    } catch (error) {
      // The run never started: drop its owner record rather than leave it behind.
      await executionFence.settle(async () => {});
      throw error;
    }

    const { messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;
    // Set after preparation so request-context schema validation never sees it.
    setExecutionClaim(requestContext, runId, executionFence.claim);
    registryEntry.executionFence = executionFence;

    // 1b. Install the abort controller for this run. The controller is owned
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
    if (agentThreadStreamRuntime.isRunAborted(runId, this.getPubSub())) {
      abortController.abort();
    }
    this.#installAbortWithTotalTimeout(registryEntry, abortController);

    // 2. Register non-serializable state (both local and global registries)
    this.#runRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
    globalRunRegistry.set(runId, { ...registryEntry, messageList });

    // Track cleanup state to avoid double cleanup
    let cleanedUp = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;
    // Assigned once the stream is created below. Declared here so the shared
    // performCleanup() closure can unsubscribe the pubsub reader (via
    // streamCleanup) from both the auto-cleanup timer and the explicit
    // cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;

    // Single cleanup path for both the auto-cleanup timer and the explicit
    // cleanup(). Revokes continuation before unsubscribing the pubsub reader,
    // then tears down the registry entries and pubsub topic. Idempotent via
    // `cleanedUp`.
    const performCleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (cleanedUp) return;

      agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
      streamCleanup?.();
      this.#runRegistry.cleanup(runId);
      globalRunRegistry.delete(runId);
      this.#clearPubsubTopic(runId);
      cleanedUp = true;
    };

    // Schedule automatic registry cleanup after stream ends
    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(performCleanup, this.#cleanupTimeoutMs);
    };

    // Whether this caller's stream closes at the suspension boundary. Defaults
    // to false (stream stays open for a same-reader resume). The same value
    // gates the `across-suspension` continuation so the two cannot drift.
    const closeOnSuspend = options?.closeOnSuspend ?? false;

    // 3. Create the durable agent stream (subscribes to pubsub)
    const {
      output,
      cleanup: createdStreamCleanup,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      minGeneration: executionFence.generation,
      messageId,
      model: {
        modelId: workflowInput.modelConfig.modelId,
        provider: workflowInput.modelConfig.provider,
        version: 'v3',
      },
      threadId,
      resourceId,
      onChunk: options?.onChunk,
      experimentalTransform: options?.experimentalTransform,
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
      closeOnSuspend,
      hideSignals: options?.hideSignals,
      structuredOutput: registryEntry.structuredOutput as any,
      outputProcessors: registryEntry.outputProcessors,
      processorStates: registryEntry.processorStates,
      requestContext: registryEntry.requestContext,
      returnScorerData: workflowInput.options.returnScorerData,
      tracingContext: registryEntry.agentSpan ? { currentSpan: registryEntry.agentSpan } : undefined,
      messageList,
    });
    streamCleanup = createdStreamCleanup;

    // 4. Wait for subscription to be ready, then execute workflow
    // This prevents race conditions where events are published before subscription
    const workflowExecution = executionFence.run(() =>
      ready
        .then(async () => {
          // Emit 'start' chunk before the workflow begins (matches regular agent's stream.ts).
          // Only the initial stream() path emits 'start'; resume() does not.
          await emitChunkEvent(fencePubSub(this.pubsub, executionFence), runId, {
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
        .catch(error => this.settleExecution(runId, executionFence, { error })),
    );
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
      {
        continuation: closeOnSuspend ? undefined : 'across-suspension',
        generation: executionFence.generation,
        ownershipLost: () => executionFence.isLost(),
      },
    );

    // 5. Cleanup function — routes through the shared performCleanup() so the
    // explicit call and the auto-cleanup timer release the same resources.
    const cleanup = performCleanup;

    const abort = async (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
      // Also stop the run wherever it is actually executing — see
      // `requestRemoteAbort`. The local controller above only reaches steps
      // running in this process.
      await this.requestRemoteAbort(runId);
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

      // A run that suspended while executing a stored version must resume on
      // *that* version. Cold rehydration rebuilds tools/model/instructions
      // from whatever `this` currently resolves to — which, for status
      // selectors, hot-switches to the latest publish mid-flight. Re-resolve
      // to the pinned id and delegate. An explicit exact version at the call
      // site is an operator escape hatch and wins over the pin, and forks
      // already produced by `resolveVersionedAgent` are left alone (they are
      // either this very delegation or an explicit server-side resolution).
      const pinnedVersionId = workflowInput.agentVersionId;
      if (pinnedVersionId && this.#mastra && !this.__isStoredVersionApplied()) {
        const callSiteSelector = options?.versions?.agents?.[this.id];
        const hasExplicitVersion = !!callSiteSelector && 'versionId' in callSiteSelector;
        const currentVersionId = this.toRawConfig()?.resolvedVersionId as string | undefined;
        if (!hasExplicitVersion && pinnedVersionId !== currentVersionId) {
          try {
            const resolved = await this.#mastra.resolveVersionedAgent(this as unknown as Agent, {
              versionId: pinnedVersionId,
            });
            if (resolved !== (this as unknown as Agent)) {
              return (resolved as unknown as DurableAgent<TAgentId, TTools, TOutput>).resume(
                runId,
                resumeData,
                options,
              );
            }
          } catch (versionError) {
            // The pinned version may have been deleted while the run sat
            // suspended — resume on the current definition rather than
            // failing at the approver (mirrors Agent#execute's fallback).
            this.logger.warn('Failed to resolve pinned agent version for durable resume, using current definition', {
              agentId: this.id,
              runId,
              pinnedVersionId,
              error: versionError,
            });
          }
        }
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
        // Restore the original run's flag from the persisted snapshot so a
        // cross-process resume still returns scoringData; caller override wins.
        returnScorerData: options?.returnScorerData ?? workflowInput.options?.returnScorerData,
        // Restore the original run's modelSettings so the rebuilt registry
        // entry re-arms the run-level timeout budget (#21724); caller
        // override wins.
        modelSettings: options?.modelSettings ?? (workflowInput.options?.modelSettings as any),
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

    let resumeRequestContext = entry.requestContext;
    if (options?.requestContext) {
      // Keep the caller's instance so schema-transformed contexts retain their
      // input source. Caller values win except for framework-managed memory.
      resumeRequestContext = options.requestContext;
      for (const [key, value] of entry.requestContext?.entries() ?? []) {
        if (!resumeRequestContext.has(key)) resumeRequestContext.set(key, value);
      }
      if (entry.requestContext?.has('MastraMemory')) {
        resumeRequestContext.set('MastraMemory', entry.requestContext.get('MastraMemory'));
      } else {
        resumeRequestContext.delete('MastraMemory');
      }
    }

    // The resumed segment always carries its own claim: without a context the
    // engine would restore the previous segment's claim from the snapshot.
    resumeRequestContext ??= new RequestContext();
    entry.requestContext = resumeRequestContext;
    const globalEntryForContext = globalRunRegistry.get(runId);
    if (globalEntryForContext) {
      globalEntryForContext.requestContext = resumeRequestContext;
    }

    const resolvedOptions = (await this.#resolveExecutionOptions({
      ...(options as DurableAgentStreamOptions<TOutput>),
      requestContext: resumeRequestContext as DurableAgentStreamOptions<TOutput>['requestContext'],
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

    // Settle the prior segment before claiming the run and taking its event
    // offset. Otherwise a late suspension event can be replayed into the new
    // segment and close it early.
    const priorExecution = globalRunRegistry.get(runId)?.workflowExecution;
    await priorExecution?.catch(() => {
      /* errors already handled by the prior segment */
    });
    // Claimed before the abort controller and timeout are replaced, so a
    // conflicting resume leaves the executing segment's state untouched.
    const executionFence = await this.#claimExecution(runId, 'acquire', resumeRequestContext);
    setExecutionClaim(resumeRequestContext, runId, executionFence.claim);
    for (const reg of [entry, globalRunRegistry.get(runId)]) {
      if (reg) reg.executionFence = executionFence;
    }

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
    if (agentThreadStreamRuntime.isRunAborted(runId, this.getPubSub())) {
      abortController.abort();
    }
    // Re-arm the run-level execution budget for the resumed session (#21724).
    // Warm resumes read the original budget parked on the registry entry;
    // cold resumes restored it from the persisted workflow input during
    // prepare(). A caller-supplied modelSettings on the resume call wins.
    const resumeTotalMs = (resolvedOptions.modelSettings as { timeout?: { totalMs?: number } } | undefined)?.timeout
      ?.totalMs;
    if (resumeTotalMs !== undefined) {
      entry.timeoutTotalMs = resumeTotalMs;
    }
    this.#installAbortWithTotalTimeout(entry, abortController);
    const globalEntryForAbort = globalRunRegistry.get(runId);
    if (globalEntryForAbort) {
      globalEntryForAbort.abortController = abortController;
      globalEntryForAbort.abortSignal = entry.abortSignal;
    }

    // Track cleanup state to avoid double cleanup
    let cleanedUp = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;
    // Assigned once the stream is created below so the shared performCleanup()
    // closure can unsubscribe the pubsub reader (via streamCleanup) from both
    // the auto-cleanup timer and the explicit cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;

    // Single cleanup path for both the auto-cleanup timer and the explicit
    // cleanup(). Revokes continuation before unsubscribing the pubsub reader,
    // then tears down the registry entries and pubsub topic. Idempotent via
    // `cleanedUp`.
    const performCleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (cleanedUp) return;

      agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
      streamCleanup?.();
      this.#runRegistry.cleanup(runId);
      globalRunRegistry.delete(runId);
      this.#clearPubsubTopic(runId);
      cleanedUp = true;
    };

    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(performCleanup, this.#cleanupTimeoutMs);
    };

    const globalEntry = globalRunRegistry.get(runId);
    const resumeModel = globalEntry?.model as any;

    // Skip events already broadcast by the original run (e.g. the SUSPENDED
    // chunk that paused it). Without this, a resume that closes on suspend
    // (resumeGenerate) would immediately close on the replayed SUSPENDED.
    const resumeOffset = await this.#getPubsubOffset(runId);

    // Open a fresh AGENT_RUN + MODEL_GENERATION for the resumed segment on the same
    // traceId — the originals were ended as `suspended` and can't be reopened. Post-resume
    // steps + terminal end() target these via the registry override. (Linking = follow-up.)
    // Opened before the stream adapter so per-chunk processor spans parent under it.
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
          requestContext: resolvedOptions.requestContext,
          mastra: this.#mastra,
        });
        const resumeModelSpan = resumeAgentSpan?.createChildSpan({
          type: SpanType.MODEL_GENERATION,
          name: `llm: '${resumeModel?.modelId ?? ''}'`,
          attributes: { model: resumeModel?.modelId, provider: resumeModel?.provider, streaming: true },
          metadata: { runId, resumed: true },
          requestContext: resolvedOptions.requestContext,
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
    const resumeSegmentSpan = entry.resumeAgentSpan ?? entry.agentSpan;

    // Same default-false semantics as the initial stream() path.
    const closeOnSuspend = (resolvedOptions as DurableAgentStreamOptions<TOutput>).closeOnSuspend ?? false;

    const {
      output,
      cleanup: createdStreamCleanup,
      detach: detachResumeStream,
      waitForEventDelivery,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      minGeneration: executionFence.generation,
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
      experimentalTransform: resolvedOptions.experimentalTransform,
      hideSignals: resolvedOptions.hideSignals,
      onStepFinish: resolvedOptions.onStepFinish,
      onFinish: resolvedOptions.onFinish,
      onStreamFinished: scheduleAutoCleanup,
      onError: async error => {
        await resolvedOptions.onError?.(error);
        scheduleAutoCleanup();
      },
      onAbort: async data => {
        try {
          await resolvedOptions.onAbort?.(data);
        } finally {
          scheduleAutoCleanup();
        }
      },
      onSuspended: resolvedOptions.onSuspended,
      // Resume segments settle at the persisted workflow result below. A sibling
      // that was already suspended may not emit another SUSPENDED event, while
      // evented execution may emit one before its snapshot is safe to resume.
      closeOnSuspend: false,
      structuredOutput: entry.structuredOutput as any,
      outputProcessors: entry.outputProcessors,
      processorStates: entry.processorStates,
      requestContext: resolvedOptions.requestContext,
      // Caller option wins, then the flag persisted at prepare time. Only fall
      // back to resolvedOptions (which merges agent defaultOptions) last, so a
      // configured default can't override the original run-level request.
      returnScorerData: options?.returnScorerData ?? entry.returnScorerData ?? resolvedOptions.returnScorerData,
      tracingContext: resumeSegmentSpan ? { currentSpan: resumeSegmentSpan } : undefined,
      messageList: globalEntry?.messageList ?? this.#runRegistry.getMessageList(runId),
    });
    streamCleanup = createdStreamCleanup;

    // Wait for subscription to be ready, then resume workflow
    const workflow = this.getWorkflow();
    const requestContext = resolvedOptions.requestContext;

    const workflowExecution = executionFence.run(() =>
      ready
        .then(async () => {
          // The prior segment was settled above (before the event-offset
          // capture), so the snapshot is already persisted as 'suspended'.
          // Evented engine: make sure the workflow event workers are running
          // before resume — a resume in a fresh process (or after shutdown())
          // would otherwise publish events nobody consumes and hang.
          await this.ensureEngineWorkersStarted();
          const run = await workflow.createRun({
            runId,
            resourceId: memoryInfo?.resourceId,
            pubsub: this.fenceRunPubSub(executionFence, abortController),
          });
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
          await this.settleExecution(runId, executionFence, {
            status: result?.status,
            error:
              result?.status === 'failed'
                ? new Error((result as any).error?.message || 'Workflow resume failed')
                : undefined,
          });
          if (result?.status === 'suspended' && closeOnSuspend) {
            // The workflow result is the authoritative persisted suspension boundary.
            // Flush transport buffers, then wait for callbacks already delivered to
            // this observer before closing only the resume segment. This preserves
            // onSuspended delivery without advancing queued resumes against a stale
            // sibling snapshot. Settling first releases the run, so a queued
            // resume can claim it without waiting.
            await this.pubsub.flush();
            await waitForEventDelivery();
            detachResumeStream();
          }
        })
        .catch(error => this.settleExecution(runId, executionFence, { error })),
    );
    const trackedResumeEntry = globalRunRegistry.get(runId);
    if (trackedResumeEntry) {
      trackedResumeEntry.workflowExecution = workflowExecution;
    }

    const resumeStreamOptions: AgentExecutionOptions<TOutput> = {
      ...resolvedOptions,
      runId,
    } as AgentExecutionOptions<TOutput>;
    const continued = agentThreadStreamRuntime.continueRun(
      this as unknown as Agent<any, any, any, any>,
      output,
      resumeStreamOptions,
      this.getPubSub(),
      { generation: executionFence.generation, ownershipLost: () => executionFence.isLost() },
    );
    if (!continued) {
      await agentThreadStreamRuntime.registerRun(
        this as unknown as Agent<any, any, any, any>,
        output,
        resumeStreamOptions,
        this.getPubSub(),
        {
          continuation: closeOnSuspend ? undefined : 'across-suspension',
          generation: executionFence.generation,
          ownershipLost: () => executionFence.isLost(),
        },
      );
    }

    // Route the explicit cleanup through the shared performCleanup() so it and
    // the auto-cleanup timer release the same resources.
    const cleanup = performCleanup;

    const abort = async (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
      // Also stop the run wherever it is actually executing — see
      // `requestRemoteAbort`. The local controller above only reaches steps
      // running in this process.
      await this.requestRemoteAbort(runId);
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
   * Only orphaned runs are recovered. If another execution still owns the run
   * (its lease is live), this throws `DURABLE_AGENT_RUN_ACTIVE` with the
   * holder and a `retryAt` hint; pass `{ force: true }` to take the run over,
   * which aborts the other execution and rejects its later writes. A run this
   * process is already driving or recovering, or one that is suspended, is
   * refused with its own error id (use `resume()` for suspended runs).
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

    // 1. Validate the persisted durable-agent input before claiming ownership
    //    so obvious caller errors fail fast.
    let { workflowInput } = await this.#loadRecoverableSnapshot(workflowsStore, runId);

    // A crashed run that was executing a stored version must recover on
    // *that* version — rehydration rebuilds tools/model/instructions from
    // whatever `this` currently resolves to, which for status selectors
    // hot-switches to the latest publish (mirrors the resume() pin above).
    // Resolution happens BEFORE lease acquisition so we never delegate to a
    // fork while holding the lease; reading the pin from the pre-claim
    // snapshot is safe because `agentVersionId` is stamped once at
    // preparation and never mutated. Unlike resume(), recover options carry
    // no call-site version selector, so the pin always wins here — recovery
    // is unattended and has no operator escape hatch.
    const pinnedVersionId = workflowInput.agentVersionId;
    if (pinnedVersionId && this.#mastra && !this.__isStoredVersionApplied()) {
      const currentVersionId = this.toRawConfig()?.resolvedVersionId as string | undefined;
      if (pinnedVersionId !== currentVersionId) {
        try {
          const resolved = await this.#mastra.resolveVersionedAgent(this as unknown as Agent, {
            versionId: pinnedVersionId,
          });
          if (resolved !== (this as unknown as Agent)) {
            return (resolved as unknown as DurableAgent<TAgentId, TTools, TOutput>).recover(runId, options);
          }
        } catch (versionError) {
          // The pinned version may have been deleted while the run sat
          // crashed — recover on the current definition rather than failing
          // an unattended path (mirrors resume()'s deleted-pin fallback).
          this.logger.warn('Failed to resolve pinned agent version for durable recovery, using current definition', {
            agentId: this.id,
            runId,
            pinnedVersionId,
            error: versionError,
          });
        }
      }
    }

    // 2. Claim the run before resolving any live dependencies so a concurrent
    //    caller cannot finish first and leave this attempt using a stale
    //    snapshot.
    const releaseLocalRecovery = this.#claimLocalRecovery(runId);
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

    let executionFence: ExecutionFence | undefined;
    let recoveryState: RehydratedRecoveryState;
    let finishPublishedBeforeCrash: boolean;
    try {
      // A run this process is still executing is not orphaned. Recovering it
      // here would replace the live execution's registry entry mid-flight
      // (#23734), so not even `force` takes it over. Checked after the local
      // recovery claim so a concurrent recover() still reports
      // DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS.
      const localExecution = ExecutionFence.getLocalActive(runId);
      if (localExecution && !localExecution.isLost()) {
        throw new MastraError({
          id: RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID,
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" recover(${runId}): this process is still executing the run. Wait for it to finish instead of recovering it.`,
          details: { agentName: this.name, runId },
        });
      }
      // Claim the run only while no execution is live, or take it over from
      // the live one under `force`, before reading its state: from here on any
      // other execution can no longer write (#23734).
      executionFence = await this.#claimExecution(
        runId,
        options?.force ? 'takeover' : 'recover',
        undefined,
        this.#untrackedRunLiveness(runId, workflowInput),
      );
      // An earlier owner may have completed while this one claimed. Re-read
      // after the claim and recover from that authoritative snapshot, never
      // from the pre-claim copy.
      const loaded = await this.#loadRecoverableSnapshot(workflowsStore, runId);
      workflowInput = loaded.workflowInput;
      // map-final-output publishes FINISH before its result is saved, so a saved
      // success means FINISH went out before the crash. The default engine
      // continues after a finished step instead of re-running it, so FINISH is
      // never published again, and the recovered stream (subscribed from the
      // topic's current end) would wait for it forever. The evented engine
      // re-runs the step, which publishes FINISH itself. Check the resolved
      // engine: an EventedAgent can fall back to the default one. Once the
      // evented engine also continues after a finished step (COR-1354), drop
      // the engine check.
      finishPublishedBeforeCrash =
        this.resolveWorkflowEngine() === 'default' &&
        loaded.snapshot.context?.[MAP_FINAL_OUTPUT_STEP_ID]?.status === 'success';
      executionFence.throwIfLost();
      recoveryState = await this.#rehydrateRecoveryState({
        runId,
        workflowInput,
        abortController,
        executionFence,
      });
      // Memory is resolved from the rehydrated context; rehydration does not write to it.
      await this.#coverMemory(executionFence, recoveryState.requestContext);
    } catch (error) {
      await executionFence?.settle(async () => {});
      releaseLocalRecovery();
      throw error;
    }
    const { requestContext, threadId, resourceId, messageList, recoverAgentSpan, registryEntry } = recoveryState;
    if (executionFence.generation !== undefined) {
      // Readers of the run's stream, including the superseded execution's own
      // caller, drop what that execution still publishes from here on.
      await emitOwnershipClaimedEvent(this.pubsub, runId, executionFence.generation).catch(error => {
        this.logger.warn(`[DurableAgent] recover(${runId}) failed to announce its claim on the run stream`, {
          runId,
          error,
        });
      });
    }
    setExecutionClaim(requestContext, runId, executionFence.claim);
    registryEntry.executionFence = executionFence;

    // 3. Cleanup plumbing (mirrors stream()/resume()).
    let cleanedUp = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;
    // Assigned once the recovered stream is created below so the shared
    // performCleanup() closure can unsubscribe the pubsub reader (via
    // streamCleanup) from both the auto-cleanup timer and the explicit
    // cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;
    const cleanupOwnedRegistryState = () => {
      if (this.#runRegistry.get(runId) === registryEntry) {
        this.#runRegistry.cleanup(runId);
      }
      if (globalRunRegistry.get(runId) === registryEntry) {
        globalRunRegistry.delete(runId);
        this.#clearPubsubTopic(runId);
      }
      cleanedUp = true;
    };
    // Single cleanup path for the auto-cleanup timer, the explicit cleanup(),
    // and the recovery error paths. Revokes continuation before unsubscribing
    // the pubsub reader, then tears down the owned registry entries. Idempotent
    // via `cleanedUp`.
    const performCleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (cleanedUp) return;
      agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
      streamCleanup?.();
      cleanupOwnedRegistryState();
    };
    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(performCleanup, this.#cleanupTimeoutMs);
    };

    let workflow: ReturnType<DurableAgent<TAgentId, TTools, TOutput>['getWorkflow']>;
    try {
      workflow = this.getWorkflow();
    } catch (error) {
      await executionFence.settle(async () => {});
      releaseLocalRecovery();
      throw error;
    }

    // 4. Register the reconstructed state and recovered stream only after
    //    claiming the run.
    const { stream, threadRegistration } = await this.#setupRecoveredStream({
      runId,
      workflowInput,
      requestContext,
      threadId,
      resourceId,
      messageList,
      registryEntry,
      options,
      scheduleAutoCleanup,
      executionFence,
    }).catch(error => {
      releaseLocalRecovery();
      throw error;
    });
    const { output, cleanup: createdStreamCleanup, ready } = stream;
    streamCleanup = createdStreamCleanup;
    const recoveryPubsub = this.fenceRunPubSub(executionFence, abortController);

    // 5. Re-drive the workflow from the persisted snapshot in the background
    //     and delete snapshot rows on non-suspended terminals (same contract
    //     as start()/resume()). Errors are also broadcast via `emitError` so
    //     observers on the pubsub topic see the failure. Callers who await
    //     the returned `workflowExecution` (e.g. `recoverActiveRuns()`) see
    //     the raw rejection so they can classify the run as failed.
    // Races the claim's loss so a recovery that lost the run settles promptly
    // even if the workflow ignores the abort.
    const workflowExecution = executionFence.run(() =>
      this.#raceFenceLoss(ready, executionFence)
        .then(async () => {
          executionFence.throwIfLost();
          await this.ensureEngineWorkersStarted();
          const run = await this.#raceFenceLoss(
            workflow.createRun({ runId, resourceId, pubsub: recoveryPubsub }),
            executionFence,
          );
          const result = await this.#raceFenceLoss(
            run.restart({
              requestContext,
              ...createObservabilityContext({ currentSpan: recoverAgentSpan }),
            } as any),
            executionFence,
          );
          executionFence.throwIfLost();
          if (finishPublishedBeforeCrash && result?.status === 'success') {
            // The run's result is map-final-output's saved output, passed through
            // execute-scorers unchanged: the same payload the lost FINISH carried.
            const { output: finalOutput, stepResult } = result.result;
            await emitFinishEvent(recoveryPubsub, runId, { output: finalOutput, stepResult });
          }
          // Snapshot cleanup runs for every non-suspended terminal (success or
          // failed) so storage stays bounded — mirrors the start()/resume()
          // contract — but only while this recovery still owns the run.
          const finished = !!result?.status && result.status !== 'suspended';
          await executionFence.settle(async () => {
            if (finished) await this.deleteRunSnapshots(runId);
          });
          if (result?.status === 'failed') {
            throw new Error((result as any).error?.message || 'Workflow recover failed');
          }
        })
        .catch(async error => {
          // Settles a recovery that failed before the run finished; otherwise
          // returns the settlement reached above.
          const settlement = await executionFence.settle(async () => {});
          if (settlement === 'superseded') {
            // The execution that took the run over holds the thread lease under
            // the same runId and owns the run's topic: leave both to it.
            await threadRegistration?.rollback({ releaseLease: false });
            performCleanup();
          } else if (!(await this.#reportRecoveryFailure(runId, error, executionFence.generation))) {
            await threadRegistration?.rollback();
            performCleanup();
          }
          throw error;
        })
        .finally(releaseLocalRecovery),
    );
    const trackedRecoverEntry = globalRunRegistry.get(runId);
    if (trackedRecoverEntry) {
      trackedRecoverEntry.workflowExecution = workflowExecution;
    }
    // Guard against unhandled rejection warnings for callers who don't await
    // `workflowExecution` (single-run `recover()` returns a stream, not the
    // workflow promise). Errors are already surfaced through `emitError` /
    // the stream's `onError` callback.
    workflowExecution.catch(() => {});

    // Route the explicit cleanup through the shared performCleanup() so it, the
    // auto-cleanup timer, and the recovery error paths release the same resources.
    const cleanup = performCleanup;

    const abort = async (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
      // Also stop the run wherever it is actually executing — see
      // `requestRemoteAbort`. The local controller above only reaches steps
      // running in this process.
      await this.requestRemoteAbort(runId);
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
      closeOnSuspend: resumeOptions.closeOnSuspend ?? true,
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
    options: { runId: string; toolCallId?: string; reason?: string } & Record<string, any>,
  ): Promise<MastraModelOutput<any>> {
    const { reason, ...resumeOptions } = options;
    return this.resumeStream({ approved: false, ...(reason !== undefined ? { reason } : {}) }, resumeOptions);
  }

  override async approveToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    const { runId, ...resumeOptions } = options;
    return this.resumeGenerate(runId, { approved: true }, resumeOptions as any) as any;
  }

  override async declineToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string; reason?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    const { runId, reason, ...resumeOptions } = options;
    return this.resumeGenerate(
      runId,
      { approved: false, ...(reason !== undefined ? { reason } : {}) },
      resumeOptions as any,
    ) as any;
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

    // 1. Claim the run before preparing it — see stream().
    const runId = options?.runId ?? crypto.randomUUID();
    const requestContext = options?.requestContext ?? new RequestContext();
    const executionFence = await this.#claimExecution(runId, 'acquire', requestContext);

    // 1a. Prepare for durable execution (non-durable phase)
    let preparation: PreparationResult<TOutput>;
    try {
      preparation = await prepareForDurableExecution<TOutput>({
        agent: this.#wrappedAgent as Agent<string, any, TOutput>,
        messages,
        options: options as AgentExecutionOptions<TOutput>,
        runId,
        requestContext,
        optionsAreResolved: true,
        mastra: this.#mastra,
        methodType: 'generate',
        durableAgentId: this.id,
        durableAgentName: this.name,
      });
    } catch (error) {
      // The run never started: drop its owner record rather than leave it behind.
      await executionFence.settle(async () => {});
      throw error;
    }

    const { messageId, workflowInput, registryEntry, messageList, threadId, resourceId } = preparation;
    // Set after preparation so request-context schema validation never sees it.
    setExecutionClaim(requestContext, runId, executionFence.claim);
    registryEntry.executionFence = executionFence;

    // 1b. Install the abort controller for this run. The controller is owned
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
    if (agentThreadStreamRuntime.isRunAborted(runId, this.getPubSub())) {
      abortController.abort();
    }
    this.#installAbortWithTotalTimeout(registryEntry, abortController);

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
      minGeneration: executionFence.generation,
      messageId,
      model: {
        modelId: workflowInput.modelConfig.modelId,
        provider: workflowInput.modelConfig.provider,
        version: 'v3',
      },
      threadId,
      resourceId,
      onChunk: options?.onChunk,
      experimentalTransform: options?.experimentalTransform,
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
      processorStates: registryEntry.processorStates,
      requestContext: registryEntry.requestContext,
      returnScorerData: workflowInput.options.returnScorerData,
      tracingContext: registryEntry.agentSpan ? { currentSpan: registryEntry.agentSpan } : undefined,
      messageList,
    });

    // 4. Wait for subscription to be ready, then execute workflow
    // This prevents race conditions where events are published before subscription
    const workflowExecution = executionFence.run(() =>
      ready
        .then(async () => {
          // Emit 'start' chunk before the workflow begins (matches regular agent's stream.ts).
          // Only the initial generate()/stream() path emits 'start'; resume() does not.
          await emitChunkEvent(fencePubSub(this.pubsub, executionFence), runId, {
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
        .catch(error => this.settleExecution(runId, executionFence, { error })),
    );
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
        agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
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
      closeOnSuspend: true,
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
          `Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL). See https://mastra.ai/docs/storage`,
        details: { agentName: this.name },
      });
    }

    // resourceId is a storage column, so it is pushed down to narrow the query
    // (the in-process check below remains as backstop for adapters that skip
    // the filter and for rows persisted before the column was populated).
    // Filtering by agentId/threadId happens in application code because those
    // fields only exist inside each row's `snapshot` JSON — storage adapters
    // have no predicate for them. Fetch candidates in bounded batches so peak
    // memory is O(batch size) hydrated snapshots instead of every `running`
    // row's full snapshot at once (#21501). Only the small per-run summary is
    // retained across batches; each batch's snapshots are discarded before the
    // next fetch.
    const matchedRuns: DurableAgentActiveRun[] = [];
    for (let storagePage = 0; ; storagePage++) {
      const { runs, total: storageTotal } = await workflowsStore.listWorkflowRuns({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        status: 'running',
        resourceId,
        fromDate,
        toDate,
        perPage: LIST_ACTIVE_RUNS_STORAGE_BATCH_SIZE,
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

      // A short batch means the last page. A batch larger than requested means
      // the adapter ignored pagination and returned everything in one call —
      // continuing would refetch the same rows forever.
      if (runs.length !== LIST_ACTIVE_RUNS_STORAGE_BATCH_SIZE) break;
      if ((storagePage + 1) * LIST_ACTIVE_RUNS_STORAGE_BATCH_SIZE >= storageTotal) break;
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
   * Only orphaned runs are recovered. A run another execution still drives,
   * in this process or another, is reported as `skipped`; for one live in
   * another process, `retryAt` says when to check again. A run that finished
   * or suspended before its turn is left out.
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

    // Without fencing in the workflows store nothing is fenced, memory included.
    const storage = this.#mastra?.getStorage();
    if (!this.#warnIfUnfenced(await storage?.getStore('workflows'), 'workflows')) {
      this.#warnIfUnfenced(await storage?.getStore('memory'), 'memory');
    }

    let targetRunIds: string[];
    if (runId) {
      // Like discovery, an explicit run is only recovered while its snapshot is
      // `running`: a finished run has nothing to recover, and a suspended one
      // waits for resume().
      targetRunIds = (await this.#isRunningSnapshot(runId)) ? [runId] : [];
    } else {
      const { runs } = await this.listActiveRuns(discoveryOptions);
      targetRunIds = runs.map(r => r.runId);
    }

    const recovered: DurableAgentRecoveredRun[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const targetRunId of targetRunIds) {
      let runError: Error | undefined;
      let started = false;
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
        started = true;
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
        if (!started) {
          // The run finished or suspended between discovery and its recovery.
          const errorId = (error as { id?: unknown })?.id;
          if (errorId === RECOVER_SNAPSHOT_NOT_FOUND_ERROR_ID || errorId === RECOVER_RUN_SUSPENDED_ERROR_ID) continue;
          const skipped = recoverySkip(error);
          if (skipped) {
            recovered.push({ runId: targetRunId, status: 'skipped', ...skipped });
            continue;
          }
        }
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
   * To stop observing without affecting the run, call the returned `detach()`
   * or leave the `for await` loop over `fullStream` (break, return, or throw).
   * Both unsubscribe this observer only; the run keeps going and other
   * observers can still replay it. To stop observing when a request is
   * cancelled, wire its signal to `detach`:
   *
   * ```ts
   * const { fullStream, detach } = await agent.observe(runId, { offset });
   * req.signal.addEventListener('abort', detach, { once: true });
   * if (req.signal.aborted) detach();
   * for await (const chunk of fullStream) send(chunk);
   * ```
   *
   * **Warning:** The returned `cleanup()` function destroys the run's registry
   * entries and cached PubSub events (replay history), including for other
   * observers. Only call it when you are done with the run entirely. If the
   * workflow is suspended and you intend to resume later, do not call cleanup —
   * let the auto-cleanup timer handle it after FINISH/ERROR. Auto-cleanup does
   * not fire on SUSPENDED events.
   *
   * Pass `idleTimeoutMs` to bound how long the stream waits on a silent topic:
   * a durable run whose driving process crashed stops emitting chunks but never
   * publishes a terminal event, so without this `observe()` hangs forever on a
   * producerless topic. When the idle timeout fires, the optional `isAlive`
   * probe is consulted first — returning true (e.g. a live run-liveness
   * heartbeat, or a suspended HITL gate) re-arms the timer and keeps waiting,
   * while false/absent terminates the stream with an error chunk. Only an
   * `isAlive` that returns false schedules the run's full cleanup; a bare
   * `idleTimeoutMs` (no `isAlive`) only detaches this observer, so pass
   * `isAlive` if you rely on the timeout to reclaim a crashed run's state. Both
   * options are opt-in; omit them for the current unbounded behavior.
   */
  async observe(
    runId: string,
    options?: {
      /**
       * Inclusive, zero-based PubSub event index. It counts all cached run-topic events, including
       * lifecycle events, not chunks. Omit it to replay all available cached events. Transports
       * without numeric offsets live-tail instead. Skipping earlier text deltas produces partial text
       * and may make structured output fail to parse; beyond retained history, an offset also skips
       * lower-index live events on numeric-offset transports. See
       * https://mastra.ai/reference/agents/durable-agent#observerunid-options.
       */
      offset?: number;
      idleTimeoutMs?: number;
      isAlive?: () => boolean | Promise<boolean>;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      experimentalTransform?: MastraStreamTransformOptions<TOutput>;
      onStepFinish?: (result: AgentStepFinishEventData) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string; detach: () => void }> {
    const memoryInfo = this.#runRegistry.getMemoryInfo(runId);

    // Track cleanup state to avoid double cleanup
    let cleanedUp = false;
    let terminalCompleted = false;
    let abortPending = false;
    let cleanupRequested = false;
    let autoCleanupTimer: ReturnType<typeof setTimeout> | null = null;
    let streamCleanup: (() => void) | undefined;

    const performCleanup = () => {
      if (autoCleanupTimer) {
        clearTimeout(autoCleanupTimer);
        autoCleanupTimer = null;
      }
      if (cleanedUp) return;

      streamCleanup?.();
      this.#runRegistry.cleanup(runId);
      globalRunRegistry.delete(runId);
      this.#clearPubsubTopic(runId);
      cleanedUp = true;
    };

    const scheduleAutoCleanup = () => {
      if (autoCleanupTimer || cleanedUp || this.#cleanupTimeoutMs === 0) return;
      autoCleanupTimer = setTimeout(performCleanup, this.#cleanupTimeoutMs);
    };

    const completeTerminalLifecycle = () => {
      terminalCompleted = true;
      abortPending = false;
      if (cleanupRequested) {
        performCleanup();
      } else {
        scheduleAutoCleanup();
      }
    };

    const observedEntry = globalRunRegistry.get(runId) ?? this.#runRegistry.get(runId);
    const observedAgentSpan = observedEntry?.resumeAgentSpan ?? observedEntry?.agentSpan;

    const stream = createDurableAgentStream<TOutput>({
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
      idleTimeoutMs: options?.idleTimeoutMs,
      isAlive: options?.isAlive,
      onChunk: options?.onChunk,
      experimentalTransform: options?.experimentalTransform,
      onStepFinish: options?.onStepFinish,
      onFinish: options?.onFinish,
      onStreamFinished: completeTerminalLifecycle,
      onError: async ({ error, runDead }) => {
        try {
          await options?.onError?.({ error });
        } finally {
          // A bare idle timeout (runDead === false) only means this observer
          // stopped hearing from the run — it may still be alive elsewhere, so
          // don't tear down its registry entry or replay history.
          if (runDead !== false) completeTerminalLifecycle();
        }
      },
      onAbort: async data => {
        try {
          await options?.onAbort?.(data);
        } finally {
          completeTerminalLifecycle();
        }
      },
      onSuspended: options?.onSuspended,
      structuredOutput: this.#runRegistry.get(runId)?.structuredOutput as any,
      outputProcessors: this.#runRegistry.get(runId)?.outputProcessors,
      processorStates: this.#runRegistry.get(runId)?.processorStates,
      returnScorerData: this.#runRegistry.get(runId)?.returnScorerData,
      tracingContext: observedAgentSpan ? { currentSpan: observedAgentSpan } : undefined,
      messageList: globalRunRegistry.get(runId)?.messageList ?? this.#runRegistry.getMessageList(runId),
    });
    const { output, ready, detach } = stream;
    streamCleanup = stream.cleanup;

    // This output belongs to this observer alone, so a consumer that stops
    // reading fullStream (break/return/throw out of `for await`) should detach
    // the observer. MastraModelOutput fans out to several readers and only drops
    // the cancelled reader's listeners, so the cancel never reaches the pubsub
    // subscription — pass it through here.
    const baseFullStream = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(output), 'fullStream')!.get!;
    Object.defineProperty(output, 'fullStream', {
      configurable: true,
      get() {
        const reader = (baseFullStream.call(output) as ReadableStream<ChunkType<TOutput>>).getReader();
        return new ReadableStream<ChunkType<TOutput>>({
          async pull(controller) {
            let result: ReadableStreamReadResult<ChunkType<TOutput>>;
            try {
              result = await reader.read();
            } catch (error) {
              detach();
              throw error;
            }
            if (result.done) {
              detach();
              controller.close();
            } else {
              controller.enqueue(result.value);
            }
          },
          cancel(reason) {
            detach();
            return reader.cancel(reason);
          },
        });
      },
    });

    // Wait for subscription to be ready
    await ready;

    const cleanup = () => {
      if (abortPending) {
        cleanupRequested = true;
        scheduleAutoCleanup();
        return;
      }
      performCleanup();
    };

    // observe() doesn't own the run's lifecycle, but the returned `abort` can
    // still stop it. Flip the in-process controller if one happens to be
    // installed here, then cancel the workflow run so the abort also reaches
    // the process actually executing it — the common case for observe(), which
    // exists precisely to watch runs this process did not start.
    const abort = async (reason?: unknown) => {
      abortPending = !terminalCompleted;
      const controller = (globalRunRegistry.get(runId) ?? this.#runRegistry.get(runId))?.abortController;
      if (controller && !controller.signal.aborted) {
        controller.abort(reason);
      }
      await this.requestRemoteAbort(runId);
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
      detach,
      abort,
    };
  }

  /**
   * Clear retained pubsub state for a run's topics (cached history and, for
   * persistent transports, the underlying stream). Fire-and-forget: the
   * `clearTopic` contract is best-effort and non-throwing.
   *
   * Clears both the agent stream topic and `workflow.events.v2.<runId>`.
   * The agent stream topic is cleared only here, on both engines. For the
   * workflow events topic the engines differ:
   * - Default engine (`DurableAgent`): no other cleanup exists — without
   *   this, CachingPubSub permanently orphans a no-TTL counter key per
   *   completed run.
   * - Evented engine (`EventedAgent`): the WorkflowEventProcessor also
   *   clears `workflow.events.v2.<runId>` via its own delayed,
   *   restart-guarded terminal cleanup. The two clears overlap safely:
   *   `clearTopic` is idempotent and clearing an empty topic is a no-op.
   *
   * This needs no restart guard of its own — the lifecycle facts are
   * engine-agnostic: cleanup timers arm only on terminal outcomes
   * (FINISH/ERROR/ABORT — never SUSPENDED), `resume()` rejects runs whose
   * snapshot isn't `suspended`, `untilIdle` continuations mint a fresh runId
   * per segment, and cross-process `recover()` can't race a dead process's
   * timer. The one evented-only edge — at-least-once redelivery writing to
   * the workflow events topic after this clear — is covered by the WEP's own
   * cleanup, which reschedules deletion on that run's terminal end.
   */
  #clearPubsubTopic(runId: string): void {
    void this.pubsub.clearTopic(AGENT_STREAM_TOPIC(runId));
    void this.pubsub.clearTopic(`workflow.events.v2.${runId}`);
  }

  /**
   * Resolve the replay position for this run's stream topic.
   * Returns the cached event count when history is available, or `latest` when it is unavailable.
   * Resume and recovery use this position so they don't re-deliver events emitted by the prior segment
   * (notably the SUSPENDED chunk that paused it) from a persistent transport.
   */
  async #getPubsubOffset(runId: string): Promise<number | 'latest'> {
    const pubsub = this.pubsub as PubSub & {
      getHistory?: (topic: string) => Promise<unknown[]>;
    };
    if (typeof pubsub.getHistory !== 'function') return 'latest';
    try {
      const history = await pubsub.getHistory(AGENT_STREAM_TOPIC(runId));
      return Array.isArray(history) && history.length > 0 ? history.length : 'latest';
    } catch {
      return 'latest';
    }
  }

  /**
   * Get the workflow instance for direct execution.
   * Lazily creates the workflow and registers Mastra on it (needed for
   * getAgentById in execution steps).
   */
  getWorkflow() {
    if (!this.#workflow) {
      this.warnOnRiskyPersistencePolicy();
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
        // Evented engine: the WorkflowEventProcessor resolves workflows by id
        // from Mastra's registries, so the loop workflow must be discoverable
        // there. Register it as an (unscoped) internal workflow — it's a
        // per-agent singleton. Without this, every run's events would be
        // unresolvable and the run would hang. Uses the resolved engine so
        // this stays consistent with the workflow instance just created.
        if (this.resolveWorkflowEngine() === 'evented') {
          this.#mastra.__registerInternalWorkflow(this.#workflow);
        }
      }
    }
    return this.#workflow;
  }

  /**
   * One-time guardrail warnings for user-supplied `shouldPersistSnapshot`
   * policies. Probes the predicate with an empty `stepResults`, so predicates
   * that read `stepResults` may probe inaccurately — the warnings are
   * best-effort and never block execution.
   *
   * Subclasses that ignore the user predicate (EventedAgent) override this
   * with their own warning.
   *
   * @internal
   */
  protected warnOnRiskyPersistencePolicy(): void {
    if (this.#warnedPersistencePolicy) return;
    this.#warnedPersistencePolicy = true;
    const predicate = this.userShouldPersistSnapshot;
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
      this.guardrailLogger?.warn(
        `DurableAgent '${this.id}': the custom shouldPersistSnapshot policy does not persist 'suspended'/'paused' snapshots. ` +
          `Suspended runs cannot be resumed — human-in-the-loop flows will break.`,
      );
    }
    if (this.#mastra?.recoveryConfig?.durableAgents === 'auto' && !probe('running')) {
      this.guardrailLogger?.warn(
        `DurableAgent '${this.id}': recovery.durableAgents is 'auto' but the custom shouldPersistSnapshot policy does not persist 'running' snapshots. ` +
          `In-flight runs of this agent are invisible to crash recovery (listActiveRuns/recoverActiveRuns).`,
      );
    }
  }

  /**
   * Logger for the persistence-policy guardrail warnings. The durable
   * registration path rewires the *underlying* agent's logger but not the
   * wrapper's, so prefer the Mastra-configured logger (which also respects
   * `logger: false`) and fall back to the base logger for unregistered
   * agents.
   *
   * @internal
   */
  protected get guardrailLogger() {
    return this.#mastra?.getLogger() ?? this.logger;
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

    // If the CachingPubSub was already built (lazy init ran before
    // registration), it was constructed without a source — wire it now so the
    // cache follows the bus the evented engine publishes on. Intentionally
    // done for custom-pubsub agents too: the custom pubsub stays the local
    // transport, but the cache must still observe `mastra.pubsub` or
    // engine-published stream events never reach it.
    if (this.#cachingPubsub instanceof CachingPubSub) {
      this.#cachingPubsub.__setSource(mastra.pubsub);
    }
  }
}
