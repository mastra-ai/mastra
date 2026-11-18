import { describe, expect, it } from 'vitest';

import { matchesSearch, searchTerms } from './search-terms.js';
import type { SearchableCard } from './search-terms.js';

const card = (overrides: Partial<SearchableCard> = {}): SearchableCard => ({
  text: '',
  ids: [],
  sourceKeys: [],
  links: [],
  ...overrides,
});
const finds = (searched: SearchableCard, query: string) => matchesSearch(searched, searchTerms(query));

describe('searchTerms', () => {
  it.each(['v1.2.3', 'package.json', 'node.js', 'acme/app#12', 'ENG-42', 'e.g/foo'])(
    'reads %s as a word, not a link',
    word => expect(searchTerms(word)).toEqual([{ kind: 'word', word: word.toLowerCase() }]),
  );

  it('reads a link pasted without its scheme as a link', () => {
    expect(searchTerms('GitHub.com/acme/app/pull/3/files')).toEqual([
      {
        kind: 'link',
        word: 'github.com/acme/app/pull/3/files',
        url: 'https://github.com/acme/app/pull/3/files',
        sourceKey: 'acme/app#3',
      },
    ]);
  });
});

describe('matchesSearch', () => {
  it('finds a card whose title holds the pasted link, whatever the link names', () => {
    const searched = card({ text: 'crash on https://example.com/pricing' });

    expect(finds(searched, 'https://example.com/pricing')).toBe(true);
    expect(finds(searched, 'https://example.com/pricing/annual')).toBe(false);
  });

  it('reads another source’s link by the link, at its own page or under it, never past its last segment', () => {
    const searched = card({ links: ['https://tracker.example.com/tickets/9'] });

    expect(finds(searched, 'https://tracker.example.com/tickets/9/?from=slack')).toBe(true);
    expect(finds(searched, 'https://tracker.example.com/tickets/9/comments')).toBe(true);
    expect(finds(searched, 'https://tracker.example.com/tickets')).toBe(true);
    expect(finds(searched, 'https://tracker.example.com/tickets/90')).toBe(false);
  });

  it('finds an id or a branch only when pasted whole', () => {
    const searched = card({ ids: ['factory/issue-12-abc'] });

    expect(finds(searched, 'factory/issue-12-abc')).toBe(true);
    expect(finds(searched, 'factory/issue-12')).toBe(false);
    expect(finds(searched, 'factory')).toBe(false);
  });
});
