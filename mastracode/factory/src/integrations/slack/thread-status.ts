/**
 * A status reaction on the first message of a Slack thread, so the people in
 * it can see where their request stands without opening Factory.
 */

import type { AgentChannels } from '@mastra/core/channels';
import type { Adapter } from 'chat';

export const DONE_REACTION = 'white_check_mark';

/** The reaction for each card stage. Stages not listed show no reaction. */
export const STAGE_REACTIONS: Record<string, string> = {
  triage: 'eyes',
  planning: 'memo',
  execute: 'hammer',
  review: 'mag',
  done: DONE_REACTION,
};

/**
 * Replace `remove` with `add` on the thread's first message. Slack thread ids
 * are `slack:<channel>:<thread ts>`, and the thread ts is that message's ts.
 * Best-effort: a failure is logged and never reaches the caller, and a failed
 * removal (the reaction was never there) still lets the new one through.
 * Swaps on the same thread run one after another, so stage changes that fire
 * close together land in order.
 */
export function swapThreadReaction(
  adapter: Pick<Adapter, 'addReaction' | 'removeReaction'>,
  threadId: string,
  { remove, add }: { remove?: string; add?: string },
): Promise<void> {
  const [platform, channel, rootTs] = threadId.split(':');
  if (platform !== 'slack' || !channel || !rootTs || remove === add) return Promise.resolve();
  const attempt = (call: Promise<void>, emoji: string) =>
    call.catch(error => console.warn('[slack] thread status reaction failed', { threadId, emoji, error }));
  const run = (pending.get(threadId) ?? Promise.resolve()).then(async () => {
    if (remove) await attempt(adapter.removeReaction(threadId, rootTs, remove), remove);
    if (add) await attempt(adapter.addReaction(threadId, rootTs, add), add);
  });
  pending.set(threadId, run);
  void run.then(() => {
    if (pending.get(threadId) === run) pending.delete(threadId);
  });
  return run;
}

const pending = new Map<string, Promise<void>>();

/**
 * Post a pull request's link into the Slack thread a session is linked to.
 * A merge also closes the thread out with ✅.
 */
export async function announcePullRequest(
  channels: AgentChannels | null | undefined,
  threadId: string,
  milestone: 'opened' | 'merged',
  url: string,
): Promise<void> {
  const render = await channels?.buildRenderContextForThread(threadId);
  if (render?.platform !== 'slack') return;
  await render.chatThread.post({ markdown: `Pull request ${milestone}: ${url}` });
  if (milestone === 'merged') await swapThreadReaction(render.adapter, render.chatThread.id, { add: DONE_REACTION });
}
