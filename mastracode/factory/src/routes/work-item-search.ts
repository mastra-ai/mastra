/**
 * Card search: every word of the query must match the card's title, external id or key
 * (`#123`, `ENG-42`), and cards rank by how well the words match. A scan over the project's
 * cards in memory; at a few thousand cards that is milliseconds, so there is no index to keep.
 */

/** Lowercase with accents stripped, so `Café` matches `cafe`. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function searchTerms(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

export interface SearchableCard {
  title: string;
  /** Exact identifiers: issue keys, `#123`, external ids. */
  keys: readonly string[];
}

/** A card's text normalized once, so repeated searches over a cached card skip the work. */
export interface PreparedCard {
  title: string;
  words: readonly string[];
  keys: readonly string[];
}

export function prepareSearchCard(card: SearchableCard): PreparedCard {
  const title = normalizeSearchText(card.title);
  return { title, words: title.split(/[^\p{L}\p{N}]+/u).filter(Boolean), keys: card.keys.map(normalizeSearchText) };
}

const EXACT_KEY = 1000;
const TITLE_PREFIX = 200;
const KEY_PREFIX = 60;
const WORD_PREFIX = 40;
const SUBSTRING = 10;

/**
 * How well `terms` match `card`, or `undefined` when a term matches nothing.
 * Per term: a key prefix beats the start of a title word, which beats anywhere inside the text.
 * The whole query naming a key exactly, or starting the title, outranks any word-by-word match.
 */
export function searchScore(card: SearchableCard | PreparedCard, terms: readonly string[]): number | undefined {
  if (terms.length === 0) return 0;
  const { title, words, keys } = 'words' in card ? card : prepareSearchCard(card);
  let score = 0;
  for (const term of terms) {
    if (keys.some(key => key.startsWith(term))) score += KEY_PREFIX;
    else if (words.some(word => word.startsWith(term))) score += WORD_PREFIX;
    else if (title.includes(term) || keys.some(key => key.includes(term))) score += SUBSTRING;
    else return undefined;
  }
  const whole = terms.join(' ');
  if (keys.includes(whole)) score += EXACT_KEY;
  if (title.startsWith(whole)) score += TITLE_PREFIX;
  return score;
}
