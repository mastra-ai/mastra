import { describe, expect, it } from 'vitest';
import { defineBoard } from './define-board.js';
import { boardRegistryOf, createBoardRegistry } from './registry.js';
import { createTestBoard } from './test-utils.js';
import { workBoard } from './work.js';

const customBoard = createTestBoard();

describe('createBoardRegistry', () => {
  it('installs the built-in boards and custom boards by default', () => {
    const registry = createBoardRegistry({ boards: [customBoard] });

    expect([...registry.keys()]).toEqual(['work', 'release']);
    expect(registry.get('release')).toBe(customBoard);
    expect(Object.isFrozen(registry)).toBe(true);
  });

  it('builds an exact registry, custom-only or empty, the way a project compiles its stored boards', () => {
    expect([...boardRegistryOf([customBoard]).keys()]).toEqual(['release']);
    expect(boardRegistryOf([]).size).toBe(0);
  });

  it('installs the exported Work board passed in boards once', () => {
    expect([...createBoardRegistry({ boards: [workBoard, customBoard] }).keys()]).toEqual(['work', 'release']);
  });

  it('rejects duplicate custom ids', () => {
    expect(() => boardRegistryOf([customBoard, customBoard])).toThrow("duplicate board id 'release'");
  });

  it('rejects an id already used by an installed built-in', () => {
    const replacement = defineBoard({
      id: 'work',
      title: 'Replacement',
      initialPhase: 'start',
      phases: { start: { title: 'Start', kind: 'resting' } },
    });

    expect(() => createBoardRegistry({ boards: [replacement] })).toThrow(
      "board id 'work' is Factory's Work board, which every project has. To run your own, store it under 'work' with factory.upsertBoard(board, { projects: 'all' }).",
    );
  });

  it('lets an exact registry hold another board under a built-in id, as a project that stored its own Work does', () => {
    const replacement = defineBoard({
      id: 'work',
      title: 'Replacement',
      initialPhase: 'start',
      phases: { start: { title: 'Start', kind: 'resting' } },
    });

    const registry = boardRegistryOf([replacement]);

    expect([...registry.keys()]).toEqual(['work']);
    expect(registry.get('work')).toBe(replacement);
  });

  it('lets an exact registry hold the exported built-in boards', () => {
    const registry = boardRegistryOf([workBoard]);

    expect([...registry.keys()]).toEqual(['work']);
    expect(registry.get('work')).toBe(workBoard);
  });

  it('rejects duplicate ids in an exact registry', () => {
    const first = defineBoard({
      id: 'work',
      title: 'First replacement',
      initialPhase: 'start',
      phases: { start: { title: 'Start', kind: 'resting' } },
    });
    const second = defineBoard({
      id: 'work',
      title: 'Second replacement',
      initialPhase: 'start',
      phases: { start: { title: 'Start', kind: 'resting' } },
    });

    expect(() => boardRegistryOf([first, second])).toThrow("duplicate board id 'work'");
  });
});
