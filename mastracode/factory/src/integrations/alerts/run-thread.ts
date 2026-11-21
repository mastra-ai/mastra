import type { Card, FactoryRunBindingRecord } from '../../storage/domains/work-items/base.js';
import type { WorkItemRunThread } from '../base.js';

import { ALERT_TRIAGE_CONTEXT } from './board.js';
import { ALERT_INTEGRATION_ID } from './rules.js';

/** The alert's Slack thread, as attached to its card on `alert.thread_linked`. */
export function alertSlackThreadOf(card: Card): { teamId: string; channelId: string; threadId: string } | null {
  if (card.externalSource?.integrationId !== ALERT_INTEGRATION_ID) return null;
  const source = card.workItem.sources.find(
    candidate => candidate.integrationId === 'slack' && candidate.sourceType === 'slack-thread',
  );
  // Stored ids are namespaced (`slack-thread:<team>:slack:<channel>:<ts>`); the chat thread id is the tail.
  const match = source?.workspaceId ? /slack:([^:]+):([^:]+)$/.exec(source.externalId) : null;
  if (!source?.workspaceId || !match) return null;
  return { teamId: source.workspaceId, channelId: match[1]!, threadId: `slack:${match[1]}:${match[2]}` };
}

/**
 * Links an alert card's run thread to the alert's Slack thread, the way the Slack handler links a
 * thread it creates: the run gets the Slack channel tools, and a reply in the Slack thread routes
 * back to this session. Returns false for cards with no alert thread.
 */
export async function bindAlertRunThread(input: {
  item: Card;
  binding: { threadId: string; sessionId: string };
  thread: WorkItemRunThread;
}): Promise<boolean> {
  const thread = alertSlackThreadOf(input.item);
  if (!thread) return false;
  const stamp = (key: string, value: string) =>
    input.thread.setSettingOn({ threadId: input.binding.threadId, key, value });
  await stamp('channel_platform', 'slack');
  await stamp('channel_externalThreadId', thread.threadId);
  await stamp('channel_externalChannelId', thread.channelId);
  await stamp('factorySessionId', input.binding.sessionId);
  return true;
}

/**
 * Binds the card's active runs that started before its Slack thread was known, when
 * `alert.thread_linked` attaches the thread. Returns the number of runs bound.
 */
export async function bindAlertRunsOnThreadLink(input: {
  card: Card;
  listRunBindings: (orgId: string, factoryProjectId: string, workItemId: string) => Promise<FactoryRunBindingRecord[]>;
  getSession: (sessionId: string) => Promise<{ thread: WorkItemRunThread } | null | undefined>;
}): Promise<number> {
  if (!input.card.factoryProjectId || !alertSlackThreadOf(input.card)) return 0;
  const bindings = await input.listRunBindings(input.card.orgId, input.card.factoryProjectId, input.card.id);
  let bound = 0;
  for (const binding of bindings) {
    // Only the triage run joins the alert thread, as when a run starts after the thread is known.
    if (binding.status !== 'active' || binding.role !== ALERT_TRIAGE_CONTEXT) continue;
    const session = await input.getSession(binding.sessionId);
    if (session && (await bindAlertRunThread({ item: input.card, binding, thread: session.thread }))) bound++;
  }
  return bound;
}
