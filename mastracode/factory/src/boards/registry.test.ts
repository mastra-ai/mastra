import { describe, expect, it } from 'vitest';
import { defineBoard } from './define-board.js';
import { createBoardRegistry } from './registry.js';
import { createTestBoard } from './test-utils.js';

const customBoard = createTestBoard();

describe('createBoardRegistry', () => {
  it('installs the built-in boards and custom boards by default', () => {
    const registry = createBoardRegistry({ boards: [customBoard] });

    expect([...registry.keys()]).toEqual(['work', 'review', 'release']);
    expect(registry.get('release')).toBe(customBoard);
    expect(Object.isFrozen(registry)).toBe(true);
  });

  it('supports custom-only and boardless Factory instances', () => {
    expect([...createBoardRegistry({ boards: [customBoard], includeDefaultBoards: false }).keys()]).toEqual([
      'release',
    ]);
    expect(createBoardRegistry({ includeDefaultBoards: false }).size).toBe(0);
  });

  it('rejects duplicate custom ids and attempts to override built-in boards', () => {
    expect(() => createBoardRegistry({ boards: [customBoard, customBoard], includeDefaultBoards: false })).toThrow(
      "duplicate board id 'release'",
    );
    expect(() =>
      createBoardRegistry({
        boards: [defineBoard({ id: 'work', title: 'Replacement', initialPhase: 'start', phases: { start: {} } })],
      }),
    ).toThrow("duplicate board id 'work'");
  });
});
