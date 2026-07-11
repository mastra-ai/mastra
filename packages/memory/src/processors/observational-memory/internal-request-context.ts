import { MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';

/**
 * OM observer/reflector agents are implementation-detail agents invoked from
 * inside a parent agent run. They should keep request-scoped values such as
 * auth, versions, routing hints, and resource id, but they must not present as
 * another run on the parent thread or core's cross-agent thread wait can block
 * on the parent run that is waiting for OM to complete.
 *
 * They must also not inherit the parent run's controller channels. When an
 * AgentController drives a run through a messaging channel, it stamps its
 * channels onto the `'controller'` key of the request context so the run's
 * output renders back to that channel. The OM observer/reflector runs are
 * internal and must not render — otherwise their raw observation text streams
 * out to the originating channel (e.g. Slack). Since this clone copies every
 * entry, we strip only the `channels` field from the controller value so the
 * internal runs resolve no channel and produce no channel output.
 */
export function withOmInternalThreadId(
  requestContext: RequestContext | undefined,
  omAgentId: string,
): RequestContext | undefined {
  if (!requestContext) return undefined;

  const parentThreadId = requestContext.get(MASTRA_THREAD_ID_KEY);
  const needsThreadId = typeof parentThreadId === 'string' && !!parentThreadId;

  const controller = requestContext.get('controller') as Record<string, unknown> | undefined;
  const needsChannelStrip =
    !!controller && typeof controller === 'object' && 'channels' in controller && controller.channels !== undefined;

  // Nothing to change: no parent thread id to namespace and no controller
  // channels to strip — return the original context untouched.
  if (!needsThreadId && !needsChannelStrip) return requestContext;

  const internalRequestContext = new RequestContext(requestContext.entries());
  if (needsThreadId) {
    internalRequestContext.set(MASTRA_THREAD_ID_KEY, `${parentThreadId}-${omAgentId}`);
  }
  if (needsChannelStrip) {
    internalRequestContext.set('controller', { ...controller, channels: undefined });
  }

  return internalRequestContext;
}
