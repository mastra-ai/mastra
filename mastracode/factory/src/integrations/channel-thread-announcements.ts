import type { AgentChannels } from '@mastra/core/channels';

/**
 * Celebratory lines for a merged pull request, one picked at random per merge.
 * Unicode emoji render on every chat platform, unlike Slack shortcodes.
 */
export const MERGED_MESSAGES: ReadonlyArray<(url: string) => string> = [
  url => `🎉 Merged! ${url} is officially in.`,
  url => `✨ ${url} merged. Another one in the books!`,
  url => `🙌 That's a wrap. ${url} just merged.`,
  url => `✅ Done and done. ${url} is merged.`,
  url => `🥳 It's in! ${url} merged.`,
  url => `💪 Nice work, everyone. ${url} made it in.`,
  url => `🏁 Crossed the finish line: ${url} merged.`,
  url => `🌟 ${url} merged. Great work!`,
  url => `👏 And it's in! ${url} just merged.`,
  url => `🚀 ${url} merged. Onward!`,
  url => `🏆 Another win: ${url} is merged.`,
  url => `🎊 Merged! ${url} is part of the codebase now.`,
  url => `💯 Signed, sealed, merged: ${url}`,
  url => `🎯 Nailed it. ${url} merged.`,
  url => `🌱 ${url} merged. The codebase grows!`,
];

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
  const markdown =
    milestone === 'merged'
      ? MERGED_MESSAGES[Math.floor(Math.random() * MERGED_MESSAGES.length)]!(url)
      : `Pull request opened: ${url}`;
  await render.chatThread.post({ markdown });
  const [platform, , rootTs] = render.chatThread.id.split(':');
  if (milestone === 'merged' && platform === 'slack' && rootTs) {
    await render.adapter.addReaction(render.chatThread.id, rootTs, 'white_check_mark');
  }
}
