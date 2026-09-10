import type { FactoryAttentionItem } from '../../factory/services/attention';

/**
 * The sessions still owed a read. Only a `thread` target names a session, so
 * everything aimed at a card or the rules page passes through. Archived items
 * are settled and read ones have been seen, so neither marks a row: this is the
 * read receipt, not the lifecycle the activity belt already reports.
 */
export function unreadSessionIds(items: readonly FactoryAttentionItem[]): ReadonlySet<string> {
  const unread = new Set<string>();
  for (const item of items) {
    if (item.read || item.archived) continue;
    if (item.target.kind !== 'thread') continue;
    unread.add(item.target.sessionId);
  }
  return unread;
}
