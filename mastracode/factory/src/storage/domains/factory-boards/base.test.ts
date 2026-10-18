import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

const FACTORY = { orgId: 'org-1', factoryProjectId: 'fp-1' };
const DEFINITION = {
  initialPhase: 'backlog',
  phases: [
    { id: 'backlog', title: 'Backlog', kind: 'resting' as const, next: ['doing'] },
    { id: 'doing', title: 'Doing', kind: 'working' as const, role: 'work', next: ['done'] },
    { id: 'done', title: 'Done', kind: 'terminal' as const, next: [] },
  ],
};

describe('FactoryBoardsStorage', () => {
  it('creates, lists, updates, and deletes a board', async () => {
    const seed = await createFactoryStorageForTests();
    const key = { ...FACTORY, boardId: 'custom-a' };

    await seed.storedBoards.create({ ...key, title: 'Ops', definition: DEFINITION });
    expect(await seed.storedBoards.get(key)).toMatchObject({ title: 'Ops', definition: DEFINITION });

    const renamed = { ...DEFINITION, phases: DEFINITION.phases.map(p => ({ ...p, title: p.title.toUpperCase() })) };
    expect(await seed.storedBoards.update({ ...key, title: 'Ops 2', definition: renamed })).toMatchObject({
      title: 'Ops 2',
      definition: renamed,
    });
    expect((await seed.storedBoards.list(FACTORY)).map(b => b.boardId)).toEqual(['custom-a']);
    expect((await seed.storedBoards.listAll()).map(b => b.boardId)).toEqual(['custom-a']);

    expect(await seed.storedBoards.delete(key)).toBe(true);
    expect(await seed.storedBoards.get(key)).toBeNull();
    expect(await seed.storedBoards.update({ ...key, title: 'x', definition: DEFINITION })).toBeNull();
  });

  it('keeps boards inside their Factory', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.storedBoards.create({ ...FACTORY, boardId: 'custom-a', title: 'Ops', definition: DEFINITION });

    const other = { orgId: 'org-1', factoryProjectId: 'fp-2', boardId: 'custom-a' };
    expect(await seed.storedBoards.get(other)).toBeNull();
    expect(await seed.storedBoards.list({ orgId: 'org-1', factoryProjectId: 'fp-2' })).toEqual([]);
    expect(await seed.storedBoards.delete(other)).toBe(false);
  });
});
