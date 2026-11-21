import { WorkItemUpdateConflictError } from '../../storage/domains/work-items/base.js';
import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';

const ATTEMPTS = 5;

/**
 * Merges keys into a card's metadata against the revision it read, re-reading and retrying when
 * the card moved on, so a write never drops another one (an alert event, a mention, a status
 * change). `change` sees the current card on each attempt and returns the keys to set, or null
 * for no write. Returns the card before and after, or null when nothing was written.
 */
export async function updateCardMetadata(
  storage: Pick<WorkItemsStorage, 'get' | 'update'>,
  ref: { orgId: string; id: string; userId: string },
  change: (card: Card) => Record<string, unknown> | null,
): Promise<{ before: Card; after: Card } | null> {
  for (let attempt = 1; ; attempt++) {
    const card = await storage.get({ orgId: ref.orgId, id: ref.id });
    if (!card) return null;
    const keys = change(card);
    if (!keys) return null;
    try {
      const written = await storage.update({
        orgId: ref.orgId,
        id: ref.id,
        userId: ref.userId,
        patch: { metadata: { ...card.metadata, ...keys } },
        expectedRevision: card.revision,
      });
      return written ? { before: card, after: written.item } : null;
    } catch (error) {
      if (error instanceof WorkItemUpdateConflictError && error.reason === 'revision' && attempt < ATTEMPTS) continue;
      throw error;
    }
  }
}
