/**
 * Sub-invocations launched from a parent chat turn (workflow agent steps,
 * sub-agent tool calls) must run under a fresh isolated Mastra memory scope
 * so they don't:
 *
 *   - write their prompts/responses into the parent chat thread's history, or
 *   - contend with the parent turn's memory-dependent processors
 *     (observational-memory, task-state, working-memory-state).
 *
 * `withEphemeralMemory` swaps a fresh MastraMemory (new random threadId,
 * inherited resourceId) onto the caller's requestContext AND stamps the
 * reserved MASTRA_THREAD_ID_KEY / MASTRA_RESOURCE_ID_KEY context values to the
 * same ephemeral ids for the duration of `fn`, then restores everything in
 * `finally`. Isolation is achieved by writing the ephemeral ids into the
 * context, not by scrubbing them — inner agent invocations (e.g. workflow
 * agent steps) resolve their thread/resource via those reserved keys, so
 * leaving them unset causes downstream storage saves to throw
 * "Thread ID is required".
 *
 * Callers can override the ephemeral thread id (e.g. for tests) via
 * `options.threadId`.
 */
import { randomUUID } from 'node:crypto';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';

interface EphemeralMemoryOptions {
  threadId?: string;
}

export async function withEphemeralMemory<T>(
  requestContext: RequestContext | undefined,
  fn: () => Promise<T>,
  options: EphemeralMemoryOptions = {},
): Promise<T> {
  if (!requestContext) return fn();

  const savedMastraMemory = requestContext.get('MastraMemory') as
    | { thread?: { id?: string }; resourceId?: string; memoryConfig?: unknown }
    | undefined;
  const savedThreadIdKey = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;
  const savedResourceIdKey = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;

  const ephemeralThreadId = options.threadId ?? randomUUID();
  const parentResourceId = savedMastraMemory?.resourceId ?? savedResourceIdKey ?? '';

  requestContext.set('MastraMemory', {
    thread: { id: ephemeralThreadId },
    resourceId: parentResourceId,
    memoryConfig: undefined,
  });
  // Stamp the reserved thread/resource-key context values with the same
  // ephemeral ids. Inner agent invocations (workflow agent steps, sub-agent
  // tool calls) read these keys to resolve their runtime thread; leaving
  // MASTRA_THREAD_ID_KEY unset causes prepare-memory-step to build a
  // MessageList without a threadId, which storage rejects downstream.
  requestContext.set(MASTRA_THREAD_ID_KEY, ephemeralThreadId);
  if (parentResourceId) {
    requestContext.set(MASTRA_RESOURCE_ID_KEY, parentResourceId);
  }

  try {
    return await fn();
  } finally {
    if (savedMastraMemory !== undefined) {
      requestContext.set('MastraMemory', savedMastraMemory);
    } else {
      requestContext.delete('MastraMemory');
    }
    if (savedThreadIdKey !== undefined) {
      requestContext.set(MASTRA_THREAD_ID_KEY, savedThreadIdKey);
    } else {
      requestContext.delete(MASTRA_THREAD_ID_KEY);
    }
    if (savedResourceIdKey !== undefined) {
      requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
    } else if (parentResourceId) {
      // We wrote a resource-id key that wasn't there before — clean it up.
      requestContext.delete(MASTRA_RESOURCE_ID_KEY);
    }
  }
}
