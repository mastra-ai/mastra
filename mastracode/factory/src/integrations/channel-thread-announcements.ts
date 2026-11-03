import type { AgentChannels } from '@mastra/core/channels';

/**
 * Post a pull request's link into the chat thread a session is linked to.
 * On Slack, a merge also adds ✅ to the thread's first message: Slack thread
 * ids are `slack:<channel>:<thread ts>`, and the thread ts is that message's ts.
 */
export async function announcePullRequest(
  channels: AgentChannels | null | undefined,
  threadId: string,
  milestone: 'opened' | 'merged',
  url: string,
): Promise<void> {
  const render = await channels?.buildRenderContextForThread(threadId);
  if (!render) return;
  await render.chatThread.post({ markdown: `Pull request ${milestone}: ${url}` });
  const [platform, , rootTs] = render.chatThread.id.split(':');
  if (milestone === 'merged' && platform === 'slack' && rootTs) {
    await render.adapter.addReaction(render.chatThread.id, rootTs, 'white_check_mark');
  }
}
