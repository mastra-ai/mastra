import type { JournalEntry, LLMock } from '@copilotkit/aimock';
import type { AgentConfig, ToolsInput } from '../../../agent';
import type { PubSub } from '../../../events/pubsub';
import type { MastraMemory } from '../../../memory';
import type { RequestContext } from '../../../request-context';
import type { MastraModelOutput } from '../../../stream/base/output';
import type { ChunkType } from '../../../stream/types';
import type { AnyWorkspace } from '../../../workspace/workspace';

/**
 * The model id used for every AIMock-backed loop scenario. Fixtures match on
 * this id (`match.model`), so keep it in sync with the model passed to the
 * Agent in {@link runLoopScenario}.
 */
export const SCENARIO_MODEL_ID = 'gpt-4o-mini';

/**
 * Result of running a single loop scenario against the AIMock server.
 *
 * - `output` is the agentic-loop's emitted stream output (already consumed), so
 *   assertions can inspect the final text, tool calls, steps, etc.
 * - `requests` is the ordered list of HTTP requests AIMock captured. Each
 *   request's `body` is the parsed OpenAI chat-completion payload the loop sent
 *   for that turn — the surface for cross-turn composition assertions
 *   (tool-result plumbing, message ordering, turn counts).
 */
export interface LoopScenarioResult {
  output: MastraModelOutput<unknown>;
  requests: JournalEntry[];
  /**
   * The LLMock instance used for this scenario. Useful for manual stream
   * consumption scenarios where you need to call `llm.getRequests()` after
   * draining the stream.
   */
  llm: LLMock;
  /**
   * Collected chunks from `output.fullStream` — only populated when
   * {@link RunLoopScenarioOptions.collectChunks} is set. Useful for asserting
   * delta-level ordering and streaming fidelity.
   */
  chunks?: ChunkType[];
  /**
   * The agent instance used for the scenario run. Exposed so scenarios can
   * call agent-level methods post-run (e.g. `agent.getObjective()`,
   * `agent.approveToolCall()`).
   */
  agent?: any;
  /**
   * The Mastra instance backing the agent. Exposed so scenarios can access
   * `mastra.backgroundTaskManager` for background task assertions or shutdown.
   */
  mastra?: any;
}

/**
 * Agent / execution variant for loop scenarios.
 *
 * The first two select the *execution engine* (how the loop runs); `'fs'`
 * selects the *agent-assembly method* (how the agent is built) and runs on the
 * normal execution path. Treating them as one axis lets every scenario run
 * through {@link describeForAllEngines} cover the file-routing path for free.
 *
 * - `'normal'` — default direct engine (regular `new Agent(...)`).
 * - `'durable'` — durable execution via `createDurableAgent` wrapper.
 * - `'fs'` — agent assembled from file-system routing (`assembleAgentFromFsEntry`,
 *   `instructions.md` body + discovered `tools/*`) and registered through
 *   `Mastra.__registerFsAgents`, then run on the normal engine. `agents`
 *   (subagents), `goal`, `workspace`, and `workflows` config are threaded through,
 *   so supervisor / agents-as-tools and goal scenarios run on `'fs'`. Scenarios
 *   whose inputs the file-routing path cannot model (dynamic-function
 *   instructions, `sharedAgent`, `workflows`-as-tool, durable resume/suspension)
 *   skip this variant via `{ skip: ['fs'] }`.
 */
export type EngineVariant = 'normal' | 'durable' | 'fs';

/** All supported engine variants for parameterised test runs. */
export const ALL_ENGINE_VARIANTS: readonly EngineVariant[] = ['normal', 'durable', 'fs'] as const;

export interface RunLoopScenarioOptions {
  /** Active AIMock handle for the current suite (from {@link useLoopScenarioAimock}). */
  llm: LLMock;
  /**
   * Execution engine variant. Defaults to `'normal'`.
   * - `'durable'` wraps the agent with `createDurableAgent`.
   */
  engine?: EngineVariant;
  /**
   * Imperatively script the per-turn model responses on the AIMock instance,
   * e.g. `llm.onMessage(...)`, `llm.onToolCall(...)`, `llm.onTurn(...)`.
   * Runs once before the loop starts.
   */
  fixtures: (llm: LLMock) => void;
  /** The user prompt that kicks off the loop. */
  prompt: string;
  /**
   * Default options for the agent (e.g. `autoResumeSuspendedTools`).
   * Applied to the Agent constructor via `defaultOptions` config.
   */
  defaultOptions?: {
    autoResumeSuspendedTools?: boolean;
  };
  /** Tools available to the loop. Tool ids must match the scripted tool-call names. */
  tools?: ToolsInput;
  /** Signal providers registered on the Agent constructor. */
  signals?: AgentConfig['signals'];
  /**
   * System instructions for the agent. May be a static string or a
   * `DynamicArgument` function `({ requestContext }) => string` to exercise
   * dynamic-instructions resolution. Combine with `requestContext` to assert the
   * resolved system prompt lands in the request.
   */
  instructions?: AgentConfig['instructions'];
  /**
   * Subagents registered on the agent (`agents: { writer }`). Mastra converts
   * each to a tool named `agent-<key>`, enabling supervisor / agents-as-tools
   * scenarios. Subagents share the same AIMock-backed provider.
   */
  agents?: AgentConfig['agents'];
  /**
   * Workflows registered on the agent (`workflows: { researchWorkflow }`). Mastra
   * converts each to a tool named `workflow-<key>`, enabling workflow-as-tools
   * scenarios. Workflows are executed when the model calls them.
   */
  workflows?: Record<string, any>;
  /**
   * Additional tool sets available for this generation, merged with agent-level
   * tools. Forwarded to `agent.stream({ toolsets })`. Toolsets allow dynamic
   * tool availability per-request.
   */
  toolsets?: Record<string, ToolsInput>;
  /**
   * Request context forwarded to `agent.stream({ requestContext })`. Used to
   * drive dynamic instructions / configuration.
   */
  requestContext?: RequestContext<any>;
  /**
   * Stop condition for the loop. Forwarded to `agent.stream({ stopWhen })`.
   * Use this to bound long/looping tool scenarios.
   */
  stopWhen?: any;
  /**
   * Maximum number of steps (model invocations) before the loop terminates.
   * Forwarded to `agent.stream({ maxSteps })`. Prevents runaway execution.
   * `stopWhen` can terminate earlier if its predicate is satisfied.
   */
  maxSteps?: number;
  /**
   * Provider-specific options forwarded to `agent.stream({ providerOptions })`.
   * These land in the model request and can include provider-specific metadata
   * like OpenAI's `prediction` or `store` flags.
   */
  providerOptions?: any;
  /**
   * Model settings forwarded to `agent.stream({ modelSettings })`. These control
   * model behavior like temperature, maxTokens, topP, etc. and land in the
   * request body.
   */
  modelSettings?: any;
  /**
   * Client-side tools to merge with agent-level tools. Forwarded to `agent.stream({ clientTools })`.
   * Useful for testing tool merging scenarios where tools are defined at the call site rather than
   * at agent construction time.
   */
  clientTools?: ToolsInput;
  /**
   * Controls how the model uses tools. Forwarded to `agent.stream({ toolChoice })`.
   * - 'auto': Model decides whether to call tools (default)
   * - 'required': Model must call at least one tool
   * - 'none': Model cannot call tools
   * - { type: 'tool', toolName: 'specific-tool' }: Model must call specific tool
   */
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };
  /**
   * Dynamic model function that resolves based on requestContext. When provided,
   * the harness uses this function instead of the default AIMock-backed model.
   * The function receives `{ requestContext }` and returns a model instance.
   */
  model?: (ctx: { requestContext: any }) => any;
  /**
   * Error processors registered on the Agent constructor (`errorProcessors: [...]`).
   * These intercept non-retryable API errors (400/422) and can retry after applying
   * modifications. Combine with AIMock error fixtures to test error recovery paths.
   */
  errorProcessors?: any[];
  /**
   * Error callback fired on tool execution errors or API errors.
   * Forwarded to `agent.stream({ onError })`. Useful for asserting error handling
   * and observing error propagation. Fires after errorProcessors (if any).
   */
  onError?: ({ error }: { error: Error | string }) => Promise<void> | void;
  /**
   * Callback fired for stream chunks. Forwarded to `agent.stream({ onChunk })`.
   * Useful for asserting server-side chunk observability separately from
   * chunks collected from `fullStream`.
   */
  onChunk?: (chunk: ChunkType) => Promise<void> | void;
  /**
   * Callback fired after each execution step (including intermediate tool-call steps).
   * Forwarded to `agent.stream({ onStepFinish })`. Useful for asserting step-level
   * observability and tracking tool execution progress.
   */
  onStepFinish?: any;
  /**
   * Callback fired when execution completes. Forwarded to `agent.stream({ onFinish })`.
   * Useful for asserting final result properties and cleanup logic.
   */
  onFinish?: any;
  /**
   * Save messages incrementally after each stream step completes. Forwarded to
   * `agent.stream({ savePerStep })`. Requires `memory` and `threadId` to be set.
   * Useful for testing intermediate message persistence.
   */
  savePerStep?: boolean;
  /**
   * Trusted server-side signal for this agent FGA check. Forwarded to
   * `agent.stream({ actor })`. Useful for testing fine-grained authorization
   * scenarios where the actor identity affects tool access.
   */
  actor?: any;
  /**
   * isTaskComplete (supervisor-style completion) config forwarded to
   * `agent.stream({ isTaskComplete })`. Supply custom `scorers` to gate the loop
   * deterministically: a scorer returning `score: 0` forces another iteration,
   * `score: 1` lets the loop finish. Each evaluation emits an `is-task-complete`
   * chunk and injects completion feedback into the next request.
   */
  isTaskComplete?: any;
  /**
   * Background tasks config forwarded to the Mastra instance
   * (`backgroundTasks: { enabled, globalConcurrency, ... }`). When set, the
   * agent can dispatch tools to the background via tool-level or agent-level
   * `backgroundTasks` opt-in. Combine with `streamUntilIdle: true` to keep the
   * stream open until background tasks complete and re-invoke the agent.
   */
  backgroundTasks?: any;
  /**
   * When set, uses `agent.streamUntilIdle()` instead of `agent.stream()`. The
   * stream stays open until all background tasks complete, and the agent is
   * re-invoked so it can process the results. Requires `backgroundTasks` to be
   * enabled on the Mastra instance.
   */
  streamUntilIdle?: boolean;
  /**
   * Agent-level background tasks config forwarded to the Agent constructor
   * (`backgroundTasks: { tools: { toolName: { enabled, timeoutMs } } }`).
   * Overrides tool-level opt-in for specific tools.
   */
  agentBackgroundTasks?: any;
  /**
   * Goal config forwarded to the Agent constructor (`goal: { judge, maxRuns,
   * scorer, prompt }`). Requires storage and a memory-backed thread. Combine
   * with `setObjective()` on the exposed agent to set a durable objective.
   */
  goal?: any;
  /**
   * Objective text to set on the agent before streaming via `setObjective()`.
   * Requires `goal` config to be set. When provided, the objective is set
   * before the stream starts so the goal step can evaluate it.
   */
  objective?: string;
  /**
   * Delegation hooks forwarded to `agent.stream({ delegation })` for
   * supervisor-agents scenarios. Supports `onDelegationStart`,
   * `onDelegationComplete`, `messageFilter`, and
   * `includeSubAgentToolResultsInModelContext`.
   */
  delegation?: any;
  /**
   * Iteration-complete hook forwarded to `agent.stream({ onIterationComplete })`.
   * Fires after each iteration, providing visibility into what happened (text,
   * tool calls/results) and the ability to control whether to continue or inject
   * feedback. Return `{ continue: false }` to stop early, or `{ feedback: string }`
   * to inject a message the model sees on the next iteration.
   */
  onIterationComplete?: any;
  /**
   * AbortSignal forwarded to `agent.stream({ abortSignal })`. Use to halt the
   * loop mid-stream and assert that the loop stops cleanly without making
   * additional model requests.
   */
  abortSignal?: AbortSignal;
  /**
   * Structured-output options forwarded to `agent.stream({ structuredOutput })`.
   * When set, the final object is available on `output.object`.
   */
  structuredOutput?: any;
  /**
   * Restrict the tools exposed to the model for this run. Forwarded to
   * `agent.stream({ activeTools })`.
   */
  activeTools?: any;
  /**
   * Output processors forwarded to `agent.stream({ outputProcessors })`. Use to
   * assert transform/redact behavior over the loop output.
   */
  outputProcessors?: any;
  /**
   * Input processors forwarded to `agent.stream({ inputProcessors })`. Run before
   * the user message reaches the model request — assert on `requests[0]`.
   */
  inputProcessors?: any;
  /**
   * Per-step hook forwarded to `agent.stream({ prepareStep })`. Use to override
   * activeTools/messages per step and assert the change lands in the request.
   */
  prepareStep?: any;
  /**
   * Memory instance attached to the agent. Combine with `threadId`/`resourceId`
   * to exercise conversation-history recall and working memory across turns.
   */
  memory?: MastraMemory;
  /** Thread id for memory-backed runs. Forwarded to `agent.stream({ memory: { thread } })`. */
  threadId?: string;
  /** Resource id for memory-backed runs. Forwarded to `agent.stream({ memory: { resource } })`. */
  resourceId?: string;
  /**
   * Memory options forwarded to `agent.stream({ memory: { options } })`.
   * Controls recall behavior like `lastMessages` (number of messages to recall)
   * or `semanticRecall` (enable/disable semantic recall).
   */
  memoryOptions?: { lastMessages?: number | false; semanticRecall?: boolean };
  /**
   * Workspace attached to the agent. Passed into tool execution context so tools
   * can read `workspace.filesystem` / `workspace.sandbox` mid-loop.
   */
  workspace?: AnyWorkspace;
  /**
   * PubSub instance for signal/event scenarios. Passed to the Mastra constructor
   * to enable `subscribeToThread()`, `sendMessage()`, and other signal APIs.
   * Use for testing the signal integration (subscribe → sendMessage → receive response).
   */
  pubsub?: PubSub;
  /**
   * When set, {@link runLoopScenario} iterates `output.fullStream` itself
   * (instead of the default `consumeStream` drain) and returns every emitted
   * chunk in {@link LoopScenarioResult.chunks}. Use for delta-level / streaming
   * fidelity assertions (text-delta ordering, reasoning chunks, etc.).
   */
  collectChunks?: boolean;
  /**
   * When set, {@link runLoopScenario} returns the output WITHOUT consuming the
   * stream. The test must manually drain `output.fullStream` after publishing
   * any lifecycle events. Use for `streamUntilIdle` scenarios where events
   * need to be published while the stream is still open.
   */
  manualStreamConsumption?: boolean;
  /**
   * Pre-built agent and Mastra instances for scenarios that need to share
   * storage/memory across multiple `runLoopScenario` calls. When provided,
   * the harness skips building a new agent and uses these instead. Required
   * for suspend/resume flows (autoResumeSuspendedTools, resumeStream) where
   * the same agent+storage must persist across calls.
   */
  sharedAgent?: { agent: any; mastra: any };
  /**
   * Build the agent via file-system routing (`assembleAgentFromFsEntry`) instead
   * of `new Agent(...)`, then register it through `Mastra.__registerFsAgents`.
   * `instructions` is treated as the `instructions.md` body and `tools` as the
   * discovered `tools/*` map, so the exact same scenario runs an FS-assembled
   * agent through the real loop. Used to prove file-based agents behave
   * identically to code-registered ones.
   */
  fsRouted?: boolean;
}

/**
 * Options for {@link runApprovalScenario}. Extends {@link RunLoopScenarioOptions}
 * with a per-approval decision callback. The loop runs with
 * `requireToolApproval: true`; each suspended tool call is approved or declined
 * based on `decision`.
 */
export interface RunApprovalScenarioOptions extends RunLoopScenarioOptions {
  /**
   * Decide whether to approve (`true`) or decline (`false`) each suspended tool
   * call. Called once per approval, in order. `approvalIndex` is the 0-based
   * count of approvals resolved so far.
   */
  decision: (context: { toolCallId: string; approvalIndex: number }) => boolean;
  /**
   * Whether to set stream-level `requireToolApproval: true`. Defaults to `true`.
   * Set to `false` to test tool-level `requireApproval: true` on specific tools.
   * Can also be a function that decides per-tool-call: `({ toolName }) => boolean`.
   */
  requireToolApproval?: boolean | ((context: { toolName: string; args?: unknown }) => boolean);
}
