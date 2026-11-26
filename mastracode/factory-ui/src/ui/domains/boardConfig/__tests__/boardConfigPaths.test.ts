import { describe, expect, it } from 'vitest';

import {
  boardConfigPath,
  boardIntakePath,
  boardSkillPath,
  boardSkillsPath,
  INTAKE_ORDER_ANCHOR,
  newSkillPath,
  parseBoardConfigPath,
  readCanvasFocus,
} from '../boardConfigPaths';
import type { CanvasFocus } from '../boardConfigPaths';

const focusOf = (path: string) => readCanvasFocus(new URL(path, 'http://localhost').searchParams);

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

  it('reads back the rule, new rule or test the side panel has open', () => {
    const focuses: CanvasFocus[] = [
      { rule: 'r-1', test: undefined },
      { rule: 'r-1', test: 'https://github.com/acme/app/issues/7' },
      { newRule: { on: undefined, into: undefined, board: undefined } },
      { newRule: { on: 'pull_request.opened', into: 'review', board: 'release notes' } },
      { test: 'd-1' },
    ];
    for (const focus of focuses) {
      expect(focusOf(boardConfigPath('fp-1', 'work', undefined, focus))).toEqual(focus);
      expect(focusOf(boardIntakePath('fp-1', 'work', { focus }))).toEqual(focus);
    }
    expect(focusOf(boardConfigPath('fp-1', 'work'))).toBeUndefined();
  });

  it('keeps the routing page apart from the canvas, with its anchors', () => {
    expect(boardIntakePath('fp-1', 'work', { anchor: INTAKE_ORDER_ANCHOR })).toBe(
      '/factories/fp-1/work/intake#intake-order',
    );
    expect(parseBoardConfigPath(boardIntakePath('fp-1', 'release notes'))).toEqual({
      factoryId: 'fp-1',
      boardId: 'release notes',
      intake: true,
    });
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

  it('keeps a skill page and the new skill form beside the skills page, even for a skill named new', () => {
    expect(boardSkillPath('fp-1', 'work', 'new')).toBe('/factories/fp-1/work/skills/new');
    expect(newSkillPath('fp-1', 'release notes')).toBe('/factories/fp-1/boards/release%20notes/new-skill');
    for (const path of [boardSkillPath('fp-1', 'work', 'release notes'), newSkillPath('fp-1', 'work')]) {
      expect(parseBoardConfigPath(path)).toEqual({ factoryId: 'fp-1', boardId: 'work', skills: true });
    }
  });

  it('ignores the board itself, the old rules pages and other pages', () => {
    expect(parseBoardConfigPath('/factories/fp-1/work')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/boards/release')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/settings/board')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/config/planning/extra')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/skills/plan/extra')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/rules')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/review/config')).toBeUndefined();
  });

  it('ignores a path whose encoding is broken, rather than failing the page that reads it', () => {
    expect(parseBoardConfigPath('/factories/fp-1/boards/%E0%A4%A/config')).toBeUndefined();
    expect(parseBoardConfigPath('/factories/fp-1/work/config/%E0%A4%A')).toBeUndefined();
  });
});
