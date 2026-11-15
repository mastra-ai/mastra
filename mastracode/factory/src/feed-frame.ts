/**
 * What one board frame says changed. `cards` names every card the write touched, and is empty when
 * only decisions or runs moved. A frame without `cards` could have changed any card.
 */
export interface FeedFrame {
  cards?: string[];
}

/** Anything a broker hands back that is not a list of card ids reads as "any card". */
export function readFeedFrame(data: unknown): FeedFrame {
  if (typeof data !== 'object' || data === null || !('cards' in data)) return {};
  const { cards } = data;
  return Array.isArray(cards) && cards.every(card => typeof card === 'string') ? { cards } : {};
}
