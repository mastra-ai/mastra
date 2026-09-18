import { Agent } from '../agent';
import { DEFAULT_GOAL_JUDGE_PROMPT } from '../agent/goal/objective';
import type { AgentConfig } from '../agent/types';
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
 * - `errorProcessors` is used verbatim when provided; otherwise it defaults to
 *   {@link defaultStabilityErrorProcessors} — provider-history compatibility,
 *   catch-all stream retries with specialized ECONNRESET/bad-request policies,
 *   then prefill-error recovery.
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
  const { basePath, workspace: _workspace, signals, errorProcessors, goal, memory, ...rest } = config;

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
    errorProcessors: errorProcessors ?? defaultStabilityErrorProcessors(),
    ...(resolvedGoal ? { goal: resolvedGoal } : {}),
  });
}
