import type { Card } from '../storage/domains/work-items/base.js';
import { workItemNumber } from '../tools/read-tools.js';

/** The words of a typed search, lowercased. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether every word is somewhere in `text`, which the caller has lowercased. */
export function hasEveryWord(text: string, words: readonly string[]): boolean {
  return words.every(word => text.includes(word));
}

interface UnstartedCard {
  card: Card;
  /** Lowercased, so a search lowercases only its own words. */
  text: string;
}

// One list per board version: `listShared` returns the same array until a card changes.
const unstartedByBoard = new WeakMap<readonly Card[], UnstartedCard[]>();

/** What a search reads of a card: its title, its key (`ENG-42`), its number and its source id. */
function searchText(card: Card): string {
  const number = workItemNumber(card);
  // `#12` also answers a search for `12`.
  return [card.title, card.workItem.key, number === null ? null : `#${number}`, card.externalSource?.externalId]
    .join(' ')
    .toLowerCase();
}

function unstarted(board: readonly Card[]): UnstartedCard[] {
  let cards = unstartedByBoard.get(board);
  if (!cards) {
    cards = board
      .filter(card => Object.keys(card.sessions).length === 0)
      // Cards updated at the same instant keep the board's order, newest created first.
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(card => ({ card, text: searchText(card) }));
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
