import { storedBoardInputSchema } from '@mastra/factory/boards/stored-board';
import { describe, expect, it } from 'vitest';

import { keyFromName, keyProblem, starterBoard } from './boardDraft';

describe('board keys', () => {
  it('derives a key the server accepts from a board name', () => {
    expect(keyFromName('Bug Triage')).toBe('bug-triage');
    expect(keyFromName('  --Émile’s board!  ')).toBe('mile-s-board');
    expect(keyFromName('release_2')).toBe('release_2');
    expect(keyFromName('!!!')).toBe('');
    const long = keyFromName(`${'a'.repeat(127)} b`);
    expect(long).toBe('a'.repeat(127));
    expect(keyProblem(long)).toBeUndefined();
  });

  it('says why a key would be refused', () => {
    expect(keyProblem('')).toBe('Enter a key.');
    expect(keyProblem('-bugs')).toMatch(/starting with a letter or digit/);
    expect(keyProblem('bug triage')).toMatch(/letters, digits/);
    expect(keyProblem('a'.repeat(129))).toBe('Use at most 128 characters.');
    expect(keyProblem('bugs', ['work', 'bugs'])).toBe('This key is already in use.');
    expect(keyProblem('Bugs_2-x')).toBeUndefined();
  });
});

describe('starterBoard', () => {
  it('is a board the server stores as it is', () => {
    const parsed = storedBoardInputSchema.safeParse({ ...starterBoard(), key: 'bugs', name: 'Bugs' });
    expect(parsed.error?.issues).toBeUndefined();
  });
});
