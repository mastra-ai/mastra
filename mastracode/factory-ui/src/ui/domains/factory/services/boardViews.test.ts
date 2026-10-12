// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { rememberedBoardPath, saveBoardView } from './boardViews';

afterEach(() => localStorage.clear());

describe('board views', () => {
  it('links each board with only its own filter and sort parameters, per factory', () => {
    saveBoardView('fp-1', 'work', new URLSearchParams('q=auth&label=bug&label=ui&sort=created-newest&item=card-1'));

    expect(rememberedBoardPath('fp-1', 'work')).toBe(
      '/factories/fp-1/work?q=auth&label=bug&label=ui&sort=created-newest',
    );
    expect(rememberedBoardPath('fp-1', 'review')).toBe('/factories/fp-1/review');
    expect(rememberedBoardPath('fp-2', 'work')).toBe('/factories/fp-2/work');
  });

  it('keeps the custom board route', () => {
    saveBoardView('fp-1', 'release train', new URLSearchParams('sort=created-oldest'));

    expect(rememberedBoardPath('fp-1', 'release train')).toBe(
      '/factories/fp-1/boards/release%20train?sort=created-oldest',
    );
  });

  it('forgets a board saved without any filters or sort', () => {
    saveBoardView('fp-1', 'work', new URLSearchParams('q=auth'));
    saveBoardView('fp-1', 'work', new URLSearchParams('item=card-1'));

    expect(rememberedBoardPath('fp-1', 'work')).toBe('/factories/fp-1/work');
  });

  it('keeps every board under one key, capped to the most recently used', () => {
    for (let index = 0; index < 55; index += 1) saveBoardView('fp-1', `board-${index}`, new URLSearchParams('q=x'));

    expect(Object.keys(JSON.parse(localStorage.getItem('mastracode.boardViews') ?? '{}'))).toHaveLength(50);
    expect(rememberedBoardPath('fp-1', 'board-4')).toBe('/factories/fp-1/boards/board-4');
    expect(rememberedBoardPath('fp-1', 'board-54')).toBe('/factories/fp-1/boards/board-54?q=x');
  });

  it('ignores malformed stored values', () => {
    localStorage.setItem('mastracode.boardViews', '{"fp-1:work": 42}');
    expect(rememberedBoardPath('fp-1', 'work')).toBe('/factories/fp-1/work');

    localStorage.setItem('mastracode.boardViews', 'not json');
    expect(rememberedBoardPath('fp-1', 'work')).toBe('/factories/fp-1/work');
    expect(() => saveBoardView('fp-1', 'work', new URLSearchParams('q=x'))).not.toThrow();
    expect(rememberedBoardPath('fp-1', 'work')).toBe('/factories/fp-1/work?q=x');
  });
});
