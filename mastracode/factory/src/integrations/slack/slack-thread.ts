import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { AgentChannels } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';

export interface SlackThreadDeps {
  /**
   * The channels attached to the controller, used to rebuild the chat thread
   * for runs that did not start from a platform message. Omit when the caller
   * has no controller; the tool is then offered only on inbound-webhook runs.
   */
  channels?: () => AgentChannels | null | undefined;
}

/**
 * The run's Slack thread, with its chat thread id (`slack:C…:ts`) when known,
 * or null when the run isn't on a Slack thread. A run started from Slack says so on
 * `requestContext`; a web prompt or a woken run on a Slack-linked session costs
 * one thread read.
 */
export async function slackThreadOf(
  requestContext: RequestContext,
  deps: SlackThreadDeps,
): Promise<{ threadId?: string } | null> {
  const channel = requestContext.get('channel') as { platform?: string; threadId?: string } | undefined;
  if (channel) return channel.platform === 'slack' ? { threadId: channel.threadId } : null;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  const threadId = controller?.threadId;
  if (!threadId) return null;
  const linked = await deps.channels?.()?.buildChannelContextForThread(threadId);
  return linked?.channel.platform === 'slack' ? { threadId: linked.render.chatThread.id } : null;
}
