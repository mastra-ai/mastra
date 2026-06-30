import { Agent } from '../agent';
import { DEFAULT_GOAL_JUDGE_PROMPT } from '../agent/goal/objective';
import type { AgentConfig } from '../agent/types';
import {
  isBadRequestError,
  PrefillErrorHandler,
  ProviderHistoryCompat,
  StreamErrorRetryProcessor,
} from '../processors';
import { TaskSignalProvider } from '../signals';
import { LocalFilesystem, LocalSandbox, Workspace } from '../workspace';

export { buildBasePrompt, type PromptContext } from './prompt';

/**
 * Retry policy for transient network resets (e.g. provider sockets dropping
 * mid-stream). Applied centrally to every model call via the default
 * `StreamErrorRetryProcessor` so all modes/subagents benefit from a short wait
 * before retrying an ECONNRESET. Delay uses exponential backoff:
 * `initialDelay * 2^retryCount`, capped at `maxDelay`.
 */
const ECONNRESET_MAX_RETRIES = 2;
const ECONNRESET_RETRY_INITIAL_DELAY_MS = 1000;
const ECONNRESET_RETRY_MAX_DELAY_MS = 30000;

const ECONNRESET_MESSAGE_PATTERN = /econnreset|socket hang up/i;

/**
 * Matcher for transient network-reset failures. Checks the immediate error for
 * an `ECONNRESET` code or a `socket hang up` message. Cause-chain traversal is
 * handled by `StreamErrorRetryProcessor.isRetryableStreamError`, which calls
 * each matcher at every level of the cause chain.
 */
function isECONNRESETError(error: unknown): boolean {
  if (!error) return false;

  const code = typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && code.toUpperCase() === 'ECONNRESET') return true;

  const message = error instanceof Error ? error.message : undefined;
  if (typeof message === 'string' && ECONNRESET_MESSAGE_PATTERN.test(message)) return true;

  return false;
}

/**
 * Builds the portable default error processors: an ECONNRESET + bad-request
 * retry policy, prefill-error recovery, and provider-history compatibility.
 */
function defaultErrorProcessors(): NonNullable<AgentConfig['errorProcessors']> {
  return [
    new StreamErrorRetryProcessor({
      matchers: [
        { match: isBadRequestError, maxRetries: 1, delayMs: 2000 },
        {
          match: isECONNRESETError,
          maxRetries: ECONNRESET_MAX_RETRIES,
          delayMs: ({ retryCount }) =>
            Math.min(ECONNRESET_RETRY_INITIAL_DELAY_MS * Math.pow(2, retryCount), ECONNRESET_RETRY_MAX_DELAY_MS),
        },
      ],
    }),
    new PrefillErrorHandler(),
    new ProviderHistoryCompat(),
  ];
}

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
 * a local workspace, the task-list signal provider, network-retry error
 * processors, and the goal judge prompt — so a caller can get a working coding
 * agent by supplying only `model`, `instructions`, and `tools`.
 */
export interface CreateCodingAgentConfig extends AgentConfig {
  /**
   * Base path for the default workspace built when `workspace` is omitted.
   * @default process.cwd()
   */
  workspaceBasePath?: string;
}

/**
 * Creates a coding agent as a Mastra {@link Agent}, applying portable defaults
 * for the workspace, task-list signal, network-retry error processors, and goal
 * judge prompt.
 *
 * Caller-provided values always win:
 * - `workspace` is used verbatim when provided; otherwise a {@link Workspace}
 *   backed by {@link LocalFilesystem}/{@link LocalSandbox} rooted at
 *   `workspaceBasePath` (default `process.cwd()`) is built.
 * - `signals` is used verbatim when provided; otherwise it defaults to a single
 *   {@link TaskSignalProvider}.
 * - `errorProcessors` is used verbatim when provided; otherwise it defaults to
 *   the ECONNRESET/bad-request retry stack plus prefill + provider-history
 *   compatibility processors.
 * - `goal.prompt` defaults to {@link DEFAULT_GOAL_JUDGE_PROMPT} when a goal is
 *   configured without one.
 *
 * @example
 * ```typescript
 * import { createCodingAgent } from '@mastra/core/coding-agent';
 * import { openai } from '@ai-sdk/openai';
 *
 * const agent = createCodingAgent({
 *   id: 'my-coding-agent',
 *   name: 'My Coding Agent',
 *   model: openai('gpt-4o'),
 *   instructions: 'You are a helpful coding assistant.',
 *   tools: {},
 * });
 * ```
 */
export function createCodingAgent(config: CreateCodingAgentConfig): Agent {
  const { workspaceBasePath, workspace: _workspace, signals, errorProcessors, goal, ...rest } = config;

  // Distinguish an absent `workspace` key (build the default) from an explicit
  // `workspace: undefined` (caller opts out — e.g. when the workspace is wired
  // elsewhere, such as at a controller/request-context level).
  const workspace = 'workspace' in config ? config.workspace : defaultWorkspace(workspaceBasePath ?? process.cwd());

  const resolvedGoal = goal ? { prompt: DEFAULT_GOAL_JUDGE_PROMPT, ...goal } : undefined;

  return new Agent({
    ...rest,
    workspace,
    signals: signals ?? [new TaskSignalProvider()],
    errorProcessors: errorProcessors ?? defaultErrorProcessors(),
    ...(resolvedGoal ? { goal: resolvedGoal } : {}),
  });
}
