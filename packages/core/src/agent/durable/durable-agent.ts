import type { MastraServerCache } from '../../cache/base';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { withAck } from '../../events/acking-callback';
import type { PubSub } from '../../events/pubsub';
import { validateModelTimeoutSettings } from '../../llm/model/model-settings';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import { LOCAL_MODEL_REQUEST_KEY } from '../../loop/run-scope-keys';
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
import { resolveRunId } from '../helpers';
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
import type { AgentDurableOption, ToolsInput } from '../types';
import { isDurableAgentLike } from '../types';
import { resolveThreadIdFromArgs } from '../utils';

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
import type { PreparationResult } from './preparation';
import { prepareForDurableExecution, SCOPES_ALREADY_APPLIED, RESUMED_SPAN_DATA } from './preparation';
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
import type { createDurableAgenticWorkflow } from './workflows';
import { hydrateMessageListState, latestMessageListState } from './workflows/shared/message-list-state';

const OBSERVED_MESSAGE_LIST_REFRESH_TIMEOUT_MS = 5_000;

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
    fork.activeStreamUntilIdle = this.activeStreamUntilIdle;
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

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Stream a response from the agent using durable execution.
   */
  // @ts-expect-error - Intentionally different signature for durable execution
  declare stream: (
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ) => Promise<DurableAgentStreamResult<TOutput>>;

  declare resumeStream: (resumeData: any, streamOptions?: any) => Promise<MastraModelOutput<TOutput>>;

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
  declare generate: (
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ) => Promise<FullOutput<TOutput>>;

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
  declare resumeGenerate: {
    (
      resumeData: unknown,
      options: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2] & { runId: string },
    ): Promise<FullOutput<TOutput>>;
    /** @deprecated Use `resumeGenerate(resumeData, { runId, ...options })`, matching `Agent.resumeGenerate`. */
    (
      runId: string,
      resumeData: unknown,
      options?: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2],
    ): Promise<FullOutput<TOutput>>;
  };

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
