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

/**
 * A card as a search reads it, from whichever side holds it: the server's card or the browser's.
 * Both build their search from it, so the board, the palette and the server agree on what a card answers.
 */
export interface SearchedCard {
  id: string;
  title: string;
  /** The issue or pull request number the card shows, or the one given to a card filed by hand. */
  number: number | null;
  /** The id its source gave it. */
  sourceId: string | null | undefined;
  /** Its own source's key (`ENG-42`). */
  key: string | null | undefined;
  /** Its own source's links. */
  urls: readonly (string | null | undefined)[];
  /** Every issue and pull request the card carries, its own first. */
  sources: readonly { key: string | null; url: string | null; metadata: Record<string, unknown> | null }[];
  sessions: Readonly<Record<string, { branch: string }>>;
}

// A card has a handful of each, so arrays: cheaper to build than sets, as quick to read.
function lowercased(values: readonly unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .map(value => value.toLowerCase());
}

/**
 * What a search reads of a card: its title, its number, its source id and the key of every issue
 * and pull request it carries as words, so a pull request attached to its issue's card finds that
 * card; those keys and links for a pasted link; and its id and branches, pasted whole.
 */
export function searchableCard(card: SearchedCard): SearchableCard {
  const keys = lowercased([card.key, ...card.sources.map(source => source.key)]);
  return {
    // `#12` also answers a search for `12`. Attached keys bring their numbers: `acme/app#30772`.
    text: [...lowercased([card.title, card.number === null ? null : `#${card.number}`, card.sourceId]), ...keys].join(
      ' ',
    ),
    ids: lowercased([
      card.id,
      ...Object.values(card.sessions).map(session => session.branch),
      // An outside contributor's pull request is worked on its own branch.
      ...card.sources.map(source => source.metadata?.headBranch),
    ]),
    sourceKeys: keys,
    links: lowercased([...card.urls, ...card.sources.map(source => source.url)]).map(normalizedUrl),
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
/** A Factory card's page, `/factories/<project>/cards/<card id>`: not any link with a `/cards/<uuid>` in it. */
const CARD_LINK =
  /^https?:\/\/[^/]+\/factories\/[^/?#]+\/cards\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

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
  // A word in a title, or a whole id or branch, still finds the card, whatever else the word could
  // name: `user.name/fix-login` reads as a link, and is a branch too.
  if (card.text.includes(term.word) || card.ids.includes(term.word)) return true;
  if (term.kind === 'word') return false;
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
