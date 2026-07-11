import { MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';

/**
 * OM observer/reflector agents are implementation-detail agents invoked from
 * inside a parent agent run. They should keep request-scoped values such as
 * auth, versions, routing hints, and resource id, but they must not present as
 * another run on the parent thread or core's cross-agent thread wait can block
 * on the parent run that is waiting for OM to complete.
 */
export function withOmInternalThreadId(
  requestContext: RequestContext | undefined,
  omAgentId: string,
): RequestContext | undefined {
  if (!requestContext) return undefined;

  const parentThreadId = requestContext.get(MASTRA_THREAD_ID_KEY);
  if (typeof parentThreadId !== 'string' || !parentThreadId) return requestContext;

  const internalRequestContext = new RequestContext(requestContext.entries());
  internalRequestContext.set(MASTRA_THREAD_ID_KEY, `${parentThreadId}-${omAgentId}`);
  return internalRequestContext;
}
