/**
 * Deterministic pull-request milestones posted into the chat thread a session
 * is linked to, independent of whether the agent decides to mention them.
 */

import type { AgentChannels } from '@mastra/core/channels';

/** Slack shortcode reacted onto the thread's first message once its PR merges. */
export const DONE_REACTION = 'white_check_mark';

export type PullRequestMilestone = 'opened' | 'merged';

export function pullRequestMilestoneMarkdown(milestone: PullRequestMilestone, url: string): string {
  return milestone === 'opened' ? `Pull request opened: ${url}` : `Pull request merged: ${url}`;
}

/**
 * The `ts` of the thread's first message. Slack thread ids are
 * `slack:<channel>:<thread ts>`, and the thread ts is the root message's ts.
 */
export function slackRootMessageId(threadId: string): string | undefined {
  const [platform, channel, ts] = threadId.split(':');
  return platform === 'slack' && channel && ts ? ts : undefined;
}

/**
 * Post a pull-request milestone into the chat thread linked to `threadId`.
 * On merge, a Slack thread also gets ✅ on its first message so the people in
 * it can see the request is done. Returns false when the session is not
 * linked to a chat thread.
 */
export async function announcePullRequestMilestone(
  channels: AgentChannels | null | undefined,
  threadId: string,
  milestone: PullRequestMilestone,
  url: string,
): Promise<boolean> {
  const render = await channels?.buildRenderContextForThread(threadId);
  if (!render) return false;
  await render.chatThread.post({ markdown: pullRequestMilestoneMarkdown(milestone, url) });
  if (milestone === 'merged' && render.platform === 'slack') {
    const rootMessageId = slackRootMessageId(render.chatThread.id);
    if (rootMessageId) await render.adapter.addReaction(render.chatThread.id, rootMessageId, DONE_REACTION);
  }
  return true;
}
