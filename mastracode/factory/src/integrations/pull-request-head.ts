import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * Records the head a pull request or merge request was observed at, so a
 * review verdict given on an earlier head can be shown as outdated. Webhooks
 * arrive out of order and get redelivered, so a write only lands when its
 * event is newer than the one the card last recorded; an event without a
 * timestamp cannot be ordered and is dropped. The check and the write run
 * against the same revision, so a concurrent delivery cannot slip between them.
 */
export async function recordPullRequestHead(
  storage: WorkItemsStorage,
  input: {
    orgId: string;
    id: string;
    headSha: string;
    headAt: number | undefined;
    /** Only write while the card has no open pull request or has this one out. */
    ownedPullRequestNumber?: number;
  },
): Promise<void> {
  if (input.headAt === undefined) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    const card = await storage.get({ orgId: input.orgId, id: input.id });
    if (!card) return;
    if (input.ownedPullRequestNumber !== undefined) {
      const recorded = card.metadata?.openPullRequestNumber;
      if (typeof recorded === 'number' && recorded !== input.ownedPullRequestNumber) return;
    }
    const recordedAt = card.metadata?.pullRequestHeadAt;
    if (typeof recordedAt === 'number' && recordedAt >= input.headAt) return;
    try {
      // The time advances even when the head is unchanged: a head that returns
      // to an earlier commit must still beat a late event for the one between.
      await storage.update({
        orgId: card.orgId,
        id: card.id,
        userId: 'factory-rule-dispatcher',
        expectedRevision: card.revision,
        patch: { metadata: { pullRequestHeadSha: input.headSha, pullRequestHeadAt: input.headAt } },
      });
      return;
    } catch (error) {
      if (!(error instanceof WorkItemUpdateConflictError)) throw error;
    }
  }
}
