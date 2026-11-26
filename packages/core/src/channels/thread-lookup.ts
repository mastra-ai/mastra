import type { AgentControllerRequestContext } from '../agent-controller/types';
import { parseMemoryRequestContext } from '../memory/types';
import type { RequestContext } from '../request-context';
import type { AgentChannels } from './agent-channels';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import type { ChatChannelRenderContext } from './output-processor';

/** The channels a run's tools and processors post through, read lazily since they attach after the agent is built. */
export type ChannelsSource = () => AgentChannels | null | undefined;

/**
 * The chat thread this run posts into, if any.
 *
 * A run started by a platform message has the render context on `requestContext`. A run
 * started elsewhere (web UI, schedule, signal wake) on a thread linked to a chat thread does
 * not, so rebuild it from the thread's persisted channel coordinates. The thread id comes from
 * the agent controller when there is one, else from the run's memory context. A forked
 * subagent's thread carries no channel metadata, so forks resolve nothing.
 */
export async function resolveChannelRenderContext(
  requestContext: RequestContext | undefined,
  channels?: ChannelsSource,
): Promise<ChatChannelRenderContext | undefined> {
  if (!requestContext) return undefined;
  const stashed = requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
  if (stashed) return stashed;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const threadId = controller?.threadId ?? parseMemoryRequestContext(requestContext)?.thread?.id;
  if (!threadId) return undefined;
  return (await channels?.()?.buildRenderContextForThread(threadId)) ?? undefined;
}
