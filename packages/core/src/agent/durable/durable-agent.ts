import type { MastraServerCache } from '../../cache/base';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { withAck } from '../../events/acking-callback';
import type { PubSub } from '../../events/pubsub';
import { validateModelTimeoutSettings } from '../../llm/model/model-settings';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import { LOCAL_MODEL_REQUEST_KEY } from '../../loop/run-scope-keys';
import {
  getRunStreamSlot,
  getScopeStreamSlot,
  untilIdleHandlesBackgroundTask,
} from '../../loop/shared/stream-until-idle-helpers';
import { withDefaultToolCallConcurrencyLimit } from '../../loop/workflows/agentic-execution/tool-call-concurrency';
import type { Mastra } from '../../mastra';
import { createRunScope } from '../../mastra/run-scope';
import {
  createObservabilityContext,
  getOrCreateSpan,
  getResumeTracingContext,
  SpanType,
  EntityType,
} from '../../observability';
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_SCOPES_KEY,
  MASTRA_THREAD_ID_KEY,
  RequestContext,
  withoutLiveRequestKeys,
} from '../../request-context';
import type { DeclaredAgentSchedule } from '../../schedules/define';
import type { WorkflowsStorage } from '../../storage';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import type {
  ChunkType,
  MastraOnFinishCallback,
  MastraStreamTransformOptions,
  ToolCallChunk,
} from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { CoreTool } from '../../tools/types';
import type { DynamicArgument } from '../../types';
import { deepMerge, rebindProcessorTools } from '../../utils';
import type { ShouldPersistSnapshotFn, WorkflowRunState, WorkflowRunStatus } from '../../workflows/types';
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import { beginGoalActivity, stopGoalActivity } from '../goal';
import { drainAgentOutput, resolveRunId } from '../helpers';
import type { MessageListInput } from '../message-list';
import { MessageList } from '../message-list';
import { modelSpanAttributes } from '../model-span-attributes';
import type { AgentScopesSnapshot } from '../scopes';
import { applyResolvedAgentScopes, incomingAgentScopes, resolveAgentScopes, restoreRunAgentScopes } from '../scopes';
import type { AgentStreamBus } from '../streams/bus';
import type { ResponseMessagesReplay } from '../streams/response-messages';
import { replayResponseMessages, withRebuiltResponseMessages } from '../streams/response-messages';
import type { AgentRunRecord } from '../streams/run-records';
import { durableReplayOwnerKey, readAgentRunRecord, readDurableReplayOwner } from '../streams/run-records';
import type { AgentStreamsConfig } from '../streams/types';
import type { AgentStreamStepFinishPayload } from '../streams/wire';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import type { AgentAbortThreadOptions, AgentDurableOption, ToolsInput } from '../types';
import { isDurableAgentLike } from '../types';
import { resolveThreadIdFromArgs } from '../utils';

import { publishAbortRequest, requestAcknowledgedAbort } from './abort-transport';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from './constants';
import { runDurableStreamUntilIdle, runResumeDurableStreamUntilIdle } from './durable-stream-until-idle';
import { DurableExecutionEngine } from './execution-engine';
import type { UntrackedRunLiveness, ExecutionFence } from './execution-fence';
import {
  executionLeaseKey,
  fencePubSub,
  readRunGeneration,
  resolveLeaseProvider,
  setExecutionClaim,
  supportsRunFencing,
} from './execution-fence';
import { detachFullStreamOnEnd } from './observe-full-stream';
import { persistDurableRunInput } from './persist-run-input';
import type { PreparationOptions, PreparationResult } from './preparation';
import { prepareForDurableExecution } from './preparation';
import { createRunAbortController } from './run-abort';
import { createRunCleanup } from './run-cleanup';
import type { ExtendedRunRegistry } from './run-registry';
import { deleteRunRegistryEntry, getRunRegistryEntry, globalRunRegistry, markResumeInFlight } from './run-registry';
import type { DurableAgentStreamOptions as DurableStreamAdapterOptions } from './stream-adapter';
import { createDurableAgentStream, createRunGenerationFilter, emitChunkEvent, emitAbortEvent } from './stream-adapter';
import { toLiveStructuredOutputSchema } from './structured-output-null-transform';
import type {
  AgentAbortEventData,
  AgentChunkEventData,
  AgentStreamEvent,
  DurableAgentStepFinishResult,
  AgentSuspendedEventData,
  DurableAgenticWorkflowInput,
  RunRegistryEntry,
} from './types';
import { normalizeResumeGenerateArgs } from './utils/resume-generate-args';
import type { createDurableAgenticWorkflow } from './workflows';
import { hydrateMessageListState, latestMessageListState } from './workflows/shared/message-list-state';

function createLocalRequestReader(runId: string, entry: RunRegistryEntry, mastra: Mastra | undefined) {
  const scope = (entry.runScope ??= createRunScope());
  scope.delete(LOCAL_MODEL_REQUEST_KEY);
  const fence = entry.executionFence;
  return () => {
    const current = getRunRegistryEntry(runId, mastra);
    if (current?.runScope !== scope || current.executionFence !== fence || fence?.isLost()) return undefined;
    return scope.get(LOCAL_MODEL_REQUEST_KEY);
  };
}

const RESOLVED_EXECUTION_OPTIONS = Symbol('mastra.durable.resolvedExecutionOptions');
const RESOLVED_DEFAULT_OPTIONS = Symbol('mastra.durable.resolvedDefaultOptions');
/** Marks `prepare()` options whose scopes the caller applies itself (a resume rebuilt from storage). */
const SCOPES_ALREADY_APPLIED = Symbol('mastra.durable.scopesAlreadyApplied');
/** Carries the persisted spans a resume rebuilt from storage reattaches to into `prepare()`. */
const RESUMED_SPAN_DATA = Symbol('mastra.durable.resumedSpanData');
const OBSERVED_MESSAGE_LIST_REFRESH_TIMEOUT_MS = 5_000;

/**
 * Reserved request-context keys win over `memory` options, matching the base Agent: server
 * middleware sets them from the authenticated identity so a request body cannot route memory
 * to another user's thread or resource.
 */
export function applyReservedMemoryContextKeys<T extends { requestContext?: RequestContext; memory?: any }>(
  options: T | undefined,
): T | undefined {
  const requestContext = options?.requestContext;
  if (!options || !requestContext) return options;
  const threadId = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;
  const resourceId = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  if (!threadId && !resourceId) return options;
  const memory = { ...(options.memory ?? {}) };
  if (threadId) memory.thread = resolveThreadIdFromArgs({ memory, overrideId: threadId });
  if (resourceId) memory.resource = resourceId;
  return { ...options, memory };
}

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
  /** Scopes this run acts with. See `AgentExecutionOptions.scopes`. */
  scopes?: string[];
  /** Unique identifier for this execution run */
  runId?: string;
  /** Request Context containing dynamic configuration and state */
  requestContext?: AgentExecutionOptions<OUTPUT>['requestContext'];
  /** Maximum number of steps to run */
  maxSteps?: number;
  /**
   * Model to run for this call instead of the agent's model.
   *
   * A model instance can't be persisted, so `recover()` in another process falls back to the
   * agent's own model and logs a warning.
   */
  model?: DynamicArgument<MastraModelConfig>;
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
  onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
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
   * Per-call tool lifecycle hooks. Applied when tools are prepared for this execution.
   * Function hooks are not serialized; a cross-process recovery cannot restore them.
   */
  hooks?: AgentExecutionOptions<OUTPUT>['hooks'];
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
   * @internal
   * Detach HTTP observers on reader cancellation instead of aborting execution.
   */
  _detachObserverOnCancel?: boolean;
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
> extends AgentStreamsConfig {
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
   * Maximum steps for the agentic loop.
   * Defaults to the workflow default if not specified.
   */
  maxSteps?: number;

  /**
   * Overrides the snapshot-persistence policy for this agent's durable
   * workflows. Returning false for a status skips that snapshot write.
   *
   * The default policy always persists `pending | paused | suspended`
   * (required for human-in-the-loop `resume()`), and persists `running`
   * when the Mastra instance is configured with
   * `recovery: { durableAgents: 'auto' }`, or at each step boundary after
   * `mastra.shutdown()` starts (even with recovery off). `running`
   * checkpoints exist solely so `listActiveRuns()` / `recover()` /
   * `recoverActiveRuns()` can see in-flight runs after a crash or shutdown.
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
   * How this agent's new runs are stored. `1` rewrites one snapshot per run
   * on every write. `2` stores a run header plus per-step entries, and each
   * write sends only what changed.
   *
   * Where the storage adapter doesn't support version 2, new runs are stored
   * as version 1 and a warning is logged. Runs keep the version they were
   * created with: a run resumed after this option changes continues in its
   * stored version.
   *
   * @default 1
   * @experimental
   */
  storageVersion?: 1 | 2;
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
 * of remaining runs could proceed; `skipped` means the run was not orphaned,
 * recovery hit a transient error, its recovery wait timed out, or recovery was interrupted by shutdown.
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
   * - `transient-error`: recovery hit a transient infrastructure error. Check again at `retryAt`.
   * - `recovery-timeout`: the attempt is still pending or its 30-second wait expired. Check again at `retryAt`.
   */
  reason?: 'run-active' | 'run-active-locally' | 'already-in-progress' | 'transient-error' | 'recovery-timeout';
  /** Epoch ms to check again: claim expiry for `run-active`, or a retry delay for `transient-error` / `recovery-timeout`. */
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
  onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
  /** Callback when the recovered run finishes */
  onFinish?: MastraOnFinishCallback<OUTPUT>;
  /** Callback when the recovered run errors */
  onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
  /** Callback when the recovered run is aborted */
  onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
  /** Callback when the recovered run suspends again */
  onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
  /**
   * Close the recovered stream once the run suspends (e.g. awaiting tool
   * approval) so callers can hand off to `resume()`. Defaults to `false`.
   */
  closeOnSuspend?: boolean;
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
  #beginSegment(runId: string): symbol {
    const segment = Symbol(runId);
    this.#segmentOwner.set(runId, segment);
    return segment;
  }

  #releaseSegment(runId: string, segment: symbol, entry: RunRegistryEntry): boolean {
    if (this.#segmentOwner.get(runId) !== segment) return false;
    this.#segmentOwner.delete(runId);
    if (this.executionRunRegistry.get(runId) === entry) this.executionRunRegistry.cleanup(runId);
    return true;
  }

  /** @internal Subclasses supply their default engine without changing workflow fallback policy. */
  protected override createExecutionEngine(mastra?: Mastra): DurableExecutionEngine {
    return new DurableExecutionEngine(this.id, mastra);
  }

  /** The wrapped agent */
  readonly #wrappedAgent: Agent<TAgentId, TTools, TOutput>;
  readonly #streamConfig: AgentStreamsConfig;
  #wrapperStreamBus?: AgentStreamBus;

  /** Registry for per-run non-serializable state */

  /** Maximum steps for the agentic loop */
  readonly #maxSteps?: number;

  /** Mastra instance (set via __setMastra when registered) */
  #mastra: Mastra | undefined;

  /** Active streamUntilIdle wrappers keyed by scope (threadId|resourceId) */
  #activeStreamUntilIdle = new Map<string, () => void>();
  /** The stream segment (stream() or resume()) that currently owns each run id's shared state. */
  readonly #segmentOwner = new Map<string, symbol>();

  /**
   * User-supplied snapshot-persistence policy
   * (see DurableAgentConfig.shouldPersistSnapshot). Protected so subclasses
   * that pin their own policy (EventedAgent) can detect and warn when set.
   */
  protected readonly userShouldPersistSnapshot: ShouldPersistSnapshotFn | undefined;

  /** Storage version for new runs (see DurableAgentConfig.storageVersion) */
  #storageVersion: 1 | 2;

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
      storageVersion,
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
      notifications: agent.__getNotificationConfig(),
    });

    this.#wrappedAgent = agent;

    this.#maxSteps = maxSteps;
    this.#streamConfig = { pubsub, cache, cleanupTimeoutMs, shouldCache };
    this.userShouldPersistSnapshot = shouldPersistSnapshot;
    this.#storageVersion = storageVersion ?? 1;

    // Keep processor access on the wrapped agent, but dispatch through this wrapper.
    this.#wrappedAgent.getChannels()?.__setDispatchAgent(this);
  }

  /** @internal Read one request-context value captured in a suspended durable run snapshot. */
  override async __getSuspendedRunRequestContextValue({
    runId,
    key,
  }: {
    runId: string;
    key: string;
  }): Promise<unknown> {
    if (!this.#mastra) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_NO_MASTRA',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" __getSuspendedRunRequestContextValue() requires the agent to be registered on a Mastra instance.`,
        details: { agentName: this.name, runId },
      });
    }

    const workflowsStore = await this.#mastra.getStorage()?.getStore('workflows');
    if (!workflowsStore) {
      throw new MastraError({
        id: 'DURABLE_AGENT_RECOVER_NO_STORAGE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" __getSuspendedRunRequestContextValue() requires persistent storage to load the run snapshot.`,
        details: { agentName: this.name, runId },
      });
    }

    return this.executionEngine.loadSuspendedRequestContextValue(workflowsStore, runId, this.id, key);
  }

  // ===========================================================================
  // Lazy PubSub/Cache initialization (allows inheriting cache from Mastra)
  // ===========================================================================

  /**
   * Get the resolved cache instance.
   * Lazily initialized to allow inheriting from Mastra.
   */
  get cache(): MastraServerCache | null {
    return this.__getStreamBus().forRun(this.__usesSharedRunLog()).cache;
  }

  /**
   * Get the PubSub instance.
   * Returns CachingPubSub if caching is enabled, otherwise the inner pubsub.
   */
  get pubsub(): PubSub {
    return this.__getStreamBus().forRun(this.__usesSharedRunLog()).pubsub;
  }

  /** Durable runs always publish on their stream topic. */
  override hasResumableStreams(): boolean {
    return true;
  }

  override __usesSharedRunLog(): boolean {
    return !!this.#mastra && this.executionEngine.resolveWorkflowEngine(this.workflowEngine, this.logger) === 'evented';
  }

  /** Durable execution uses its lifecycle publisher, not the plain Agent entry point. @internal */
  protected override __ownsPlainStreamPublisher(): boolean {
    return false;
  }

  /** Kept `false`, the value this getter has always reported for durable agents. */
  override get durable(): AgentDurableOption | undefined {
    return false;
  }

  /** @internal */
  override __getStreamBus(): AgentStreamBus {
    const bus = this.#wrappedAgent.__getStreamBus(true)!;
    if (!Object.values(this.#streamConfig).some(value => value !== undefined)) return bus;
    return (this.#wrapperStreamBus ??= bus.withConfig(this.#streamConfig));
  }

  /**
   * Owner of a run this process still tracks (until its auto-cleanup clears
   * the replay history), or undefined.
   * @internal
   */
  override __getRunOwner(runId: string): { resourceId?: string; threadId?: string } | undefined {
    if (!this.executionRunRegistry.has(runId)) return undefined;
    return { ...this.executionRunRegistry.getMemoryInfo(runId) };
  }

  override async __getRunRecord(runId: string): Promise<AgentRunRecord | undefined> {
    const bus = this.__getStreamBus();
    return readAgentRunRecord(
      bus.getRunRecordCache(this.__usesSharedRunLog()),
      this.id,
      runId,
      durableReplayOwnerKey(this.id, runId),
    );
  }

  /**
   * Owner of a run whose replay history is still retained: the local owner,
   * else the shared record, including legacy records without stream status.
   * Undefined once the run's topic is cleared. Only used for replay access.
   * Rejects when the shared cache cannot be read.
   * @internal
   */
  async __getReplayOwner(runId: string): Promise<{ resourceId?: string; threadId?: string } | undefined> {
    const local = this.__getRunOwner(runId);
    if (local) return local;
    const shared = await readDurableReplayOwner(
      this.__getStreamBus().getRunRecordCache(this.__usesSharedRunLog()),
      this.id,
      runId,
    );
    if (!shared) return undefined;
    return { resourceId: shared.resourceId, threadId: shared.threadId };
  }

  async #loadSuspendedIteration(
    runId: string,
  ): Promise<{ toolCalls: ToolCallChunk[]; resumedText?: { priorText: string; stepText: string } }> {
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const { toolCalls, resumedText } = await this.executionEngine.loadSuspendedIteration(workflowsStore, runId);
    const toolCallChunks: ToolCallChunk[] = toolCalls.map(toolCall => ({
      type: 'tool-call',
      runId,
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: toolCall.args,
        providerMetadata: toolCall.providerMetadata as ToolCallChunk['payload']['providerMetadata'],
        providerExecuted: toolCall.providerExecuted,
        output: toolCall.output,
      },
    }));
    return { toolCalls: toolCallChunks, resumedText };
  }

  // ===========================================================================
  // Delegate to wrapped agent
  // ===========================================================================

  protected override get agentForExecution(): Agent<TAgentId, TTools, TOutput> {
    return this.#wrappedAgent;
  }

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
    return this.executionRunRegistry;
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
    return this.__getStreamBus().cleanupTimeoutMs;
  }

  // ===========================================================================
  // Delegate Agent methods to wrapped agent
  //
  // DurableAgent's super() only passes id, name, instructions, and model.
  // All other private fields (#tools, #memory, #workspace, #processors, etc.)
  // are empty on the DurableAgent instance. Every public/protected method that
  // reads those fields must be overridden to delegate to the wrapped agent.
  // ===========================================================================

  override __setLogger(logger: IMastraLogger) {
    super.__setLogger(logger);
    this.#wrappedAgent.__setLogger(logger);
  }

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
    snapshot?: AgentScopesSnapshot,
  ): Promise<DurableAgentStreamOptions<TOutput>> {
    if ((options as any)?.[RESOLVED_EXECUTION_OPTIONS]) {
      return options!;
    }

    const defaultOptions = await this.getDefaultOptions({ requestContext: options?.requestContext });
    const resolvedOptions = deepMerge(
      withDefaultToolCallConcurrencyLimit(defaultOptions ?? {}, options) as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as DurableAgentStreamOptions<TOutput>;
    // Actor is a per-call trust signal, so an explicit value replaces the
    // default actor as a whole rather than inheriting any of its fields.
    if (options?.actor !== undefined) {
      resolvedOptions.actor = options.actor;
    }
    const scopedOptions = await this.#applyScopes(resolvedOptions, {
      callScopes: options?.scopes,
      defaultScopes: defaultOptions?.scopes,
      snapshot,
    });
    // Preserve the marker when the until-idle wrapper spreads these options.
    Object.defineProperty(scopedOptions, RESOLVED_EXECUTION_OPTIONS, { value: true, enumerable: true });
    Object.defineProperty(scopedOptions, RESOLVED_DEFAULT_OPTIONS, { value: defaultOptions, enumerable: true });
    return scopedOptions;
  }

  /**
   * Applies agent scopes to durable execution options. Durable runs resolve their thread and
   * resource from `memory` only, so options are returned unchanged unless the run has scopes.
   */
  async #applyScopes<T extends DurableAgentStreamOptions<TOutput>>(
    options: T,
    {
      callScopes,
      defaultScopes,
      snapshot,
    }: { callScopes?: string[]; defaultScopes?: string[]; snapshot?: AgentScopesSnapshot },
  ): Promise<T> {
    const requestContext = options.requestContext ?? new RequestContext();
    // A resumed run keeps its suspended scopes, so the Agent's configuration is not consulted.
    const incomingScopes = snapshot?.scopes
      ? undefined
      : incomingAgentScopes({ requestContext, callScopes, defaultScopes, mastra: this.#mastra });
    const agentScopes = incomingScopes ? await this.getScopes({ requestContext, scopes: incomingScopes }) : undefined;
    if (!agentScopes?.length && !callScopes?.length && !requestContext.has(MASTRA_SCOPES_KEY) && !snapshot?.scopes) {
      return options;
    }
    const resolved = resolveAgentScopes({
      requestContext,
      agentScopes,
      incomingScopes,
      callScopes,
      memory: options.memory,
      snapshot,
      mastra: this.#mastra,
    });
    return applyResolvedAgentScopes(options, resolved, requestContext);
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

  override getScopes(options?: any) {
    return this.#wrappedAgent.getScopes(options);
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
    agentChannels.__setDispatchAgent(this);
  }

  // --- PubSub (base Agent fields — DurableAgent has its own pubsub) ---
  override hasOwnPubSub() {
    return this.#wrappedAgent.hasOwnPubSub();
  }

  override getPubSub() {
    return this.#wrappedAgent.getPubSub();
  }

  // --- Setters called by AgentController — forward to BOTH wrapper and wrapped ---
  // We propagate to both so that:
  //  - The wrapped agent sees the value for its own internal use.
  //  - The DurableAgent's inherited getMemory()/getWorkspace() also work.
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
    const sharedChannels = this.#wrappedAgent.getChannels();
    const innerFork = this.#wrappedAgent.__fork();

    const Ctor = this.constructor as new (
      config: DurableAgentConfig<TAgentId, TTools, TOutput>,
    ) => DurableAgent<TAgentId, TTools, TOutput>;

    const fork = new Ctor({
      agent: innerFork,
      ...this.#streamConfig,
      id: this.id,
      name: this.name,
      maxSteps: this.#maxSteps,
      shouldPersistSnapshot: this.userShouldPersistSnapshot,
      storageVersion: this.#storageVersion,
    });

    // A transient version fork must not take over the singleton's channel ingress.
    if (sharedChannels && sharedChannels === innerFork.getChannels()) {
      sharedChannels.__setAgent(this.#wrappedAgent);
      sharedChannels.__setDispatchAgent(this);
    }

    // Preserve Mastra registration without re-triggering its side effects.
    // The inner fork inherits registration and resolves its shared bus lazily.
    if (this.#mastra) {
      fork.__inheritMastraForFork(this.#mastra);
      fork.#mastra = this.#mastra;
    }
    fork.source = this.source;
    // Share the untilIdle wrappers, so a task finishing under the fork's stream isn't
    // also reported by the registered agent (mirrors `Agent.__fork()`).
    fork.#activeStreamUntilIdle = this.#activeStreamUntilIdle;
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
    return this.executionRunRegistry;
  }

  /** Whether new runs opt into journal storage. @internal */
  protected get storesRunsInJournal(): boolean {
    return this.#storageVersion === 2;
  }

  /**
   * Warns once when `storageVersion: 2` is set but the registered store can't
   * store version 2 runs. The loop workflow's `autoStorageVersion` then stores
   * new runs as version 1. An agent with no registered store isn't warned.
   */
  #warnIfStorageVersionUnsupported(): void {
    if (this.#storageVersion !== 2) return;
    // Read `stores` directly, as resolveWorkflowEngine() does: getWorkflow() is synchronous.
    const storage = this.#mastra?.getStorage();
    const workflowsStore = storage?.stores?.workflows;
    if (workflowsStore && !workflowsStore.supportsRunJournal()) {
      this.guardrailLogger?.warn(
        `DurableAgent '${this.id}' sets storageVersion: 2, which ${storage?.name ?? 'the configured'} storage ` +
          `doesn't support yet; storing new runs as version 1.`,
      );
    }
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
    return this.executionEngine.resolveWorkflowEngine(this.workflowEngine, this.logger);
  }

  /**
   * Evented-engine runs execute via pubsub events consumed by in-process
   * workers — without them `run.start()`/`resume()`/`restart()` never
   * resolve (they wait on the `workflows-finish` topic). No-op on the
   * default engine; idempotent on Mastra's side.
   * @internal
   */
  protected async ensureEngineWorkersStarted(): Promise<void> {
    return this.executionEngine.ensureEngineWorkersStarted(this.workflowEngine, this.logger);
  }

  private async persistInitialInput(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    await persistDurableRunInput(runId, workflowInput, this.#mastra);
  }

  /**
   * Execute the durable workflow.
   *
   * Subclasses override this method to customize how the workflow is executed:
   * - DurableAgent (this): Runs the workflow directly via createRun + start
   * - EventedAgent: Runs steps through event workers and tracks completion
   * - InngestAgent: Uses inngest.send() to trigger Inngest function
   *
   * @param runId - The unique run ID
   * @param workflowInput - The serialized workflow input
   * @internal
   */
  protected async executeWorkflow(
    runId: string,
    workflowInput: DurableAgenticWorkflowInput,
  ): Promise<{ status?: string } | void> {
    const workflow = this.getWorkflow();
    const entry = getRunRegistryEntry(runId, this.#mastra);
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

    const run = await this.executionEngine.createRun(workflow, {
      runId,
      resourceId,
      pubsub: this.fenceRunPubSub(executionFence, entry?.abortController),
    });
    // Parent the workflow run under the AGENT_RUN span so the trace exports under it.
    let result;
    try {
      result = await this.withSuspensionAfterPersist(runId, () =>
        this.executionEngine.startRun(
          run,
          workflowInput,
          requestContext,
          createObservabilityContext({ currentSpan: entry?.agentSpan }),
        ),
      );
      const outcome = this.executionEngine.finishExecution(runId, executionFence, false, { result });
      if (outcome.owner === 'agent') await this.settleExecution(runId, executionFence, outcome);
      return result;
    } finally {
      this.executionEngine.releaseRun(workflow, runId, run, result?.status);
    }
  }

  /**
   * Run a workflow leg with suspension chunks/events held back until the leg
   * returns, i.e. until the engine has saved the suspended snapshot. Without
   * this a crash between publishing the question and saving the snapshot
   * leaves a run that `resume()` rejects (#26435).
   */
  private async withSuspensionAfterPersist<T>(runId: string, execute: () => Promise<T>): Promise<T> {
    const entry = this.suspendPersistedOnReturn ? getRunRegistryEntry(runId, this.#mastra) : undefined;
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
          this.logger.warn('Failed to publish deferred suspension event', { runId, error });
        }
      }
    }
    return result;
  }

  /**
   * Whether `executeWorkflow()` resolves only after a suspended snapshot has
   * been persisted, reporting `{ status: 'suspended' }`. When true,
   * `closeOnSuspend` streams close on that result instead of on the SUSPENDED
   * pubsub event (which the tool-call step publishes before persistence), so
   * an immediate cold resume finds the `suspended` snapshot.
   * @internal
   */
  protected get suspendPersistedOnReturn(): boolean {
    return true;
  }

  /**
   * Create the durable workflow for this agent.
   *
   * Retained for direct calls and subclass super calls. Run execution creates
   * workflows through the execution engine, not through overrides of this method.
   *
   * @internal
   */
  protected createWorkflow(): ReturnType<typeof createDurableAgenticWorkflow> {
    return this.executionEngine.createWorkflow({
      maxSteps: this.#maxSteps,
      workflowEngine: this.workflowEngine,
      storesRunsInJournal: this.storesRunsInJournal,
      shouldPersistSnapshot: this.userShouldPersistSnapshot,
      logger: this.logger,
      guardrailLogger: this.guardrailLogger,
    });
  }

  /**
   * Resolve the effective snapshot-persistence policy for this agent's
   * workflows: the user-supplied predicate when set, otherwise the
   * recovery-aware default. Engine variants own this policy during execution;
   * overriding this compatibility method does not change running workflows.
   *
   * @internal
   */
  protected resolveShouldPersistSnapshot(): ShouldPersistSnapshotFn {
    return this.executionEngine.resolveShouldPersistSnapshot(this.userShouldPersistSnapshot);
  }

  protected workflowFailureError(workflowError: unknown, fallbackMessage: string): Error {
    return this.executionEngine.workflowFailureError(workflowError, fallbackMessage);
  }

  protected workflowExecutionError(workflowError: unknown, fallbackMessage: string): Error {
    return this.executionEngine.workflowExecutionError(workflowError, fallbackMessage);
  }

  /**
   * Claim the run's execution fence (#23734): `acquire` for a new execution
   * segment, `takeover` when recovering an orphaned run. With a
   * `requestContext`, the claim also covers the run's memory store (see
   * {@link DurableAgent.coverMemory}).
   */
  async #claimExecution(
    runId: string,
    mode: 'acquire' | 'recover' | 'takeover',
    requestContext?: RequestContext,
    untrackedRun?: UntrackedRunLiveness,
  ): Promise<ExecutionFence> {
    const fence = await this.executionEngine.claimExecution(runId, mode, this.pubsub, this.logger, untrackedRun);
    if (requestContext) await this.coverMemory(fence, requestContext);
    return fence;
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
  /** @internal Durable `untilIdle` streams are tracked on this agent, not the wrapped one. */
  override __untilIdleHandlesBackgroundTask(threadId: string, resourceId: string, taskId: string): boolean {
    return untilIdleHandlesBackgroundTask(this.#activeStreamUntilIdle, threadId, resourceId, taskId);
  }

  abortThreadStream(options: AgentAbortThreadOptions): boolean {
    const aborted = this.#abortThreadStreamLocally(options);
    // The lookup is async, so this synchronous call can't report its outcome.
    // Server routes use `__abortThreadStreamAcrossProcesses` for that.
    if (!aborted && !options.localOnly) {
      void this.#abortThreadLeaseOwner(options).catch(error => {
        this.#mastra?.getLogger?.()?.warn?.('Failed to abort durable agent thread run on another process', {
          agentId: this.id,
          threadId: options.threadId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
    return aborted;
  }

  /** @internal Like {@link abortThreadStream}, but reports whether a run on another process was asked to stop. */
  async __abortThreadStreamAcrossProcesses(options: AgentAbortThreadOptions): Promise<boolean> {
    const aborted = this.#abortThreadStreamLocally(options);
    if (aborted || options.localOnly) return aborted;
    return this.#abortThreadLeaseOwner(options);
  }

  #abortThreadStreamLocally(options: AgentAbortThreadOptions): boolean {
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

    if (!options.localOnly) {
      this.#abortLocalController(runId);
      void this.requestRemoteAbort(runId);
    }
    return true;
  }

  /**
   * A process only knows another process's run while it subscribes to the
   * thread, so a server answering a bare abort request usually knows none.
   * The thread lease names the run holding the thread wherever it executes;
   * stop that run the way {@link abortRunStream} does (#28310).
   */
  async #abortThreadLeaseOwner(options: AgentAbortThreadOptions): Promise<boolean> {
    const runId = await agentThreadStreamRuntime.getThreadLeaseOwnerRunId(this.getPubSub(), options);
    if (!runId) return false;
    // Never stop a successor run the caller didn't mean (#24422).
    if (options.expectedRunId !== undefined && options.expectedRunId !== runId) return false;
    // The run executes elsewhere, so success means the request was published: a
    // failed lease lookup or publish throws rather than reading as an idle thread.
    // The thread-topic request reaches the owner's thread runtime, which stops an
    // executing run and also releases one parked on a suspension; a run-topic request
    // only reaches an executing step. With clearPendingSignals the owner must clear the
    // queued input before the run ends and drains it, so only the thread request goes.
    await Promise.all([
      agentThreadStreamRuntime.requestThreadRunAbort(this.getPubSub(), options, runId),
      options.clearPendingSignals ? undefined : publishAbortRequest(this.pubsub, runId),
    ]);
    return true;
  }

  override abortRunStream(runId: string): boolean {
    return (
      super.abortRunStream(runId) ||
      this.executionRunRegistry.get(runId) !== undefined ||
      getRunRegistryEntry(runId, this.#mastra) !== undefined ||
      agentThreadStreamRuntime.hasThreadRun(runId, this.getPubSub())
    );
  }

  protected override __abortLocalRun(runId: string): boolean {
    const wrapperClose = getRunStreamSlot(this.#activeStreamUntilIdle, runId);
    if (wrapperClose) {
      wrapperClose();
      return true;
    }
    const aborted = super.__abortLocalRun(runId);
    const controller = (this.executionRunRegistry.get(runId) ?? getRunRegistryEntry(runId, this.#mastra))
      ?.abortController;
    this.#abortLocalController(runId);
    // An evented run's registry entry can belong to a caller, not its executor.
    // Let the base path send the request to the workers in that case.
    return (
      aborted ||
      (this.executionEngine.resolveWorkflowEngine(this.workflowEngine, this.logger) === 'default' &&
        controller !== undefined)
    );
  }

  /**
   * Abort `runId` and resolve whether the abort was confirmed.
   *
   * Only a close this process performs itself counts as local confirmation. A
   * run-registry entry does not: an evented run keeps one here while another
   * process executes its steps, possibly a dead one. Every other run gets a
   * single correlated request, and only the executor's answer confirms it.
   * The local controller is flipped after that answer, so an executor in this
   * process cannot unwind and drop its listener before the request reaches it.
   *
   * @internal Used by the server's run abort route.
   */
  override async __abortRunAcknowledged(runId: string): Promise<boolean> {
    const wrapperClose = getRunStreamSlot(this.#activeStreamUntilIdle, runId);
    if (wrapperClose) {
      wrapperClose();
      return true;
    }
    if (agentThreadStreamRuntime.abortRun(runId, this.getPubSub())) {
      this.#abortLocalController(runId);
      void this.requestRemoteAbort(runId);
      if (await this.#cancelParkedRun(runId)) await this.#announceCanceledRun(runId);
      return true;
    }
    try {
      const canceled = await this.#cancelParkedRun(runId);
      if (canceled) await this.#announceCanceledRun(runId);
      return (await requestAcknowledgedAbort(this.pubsub, runId)) || canceled;
    } finally {
      this.#abortLocalController(runId);
    }
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
  async #cancelParkedRun(runId: string): Promise<boolean> {
    return this.executionEngine.cancelParkedRun(runId);
  }

  /**
   * Publish the abort terminal for a parked run this call just canceled. The bus is
   * shared, so observers on every server close now, whichever server later refuses
   * the approval. Only the call that won the cancel publishes. A failed publish does
   * not undo the abort: the cancel is already stored, and a refused resume on this
   * server retries the publish.
   */
  async #announceCanceledRun(runId: string): Promise<void> {
    return this.executionEngine.announceCanceledRun(runId, this.pubsub);
  }

  async #isRunCanceledInStorage(runId: string): Promise<boolean> {
    return this.executionEngine.isRunCanceledInStorage(runId);
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
  async #deleteFencedSuspendedRun(runId: string): Promise<void> {
    try {
      const snapshot = await this.executionEngine.loadRunSnapshot(runId);
      if (snapshot?.status === 'canceled') {
        await this.executionEngine.publishCanceledRunTerminal(runId, this.pubsub);
        return;
      }
      if (snapshot?.status !== 'suspended') return;
      await this.deleteRunSnapshots(runId);
      await emitAbortEvent(this.pubsub, runId, { steps: [], text: '' });
    } catch (error) {
      this.#mastra?.getLogger?.()?.warn?.(`Failed to delete snapshot of aborted suspended run ${runId}`, {
        runId,
        error,
      });
    }
  }

  /** Flip the controller this process holds for `runId`, if it holds one. */
  #abortLocalController(runId: string): void {
    const controller = (this.executionRunRegistry.get(runId) ?? getRunRegistryEntry(runId, this.#mastra))
      ?.abortController;
    if (controller && !controller.signal.aborted) {
      controller.abort(new Error('Aborted'));
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
    options = await this.#resolveExecutionOptions(applyReservedMemoryContextKeys(options));

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

    return this.#execute(messages, options, 'stream');
  }

  async #execute(
    messages: MessageListInput,
    options: DurableAgentStreamOptions<TOutput>,
    methodType: 'stream' | 'generate',
  ): Promise<DurableAgentStreamResult<TOutput>> {
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

    validateModelTimeoutSettings(options?.modelSettings?.timeout);

    // 1. Claim the run before preparing it, so a run that is already executing
    // fails before any span or memory write is made for this call.
    const runId = resolveRunId(options?.runId);
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
        resolvedDefaultOptions: (options as any)?.[RESOLVED_DEFAULT_OPTIONS],
        scopesResolved: true,
        mastra: this.#mastra,
        methodType,
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
    this.runInputs.set(executionFence, workflowInput);

    // 1b. Install the abort controller for this run. The controller is owned
    // by this DurableAgent instance; the result's abort() method flips it,
    // and the durable LLM-execution step reads `abortSignal` off the registry
    // to thread it into the model call + abort short-circuits. If the caller
    // also supplied an external signal, forward its abort to the internal
    // controller so either source can cancel the run.
    const { controller: abortController } = createRunAbortController(options?.abortSignal);
    if (agentThreadStreamRuntime.isRunAborted(runId, this.getPubSub())) {
      abortController.abort();
    }
    this.installAbortWithTotalTimeout(registryEntry, abortController, executionFence);

    // Share the scope before either registry copies the entry.
    const readLocalRequest = createLocalRequestReader(runId, registryEntry, this.#mastra);

    // 2. Register non-serializable state (both local and global registries)
    registryEntry.agentId = this.id;
    this.executionRunRegistry.registerWithMessageList(runId, registryEntry, messageList, { threadId, resourceId });
    const globalRegistryEntry = { ...registryEntry, messageList };
    globalRunRegistry.set(runId, globalRegistryEntry);
    await this.attachStreamPublisher(runId, { threadId, resourceId });
    const segment = methodType === 'stream' ? this.#beginSegment(runId) : undefined;

    // Assigned once the stream is created below. Declared here so the shared
    // performCleanup() closure can unsubscribe the pubsub reader (via
    // streamCleanup) from both the auto-cleanup timer and the explicit
    // cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;

    // Stream segments and generate registry entries have distinct release guards.
    // Neither may tear down state registered by a newer execution.
    const releaseRunState = () => {
      if (segment !== undefined) {
        if (!this.#releaseSegment(runId, segment, registryEntry)) return;
      } else if (this.executionRunRegistry.get(runId) === registryEntry) {
        this.executionRunRegistry.cleanup(runId);
      }
      if (getRunRegistryEntry(runId, this.#mastra) === globalRegistryEntry) {
        globalRunRegistry.delete(runId);
        if (
          !this.unverifiedReaderFences.has(executionFence) &&
          (globalRegistryEntry.executionFence?.ownsRunTopics() ?? true)
        )
          this.clearPubsubTopic(runId, globalRegistryEntry);
      }
    };

    const runCleanup = createRunCleanup({
      scheduleTimer: cleanup => this.scheduleReaderCleanup(executionFence, cleanup),
      release: () => {
        agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
        streamCleanup?.();
        releaseRunState();
      },
      // Generate's timer releases state without disposing its draining reader.
      ...(methodType === 'generate' ? { releaseOnTimer: releaseRunState } : {}),
    });
    const performCleanup = runCleanup.run;
    // Schedule automatic registry cleanup after stream ends
    const scheduleAutoCleanup = runCleanup.schedule;

    // Generate closes at suspension; stream defaults to staying open for a
    // same-reader resume. The same value gates stream's continuation.
    const closeOnSuspend = methodType === 'generate' || (options?.closeOnSuspend ?? false);
    const closeOnPersistedSuspend = methodType === 'stream' && closeOnSuspend && this.suspendPersistedOnReturn;

    // 3. Create the durable agent stream (subscribes to pubsub)
    const {
      output,
      cleanup: createdStreamCleanup,
      detach: detachStream,
      waitForEventDelivery,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      minGeneration: executionFence.generation,
      onTerminalEvent: this.owningReaderTerminal(runId, executionFence),
      readLocalRequest,
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
      // When the engine reports the persisted suspension, the stream is closed
      // after executeWorkflow() returns (below) rather than on the SUSPENDED
      // event, which is published before the snapshot is saved.
      closeOnSuspend: closeOnSuspend && !closeOnPersistedSuspend,
      ...(methodType === 'stream' ? { hideSignals: options?.hideSignals } : {}),
      structuredOutput: registryEntry.structuredOutput as any,
      outputProcessors: registryEntry.outputProcessors,
      processorStates: registryEntry.processorStates,
      agent: registryEntry.agent,
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
          if (await this.redeliverDeadlineError(registryEntry, executionFence)) return;
          // Emit 'start' chunk before the workflow begins (matches regular agent's stream.ts).
          // Only initial generate()/stream() emits 'start'; resume() does not.
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
              requestContext: getRunRegistryEntry(runId, this.#mastra)?.requestContext,
            });
          }
          let result: { status?: string } | void;
          try {
            await this.persistInitialInput(runId, workflowInput);
            result = await this.executeWorkflow(runId, workflowInput);
          } finally {
            await stopGoalActivity({ agentId: workflowInput.agentId, runId });
          }
          if (closeOnPersistedSuspend && result?.status === 'suspended') {
            // The workflow result is the persisted suspension boundary. Deliver
            // buffered events (including onSuspended) before closing the stream.
            await this.pubsub.flush();
            await waitForEventDelivery();
            detachStream();
          }
          if (methodType === 'generate') return result;
        })
        .catch(error =>
          this.settleExecution(runId, executionFence, {
            error: this.executionEngine.workflowExecutionError(error, 'Workflow execution failed'),
          }),
        ),
    );
    const trackedEntry = getRunRegistryEntry(runId, this.#mastra);
    if (trackedEntry) {
      trackedEntry.workflowExecution = workflowExecution;
    }

    if (methodType === 'stream') {
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
          stepOwner: () => getRunRegistryEntry(runId, this.#mastra),
        },
      );
    }

    // 5. Cleanup function — routes through the shared performCleanup() so the
    // explicit call and the auto-cleanup timer release the same resources.
    // A cleanup() that arrives before the output settles waits for the run's
    // terminal event, including an error event still being published in the
    // background. Tearing down the reader first would drop it, leaving the
    // output unsettled and the thread busy forever (#25974).
    const cleanup = () => {
      if (methodType === 'generate' || runCleanup.done || output.status !== 'running') return performCleanup();
      void Promise.race([workflowExecution, executionFence.whenSettled])
        .then(() => this.pubsub.flush())
        .then(() => waitForEventDelivery())
        .catch(() => {})
        .finally(performCleanup);
    };

    const abort = async (reason?: unknown) => {
      if (!abortController.signal.aborted) {
        abortController.abort(reason);
      }
      // Also stop the run wherever it is actually executing — see
      // `requestRemoteAbort`. The local controller above only reaches steps
      // running in this process.
      await this.requestRemoteAbort(runId);
      // A run parked on a suspension has no steps left to stop; release it so
      // it is no longer listed as suspended.
      if (agentThreadStreamRuntime.isRunParked(runId, this.getPubSub())) super.abortRunStream(runId);
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
    const abortedRunError = () =>
      new MastraError({
        id: 'AGENT_RESUME_ABORTED_RUN',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" cannot resume aborted run "${runId}".`,
        details: { agentName: this.name, runId },
      });
    if (agentThreadStreamRuntime.isResumeFenced(runId, this.getPubSub())) {
      // The fenced run can never continue, so the rejected caller must not find it in
      // listSuspendedRuns() afterwards (#27619).
      await this.#deleteFencedSuspendedRun(runId);
      throw abortedRunError();
    }
    // Marked before the first await, so a second resume of the same tool call
    // fails fast even when both start in the same tick (#27365).
    const toolCallId = options?.toolCallId;
    let releaseResumeMarker = () => {};
    if (toolCallId !== undefined) {
      const release = markResumeInFlight(runId, toolCallId);
      if (!release) {
        throw new MastraError({
          id: 'AGENT_RESUME_ALREADY_CLAIMED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it is already running.`,
          details: { agentName: this.name, runId, toolCallId },
        });
      }
      releaseResumeMarker = release;
    }
    try {
      // An abort on another server leaves the run canceled in storage.
      if (await this.#isRunCanceledInStorage(runId)) throw abortedRunError();
      return await this.#resumeRun(runId, resumeData, options, releaseResumeMarker);
    } catch (error) {
      releaseResumeMarker();
      throw error;
    }
  }

  /**
   * A resume claims the run by marking it `running` (#27619). When the process holding
   * that claim dies, nothing else moves the run on, so the run would stay unresumable.
   * Recover the run once the claim's lease has lapsed: when no running progress was
   * checkpointed (the default snapshot policy) recovery parks it at its suspension
   * again and this resume goes on; otherwise recovery finishes it.
   */
  async #takeOverResumeClaim(runId: string, workflowsStore: WorkflowsStorage): Promise<WorkflowRunState> {
    const outcome = (await this.recoverActiveRuns({ runId })).recovered[0];
    if (outcome?.status === 'skipped') {
      throw new MastraError({
        id: 'AGENT_RESUME_ALREADY_CLAIMED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it is still running.`,
        details: { agentName: this.name, runId, reason: outcome.reason ?? '', retryAt: outcome.retryAt ?? '' },
      });
    }
    if (outcome?.status === 'failed' && outcome.error) throw outcome.error;
    const persisted = await this.executionEngine.loadPersistedRunSnapshot(workflowsStore, runId);
    if (!persisted) {
      throw new MastraError({
        id: 'AGENT_RESUME_RUN_FINISHED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because it already finished: recovery completed it after the process running its previous resume stopped.`,
        details: { agentName: this.name, runId },
      });
    }
    return persisted.snapshot;
  }

  async #resumeRun(
    runId: string,
    resumeData: unknown,
    options: DurableAgentResumeOptions<TOutput> | undefined,
    releaseResumeMarker: () => void,
  ): Promise<DurableAgentStreamResult<TOutput>> {
    let entry = this.executionRunRegistry.get(runId);
    // Scopes persisted with a run rebuilt from storage. They are the suspended run's set even when
    // the caller passes its own request context.
    let rehydratedScopes: unknown;
    let coldSnapshot: WorkflowRunState | undefined;
    if (!entry) {
      // A persisted durable run can outlive this process (or the registry TTL).
      // Rebuild the non-serializable runtime state before resuming the stored
      // workflow snapshot. Keep warm resumes on the existing path to avoid
      // racing an active registry entry with a second preparation pass.
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      const persisted = workflowsStore
        ? await this.executionEngine.loadPersistedRunSnapshot(workflowsStore, runId)
        : undefined;
      if (!persisted) {
        throw new MastraError({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `No registry entry found for run ${runId}. Cannot resume.`,
          details: { agentName: this.name, runId },
        });
      }

      let snapshot = persisted.snapshot;
      const readWorkflowInput = (snapshot: WorkflowRunState, allowRunning = false) => {
        if (snapshot?.status !== 'suspended' && !(allowRunning && snapshot?.status === 'running')) {
          throw new MastraError({
            id: 'AGENT_RESUME_RUN_NOT_SUSPENDED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because it is not waiting to be resumed (status: ${snapshot?.status}).`,
            details: { agentName: this.name, runId, status: snapshot?.status },
          });
        }
        const input = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
        if (!input || input.__workflowKind !== 'durable-agent') {
          throw new MastraError({
            id: 'DURABLE_AGENT_RESUME_INVALID_SNAPSHOT',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.SYSTEM,
            text: `DurableAgent "${this.name}" resume(${runId}): persisted snapshot does not contain a durable-agent workflow input.`,
            details: { agentName: this.name, runId },
          });
        }
        if (input.agentId !== this.id) {
          throw new MastraError({
            id: 'DURABLE_AGENT_RESUME_AGENT_MISMATCH',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            text: `DurableAgent "${this.name}" resume(${runId}): persisted run belongs to agent "${input.agentId}", not "${this.id}".`,
            details: { agentName: this.name, runId, ownerAgentId: input.agentId },
          });
        }
        return input;
      };
      let workflowInput = readWorkflowInput(snapshot, true);

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
          let resolved: Agent | undefined;
          try {
            resolved = await this.#mastra.resolveVersionedAgent(this as unknown as Agent, {
              versionId: pinnedVersionId,
            });
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
          if (resolved && resolved !== (this as unknown as Agent)) {
            // Hand the tool-call marker to the pinned agent's resume(), which
            // re-takes it synchronously before its first await.
            releaseResumeMarker();
            return (resolved as unknown as DurableAgent<TAgentId, TTools, TOutput>).resume(runId, resumeData, options);
          }
        }
      }

      if (snapshot?.status === 'running' && workflowsStore) {
        // Recovery can execute the run. Dynamic defaults still require the rehydrated context below.
        this.#wrappedAgent.__validateStaticModelTimeoutSettings(options?.modelSettings);
        validateModelTimeoutSettings((options?.modelSettings ?? workflowInput.options?.modelSettings)?.timeout);
        snapshot = await this.#takeOverResumeClaim(runId, workflowsStore);
        workflowInput = readWorkflowInput(snapshot);
      }
      coldSnapshot = snapshot;

      const messageListMemoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
      const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;
      // The starting request's user and token are left out, so they come only from this resume.
      const snapshotRequestContext = workflowInput.requestContextEntries
        ? new RequestContext<unknown>(Object.entries(withoutLiveRequestKeys(workflowInput.requestContextEntries)))
        : undefined;
      if (snapshotRequestContext) restoreRunAgentScopes(snapshotRequestContext);
      const persistedScopes = workflowInput.requestContextEntries?.[MASTRA_SCOPES_KEY];
      if (
        persistedScopes !== undefined &&
        (!Array.isArray(persistedScopes) || persistedScopes.some(scope => typeof scope !== 'string'))
      ) {
        // A malformed persisted set must not be coerced to "no scopes": that would both
        // drop the run's scopes and falsely reject re-supplied ones as additions.
        throw new MastraError({
          id: 'AGENT_SCOPES_INVALID',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          // Corrupted persisted state is a system fault, not a caller error: no
          // `details.status`, so server handlers surface it as HTTP 500.
          text: `DurableAgent "${this.name}" resume(${runId}): persisted run scopes are malformed; expected an array of strings.`,
          details: { agentName: this.name, runId },
        });
      }
      // Absent (vs recorded []) marks a run suspended before the scopes upgrade; the resume
      // adopts the supplied scopes with the same trust posture as a fresh run.
      rehydratedScopes = persistedScopes;
      const memory = threadId
        ? {
            ...options?.memory,
            thread: threadId,
            resource: resourceId ?? options?.memory?.resource,
          }
        : options?.memory;

      // The resume below applies the suspended run's scopes, so preparation does not resolve them again.
      await this.prepare([], {
        [SCOPES_ALREADY_APPLIED]: true,
        [RESUMED_SPAN_DATA]: { agentSpanData: workflowInput.agentSpanData, modelSpanData: workflowInput.modelSpanData },
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
      } as AgentExecutionOptions<TOutput>);
      entry = this.executionRunRegistry.get(runId);
    }
    if (!entry) {
      throw new Error(`Failed to rehydrate registry entry for run ${runId}. Cannot resume.`);
    }

    const memoryInfo = this.executionRunRegistry.getMemoryInfo(runId);
    const registeredMemory = memoryInfo?.threadId
      ? ({
          ...options?.memory,
          thread: memoryInfo.threadId,
          resource: memoryInfo.resourceId ?? options?.memory?.resource,
        } as DurableAgentStreamOptions<TOutput>['memory'])
      : options?.memory;

    // The suspended run's non-identity scopes live on its persisted request context;
    // its identity is the registered memory. A resume keeps that set (rule: re-supplied
    // scopes may only be a subset of it).
    // A recorded set — [] included — is authoritative: a resume may not add scopes.
    // Cold resumes read the persisted entries, which preparation stamps unconditionally,
    // so an absent value there marks a pre-upgrade snapshot whose resume adopts the
    // supplied scopes. Warm registry entries only exist for runs this (post-upgrade)
    // process started, so an absent live value simply means the run held no scopes.
    const snapshotScopes = coldSnapshot ? rehydratedScopes : (entry.requestContext?.get(MASTRA_SCOPES_KEY) ?? []);
    const resumeScopesSnapshot: AgentScopesSnapshot = {
      resourceId: memoryInfo?.resourceId,
      threadId: memoryInfo?.threadId,
      scopes: Array.isArray(snapshotScopes) ? snapshotScopes : undefined,
    };

    // The suspended run's values carry over, except the starting request's user and
    // token: those come only from this resume, so a resume without a signed-in user
    // can't act as the user who started the run.
    const carriedEntries = entry.requestContext
      ? Object.entries(withoutLiveRequestKeys(Object.fromEntries(entry.requestContext.entries())))
      : undefined;
    // Tools built for the starting request are bound to its context, so they are rebuilt below.
    const droppedStartingUser = carriedEntries !== undefined && carriedEntries.length < entry.requestContext!.size();
    // Copy only when user keys were removed; otherwise keep the run's own instance.
    let resumeRequestContext = droppedStartingUser ? new RequestContext<unknown>(carriedEntries) : entry.requestContext;
    if (options?.requestContext) {
      // Keep the caller's instance so schema-transformed contexts retain their
      // input source. Caller values win except for framework-managed memory.
      resumeRequestContext = options.requestContext;
      for (const [key, value] of carriedEntries ?? []) {
        // The suspended run's scopes are applied on the run's own context below, never the caller's.
        if (key === MASTRA_SCOPES_KEY) continue;
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
    const resolvedOptions = (await this.#resolveExecutionOptions(
      {
        ...(options as DurableAgentStreamOptions<TOutput>),
        requestContext: resumeRequestContext as DurableAgentStreamOptions<TOutput>['requestContext'],
        memory: registeredMemory ?? options?.memory,
      },
      resumeScopesSnapshot,
    )) as DurableAgentResumeOptions<TOutput>;
    validateModelTimeoutSettings(resolvedOptions.modelSettings?.timeout);
    // Scoped runs execute on a run-scoped copy of the request context.
    resumeRequestContext = (resolvedOptions.requestContext as typeof resumeRequestContext) ?? resumeRequestContext;

    entry.requestContext = resumeRequestContext;
    const globalEntryForContext = getRunRegistryEntry(runId, this.#mastra);
    if (globalEntryForContext) {
      globalEntryForContext.requestContext = resumeRequestContext;
    }

    // Delegate to the idle-loop wrapper when `untilIdle` is set. Strip
    // `untilIdle` before passing to the wrapper so the inner agent.resume()
    // call (and subsequent agent.stream([]) continuations) don't recurse.
    if (resolvedOptions.untilIdle) {
      const { untilIdle, ...rest } = resolvedOptions;
      const maxIdleMs = typeof untilIdle === 'object' ? untilIdle.maxIdleMs : undefined;
      // The idle-loop wrapper re-enters resume() for this same tool call.
      releaseResumeMarker();
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

    // Settle the prior segment before claiming the run and reading its snapshot
    // and event offset. The suspension chunk can arrive before the suspended
    // snapshot is persisted, and a late suspension event replayed into the new
    // segment would close it early.
    const priorExecution = getRunRegistryEntry(runId, this.#mastra)?.workflowExecution;
    await priorExecution?.catch(() => {
      /* errors already handled by the prior segment */
    });
    // A warm resume reuses the tools built for the first request, which close
    // over its request context, delegation hooks, and tool hooks (#25960). Rebuild them for
    // this call and swap in only entries still holding a request-built tool, so
    // tools a processor added or replaced are kept. Processor-added tools are
    // rebuilt for this call's request context instead (#27544). Cold resumes already
    // rebuilt everything in prepare() above.
    if (!coldSnapshot && (options?.requestContext || options?.delegation || options?.hooks || droppedStartingUser)) {
      try {
        const requestTools = await this.#wrappedAgent.getToolsForExecution({
          toolsets: resolvedOptions.toolsets,
          clientTools: resolvedOptions.clientTools,
          threadId: memoryInfo?.threadId,
          resourceId: memoryInfo?.resourceId,
          runId,
          requestContext: resumeRequestContext,
          memoryConfig: resolvedOptions.memory?.options,
          autoResumeSuspendedTools: resolvedOptions.autoResumeSuspendedTools,
          // resolvedOptions always carries defaultOptions.delegation, so only a delegation passed
          // to this resume may replace the one the first call parked on the entry.
          delegation: options?.delegation
            ? resolvedOptions.delegation
            : (entry.delegation ?? resolvedOptions.delegation),
          hooks: resolvedOptions.hooks,
          // Build for the method that started the run. `closeOnSuspend` is also a
          // stream() option and resumeStream() always sets it, so it cannot tell (#29436).
          methodType: entry.methodType ?? 'stream',
          backgroundTaskEnabled: Boolean(entry.backgroundTaskManager),
          backgroundTaskPolicy: resolvedOptions.backgroundTaskPolicy,
          model: entry.model,
        });
        const refresh = (current: Record<string, CoreTool>, previous: Record<string, CoreTool> | undefined) => {
          const next = { ...current };
          for (const [name, tool] of Object.entries(requestTools)) {
            // A name missing from current but present in previous was withheld by a processor.
            const configured = name in current ? current[name] === previous?.[name] : !previous || !(name in previous);
            if (configured) next[name] = tool;
          }
          return next;
        };
        for (const reg of new Set([entry, getRunRegistryEntry(runId, this.#mastra)])) {
          if (!reg) continue;
          reg.tools = rebindProcessorTools(refresh(reg.tools ?? {}, reg.requestTools), resumeRequestContext);
          if (reg.baseTools)
            reg.baseTools = rebindProcessorTools(refresh(reg.baseTools, reg.requestTools), resumeRequestContext);
          // Tools this rebuild did not produce still hold their earlier build, so
          // keep that as their baseline; otherwise a later resume can never refresh them.
          reg.requestTools = { ...reg.requestTools, ...requestTools };
          if (options?.delegation) reg.delegation = resolvedOptions.delegation;
        }
      } catch (error) {
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] resume(${runId}) tool resolution failed: ${error}`);
      }
    }
    // Claimed before the abort controller and timeout are replaced, so a
    // conflicting resume leaves the executing segment's state untouched.
    // Memory is covered only once the run is known to be resumable below, so a
    // resume that lost the race never raises the memory fence past the winner.
    const executionFence = await this.#claimExecution(runId, 'acquire');
    let initialToolCalls: ToolCallChunk[];
    let resumedText: { priorText: string; stepText: string } | undefined;
    let resumeOffset: number | 'latest';
    let persistedInput: DurableAgenticWorkflowInput | undefined;
    try {
      // A concurrent resume of the same suspension may have claimed and run it while this one
      // waited for the execution claim. Report that as a lost race, not a generic failure.
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      const current = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId,
      });
      // The row is gone once a run finishes (possibly in another process). When
      // this process already ran a segment of the run (settled above), a missing
      // row means there is nothing left to resume; resuming anyway would write a
      // fresh `pending` row. A run that was only prepared has no row yet.
      if (workflowsStore && !current && priorExecution) {
        throw new MastraError({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" resume(${runId}) could not find a suspended run for this runId. The run has already finished (for example, an earlier approval or resume already handled it), never suspended, or the runId is invalid.`,
          details: { agentName: this.name, runId },
        });
      }
      // Only a settled run counts: a just-suspended run's row can still read `running`
      // briefly, because the suspension chunk is emitted before the row is durable.
      if (current && !['suspended', 'running', 'pending', 'waiting'].includes(current.status)) {
        throw new MastraError({
          id: 'AGENT_RESUME_ALREADY_CLAIMED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it already ran.`,
          details: { agentName: this.name, runId },
        });
      }
      if (resumeRequestContext) await this.coverMemory(executionFence, resumeRequestContext);
      await this.loadRecalledMessages(runId, coldSnapshot, resumeRequestContext);
      ({ toolCalls: initialToolCalls, resumedText } = await this.#loadSuspendedIteration(runId));
      // Skip events already broadcast by the original run (e.g. the SUSPENDED
      // chunk that paused it). Without this, a resume that closes on suspend
      // (resumeGenerate) would immediately close on the replayed SUSPENDED.
      resumeOffset = await this.executionEngine.getPubsubOffset(this.pubsub, runId);
      persistedInput = current?.context?.input as DurableAgenticWorkflowInput | undefined;
      // A parked run that lost its thread lease must hold it again before the segment runs. Later
      // registration fails open, so take it here: a successor that now holds the thread refuses this
      // resume instead of running beside it, and the run stays parked.
      await agentThreadStreamRuntime.reacquireParkedRunLease(runId, this.getPubSub());
    } catch (error) {
      // The segment never started: release the run so it can be resumed again.
      await executionFence.settle(async () => {});
      throw error;
    }
    setExecutionClaim(resumeRequestContext, runId, executionFence.claim);
    for (const reg of [entry, getRunRegistryEntry(runId, this.#mastra)]) {
      if (!reg) continue;
      reg.executionFence = executionFence;
      reg.resumeToolCallId = resolvedOptions.toolCallId;
    }

    // Install a fresh abort controller for the resumed segment. The original
    // controller is gone (the stream that owned it has already settled), so
    // we overwrite the registry slot. If the caller passed an external
    // signal, forward it onto the new internal controller.
    const { controller: abortController, detach: detachExternalAbort } = createRunAbortController(
      resolvedOptions.abortSignal,
    );
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
    // The resumed segment's deadline saves the turn from the run's persisted input, as a first segment does.
    if (persistedInput) this.runInputs.set(executionFence, persistedInput);
    this.installAbortWithTotalTimeout(entry, abortController, executionFence);
    const globalEntryForAbort = getRunRegistryEntry(runId, this.#mastra);
    if (globalEntryForAbort) {
      globalEntryForAbort.abortController = abortController;
      globalEntryForAbort.abortSignal = entry.abortSignal;
    }

    const segment = this.#beginSegment(runId);

    // Assigned once the stream is created below so the shared performCleanup()
    // closure can unsubscribe the pubsub reader (via streamCleanup) from both
    // the auto-cleanup timer and the explicit cleanup() path — mirroring observe().
    let streamCleanup: (() => void) | undefined;
    // Set when a concurrent resume ran the run first: the topic is that resume's.
    let lostResumeRace = false;

    // Single cleanup path for both the auto-cleanup timer and the explicit
    // cleanup(). Revokes continuation before unsubscribing the pubsub reader,
    // then tears down the registry entries and pubsub topic this execution
    // still owns — an execution that recovered the run in this process holds
    // its own. The topic stays when the run's latest execution here (this one
    // or a later resume()) lost the run: whoever took it over, in any process,
    // writes to it. Runs at most once.
    const runCleanup = createRunCleanup({
      scheduleTimer: cleanup => this.scheduleReaderCleanup(executionFence, cleanup),
      release: () => {
        agentThreadStreamRuntime.closeRunContinuation(output, this.getPubSub());
        streamCleanup?.();
        if (this.#releaseSegment(runId, segment, entry)) {
          if (getRunRegistryEntry(runId, this.#mastra) === globalEntryForAbort) {
            globalRunRegistry.delete(runId);
            if (
              !this.unverifiedReaderFences.has(executionFence) &&
              !lostResumeRace &&
              (globalEntryForAbort?.executionFence ?? executionFence).ownsRunTopics()
            ) {
              this.clearPubsubTopic(runId, globalEntryForAbort);
            }
          }
        }
      },
    });
    const performCleanup = runCleanup.run;
    const scheduleAutoCleanup = runCleanup.schedule;

    const globalEntry = getRunRegistryEntry(runId, this.#mastra);
    const resumeModel = globalEntry?.model as any;

    // Open a fresh AGENT_RUN + MODEL_GENERATION for the resumed segment on the same
    // traceId — the originals were ended as `suspended` and can't be reopened. Post-resume
    // steps + terminal end() target these via the registry override.
    // Opened before the stream adapter so per-chunk processor spans parent under it.
    const origTraceId = entry.agentSpan?.traceId;
    const origSpanId = entry.agentSpan?.id;
    // Spans this resume opened, ended by it alone if it turns out to have lost the run.
    const ownResumeSpans: Array<{ error: (options: { error: Error; endSpan: boolean }) => void } | undefined> = [];
    if (origTraceId && this.#mastra?.observability) {
      try {
        const ag = this.#wrappedAgent as Agent<string, any, any>;
        // Match non-durable Agent.stream() resume-span shape.
        const rawConfig = typeof (ag as any).toRawConfig === 'function' ? (ag as any).toRawConfig() : undefined;
        const resolvedVersionId = rawConfig?.resolvedVersionId as string | undefined;
        const agentTracingPolicy = typeof ag.getTracingPolicy === 'function' ? ag.getTracingPolicy() : undefined;
        const resumeAgentSpan = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          outcome: null,
          name: `agent run: '${ag.id}' (resumed)`,
          entityType: EntityType.AGENT,
          entityId: ag.id,
          entityName: ag.name,
          attributes: modelSpanAttributes(resumeModel),
          metadata: {
            runId,
            resumed: true,
            ...(origSpanId ? { resumedFromSpanId: origSpanId } : {}),
            ...(resolvedVersionId ? { entityVersionId: resolvedVersionId } : {}),
          },
          resumeFrom: getResumeTracingContext(entry.agentSpan),
          tracingPolicy: agentTracingPolicy,
          tracingOptions: { traceId: origTraceId, ...entry.agentSpan?.traceState },
          traceState: entry.agentSpan?.traceState,
          samplingDecision: entry.agentSpan?.isValid,
          requestContext: resolvedOptions.requestContext,
          mastra: this.#mastra,
        });
        const resumeModelSpan = resumeAgentSpan?.createChildSpan({
          type: SpanType.MODEL_GENERATION,
          outcome: null,
          name: `llm: '${resumeModel?.modelId ?? ''}'`,
          attributes: { model: resumeModel?.modelId, provider: resumeModel?.provider, streaming: true },
          metadata: { runId, resumed: true },
          requestContext: resolvedOptions.requestContext,
        });
        ownResumeSpans.push(resumeModelSpan, resumeAgentSpan);
        for (const reg of [entry, getRunRegistryEntry(runId, this.#mastra)]) {
          if (!reg) continue;
          reg.resumeAgentSpan = resumeAgentSpan;
          reg.resumeModelSpan = resumeModelSpan;
          reg.resumeAgentSpanData = resumeAgentSpan?.snapshot?.() ?? resumeAgentSpan?.exportSpan();
          reg.resumeModelSpanData = resumeModelSpan?.snapshot?.() ?? resumeModelSpan?.exportSpan();
          // Fresh spans capture their own first-chunk clock, never a prior segment's.
          reg.resumeCompletionStartTime = undefined;
          reg.resumeTimeToFirstTokenMs = undefined;
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
      fail: failResumeStream,
      waitForEventDelivery,
      ready,
    } = createDurableAgentStream<TOutput>({
      pubsub: this.pubsub,
      runId,
      minGeneration: executionFence.generation,
      onTerminalEvent: this.owningReaderTerminal(runId, executionFence),
      messageId: crypto.randomUUID(),
      initialToolCalls,
      resumedText,
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
      agent: entry.agent,
      requestContext: resolvedOptions.requestContext,
      // Caller option wins, then the flag persisted at prepare time. Only fall
      // back to resolvedOptions (which merges agent defaultOptions) last, so a
      // configured default can't override the original run-level request.
      returnScorerData: options?.returnScorerData ?? entry.returnScorerData ?? resolvedOptions.returnScorerData,
      tracingContext: resumeSegmentSpan ? { currentSpan: resumeSegmentSpan } : undefined,
      messageList: globalEntry?.messageList ?? this.executionRunRegistry.getMessageList(runId),
    });
    streamCleanup = createdStreamCleanup;

    // Wait for subscription to be ready, then resume workflow
    const requestContext = resolvedOptions.requestContext;

    const workflowExecution = executionFence.run(() =>
      ready
        .then(async () => {
          if (await this.redeliverDeadlineError(entry, executionFence)) return;
          // Looked up inside the chain so a throw settles (releases) the claim.
          const workflow = this.getWorkflow();
          // The prior segment was settled above (before the event-offset
          // capture), so the snapshot is already persisted as 'suspended'.
          // Evented engine: make sure the workflow event workers are running
          // before resume — a resume in a fresh process (or after shutdown())
          // would otherwise publish events nobody consumes and hang.
          await this.executionEngine.ensureEngineWorkersStarted(this.workflowEngine, this.logger);
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
            result = await this.withSuspensionAfterPersist(runId, () =>
              run.resume({
                resumeData,
                label: resolvedOptions.toolCallId,
                requestContext,
                actor: resolvedOptions.actor,
                ...createObservabilityContext({ currentSpan: entry.resumeAgentSpan ?? entry.agentSpan }),
              }),
            );
          } catch (error) {
            // This resume saw the run suspended when it claimed it, so the workflow no longer
            // being suspended means a concurrent resume ran it first. The run, its topic and
            // its spans belong to that resume: release the claim without writing run state
            // and report the lost race to this caller only.
            // When the resume claim is persisted (`persistResumeClaim`), the losing CAS reports the
            // race as WORKFLOW_RESUME_ALREADY_CLAIMED instead.
            if (
              error instanceof MastraError &&
              (error.id === 'WORKFLOW_RUN_NOT_SUSPENDED' || error.id === 'WORKFLOW_RESUME_ALREADY_CLAIMED')
            ) {
              const lost = new MastraError({
                id: 'AGENT_RESUME_ALREADY_CLAIMED',
                domain: ErrorDomain.AGENT,
                category: ErrorCategory.USER,
                text: `DurableAgent "${this.name}" resume(${runId}) cannot resume the run because another resume of it already ran.`,
                details: { agentName: this.name, runId },
              });
              lostResumeRace = true;
              await executionFence.settle(async () => {});
              for (const span of ownResumeSpans) span?.error({ error: lost, endSpan: true });
              await failResumeStream(lost);
              return;
            }
            throw error;
          } finally {
            await stopGoalActivity({ agentId: this.id, runId });
            if (result?.status !== 'suspended' && workflow.runs.get(runId) === run) {
              workflow.runs.delete(runId);
            }
          }
          await this.settleExecution(runId, executionFence, {
            status: result?.status,
            error:
              result?.status === 'failed'
                ? this.executionEngine.workflowFailureError((result as any).error, 'Workflow resume failed')
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
        .catch(error =>
          this.settleExecution(runId, executionFence, {
            error: this.executionEngine.workflowExecutionError(error, 'Workflow resume failed'),
          }),
        )
        .finally(detachExternalAbort),
    );
    const trackedResumeEntry = getRunRegistryEntry(runId, this.#mastra);
    if (trackedResumeEntry) {
      trackedResumeEntry.workflowExecution = workflowExecution;
    }
    void workflowExecution.then(releaseResumeMarker, releaseResumeMarker);

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
          stepOwner: () => getRunRegistryEntry(runId, this.#mastra),
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
      // A run parked on a suspension has no steps left to stop; release it so
      // it is no longer listed as suspended.
      if (agentThreadStreamRuntime.isRunParked(runId, this.getPubSub())) super.abortRunStream(runId);
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

  /** @deprecated Use `resumeStream(resumeData, { untilIdle: true })` instead. */
  override async resumeStreamUntilIdle(resumeData: any, streamOptions?: any): Promise<MastraModelOutput<TOutput>> {
    const { maxIdleMs, ...options } = streamOptions ?? {};
    return this.resumeStream(resumeData, {
      ...options,
      untilIdle: maxIdleMs === undefined ? true : { maxIdleMs },
    });
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
    return this.resumeGenerate({ approved: true }, { ...resumeOptions, runId } as any) as any;
  }

  override async declineToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string; reason?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    const { runId, reason, ...resumeOptions } = options;
    return this.resumeGenerate({ approved: false, ...(reason !== undefined ? { reason } : {}) }, {
      ...resumeOptions,
      runId,
    } as any) as any;
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
   * Note on suspend persistence: both `DurableAgent` and `EventedAgent` track
   * the workflow engine's `run.start()` through snapshot persistence, so
   * awaiting `workflowExecution` on suspend is sufficient for a subsequent
   * `resumeGenerate()` to find the snapshot.
   */
  // @ts-expect-error - Intentionally different signature for durable execution
  async generate(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<FullOutput<TOutput>> {
    options = await this.#resolveExecutionOptions(applyReservedMemoryContextKeys(options));

    const { output, runId, cleanup } = await this.#execute(messages, options, 'generate');

    let suspended = false;
    try {
      const fullOutput = (await drainAgentOutput(output)) as FullOutput<TOutput>;
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
        await getRunRegistryEntry(runId, this.#mastra)?.workflowExecution;
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
    resumeData: unknown,
    options: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2] & { runId: string },
  ): Promise<FullOutput<TOutput>>;
  /** @deprecated Use `resumeGenerate(resumeData, { runId, ...options })`, matching `Agent.resumeGenerate`. */
  async resumeGenerate(
    runId: string,
    resumeData: unknown,
    options?: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2],
  ): Promise<FullOutput<TOutput>>;
  async resumeGenerate(...args: unknown[]): Promise<FullOutput<TOutput>> {
    const { runId, resumeData, options } = normalizeResumeGenerateArgs(args);
    const result = await this.resume(runId, resumeData, {
      ...(options ?? {}),
      closeOnSuspend: true,
    } as Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2]);
    let suspended = false;
    try {
      const fullOutput = (await drainAgentOutput(result.output)) as FullOutput<TOutput>;
      suspended = fullOutput.finishReason === 'suspended';
      if (suspended) {
        await getRunRegistryEntry(result.runId, this.#mastra)?.workflowExecution;
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
   * A replay from an offset can start past the marker of the execution that
   * took the run over, and would then accept what the lost execution still
   * publishes, its finish included. Start the reader with the floor it would
   * have reached by reading the skipped events: the highest generation among
   * them. Ordinary suspend/resume segments then still replay, since each
   * segment's events precede the next claim. When the transport keeps no
   * history to read, follow the run's current claim instead.
   * Runs fenced by a pubsub lease have no generation and are unaffected.
   * The floor only adds protection, so a failed read must not fail the reconnect;
   * the reader reads the claim again before an event can end its stream.
   */
  async #readReplayFloor(
    runId: string,
    offset: number | undefined,
  ): Promise<
    Pick<DurableStreamAdapterOptions, 'minGeneration' | 'rereadMinGeneration' | 'keepReplayEvent'> & {
      refreshReplayFilter?: () => Promise<unknown>;
    }
  > {
    try {
      const { keepReplayEvent: initialFilter, ...floor } = await this.executionEngine.readReplayFloor(
        this.pubsub,
        runId,
        offset,
      );
      let refreshedFilter: Promise<typeof initialFilter> | undefined;
      let currentFilter: typeof initialFilter | undefined;
      // Subscription can replay a newer claim than the snapshot above. Refresh
      // before the first replayed event; live events and later deliveries stay synchronous.
      const refreshReplayFilter = () => {
        refreshedFilter ??= this.executionEngine
          .readReplayFloor(this.pubsub, runId, undefined)
          .then(evidence => (currentFilter = evidence.keepReplayEvent))
          .catch(() => (currentFilter = initialFilter));
        return refreshedFilter;
      };
      const keepReplayEvent = (event: AgentStreamEvent): boolean | Promise<boolean> => {
        if (event.index === undefined) return (currentFilter ?? initialFilter)(event);
        if (currentFilter) return currentFilter(event);
        return refreshReplayFilter().then(filter => filter(event));
      };
      return { ...floor, keepReplayEvent, refreshReplayFilter };
    } catch (error) {
      this.logger.warn(`[DurableAgent] Couldn't read the claim of run ${runId}; observing it without a floor`, {
        error,
      });
      return { rereadMinGeneration: () => readRunGeneration(this.#mastra, runId) };
    }
  }

  /** Reconcile only after subscribing, so a completion racing attachment is not lost. */
  async #isObservationComplete(runId: string): Promise<boolean> {
    try {
      const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
      // Read twice before concluding absence/completion. In particular a newer
      // claim must win over terminal replay from the execution it superseded.
      for (let attempt = 0; attempt < 2; attempt++) {
        const history = await this.pubsub.getHistory(AGENT_STREAM_TOPIC(runId), 0);
        // A newer segment's nonterminal history keeps the observer attached even
        // when ownership reads fail or an older segment ended with suspension.
        const historyGeneration = history.reduce<number | undefined>(
          (floor, event) =>
            event.generation === undefined ? floor : Math.max(floor ?? event.generation, event.generation),
          undefined,
        );
        const latest = history.findLast(
          event =>
            event.generation === undefined || historyGeneration === undefined || event.generation >= historyGeneration,
        );
        if (latest) {
          const type = latest.type === AgentStreamEventTypes.CHUNK ? latest.data?.type : latest.type;
          if (type !== 'finish' && type !== 'error' && type !== 'abort') return false;
        }
        const ownership =
          workflowsStore && (await supportsRunFencing(workflowsStore))
            ? await workflowsStore.getRunOwnership({ runId })
            : undefined;
        const minGeneration = history.reduce<number | undefined>(
          (floor, event) =>
            event.generation === undefined ? floor : Math.max(floor ?? event.generation, event.generation),
          ownership?.generation,
        );
        const keepGeneration = createRunGenerationFilter({ minGeneration });
        let hasHistory = false;
        let terminal = false;
        for (const event of history) {
          if (!(await keepGeneration(event as unknown as AgentStreamEvent))) continue;
          hasHistory = true;
          const type = event.type === AgentStreamEventTypes.CHUNK ? event.data?.type : event.type;
          if (type === 'finish' || type === 'error' || type === 'abort') terminal = true;
        }
        if (!terminal) {
          if (hasHistory || ownership?.live) return false;
          if (getRunRegistryEntry(runId, this.#mastra) || this.executionRunRegistry.get(runId)) return false;
          if (await resolveLeaseProvider(this.pubsub).getLeaseOwner(executionLeaseKey(this.id, runId))) {
            return false;
          }
          if (workflowsStore) {
            for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
              const record = await workflowsStore.getWorkflowRunById({ runId, workflowName });
              if (!record) continue;
              const snapshot =
                typeof record.snapshot === 'string'
                  ? (JSON.parse(record.snapshot) as WorkflowRunState)
                  : record.snapshot;
              const input = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
              if (input?.__workflowKind === 'durable-agent' && input.agentId !== this.id) {
                throw new MastraError({
                  id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  text: `DurableAgent "${this.name}" observe(${runId}): persisted run belongs to agent "${input.agentId}", not "${this.id}".`,
                  details: { agentName: this.name, runId, ownerAgentId: input.agentId },
                });
              }
              // A failed cleanup can leave terminal snapshots behind. Unknown
              // statuses stay observable, including suspension without a lease.
              if (
                !snapshot ||
                !['success', 'failed', 'tripwire', 'canceled', 'bailed', 'skipped'].includes(snapshot.status)
              ) {
                return false;
              }
            }
          }
        }
      }
      return true;
    } catch (error) {
      if (error instanceof MastraError && error.id === 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH') throw error;
      // Unavailable lifecycle evidence cannot prove that the producer is gone.
      return false;
    }
  }

  /**
   * Subscribe to a run's raw AgentStreamEvents, filtering out events from
   * executions that lost ownership and takeover markers. Callers must map
   * these events to the public frame contract produced by stream-adapter.ts's
   * createDurableAgentStream before sending them to clients; raw event
   * envelopes are not public stream frames. Resolves once subscribed, with
   * a function that unsubscribes.
   *
   * @internal
   */
  async __subscribeToRunStream(
    runId: string,
    options: { offset?: number; onComplete?: () => void },
    onEvent: (event: AgentStreamEvent) => void,
  ): Promise<() => Promise<void>> {
    const replayFloor = await this.#readReplayFloor(runId, options.offset);
    const keepGeneration = createRunGenerationFilter(replayFloor);
    const topic = AGENT_STREAM_TOPIC(runId);
    let subscribed = true;
    let activityVersion = 0;
    let bufferingReplay = true;
    const bufferedEvents: Array<() => Promise<void>> = [];

    // Step-finish events carry only the response messages that changed; rebuild the full list so
    // the frames match what the run's own stream reports. A reader starting at an offset first
    // rebuilds it from the events it skips.
    let responseMessages: ResponseMessagesReplay = { messages: [] };
    const offset = options.offset;
    if (offset !== undefined && offset > 0 && this.pubsub.supportsOffsets) {
      try {
        const skipped = (await this.pubsub.getHistory(topic, 0)).filter(
          event => typeof event.index === 'number' && event.index < offset,
        );
        responseMessages = replayResponseMessages(skipped);
      } catch (error) {
        this.logger.warn(`[DurableAgent] Couldn't read run ${runId}'s history before offset ${offset}`, { error });
      }
    }

    const deliver = (event: AgentStreamEvent) => {
      activityVersion++;
      if (
        !subscribed ||
        event.type === AgentStreamEventTypes.OWNERSHIP_CLAIMED ||
        event.type === AgentStreamEventTypes.ITERATION_START
      )
        return;
      const chunk = event.type === AgentStreamEventTypes.CHUNK ? (event.data as AgentChunkEventData) : undefined;
      if (chunk?.type === 'step-finish' && chunk.payload) {
        event = {
          ...event,
          data: {
            ...chunk,
            payload: withRebuiltResponseMessages(
              responseMessages,
              chunk.payload as unknown as AgentStreamStepFinishPayload,
            ),
          },
        };
      }
      // Keep `index`: the observe route forwards it on each frame so clients can resume at index + 1.
      onEvent(event);
    };
    const filterEvent = (streamEvent: AgentStreamEvent) => {
      const filterGeneration = () => {
        const keep = keepGeneration(streamEvent);
        if (typeof keep === 'boolean') {
          if (keep) deliver(streamEvent);
          return;
        }
        return keep.then(kept => {
          if (kept) deliver(streamEvent);
        });
      };
      const keepReplay = replayFloor.keepReplayEvent?.(streamEvent);
      if (keepReplay === undefined || keepReplay === true) return filterGeneration();
      if (keepReplay === false) return;
      return keepReplay.then(keep => {
        if (keep) return filterGeneration();
      });
    };
    // Replayed frames are held until attachment finishes and the claim history
    // is refreshed; a claim can arrive partway through replay. Acknowledge only
    // after filtering and delivery, including frames that are dropped.
    const acknowledge = withAck(event => filterEvent(event as AgentStreamEvent));
    const callback: ReturnType<typeof withAck> = (event, ...args) => {
      if (!subscribed) return args[0]?.() ?? Promise.resolve();
      activityVersion++;
      if (bufferingReplay) {
        bufferedEvents.push(async () => {
          await acknowledge(event, ...args);
        });
        return Promise.resolve();
      }
      return acknowledge(event, ...args);
    };
    const unsubscribe = async () => {
      if (!subscribed) return;
      subscribed = false;
      await this.pubsub.unsubscribe(topic, callback);
    };

    try {
      await (options.offset !== undefined
        ? this.pubsub.subscribeFromOffset(topic, options.offset, callback)
        : this.pubsub.subscribeWithReplay(topic, callback));
      await replayFloor.refreshReplayFilter?.();
      // Index cursor keeps the drain linear; live frames can still append while draining.
      for (let i = 0; i < bufferedEvents.length; i++) {
        await bufferedEvents[i]!();
      }
      bufferedEvents.length = 0;
      bufferingReplay = false;

      const reconciledVersion = activityVersion;
      if (options.onComplete && (await this.#isObservationComplete(runId)) && activityVersion === reconciledVersion) {
        options.onComplete();
      }
      return unsubscribe;
    } catch (error) {
      await unsubscribe();
      throw error;
    }
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
       * lifecycle events, not chunks. Each chunk carries its event's index as `chunk.index`: to resume
       * after a dropped connection, pass the `index + 1` of the last chunk that has an index. Omit it to replay all available cached events. Transports
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
      onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string; detach: () => void }> {
    let memoryInfo = this.executionRunRegistry.getMemoryInfo(runId);

    let terminalCompleted = false;
    let abortPending = false;
    let cleanupRequested = false;
    let streamCleanup: (() => void) | undefined;

    const localEntry = this.executionRunRegistry.get(runId);
    const observedEntry = localEntry ?? getRunRegistryEntry(runId, this.#mastra);
    const observedFence = observedEntry?.executionFence;
    const runCleanup = createRunCleanup({
      scheduleTimer: cleanup =>
        observedFence
          ? this.scheduleReaderCleanup(observedFence, cleanup)
          : this.__getStreamBus().scheduleCleanup(cleanup),
      release: () => {
        streamCleanup?.();
        if (
          observedFence &&
          (this.unverifiedReaderFences.has(observedFence) ||
            !observedFence.ownsRunTopics() ||
            getRunRegistryEntry(runId, this.#mastra)?.executionFence !== observedFence ||
            (localEntry &&
              (this.executionRunRegistry.get(runId) !== localEntry || localEntry.executionFence !== observedFence)))
        ) {
          return;
        }
        this.executionRunRegistry.cleanup(runId);
        deleteRunRegistryEntry(runId, this.#mastra);
        this.clearPubsubTopic(runId, observedEntry);
      },
    });
    const performCleanup = runCleanup.run;
    const scheduleAutoCleanup = runCleanup.schedule;

    const completeTerminalLifecycle = () => {
      terminalCompleted = true;
      abortPending = false;
      if (cleanupRequested) {
        performCleanup();
      } else {
        scheduleAutoCleanup();
      }
    };

    const observedAgentSpan = observedEntry?.resumeAgentSpan ?? observedEntry?.agentSpan;
    let structuredOutput = observedEntry?.structuredOutput;
    let outputProcessors = observedEntry?.outputProcessors;
    const processorStates = observedEntry?.processorStates;
    let streamAgent: Agent<any, any, any, any> = observedEntry?.agent ?? this.#wrappedAgent;
    let returnScorerData = observedEntry?.returnScorerData;
    let requestContext = observedEntry?.requestContext;
    let messageList = observedEntry?.messageList ?? this.executionRunRegistry.getMessageList(runId);
    // Worker entries can carry runtime dependencies without the caller's live transcript.
    const liveEntry = messageList ? observedEntry : undefined;
    if (liveEntry?.agentId !== undefined && liveEntry.agentId !== this.id) {
      throw new MastraError({
        id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" observe(${runId}): live run belongs to agent "${liveEntry.agentId}", not "${this.id}".`,
        details: { agentName: this.name, runId, ownerAgentId: liveEntry.agentId },
      });
    }
    let workflowInput: DurableAgenticWorkflowInput | undefined;
    let loopSnapshot: WorkflowRunState | undefined;
    let workflowInputSnapshot: WorkflowRunState | undefined;
    const workflowsStore = !liveEntry ? await this.#mastra?.getStorage()?.getStore('workflows') : undefined;

    if (!structuredOutput || !liveEntry) {
      const snapshotStore = workflowsStore ?? (await this.#mastra?.getStorage()?.getStore('workflows'));

      for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
        const persisted = await snapshotStore?.getWorkflowRunById({ runId, workflowName });
        if (!persisted) continue;

        const snapshot =
          typeof persisted.snapshot === 'string'
            ? (JSON.parse(persisted.snapshot) as WorkflowRunState)
            : persisted.snapshot;
        if (workflowName === DurableStepIds.AGENTIC_LOOP) loopSnapshot = snapshot;
        const persistedInput = snapshot?.context?.input as DurableAgenticWorkflowInput | undefined;
        if (persistedInput?.__workflowKind !== 'durable-agent') continue;

        workflowInput = persistedInput;
        workflowInputSnapshot = snapshot;
        break;
      }
    }

    if (!liveEntry && workflowInput && workflowInput.agentId !== this.id) {
      throw new MastraError({
        id: 'DURABLE_AGENT_OBSERVE_AGENT_MISMATCH',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `DurableAgent "${this.name}" observe(${runId}): persisted run belongs to agent "${workflowInput.agentId}", not "${this.id}".`,
        details: { agentName: this.name, runId, ownerAgentId: workflowInput.agentId },
      });
    }

    if (!structuredOutput && workflowInput) {
      const persistedStructuredOutput = workflowInput.options?.structuredOutput;
      if (persistedStructuredOutput?.schema) {
        const { errorStrategy, fallbackValue, ...rest } = persistedStructuredOutput;
        const schema = toLiveStructuredOutputSchema<{}>(
          persistedStructuredOutput.schema,
          persistedStructuredOutput.nullToUndefined,
        );
        // A non-JSON-safe fallbackValue is not persisted; keep the default strategy then.
        structuredOutput =
          errorStrategy === 'fallback'
            ? fallbackValue === undefined
              ? { ...rest, schema }
              : { ...rest, schema, errorStrategy, fallbackValue: fallbackValue as {} }
            : { ...rest, schema, errorStrategy };
      }
    }

    if (!liveEntry && workflowInput) {
      requestContext = workflowInput.requestContextEntries
        ? new RequestContext(Object.entries(workflowInput.requestContextEntries))
        : new RequestContext();

      const messageListMemoryInfo = (
        workflowInput.messageListState as { memoryInfo?: { threadId?: string; resourceId?: string } } | undefined
      )?.memoryInfo;
      const threadId = workflowInput.state?.threadId ?? messageListMemoryInfo?.threadId;
      const resourceId = workflowInput.state?.resourceId ?? messageListMemoryInfo?.resourceId;
      memoryInfo = threadId && resourceId ? { threadId, resourceId } : undefined;

      if (threadId && resourceId) {
        requestContext.set('MastraMemory', {
          thread: { id: threadId },
          resourceId,
          memoryConfig: workflowInput.state?.memoryConfig,
        });
      } else {
        requestContext.delete('MastraMemory');
      }

      messageList = new MessageList({ threadId, resourceId });
      try {
        const snapshot = workflowInputSnapshot ?? loopSnapshot;
        const storedState = workflowInput.messageListState ?? (snapshot ? latestMessageListState(snapshot) : undefined);
        if (storedState) {
          const initialState = await hydrateMessageListState(
            { getInitData: () => workflowInput!, mastra: this.#mastra },
            storedState,
          );
          messageList.deserialize(initialState);
        }

        if (workflowsStore && snapshot) {
          const inputMessages = messageList.get.input.db();
          const latestState = await this.loadLatestMessageListState(workflowsStore, runId, snapshot);
          if (latestState) {
            messageList.deserialize(latestState);
            if (messageList.get.input.db().length === 0 && inputMessages.length > 0) {
              messageList.add(inputMessages, 'input');
            }
          }
        }
      } catch (error) {
        this.#mastra
          ?.getLogger?.()
          ?.warn?.(`[DurableAgent] observe(${runId}) messageList deserialize skipped: ${error}`);
      }

      let processorAgent: Agent<any, any, TOutput> = this.#wrappedAgent as Agent<any, any, TOutput>;
      const pinnedVersionId = workflowInput.agentVersionId;
      if (pinnedVersionId && this.#mastra && !this.__isStoredVersionApplied()) {
        const currentVersionId = this.toRawConfig()?.resolvedVersionId;
        if (pinnedVersionId !== currentVersionId) {
          try {
            processorAgent = (await this.#mastra.resolveVersionedAgent(this as unknown as Agent, {
              versionId: pinnedVersionId,
            })) as unknown as Agent<any, any, TOutput>;
          } catch (error) {
            this.#mastra
              .getLogger?.()
              ?.warn?.(
                `[DurableAgent] Failed to resolve pinned agent version for durable observe, using current definition: ${error}`,
              );
          }
        }
      }

      // Hooks get the agent the output processors come from, not an entry's agent
      // (which is the current version). A pinned version is a DurableAgent fork; unwrap it.
      streamAgent =
        isDurableAgentLike(processorAgent) && processorAgent.agent !== processorAgent
          ? processorAgent.agent
          : processorAgent;
      try {
        outputProcessors = (await processorAgent.listOutputProcessors(requestContext)) ?? [];
      } catch (error) {
        outputProcessors = [];
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] observe(${runId}) processor resolution failed: ${error}`);
      }
      returnScorerData = workflowInput.options?.returnScorerData;
    }

    const refreshObservedMessageList = async (isExpired: () => boolean) => {
      const targetMessageList = messageList;
      const snapshot = workflowInputSnapshot ?? loopSnapshot;
      if (!workflowsStore || !snapshot || !targetMessageList) return;

      try {
        const inputMessages = targetMessageList.get.input.db();
        const latestState = await this.loadLatestMessageListState(workflowsStore, runId, snapshot);
        if (latestState && !isExpired()) {
          targetMessageList.deserialize(latestState);
          if (targetMessageList.get.input.db().length === 0 && inputMessages.length > 0) {
            targetMessageList.add(inputMessages, 'input');
          }
        }
      } catch (error) {
        this.#mastra?.getLogger?.()?.warn?.(`[DurableAgent] observe(${runId}) messageList refresh failed: ${error}`);
      }
    };

    const refreshObservedMessageListWithTimeout = async () => {
      const refreshTimeoutMs = Math.min(
        options?.idleTimeoutMs && options.idleTimeoutMs > 0
          ? options.idleTimeoutMs
          : OBSERVED_MESSAGE_LIST_REFRESH_TIMEOUT_MS,
        OBSERVED_MESSAGE_LIST_REFRESH_TIMEOUT_MS,
      );
      let expired = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<boolean>(resolve => {
        timeout = setTimeout(() => {
          expired = true;
          resolve(true);
        }, refreshTimeoutMs);
      });

      try {
        const didTimeOut = await Promise.race([refreshObservedMessageList(() => expired).then(() => false), timedOut]);
        if (didTimeOut) {
          this.#mastra
            ?.getLogger?.()
            ?.warn?.(`[DurableAgent] observe(${runId}) messageList refresh timed out after ${refreshTimeoutMs}ms`);
        }
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    };

    let observedResponseText = '';
    const handleObservedChunk = async (chunk: ChunkType<TOutput>) => {
      if (chunk.type === 'text-delta' && typeof chunk.payload.text === 'string') {
        observedResponseText += chunk.payload.text;
      }
      if (chunk.type === 'step-finish') {
        await refreshObservedMessageListWithTimeout();
        if (messageList && messageList.get.response.db().length === 0 && observedResponseText) {
          messageList.add({ role: 'assistant', content: observedResponseText }, 'response');
        }
      }
      await options?.onChunk?.(chunk);
    };

    const replayFloor = await this.#readReplayFloor(runId, options?.offset);

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
      replayResponseMessagesBeforeOffset: true,
      ...replayFloor,
      idleTimeoutMs: options?.idleTimeoutMs,
      isAlive: options?.isAlive,
      onChunk: handleObservedChunk,
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
      structuredOutput: structuredOutput as any,
      agent: streamAgent,
      outputProcessors,
      processorStates,
      returnScorerData,
      requestContext,
      tracingContext: observedAgentSpan ? { currentSpan: observedAgentSpan } : undefined,
      messageList,
    });
    const { output, ready, detach } = stream;
    streamCleanup = stream.cleanup;

    // This output belongs to this observer alone, so a consumer that stops
    // reading fullStream (break/return/throw out of `for await`) should detach
    // the observer. MastraModelOutput fans out to several readers and only drops
    // the cancelled reader's listeners, so the cancel never reaches the pubsub
    // subscription — pass it through here.
    detachFullStreamOnEnd(output, detach);

    // Wait for subscription to be ready
    try {
      await ready;
      await replayFloor.refreshReplayFilter?.();
      await stream.waitForEventDelivery();
      const reconciledVersion = stream.activityVersion;
      if ((await this.#isObservationComplete(runId)) && stream.activityVersion === reconciledVersion) detach();
    } catch (error) {
      detach();
      throw error;
    }

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
      const controller = (getRunRegistryEntry(runId, this.#mastra) ?? this.executionRunRegistry.get(runId))
        ?.abortController;
      if (controller && !controller.signal.aborted) {
        controller.abort(reason);
      }
      await this.requestRemoteAbort(runId);
      // A run parked on a suspension has no steps left to stop; release it so
      // it is no longer listed as suspended, as the stream abort does.
      if (agentThreadStreamRuntime.isRunParked(runId, this.getPubSub())) super.abortRunStream(runId);
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
   * Get the workflow instance for direct execution.
   * Lazily creates the workflow and registers Mastra on it (needed for
   * getAgentById in execution steps).
   */
  getWorkflow(): ReturnType<typeof createDurableAgenticWorkflow> {
    if (!this.executionEngine.workflow) this.#warnIfStorageVersionUnsupported();
    return (
      this.executionEngine.workflow ??
      this.executionEngine.getWorkflow({
        maxSteps: this.#maxSteps,
        workflowEngine: this.workflowEngine,
        storesRunsInJournal: this.storesRunsInJournal,
        shouldPersistSnapshot: this.userShouldPersistSnapshot,
        logger: this.logger,
        guardrailLogger: this.guardrailLogger,
      })
    );
  }

  /**
   * One-time guardrail warnings for user-supplied `shouldPersistSnapshot`
   * policies. Probes the predicate with an empty `stepResults`, so predicates
   * that read `stepResults` may probe inaccurately — the warnings are
   * best-effort and never block execution.
   *
   * Engine variants own their warnings during workflow creation. This method
   * remains available for direct calls and subclass super calls.
   *
   * @internal
   */
  protected warnOnRiskyPersistencePolicy(): void {
    this.executionEngine.warnOnRiskyPersistencePolicy(this.userShouldPersistSnapshot, this.guardrailLogger);
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
      scopesResolved: !!(options as { [SCOPES_ALREADY_APPLIED]?: boolean } | undefined)?.[SCOPES_ALREADY_APPLIED],
      resumedSpanData: (options as { [RESUMED_SPAN_DATA]?: PreparationOptions['resumedSpanData'] } | undefined)?.[
        RESUMED_SPAN_DATA
      ],
      mastra: this.#mastra,
      durableAgentId: this.id,
      durableAgentName: this.name,
    });

    preparation.registryEntry.agentId = this.id;
    this.executionRunRegistry.registerWithMessageList(
      preparation.runId,
      preparation.registryEntry,
      preparation.messageList,
      {
        threadId: preparation.threadId,
        resourceId: preparation.resourceId,
      },
    );
    await this.attachStreamPublisher(preparation.runId, {
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
    this.#wrapperStreamBus?.registerMastra(mastra.pubsub);
  }
}
