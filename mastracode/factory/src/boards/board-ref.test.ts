import { describe, expect, it } from 'vitest';
import { resolveBoardRef } from './board-ref.js';
import { boardRegistryOf } from './registry.js';
import type { InstalledBoard } from './registry.js';
import { boardDefinitionOf, compileStoredBoard } from './stored-board.js';
import { createTestBoard, createTriageWorkRegistry, triageWorkBoard } from './test-utils.js';

/** A stored board renamed the way `factory.upsertBoard` renames one: the name changes, the id does not. */
function renamed(board: InstalledBoard, name: string): InstalledBoard {
  return compileStoredBoard({ ...boardDefinitionOf(board), name }, board);
}

const openSourceWork = renamed(triageWorkBoard, 'Open source');
const release = createTestBoard();

describe('resolveBoardRef', () => {
  it('resolves a board by its displayed name', () => {
    const registry = boardRegistryOf([openSourceWork, release]);

    expect(resolveBoardRef(registry, 'Open source')).toBe(openSourceWork);
    expect(resolveBoardRef(registry, 'Release')).toBe(release);
  });

  it('resolves a name the way someone types it: trimmed, and any case', () => {
    const registry = boardRegistryOf([openSourceWork]);

    expect(resolveBoardRef(registry, '  open source  ')).toBe(openSourceWork);
    expect(resolveBoardRef(registry, 'OPEN SOURCE')).toBe(openSourceWork);
  });

  it('resolves an id, which outranks a board named the same', () => {
    const namedWork = renamed(release, 'work');
    const registry = boardRegistryOf([openSourceWork, namedWork]);

    expect(resolveBoardRef(registry, 'work')).toBe(openSourceWork);
    expect(resolveBoardRef(registry, 'release')).toBe(namedWork);
  });

  it('refuses a name two boards share, naming both', () => {
    const registry = boardRegistryOf([openSourceWork, renamed(release, 'Open source')]);

    expect(() => resolveBoardRef(registry, 'Open source')).toThrow(
      '"Open source" matches more than one board; use its id instead: Open source (work), Open source (release).',
    );
  });

  it('refuses a name no board carries, listing the boards it has', () => {
    expect(() => resolveBoardRef(createTriageWorkRegistry(), 'Open source')).toThrow(
      'No board is named "Open source" in this Factory. It has: Work (work).',
    );
    expect(() => resolveBoardRef(boardRegistryOf([]), 'work')).toThrow(
      'No board is named "work" in this Factory. It has: no boards.',
    );
  });
});
