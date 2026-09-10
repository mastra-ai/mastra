import type { FactoryAttentionItem } from '../../factory/services/attention';

/**
 * The unread items a visit to `sessionId` settles: everything the attention
 * feed aims at that session's thread. The exact inverse of `unreadSessionIds`'
 * predicate — keep the two in step, since one paints the dot and this one
 * clears it.
 *
 * Kind-agnostic on purpose. The activity belt reports what is still owed
 * independently, so the dot is free to mean only "nobody has looked at this
 * yet". In practice this sees the four `attention`-group kinds, because that is
 * all the sidebar's shared query fetches.
 */
export function unreadItemsForSession(
  items: readonly FactoryAttentionItem[],
  sessionId: string,
): FactoryAttentionItem[] {
  return items.filter(
    item => !item.read && !item.archived && item.target.kind === 'thread' && item.target.sessionId === sessionId,
  );
}
