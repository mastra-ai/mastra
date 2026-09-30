import { describe, expect, it } from 'vitest';
import { defineBoard } from './define-board.js';
import { createBoardRegistry } from './registry.js';
import { reviewBoard } from './review.js';
import { createTestBoard } from './test-utils.js';
import { workBoard } from './work.js';

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

  it('rejects duplicate custom ids', () => {
    expect(() => createBoardRegistry({ boards: [customBoard, customBoard], includeDefaultBoards: false })).toThrow(
      "duplicate board id 'release'",
    );
  });

  it('rejects a custom board that collides with an installed built-in', () => {
    const replacement = defineBoard({
      id: 'work',
      title: 'Replacement',
      initialPhase: 'start',
      phases: { start: { title: 'Start', kind: 'resting' } },
    });

    expect(() => createBoardRegistry({ boards: [replacement] })).toThrow(
      "board id 'work' is already used by a built-in board",
    );
  });

  it('allows replacing a built-in id when default boards are disabled', () => {
    const replacement = defineBoard({
      id: 'work',
      title: 'Replacement',
      initialPhase: 'start',
      phases: { start: { title: 'Start', kind: 'resting' } },
    });

    const registry = createBoardRegistry({ boards: [replacement], includeDefaultBoards: false });

    expect([...registry.keys()]).toEqual(['work']);
    expect(registry.get('work')).toBe(replacement);
  });

  it('allows reinstalling the exported built-in boards when defaults are disabled', () => {
    const registry = createBoardRegistry({ boards: [workBoard, reviewBoard], includeDefaultBoards: false });

    expect([...registry.keys()]).toEqual(['work', 'review']);
    expect(registry.get('work')).toBe(workBoard);
    expect(registry.get('review')).toBe(reviewBoard);
  });

  it('rejects duplicate replacement ids when default boards are disabled', () => {
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

    expect(() => createBoardRegistry({ boards: [first, second], includeDefaultBoards: false })).toThrow(
      "duplicate board id 'work'",
    );
  });
});
