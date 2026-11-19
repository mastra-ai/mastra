import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import type { RequestContext } from '../request-context';
import { RECOVER_ALREADY_IN_PROGRESS_ERROR_ID } from './durable/constants';
import type { DurableAgentRecoveredRun } from './durable/durable-agent';
import { RECOVER_RUN_ACTIVE_LOCALLY_ERROR_ID, RUN_ACTIVE_ERROR_ID } from './durable/execution-fence';
import type { MessageList } from './message-list';
import { mastraDBMessageToSignal } from './signals';
import type { AgentInstructions } from './types';
import { resolveThreadIdFromArgs } from './utils';

export function resolveRunId(runId: string | undefined, generateId?: () => string | undefined): string {
  return runId ?? generateId?.() ?? globalThis.crypto.randomUUID();
}

export function successfulAgentOutput<T extends { error?: unknown }>(output: T): T {
  const error = output.error;
  if (error) {
    throw error;
  }
  return output;
}

export async function drainAgentOutput<T extends { error?: unknown }>(output: {
  getFullOutput(): Promise<T>;
}): Promise<T> {
  return successfulAgentOutput(await output.getFullOutput());
}

/** Format resolved instructions for string-only consumers such as voice and spans. */
export function convertInstructionsToString(instructions: AgentInstructions): string {
  if (typeof instructions === 'string') {
    return instructions;
  }

  if (Array.isArray(instructions)) {
    // Handle array of messages (strings or objects)
    return instructions
      .map(msg => {
        if (typeof msg === 'string') {
          return msg;
        }
        // Safely extract content from message objects
        return typeof msg.content === 'string' ? msg.content : '';
      })
      .filter(content => content) // Remove empty strings
      .join('\n\n');
  }

  // Handle single message object - safely extract content
  return typeof instructions.content === 'string' ? instructions.content : '';
}

/** Select persisted input signals to echo on the first LLM step. */
export function getInitialSignalEchoes(messageList: MessageList) {
  const inputMessageIds = messageList.makeMessageSourceChecker().input;
  return messageList.get.all
    .db()
    .filter(message => message.role === 'signal' && inputMessageIds.has(message.id))
    .map(mastraDBMessageToSignal);
}

export const TRANSIENT_RECOVERY_RETRY_DELAY_MS = 30_000;
const TRANSIENT_RECOVERY_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'LOADING',
]);

function isTransientRecoveryError(error: unknown): boolean {
  const seen = new Set<object>();
  let transient = false;
  while (typeof error === 'object' && error !== null && !seen.has(error)) {
    seen.add(error);
    if ('name' in error && error.name === 'AbortError') return false;
    if ('code' in error && typeof error.code === 'string' && TRANSIENT_RECOVERY_ERROR_CODES.has(error.code)) {
      transient = true;
    }
    if ('message' in error && typeof error.message === 'string' && /^LOADING(?:\s|$)/.test(error.message)) {
      transient = true;
    }
    error = 'cause' in error ? error.cause : undefined;
  }
  return transient;
}

/** Why `recover()` should be deferred, or `undefined` for a permanent failure. */
export function recoverySkip(error: unknown): Pick<DurableAgentRecoveredRun, 'reason' | 'retryAt'> | undefined {
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
      return isTransientRecoveryError(error)
        ? { reason: 'transient-error', retryAt: Date.now() + TRANSIENT_RECOVERY_RETRY_DELAY_MS }
        : undefined;
  }
}

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
