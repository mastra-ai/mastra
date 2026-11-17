import type { Card } from '../storage/domains/work-items/base.js';

/**
 * Board metadata key holding the `#number` of a card filed without an issue
 * behind it. Kept apart from `number`, which integrations read as the source
 * issue's number.
 */
export const CARD_NUMBER_METADATA_KEY = 'cardNumber';

/** The number a person sees on the card: the issue or PR number the item was filed from, or the project's own number for a card filed by hand. */
export function workItemNumber(item: Pick<Card, 'workItem' | 'metadata'>): number | null {
  const number =
    item.workItem.metadata?.number ??
    item.workItem.metadata?.githubIssueNumber ??
    item.workItem.metadata?.githubPullRequestNumber ??
    item.metadata?.[CARD_NUMBER_METADATA_KEY];
  return typeof number === 'number' ? number : null;
}
