import type { MastraServerCache } from '../../cache/base';
import type { PubSub } from '../../events/pubsub';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { DeclaredAgentSchedule } from '../../schedules/define';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import type { ChunkType, MastraOnFinishCallback, MastraStreamTransformOptions } from '../../stream/types';
import type { DynamicArgument } from '../../types';
import type { ShouldPersistSnapshotFn, WorkflowRunStatus } from '../../workflows/types';
import { Agent } from '../agent';
import type { AgentExecutionOptions } from '../agent.types';
import type { MessageListInput } from '../message-list';
import type { AgentStreamBus } from '../streams/bus';
import type { AgentRunRecord } from '../streams/run-records';
import { durableReplayOwnerKey, readAgentRunRecord, readDurableReplayOwner } from '../streams/run-records';
import type { AgentStreamsConfig } from '../streams/types';
import type { AgentDurableOption, ToolsInput } from '../types';

import { DurableExecutionEngine } from './execution-engine';
import type { ExtendedRunRegistry } from './run-registry';
import type {
  AgentAbortEventData,
  AgentStreamEvent,
  DurableAgentStepFinishResult,
  AgentSuspendedEventData,
} from './types';
import type { createDurableAgenticWorkflow } from './workflows';

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
  /** Trace ID of the run, when the run is traced */
  traceId?: string;
  /** ID of the agent run span, when the run is traced */
  spanId?: string;
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

// @ts-expect-error - Legacy durable methods intentionally specialize the base Agent API.
export interface DurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> {
  stream(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<TOutput>,
  ): Promise<DurableAgentStreamResult<TOutput>>;

  resumeStream(resumeData: any, streamOptions?: any): Promise<MastraModelOutput<TOutput>>;

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
  generate(messages: MessageListInput, options?: DurableAgentStreamOptions<TOutput>): Promise<FullOutput<TOutput>>;

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
  resumeGenerate(
    resumeData: unknown,
    options: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2] & { runId: string },
  ): Promise<FullOutput<TOutput>>;
  /** @deprecated Use `resumeGenerate(resumeData, { runId, ...options })`, matching `Agent.resumeGenerate`. */
  resumeGenerate(
    runId: string,
    resumeData: unknown,
    options?: Parameters<DurableAgent<TAgentId, TTools, TOutput>['resume']>[2],
  ): Promise<FullOutput<TOutput>>;

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
   *
   * By default the observed stream stays open when the run suspends (e.g. for
   * tool approval) so a later resume can continue on the same reader. Pass
   * `closeOnSuspend: true` to end the stream at the suspension boundary so
   * `fullStream`/`text`/`getFullOutput()` resolve instead of hanging; closing
   * stays observer-scoped, keeping the run's registry entry and replay history
   * so it can still be resumed with `resume()`/`resumeStream()`.
   */
  observe(
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
      /**
       * Whether this observer's stream closes when the observed run suspends
       * (e.g. for tool approval). Defaults to `false`: the stream stays open
       * across suspension so a later resume can continue on this same reader.
       *
       * Set to `true` so `fullStream`, `text`, and `getFullOutput()` resolve at
       * the suspension boundary instead of hanging. Closing stays
       * observer-scoped — the run's registry entry and replay history are
       * preserved. Resume the run with `resumeStream()`/`resume()`, which always
       * return a fresh stream.
       */
      closeOnSuspend?: boolean;
      onChunk?: (chunk: ChunkType<TOutput>) => void | Promise<void>;
      experimentalTransform?: MastraStreamTransformOptions<TOutput>;
      onStepFinish?: (result: DurableAgentStepFinishResult) => void | Promise<void>;
      onFinish?: MastraOnFinishCallback<TOutput>;
      onError?: ({ error }: { error: Error | string }) => void | Promise<void>;
      onAbort?: (data: AgentAbortEventData) => void | Promise<void>;
      onSuspended?: (data: AgentSuspendedEventData) => void | Promise<void>;
    },
  ): Promise<Omit<DurableAgentStreamResult<TOutput>, 'runId'> & { runId: string; detach: () => void }>;

  /**
   * @deprecated Use `stream(messages, { untilIdle: true })` instead.
   *
   * Stream until all background tasks complete and the agent is idle.
   * Mirrors the regular Agent's streamUntilIdle but adapted for durable execution.
   */
  streamUntilIdle<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: DurableAgentStreamOptions<OUTPUT> & { maxIdleMs?: number },
  ): Promise<DurableAgentStreamResult<OUTPUT>>;
}

// @ts-expect-error - The merged interface preserves the legacy durable method signatures.
export class DurableAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends Agent<TAgentId, TTools, TOutput> {
  /** @internal Subclasses supply their default engine without changing workflow fallback policy. */
  protected override createExecutionEngine(mastra?: Mastra): DurableExecutionEngine {
    return new DurableExecutionEngine(this.id, mastra);
  }

  /** @internal Forced strategy, without resolving host/storage fallback. */
  __getExecutionEngineStrategy(): 'durable' | 'evented' {
    return this.workflowEngine === 'evented' ? 'evented' : 'durable';
  }

  /** The wrapped agent */
  readonly #wrappedAgent: Agent<TAgentId, TTools, TOutput>;
  readonly #streamConfig: AgentStreamsConfig;
  #wrapperStreamBus?: AgentStreamBus;

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
    // Read `stores` directly: getWorkflow() is synchronous.
    const storage = this.#mastra?.getStorage();
    const workflowsStore = storage?.stores?.workflows;
    if (workflowsStore && !workflowsStore.supportsRunJournal()) {
      this.guardrailLogger?.warn(
        `DurableAgent '${this.id}' sets storageVersion: 2, which ${storage?.name ?? 'the configured'} storage ` +
          `doesn't support yet; storing new runs as version 1.`,
      );
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Stream a response from the agent using durable execution.
   */

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
  __subscribeToRunStream(
    runId: string,
    options: { offset?: number; onComplete?: () => void },
    onEvent: (event: AgentStreamEvent) => void,
  ): Promise<() => Promise<void>> {
    return this.subscribeToDurableRunStream(runId, options, onEvent);
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
