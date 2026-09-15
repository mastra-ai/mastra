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
  const ephemeralThreadId = options.threadId ?? globalThis.crypto.randomUUID();
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
