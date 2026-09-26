// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { restoreBoardView, saveBoardView } from './boardViews';

const loadBoardView = (factoryId: string, boardId: string) =>
  restoreBoardView(factoryId, boardId, new URLSearchParams());

afterEach(() => localStorage.clear());

describe('board views', () => {
  it('round-trips only the filter and sort parameters, per factory and board', () => {
    saveBoardView('fp-1', 'work', new URLSearchParams('q=auth&label=bug&label=ui&sort=created-newest&item=card-1'));

    expect(loadBoardView('fp-1', 'work')?.toString()).toBe('q=auth&label=bug&label=ui&sort=created-newest');
    expect(loadBoardView('fp-1', 'review')).toBeUndefined();
    expect(loadBoardView('fp-2', 'work')).toBeUndefined();
  });

  it('forgets a board saved without any filters or sort', () => {
    saveBoardView('fp-1', 'work', new URLSearchParams('q=auth'));
    saveBoardView('fp-1', 'work', new URLSearchParams('item=card-1'));

    expect(loadBoardView('fp-1', 'work')).toBeUndefined();
  });

  it('keeps every board under one key, capped to the most recently used', () => {
    for (let index = 0; index < 55; index += 1) saveBoardView('fp-1', `board-${index}`, new URLSearchParams('q=x'));

    const stored = JSON.parse(localStorage.getItem('mastracode.boardViews') ?? '{}') as Record<string, string>;
    expect(Object.keys(stored)).toHaveLength(50);
    expect(loadBoardView('fp-1', 'board-4')).toBeUndefined();
    expect(loadBoardView('fp-1', 'board-54')?.toString()).toBe('q=x');
  });

  it('ignores malformed stored values', () => {
    localStorage.setItem('mastracode.boardViews', '{"fp-1:work": 42}');
    expect(loadBoardView('fp-1', 'work')).toBeUndefined();

    localStorage.setItem('mastracode.boardViews', 'not json');
    expect(loadBoardView('fp-1', 'work')).toBeUndefined();
    expect(() => saveBoardView('fp-1', 'work', new URLSearchParams('q=x'))).not.toThrow();
    expect(loadBoardView('fp-1', 'work')?.toString()).toBe('q=x');
  });

  it('restores only when the URL has no view of its own and no card target', () => {
    saveBoardView('fp-1', 'work', new URLSearchParams('q=auth&sort=created-newest'));

    expect(restoreBoardView('fp-1', 'work', new URLSearchParams('tab=x'))?.toString()).toBe(
      'tab=x&q=auth&sort=created-newest',
    );
    expect(restoreBoardView('fp-1', 'work', new URLSearchParams('sort=created-oldest'))).toBeUndefined();
    expect(restoreBoardView('fp-1', 'work', new URLSearchParams('item=card-1'))).toBeUndefined();
  });
});
