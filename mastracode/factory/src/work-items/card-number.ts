/**
 * Board metadata key holding the `#number` of a card filed without an issue
 * behind it. Kept apart from `number`, which integrations read as the source
 * issue's number.
 */
export const CARD_NUMBER_METADATA_KEY = 'cardNumber';

/**
 * What the number is read from, as the server's card and the browser's both hold it: the facts of
 * its source, and the card's own metadata. The browser's card may lack its source's facts.
 */
export interface NumberedCard {
  workItem?: { metadata?: Record<string, unknown> | null } | null;
  metadata?: Record<string, unknown> | null;
}

/** The number a person sees on the card: the issue or PR number the item was filed from, or the project's own number for a card filed by hand. */
export function workItemNumber(item: NumberedCard): number | null {
  const facts = item.workItem?.metadata;
  const number =
    facts?.number ??
    facts?.githubIssueNumber ??
    facts?.githubPullRequestNumber ??
    item.metadata?.[CARD_NUMBER_METADATA_KEY];
  return typeof number === 'number' ? number : null;
}
