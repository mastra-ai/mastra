/**
 * What one board frame says changed. `cards` names every card the write touched, and is empty when
 * only decisions or runs moved. A frame without `cards` could have changed any card. `sessions`
 * names the sessions whose run started, parked, was answered or ended.
 */
export interface FeedFrame {
  cards?: string[];
  sessions?: string[];
}

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(id => typeof id === 'string');

/** Anything a broker hands back that is not a list of card ids reads as "any card". */
export function readFeedFrame(data: unknown): FeedFrame {
  if (typeof data !== 'object' || data === null || !('cards' in data) || !isIdList(data.cards)) return {};
  return 'sessions' in data && isIdList(data.sessions)
    ? { cards: data.cards, sessions: data.sessions }
    : { cards: data.cards };
}
