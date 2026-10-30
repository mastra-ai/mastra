import { describe, expect, it } from 'vitest';

import { searchScore, searchTerms } from './work-item-search.js';

const rank = (query: string, cards: { title: string; keys?: string[] }[]) =>
  cards
    .map(card => ({
      title: card.title,
      score: searchScore({ title: card.title, keys: card.keys ?? [] }, searchTerms(query)),
    }))
    .filter(entry => entry.score !== undefined)
    .sort((left, right) => right.score! - left.score!)
    .map(entry => entry.title);

describe('card search', () => {
  it('needs every word to match, in any order, ignoring case and accents', () => {
    const cards = [{ title: 'Café login is broken' }, { title: 'Login page copy' }];
    expect(rank('BROKEN cafe', cards)).toEqual(['Café login is broken']);
    expect(rank('login nope', cards)).toEqual([]);
  });

  it('puts an exact key first, then a title that starts with the query, then word starts, then anywhere', () => {
    const cards = [
      { title: 'Relogin loops forever' },
      { title: 'Retry login after timeout' },
      { title: 'Login is broken' },
      { title: 'Unrelated card', keys: ['login'] },
    ];
    expect(rank('login', cards)).toEqual([
      'Unrelated card',
      'Login is broken',
      'Retry login after timeout',
      'Relogin loops forever',
    ]);
  });

  it('finds a card by its key prefix', () => {
    const cards = [
      { title: 'Ship it', keys: ['ENG-42'] },
      { title: 'Other', keys: ['ENG-7'] },
    ];
    expect(rank('eng-4', cards)).toEqual(['Ship it']);
    expect(rank('eng', cards)).toHaveLength(2);
  });
});
