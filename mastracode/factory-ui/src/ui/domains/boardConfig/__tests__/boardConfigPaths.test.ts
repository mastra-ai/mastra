import { describe, expect, it } from 'vitest';

import { boardCardMovesPath, boardConfigPath, boardSkillsPath, parseBoardConfigPath } from '../boardConfigPaths';

describe('board config paths', () => {
  it('nests a board configuration under the board it configures', () => {
    expect(boardConfigPath('fp-1', 'work')).toBe('/factories/fp-1/work/config');
    expect(boardConfigPath('fp-1', 'review', 'pr-review')).toBe('/factories/fp-1/boards/review/config/pr-review');
    expect(boardConfigPath('fp-1', 'release notes', 'draft')).toBe(
      '/factories/fp-1/boards/release%20notes/config/draft',
    );
  });

  it('reads back every path it builds', () => {
    for (const [boardId, phaseKey] of [
      ['work', undefined],
      ['work', 'planning'],
      ['review', undefined],
      ['release notes', 'draft'],
    ] as const) {
      expect(parseBoardConfigPath(boardConfigPath('fp-1', boardId, phaseKey))).toEqual({
        factoryId: 'fp-1',
        boardId,
        ...(phaseKey ? { phaseKey } : {}),
      });
    }
  });

  it("keeps the factory skills page beside a board's settings, apart from a phase named skills", () => {
    expect(parseBoardConfigPath(boardSkillsPath('fp-1', 'review'))).toEqual({
      factoryId: 'fp-1',
      boardId: 'review',
      skills: true,
    });
    expect(parseBoardConfigPath(boardSkillsPath('fp-1', 'release notes'))).toEqual({
      factoryId: 'fp-1',
      boardId: 'release notes',
      skills: true,
    });
    expect(parseBoardConfigPath(boardConfigPath('fp-1', 'work', 'skills'))).toEqual({
      factoryId: 'fp-1',
      boardId: 'work',
      phaseKey: 'skills',
    });
  });

  it("keeps a board's card moves beside its settings, apart from a phase named moves", () => {
    expect(boardCardMovesPath('fp-1', 'work')).toBe('/factories/fp-1/work/moves');
    expect(parseBoardConfigPath(boardCardMovesPath('fp-1', 'release notes'))).toEqual({
      factoryId: 'fp-1',
      boardId: 'release notes',
      moves: true,
    });
    expect(parseBoardConfigPath(boardConfigPath('fp-1', 'work', 'moves'))).toEqual({
      factoryId: 'fp-1',
      boardId: 'work',
      phaseKey: 'moves',
    });
  });

  it('ignores the board itself and other pages', () => {
    expect(parseBoardConfigPath('/factories/fp-1/work')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/boards/release')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/settings/board')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/config/planning/extra')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/skills/extra')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/moves/extra')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/review/config')).toBeUndefined();
  });

  it('ignores a path whose encoding is broken, rather than failing the page that reads it', () => {
    expect(parseBoardConfigPath('/factories/fp-1/boards/%E0%A4%A/config')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/config/%E0%A4%A')).toBeUndefined();
  });
});
