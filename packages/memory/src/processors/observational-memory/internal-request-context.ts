import { MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';

/**
 * OM observer/reflector agents are implementation-detail agents invoked from
 * inside a parent agent run. They should keep request-scoped values such as
 * auth, versions, routing hints, and resource id, but they must not present as
 * another run on the parent thread or core's cross-agent thread wait can block
 * on the parent run that is waiting for OM to complete.
 *
 * A fresh RequestContext clone is always returned so that memory-scoped writes
 * made by the internal agent run (e.g. the `MastraMemory` entry that agent.generate
 * sets from the observer's temporary `structured-observer` memory) cannot leak back
 * into the parent's RequestContext. Without this isolation the parent's OM turn later
 * reads the temporary observer's resourceId and injects a continuation message that
 * fails MessageList's resourceId validation.
 */
export function withOmInternalThreadId(
  requestContext: RequestContext | undefined,
  omAgentId: string,
): RequestContext | undefined {
  if (!requestContext) return undefined;

  const internalRequestContext = new RequestContext(requestContext.entries());

  const parentThreadId = requestContext.get(MASTRA_THREAD_ID_KEY);
  if (typeof parentThreadId === 'string' && parentThreadId) {
    internalRequestContext.set(MASTRA_THREAD_ID_KEY, `${parentThreadId}-${omAgentId}`);
  }

  return internalRequestContext;
}
