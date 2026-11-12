import { describe, expect, it } from 'vitest';

import { boardColumnsRequest, deeperColumnWindow } from './boardColumnsRequest';
import { boardFiltersFromParams } from './boardFilters';

const NO_FILTERS = boardFiltersFromParams(new URLSearchParams(), true);
const CARD_ID = '3f2c1a9e-5b7d-4c1e-9a2f-0d6e8b4c7a15';

function request(overrides: Partial<Parameters<typeof boardColumnsRequest>[0]> = {}) {
  return boardColumnsRequest({
    board: 'work',
    sort: 'recent',
    search: '',
    filters: NO_FILTERS,
    windows: {},
    item: undefined,
    ...overrides,
  });
}

describe('boardColumnsRequest', () => {
  it('asks the same thing whatever order the filters were picked in, so one view is one cached read', () => {
    const first = request({
      filters: boardFiltersFromParams(new URLSearchParams('label=p1&label=bug&author=github%3Aada'), true),
    });
    const second = request({
      filters: boardFiltersFromParams(new URLSearchParams('author=github%3Aada&label=bug&label=p1'), true),
    });

    expect(first.filters).toEqual({ label: ['bug', 'p1'], author: ['github:ada'] });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('names no filter the view leaves empty', () => {
    expect(request().filters).toEqual({});
  });

  it('asks for the search without its outer spaces and no longer than the server accepts', () => {
    expect(request({ search: '  login bug ' }).q).toBe('login bug');
    expect(request({ search: 'x'.repeat(260) }).q).toHaveLength(200);
  });

  it('names the linked card only when the link holds a card id, which is all the server accepts', () => {
    expect(request({ item: CARD_ID }).item).toBe(CARD_ID);
    expect(request({ item: 'not-a-card' })).not.toHaveProperty('item');
    expect(request()).not.toHaveProperty('item');
  });
});

describe('deeperColumnWindow', () => {
  it('doubles what a column lists, starting from the first page', () => {
    expect(deeperColumnWindow(50)).toBe(100);
    expect(deeperColumnWindow(100)).toBe(200);
    // A column that lost cards since its read still deepens past its first page.
    expect(deeperColumnWindow(48)).toBe(100);
  });

  it('never asks deeper than the server accepts', () => {
    expect(deeperColumnWindow(900_000)).toBe(999_999);
  });
});
