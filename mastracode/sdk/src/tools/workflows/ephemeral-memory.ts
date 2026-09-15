/**
 * Sub-invocations launched from a parent chat turn (workflow agent steps,
 * sub-agent tool calls) must run under a fresh isolated Mastra memory scope
 * so they don't:
 *
 *   - write their prompts/responses into the parent chat thread's history, or
 *   - contend with the parent turn's memory-dependent processors
 *     (observational-memory, task-state, working-memory-state).
 *
 * `withEphemeralMemory` copies the caller's request context into a child,
 * replaces its MastraMemory with a fresh thread id and inherited resource id,
 * then passes that isolated child to `fn`. The parent context is never mutated,
 * so concurrent sub-invocations cannot overwrite or restore each other's
 * memory values. Isolation writes the ephemeral ids instead of scrubbing them:
 * inner agent invocations resolve their thread/resource via those reserved
 * keys, and leaving them unset causes downstream storage saves to throw
 * "Thread ID is required".
 *
 * Callers can override the ephemeral thread id (e.g. for tests) via
 * `options.threadId`.
 */
import { randomUUID } from 'node:crypto';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';

interface EphemeralMemoryOptions {
  threadId?: string;
}

export async function withEphemeralMemory<T>(
  requestContext: RequestContext | undefined,
  fn: (requestContext: RequestContext | undefined) => Promise<T>,
  options: EphemeralMemoryOptions = {},
): Promise<T> {
  if (!requestContext) return fn(undefined);

  const childRequestContext = new RequestContext(requestContext.entries());
  const mastraMemory = requestContext.get('MastraMemory') as
    | { thread?: { id?: string }; resourceId?: string; memoryConfig?: unknown }
    | undefined;
  const resourceId = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  const ephemeralThreadId = options.threadId ?? randomUUID();
  const parentResourceId = mastraMemory?.resourceId ?? resourceId ?? '';

  childRequestContext.set('MastraMemory', {
    thread: { id: ephemeralThreadId },
    resourceId: parentResourceId,
    memoryConfig: undefined,
  });
  // Stamp the reserved thread/resource-key context values with the same
  // ephemeral ids. Inner agent invocations (workflow agent steps, sub-agent
  // tool calls) read these keys to resolve their runtime thread; leaving
  // MASTRA_THREAD_ID_KEY unset causes prepare-memory-step to build a
  // MessageList without a threadId, which storage rejects downstream.
  childRequestContext.set(MASTRA_THREAD_ID_KEY, ephemeralThreadId);
  if (parentResourceId) {
    childRequestContext.set(MASTRA_RESOURCE_ID_KEY, parentResourceId);
  } else {
    childRequestContext.delete(MASTRA_RESOURCE_ID_KEY);
  }

  return fn(childRequestContext);
}
