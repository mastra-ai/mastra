import { describe, expect, it, vi } from 'vitest';

import type { FactoryStageRuleContext } from '../rules/types.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { BoardDefinitionError } from './define-board.js';
import { boardAvailableTo, createBoardRegistry } from './registry.js';
import {
  buildStoredBoard,
  debouncedStoredBoardReload,
  loadStoredBoards,
  newStoredBoardId,
  parseStoredBoard,
} from './stored-board.js';

const INPUT = {
  title: 'Ops',
  initialPhase: 'backlog',
  phases: [
    { id: 'backlog', title: 'Backlog', kind: 'resting', next: ['doing'] },
    { id: 'doing', title: 'Doing', kind: 'working', role: 'work', next: ['done', 'backlog'] },
    { id: 'done', title: 'Done', kind: 'terminal', next: [] },
  ],
};

describe('parseStoredBoard', () => {
  it('accepts a valid board', () => {
    expect(parseStoredBoard(INPUT)).toEqual({
      title: 'Ops',
      definition: { initialPhase: 'backlog', phases: INPUT.phases },
    });
  });

  it.each([
    ['no phases', { ...INPUT, phases: [] }],
    ['a missing title', { ...INPUT, title: ' ' }],
    ['a duplicate phase id', { ...INPUT, phases: [...INPUT.phases, INPUT.phases[0]] }],
    [
      'a target that does not exist',
      { ...INPUT, phases: [{ ...INPUT.phases[0], next: ['nowhere'] }, ...INPUT.phases.slice(1)] },
    ],
    [
      'a working phase without a role',
      { ...INPUT, phases: [INPUT.phases[0], { ...INPUT.phases[1], role: '' }, INPUT.phases[2]] },
    ],
    ['an initial phase that is not resting', { ...INPUT, initialPhase: 'doing' }],
    ['an unknown kind', { ...INPUT, phases: [{ ...INPUT.phases[0], kind: 'parked' }, ...INPUT.phases.slice(1)] }],
  ])('rejects %s', (_label, input) => {
    expect(() => parseStoredBoard(input)).toThrow(BoardDefinitionError);
  });
});

describe('buildStoredBoard', () => {
  const board = buildStoredBoard({ boardId: 'custom-1', ...parseStoredBoard(INPUT) });

  it('builds the phases and transitions', () => {
    expect(board.roleForPhase('doing')).toBe('work');
    expect(board.isTerminal('done')).toBe(true);
    expect(board.allowsTransition('backlog', 'doing')).toBe(true);
    expect(board.allowsTransition('backlog', 'done')).toBe(false);
  });

  it('starts the working phase role for cards from any source', () => {
    const onEnter = board.rules.doing?.manual?.onEnter;
    expect(board.rules.doing?.issue?.onEnter).toBe(onEnter);
    const decision = onEnter!({
      ingress: { id: 'ing-1' },
      item: { title: 'Rotate keys', url: null },
    } as unknown as FactoryStageRuleContext);
    expect(decision).toMatchObject({ type: 'invokeSkill', role: 'work', idempotencyKey: 'ing-1:doing' });
    expect((decision as { prompt: string }).prompt).toContain('"Rotate keys"');
  });
});

describe('live board registry', () => {
  it('installs, replaces, and removes stored boards but never code-defined ones', () => {
    const registry = createBoardRegistry();
    const id = newStoredBoardId();
    expect(id).toMatch(/^custom-[0-9a-f]{8}$/);

    registry.install(buildStoredBoard({ boardId: id, ...parseStoredBoard(INPUT) }), 'fp-1');
    expect(boardAvailableTo(registry, id, 'fp-1')).toBe(true);
    expect(boardAvailableTo(registry, id, 'fp-2')).toBe(false);
    expect(boardAvailableTo(registry, id, null)).toBe(false);
    expect(boardAvailableTo(registry, 'work', 'fp-2')).toBe(true);
    expect(registry.get(id)?.title).toBe('Ops');
    expect(registry.size).toBe(3);

    registry.install(buildStoredBoard({ boardId: id, ...parseStoredBoard({ ...INPUT, title: 'Ops 2' }) }), 'fp-1');
    expect(registry.get(id)?.title).toBe('Ops 2');

    registry.replaceStored([]);
    expect(registry.has(id)).toBe(false);
    expect([...registry.keys()]).toEqual(['work', 'review']);

    expect(registry.isCodeDefined('work')).toBe(true);
    expect(() => registry.uninstall('work')).toThrow(/defined in code/);
  });
});

describe('stored board reload across replicas', () => {
  it('picks up a board created on another replica when a lookup misses it', async () => {
    const seed = await createFactoryStorageForTests();
    const replica = createBoardRegistry();
    replica.setStoredReloader(debouncedStoredBoardReload(replica, seed.storedBoards));

    const parsed = parseStoredBoard(INPUT);
    const boardId = newStoredBoardId();
    await seed.storedBoards.create({ orgId: 'org-1', factoryProjectId: 'fp-1', boardId, ...parsed });

    expect(replica.get(boardId)).toBeUndefined();
    await vi.waitFor(() => expect(replica.get(boardId)?.title).toBe('Ops'));
    expect(boardAvailableTo(replica, boardId, 'fp-1')).toBe(true);
    expect(boardAvailableTo(replica, boardId, 'fp-2')).toBe(false);
  });

  it('does not reload on a miss for a code-style board id', () => {
    const replica = createBoardRegistry();
    const reload = vi.fn(() => Promise.resolve());
    replica.setStoredReloader(reload);
    expect(replica.get('release')).toBeUndefined();
    expect(reload).not.toHaveBeenCalled();
    expect(replica.get('custom-gone')).toBeUndefined();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('drops a reload snapshot read before a local board write', async () => {
    const registry = createBoardRegistry();
    const boardId = newStoredBoardId();
    let release!: (records: []) => void;
    const reload = loadStoredBoards(registry, { listAll: () => new Promise(resolve => (release = resolve)) });

    registry.install(buildStoredBoard({ boardId, ...parseStoredBoard(INPUT) }), 'fp-1');
    release([]);
    await reload;

    expect(registry.get(boardId)?.title).toBe('Ops');
    await loadStoredBoards(registry, { listAll: async () => [] });
    expect(registry.has(boardId)).toBe(false);
  });
});
