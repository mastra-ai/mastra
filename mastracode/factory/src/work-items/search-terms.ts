import { normalizedUrl, sourceKeyFromReference } from './card-reference.js';
import { searchWords } from './search-words.js';

/**
 * What a card offers a search, lowercased. Built once per card version by the caller, so a search
 * only reads it.
 */
export interface SearchableCard {
  /** What reads as words: its title, its keys and numbers, its source ids. Never its links: `issues` or `github.com` would find every card. */
  text: string;
  /** What is only ever pasted whole: the card's id, its branches. */
  ids: readonly string[];
  /** The keys of every issue or pull request the card carries, its own and the attached ones (`acme/app#12`, `eng-42`). */
  sourceKeys: readonly string[];
  /** The links of those issues and pull requests, as {@link normalizedUrl} writes them. */
  links: readonly string[];
}

function present(values: readonly unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value !== '');
}

/** What a search reads of a card, from its parts as stored: blanks dropped, the rest lowercased and links normalized. */
export function searchableCard(parts: {
  words: readonly unknown[];
  ids: readonly unknown[];
  sourceKeys: readonly unknown[];
  links: readonly unknown[];
}): SearchableCard {
  // A card has a handful of each, so arrays: cheaper to build than sets, as quick to read.
  const lowercased = (values: readonly unknown[]) => present(values).map(value => value.toLowerCase());
  return {
    text: lowercased(parts.words).join(' '),
    ids: lowercased(parts.ids),
    sourceKeys: lowercased(parts.sourceKeys),
    links: present(parts.links).map(normalizedUrl),
  };
}

/** One word of a typed search, and what else than the card's text finds a card for it. */
export type SearchTerm =
  | { kind: 'word'; word: string }
  /** A link to a Factory card. */
  | { kind: 'card'; word: string; id: string }
  /** Any other link; `sourceKey` when it names an issue or pull request. */
  | { kind: 'link'; word: string; url: string; sourceKey: string | null };

const LINK = /^https?:\/\//i;
/** A link pasted without its scheme: `github.com/acme/app/pull/3`. */
const BARE_LINK = /^(?:[a-z0-9-]+\.)+[a-z]{2,}\//i;
const CARD_LINK = /\/cards\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

function searchTerm(word: string): SearchTerm {
  const link = LINK.test(word) ? word : BARE_LINK.test(word) ? `https://${word}` : undefined;
  if (link === undefined) return { kind: 'word', word };
  const card = CARD_LINK.exec(link)?.[1];
  if (card !== undefined) return { kind: 'card', word, id: card };
  return {
    kind: 'link',
    word,
    url: normalizedUrl(link),
    sourceKey: sourceKeyFromReference(link)?.toLowerCase() ?? null,
  };
}

/** The terms of a typed search: one per word, lowercased. Parse once per search, not per card. */
export function searchTerms(query: string): SearchTerm[] {
  return searchWords(query).map(searchTerm);
}

const SLASH = '/'.charCodeAt(0);

/** `inner` is `outer` or a page under it: `…/pull/3/files` under `…/pull/3`, never `…/pull/30`. */
function isAtOrUnder(inner: string, outer: string): boolean {
  if (inner.length === outer.length) return inner === outer;
  // Read for every card on every search: compares in place rather than building `${outer}/`.
  return inner.length > outer.length && inner.charCodeAt(outer.length) === SLASH && inner.startsWith(outer);
}

function matchesTerm(card: SearchableCard, term: SearchTerm): boolean {
  // A word in a title still finds the card, whatever else the word could name.
  if (card.text.includes(term.word)) return true;
  if (term.kind === 'word') return card.ids.includes(term.word);
  if (term.kind === 'card') return card.ids.includes(term.id);
  // A link to the issue or pull request, to a page of it, or to a repository or project holding it.
  return (
    (term.sourceKey !== null && card.sourceKeys.includes(term.sourceKey)) ||
    card.links.some(link => isAtOrUnder(term.url, link) || isAtOrUnder(link, term.url))
  );
}

/** Whether the card answers every term. No terms keep every card. */
export function matchesSearch(card: SearchableCard, terms: readonly SearchTerm[]): boolean {
  return terms.every(term => matchesTerm(card, term));
}
