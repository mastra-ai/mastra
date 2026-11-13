import type { Card } from '../storage/domains/work-items/base.js';
import { cardSearchText } from '../work-items/card-search-text.js';
import { hasEveryWord, searchWords } from '../work-items/search-words.js';

interface UnstartedCard {
  card: Card;
  /** Lowercased, so a search lowercases only its own words. */
  text: string;
}

// One list per board version: `listShared` returns the same array until a card changes.
const unstartedByBoard = new WeakMap<readonly Card[], UnstartedCard[]>();

function unstarted(board: readonly Card[]): UnstartedCard[] {
  let cards = unstartedByBoard.get(board);
  if (!cards) {
    cards = board
      .filter(card => Object.keys(card.sessions).length === 0)
      // Cards updated at the same instant keep the board's order, newest created first.
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(card => ({ card, text: cardSearchText(card) }));
    unstartedByBoard.set(board, cards);
  }
  return cards;
}

/**
 * The cards holding no session whose text has every word of `query`, most recently updated first:
 * the first `limit` of them, and how many there are in all.
 */
export function unstartedCards(board: readonly Card[], query: string, limit: number): { cards: Card[]; total: number } {
  const words = searchWords(query);
  const matches = unstarted(board).filter(({ text }) => hasEveryWord(text, words));
  return { cards: matches.slice(0, limit).map(({ card }) => card), total: matches.length };
}

/** The cards filed from one of `sources`, each a source id or a URL, in board order. */
export function cardsFiledFrom(board: readonly Card[], sources: readonly string[]): Card[] {
  const wanted = new Set(sources);
  return board.filter(card =>
    [card.externalSource?.externalId, card.externalSource?.url, card.workItem.url].some(
      key => typeof key === 'string' && wanted.has(key),
    ),
  );
}

/** The cards whose id is one of `ids`, in board order. An id no card has is left out. */
export function cardsWithIds(board: readonly Card[], ids: readonly string[]): Card[] {
  const wanted = new Set(ids);
  return board.filter(card => wanted.has(card.id));
}
