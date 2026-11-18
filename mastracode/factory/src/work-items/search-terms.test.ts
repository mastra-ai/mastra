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
  it.each(['v1.2.3', 'package.json', 'node.js', 'ENG-42', 'gpt-4', 'e.g/foo', '12'])(
    'reads %s as a word, not a link',
    word => expect(searchTerms(word)).toEqual([{ kind: 'word', word: word.toLowerCase() }]),
  );

  it.each(['#12', 'acme/app#12', 'group/sub/project!7'])('reads %s as a whole reference', word =>
    expect(searchTerms(word)).toEqual([{ kind: 'reference', word }]),
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
  it('finds a number or key only whole, in a key or a title, and bare digits anywhere', () => {
    const searched = card({ text: 'follow up on #12. #345 acme/app#30772' });

    expect(finds(searched, '#12')).toBe(true);
    expect(finds(searched, '#34')).toBe(false);
    expect(finds(searched, '#345')).toBe(true);
    expect(finds(searched, 'acme/app#307')).toBe(false);
    expect(finds(searched, 'acme/app#30772')).toBe(true);
    expect(finds(searched, '34')).toBe(true);
  });

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

  it('finds a branch whose first segment holds a dot, which reads as a link, when pasted whole', () => {
    const searched = card({ ids: ['user.name/fix-login'] });

    expect(searchTerms('user.name/fix-login')[0]?.kind).toBe('link');
    expect(finds(searched, 'user.name/fix-login')).toBe(true);
    expect(finds(searched, 'user.name/fix')).toBe(false);
  });

  it('reads a link as a Factory card only on a Factory card’s page', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const sourceLink = `https://gitlab.example.com/cards/${id}/-/issues/9`;
    const carrier = card({ links: [sourceLink], sourceKeys: [`cards/${id}#9`] });

    expect(searchTerms(sourceLink)[0]?.kind).toBe('link');
    expect(finds(carrier, sourceLink)).toBe(true);
    expect(searchTerms(`https://factory.example.com/factories/p1/cards/${id}/new/x`)).toEqual([
      { kind: 'card', word: `https://factory.example.com/factories/p1/cards/${id}/new/x`, id },
    ]);
    expect(finds(card({ ids: [id] }), `https://factory.example.com/factories/p1/cards/${id}`)).toBe(true);
  });

  it('finds an id or a branch only when pasted whole', () => {
    const searched = card({ ids: ['factory/issue-12-abc'] });

    expect(finds(searched, 'factory/issue-12-abc')).toBe(true);
    expect(finds(searched, 'factory/issue-12')).toBe(false);
    expect(finds(searched, 'factory')).toBe(false);
  });
});
