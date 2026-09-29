import { Agent } from '../agent';
import { DEFAULT_GOAL_JUDGE_PROMPT } from '../agent/goal/objective';
import type { AgentConfig } from '../agent/types';
import { CyberRefusalHandler } from '../processors';
import { DEFAULT_MAX_PROCESSOR_RETRIES } from '../processors/retry-budget';
import { defaultStabilityErrorProcessors } from '../processors/stability-defaults';
import { TaskSignalProvider } from '../signals';
import { LocalFilesystem, LocalSandbox, Workspace } from '../workspace';

export { buildBasePrompt, type PromptContext } from './prompt';

/**
 * Builds a portable default workspace from core's local primitives, rooted at
 * `basePath` (defaults to `process.cwd()`). Used when the caller passes no
 * `workspace`.
 */
function defaultWorkspace(basePath: string): Workspace {
  return new Workspace({
    filesystem: new LocalFilesystem({ basePath }),
    sandbox: new LocalSandbox({ workingDirectory: basePath }),
  });
}

/**
 * Configuration for {@link createCodingAgent}.
 *
 * Most fields are passed straight through to the underlying `Agent`. The
 * factory fills portable defaults for the pieces a coding agent always needs —
 * a local workspace, the task-list signal provider, stream-retry error
 * processors, and the goal judge prompt — so a caller can get a working coding
 * agent by supplying only `model`, `instructions`, and `tools`.
 */
export interface CreateCodingAgentConfig extends AgentConfig {
  /**
   * Base path for the default workspace built when `workspace` is omitted.
   * @default process.cwd()
   */
  basePath?: string;
}

/**
 * Creates a coding agent as a Mastra {@link Agent}, applying portable defaults
 * for the workspace, task-list signal, stream-retry error processors, and goal
 * judge prompt.
 *
 * Caller-provided values always win:
 * - `workspace` is used verbatim when provided; otherwise a {@link Workspace}
 *   backed by {@link LocalFilesystem}/{@link LocalSandbox} rooted at
 *   `basePath` (default `process.cwd()`) is built.
 * - `signals` are merged with a {@link TaskSignalProvider} when `memory` is
 *   configured; otherwise the caller-provided signals are used verbatim (or
 *   an empty array when none are provided). This avoids wiring
 *   {@link TaskSignalProvider} — which requires a memory-backed thread — into
 *   agents that have no memory.
 * - `outputProcessors` is used verbatim when provided; otherwise it defaults to
 *   {@link CyberRefusalHandler}, which retries once after an Anthropic cyber
 *   classifier stop.
 * - `errorProcessors` is passed through when provided; otherwise it defaults to
 *   a {@link CyberRefusalHandler} followed by
 *   {@link defaultStabilityErrorProcessors} — provider-history compatibility,
 *   then prefill-error recovery, then catch-all stream retries with specialized
 *   ECONNRESET/bad-request policies. The repairs run before the retry because
 *   error processors short-circuit on the first `retry: true`, and the retry's
 *   bad-request matcher claims the same `400`s they repair. Unlike a bare
 *   agent's defaults, this stack also retries unmatched errors, which is the
 *   portable coding agent's long-standing behavior. A provided list is merged
 *   with the shared defaults by the agent, like any `errorProcessors` list;
 *   `errorProcessorDefaults: false` runs only the provided list, or none.
 * - `maxProcessorRetries` defaults to {@link DEFAULT_MAX_PROCESSOR_RETRIES} so
 *   the default output-lane cyber-refusal retry has a budget. Output-step
 *   retries only read this option, so the implicit error-lane cap does not
 *   cover them.
 * - `goal.prompt` defaults to {@link DEFAULT_GOAL_JUDGE_PROMPT} when a goal is
 *   configured without one.
 *
 * @example
 * ```typescript
 * import { createCodingAgent } from '@mastra/core/coding-agent';
 *
 * const agent = createCodingAgent({
 *   id: 'my-coding-agent',
 *   name: 'My Coding Agent',
 *   model: 'openai/gpt-5',
 *   instructions: 'You are a helpful coding assistant.',
 *   tools: {},
 * });
 * ```
 */
export function createCodingAgent(config: CreateCodingAgentConfig): Agent {
  const { basePath, workspace: _workspace, signals, outputProcessors, errorProcessors, goal, memory, ...rest } = config;

  // Distinguish an absent `workspace` key (build the default) from an explicit
  // `workspace: undefined` (caller opts out — e.g. when the workspace is wired
  // elsewhere, such as at a controller/request-context level).
  const workspace = 'workspace' in config ? config.workspace : defaultWorkspace(basePath ?? process.cwd());

  // TaskSignalProvider needs a memory-backed thread to function. Only include
  // it when the caller has configured memory; merge it into caller-provided
  // signals so custom signal providers don't drop task tracking.
  const taskSignals = memory ? [new TaskSignalProvider()] : [];
  const resolvedSignals = signals ? [...signals, ...taskSignals] : taskSignals;

  // Treat an explicit `prompt: undefined` the same as an omitted prompt so the
  // documented default is preserved.
  const resolvedGoal = goal ? { ...goal, prompt: goal.prompt ?? DEFAULT_GOAL_JUDGE_PROMPT } : undefined;

  return new Agent({
    ...rest,
    memory,
    workspace,
    signals: resolvedSignals,
    // CyberRefusalHandler also sits in the error lane (via outputProcessors,
    // see below) for OpenAI refusals; here it catches Anthropic refusals, which
    // finish a step instead of throwing.
    outputProcessors: outputProcessors ?? [new CyberRefusalHandler()],
    errorProcessors:
      errorProcessors ??
      // With `errorProcessorDefaults: false` the caller runs only what they
      // configured, so the coding stack is not supplied either. CyberRefusalHandler
      // runs first: the retry processor would otherwise claim the retryable refusal
      // and resend it without the `continue` nudge. It is always in the error lane
      // (OpenAI refusals throw); the output-lane handler above covers Anthropic stops.
      (rest.errorProcessorDefaults === false
        ? undefined
        : [
            new CyberRefusalHandler(),
            ...defaultStabilityErrorProcessors({ retryUnknownErrors: true, retryBadRequests: true }),
          ]),
    // Output-step retries only read the raw option; the implicit error-lane cap
    // from `resolveMaxProcessorRetries` never reaches them. Default it here so
    // the default output-lane handler can retry instead of ending as a tripwire.
    maxProcessorRetries: rest.maxProcessorRetries ?? DEFAULT_MAX_PROCESSOR_RETRIES,
    ...(resolvedGoal ? { goal: resolvedGoal } : {}),
  });
}
