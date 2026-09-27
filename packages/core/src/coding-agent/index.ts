import { Agent } from '../agent';
import { DEFAULT_GOAL_JUDGE_PROMPT } from '../agent/goal/objective';
import type { AgentConfig } from '../agent/types';
import {
  CyberRefusalHandler,
  isBadRequestError,
  PrefillErrorHandler,
  ProviderHistoryCompat,
  StreamErrorRetryProcessor,
} from '../processors';
import { DEFAULT_MAX_PROCESSOR_RETRIES } from '../processors/retry-budget';
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

  const code = typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && code.toUpperCase() === 'ECONNRESET') return true;

  const message = error instanceof Error ? error.message : undefined;
  if (typeof message === 'string' && ECONNRESET_MESSAGE_PATTERN.test(message)) return true;

  return false;
}

/**
 * Builds the portable default error processors: provider-history compatibility,
 * prefill-error recovery, and cyber-refusal recovery first, then catch-all
 * stream retries with specialized ECONNRESET and bad-request policies.
 */
function defaultErrorProcessors(): NonNullable<AgentConfig['errorProcessors']> {
  return [
    // Repairs must run before StreamErrorRetryProcessor: error processors
    // short-circuit on the first `retry: true`, and the retry below claims the
    // same errors these repair. A blind retry first resends the unrepaired
    // request, and all of these decline once `retryCount > 0`.
    new ProviderHistoryCompat(),
    new PrefillErrorHandler(),
    new CyberRefusalHandler(),
    new StreamErrorRetryProcessor({
      retryUnknownErrors: true,
      maxRetries: 2,
      delayMs: 3000,
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
 * a local workspace, the task-list signal provider, repair-then-retry error
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
 * - `errorProcessors` is used verbatim when provided; otherwise it defaults to
 *   the provider-history, prefill, and cyber-refusal repair processors, followed by catch-all
 *   stream retries with specialized ECONNRESET/bad-request policies.
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
    // CyberRefusalHandler also sits in the error lane (see defaultErrorProcessors)
    // for OpenAI refusals; here it catches Anthropic refusals, which finish a
    // step instead of throwing.
    outputProcessors: outputProcessors ?? [new CyberRefusalHandler()],
    errorProcessors: errorProcessors ?? defaultErrorProcessors(),
    // Output-step retries only read the raw option; the implicit error-lane cap
    // from `resolveMaxProcessorRetries` never reaches them. Default it here so
    // the default output-lane handler can retry instead of ending as a tripwire.
    maxProcessorRetries: rest.maxProcessorRetries ?? DEFAULT_MAX_PROCESSOR_RETRIES,
    ...(resolvedGoal ? { goal: resolvedGoal } : {}),
  });
}
