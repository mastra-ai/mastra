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
 * inherited resourceId) onto the caller's requestContext for the duration of
 * `fn`, then restores the original memory scope in `finally` — mirroring the
 * sub-agent-as-tool save/restore pattern in
 * packages/core/src/agent/agent.ts:4470–5209.
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

  const parentResourceId = savedMastraMemory?.resourceId ?? savedResourceIdKey ?? '';
  requestContext.set('MastraMemory', {
    thread: { id: options.threadId ?? randomUUID() },
    resourceId: parentResourceId,
    memoryConfig: undefined,
  });
  // Reserved thread/resource-key context values take precedence over the
  // MastraMemory payload — scrub MASTRA_THREAD_ID_KEY so the fresh thread
  // above is honored. Leave MASTRA_RESOURCE_ID_KEY as-is so thread-scoped
  // processors that require a resource still resolve one.
  if (savedThreadIdKey !== undefined) {
    requestContext.delete(MASTRA_THREAD_ID_KEY);
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
    }
    if (savedResourceIdKey !== undefined) {
      requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
    }
  }
}
