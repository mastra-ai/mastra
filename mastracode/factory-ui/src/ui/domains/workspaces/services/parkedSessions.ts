import type { FactoryAttentionItem } from '../../factory/services/attention';

/**
 * The sessions whose agent is parked, read from the attention feed rather than
 * the board. The board's `parkedSessionIds` only covers sessions a work item
 * names, so a user session bound to no card never appears there — the attention
 * feed lists those parks aimed at the user threads list instead.
 *
 * A park lives exactly as long as the answer is owed, so a *read* one still
 * means parked: only archiving settles it. That is what separates this from
 * `unreadSessionIds` — this feeds the activity belt ("still owed"), that feeds
 * the unread dot ("nobody has looked").
 */
export function parkedSessionIdsFrom(items: readonly FactoryAttentionItem[]): ReadonlySet<string> {
  const parked = new Set<string>();
  for (const item of items) {
    if (item.kind !== 'agent-waiting' || item.archived) continue;
    parked.add(item.sessionId);
  }
  return parked;
}
