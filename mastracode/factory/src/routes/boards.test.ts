import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/registry.js';
import type { LiveBoardRegistry } from '../boards/registry.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { createFactoryWorkItem } from '../work-items/create-work-item.js';
import { BoardRoutes } from './boards.js';
import { PhaseSkillRoutes } from './phase-skills.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const orgUser = { workosId: 'u1', organizationId: 'org1' };

let seed: FactoryStorageTestSeed;
let registry: LiveBoardRegistry;
let projectId = '';
let otherProjectId = '';

function call(method: string, path: string, body?: unknown) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, orgUser as never);
    await next();
  });
  mountApiRoutes(app as never, [
    ...new BoardRoutes({
      auth: fakeRouteAuth(),
      storedBoards: seed.storedBoards,
      phaseSkills: seed.phaseSkills,
      workItems: seed.workItems,
      projects: seed.projects,
      boards: registry,
    }).routes(),
    ...new PhaseSkillRoutes({
      auth: fakeRouteAuth(),
      phaseSkills: seed.phaseSkills,
      skillLibrary: seed.skillLibrary,
      projects: seed.projects,
      boards: registry,
    }).routes(),
    ...new WorkItemRoutes({
      auth: fakeRouteAuth(),
      projects: seed.projects,
      workItems: seed.workItems,
      boardRegistry: registry,
    } as never).routes(),
  ]);
  return app.request(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });
}

const BOARD = {
  title: 'Ops',
  initialPhase: 'backlog',
  phases: [
    { id: 'backlog', title: 'Backlog', kind: 'resting', next: ['doing'] },
    { id: 'doing', title: 'Doing', kind: 'working', role: 'work', next: ['done'] },
    { id: 'done', title: 'Done', kind: 'terminal', next: [] },
  ],
};

async function createBoard(factoryProjectId = projectId): Promise<string> {
  const response = await call('POST', `/web/factory/projects/${factoryProjectId}/boards`, BOARD);
  expect(response.status).toBe(201);
  return ((await response.json()) as { board: { id: string } }).board.id;
}

function fileCard(factoryProjectId: string, board: string) {
  return createFactoryWorkItem({
    workItems: seed.workItems,
    boards: registry,
    transitionService: undefined,
    audit: async () => {},
    orgId: 'org1',
    userId: 'u1',
    factoryProjectId,
    input: { title: 'Rotate keys', board, stages: ['backlog'], metadata: {} },
  });
}

async function placeCard(board: string) {
  const { item } = await seed.workItems.upsert({
    orgId: 'org1',
    userId: 'u1',
    factoryProjectId: projectId,
    input: { title: 'Rotate keys', board, stages: ['backlog'], metadata: {} },
  });
  return item;
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  registry = createBoardRegistry();
  projectId = (await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'one' } })).id;
  otherProjectId = (await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'two' } })).id;
});

describe('BoardRoutes', () => {
  it('creates a board, installs it, and lists it only for its Factory', async () => {
    const boardId = await createBoard();
    expect(boardId).toMatch(/^custom-/);
    expect(registry.get(boardId)?.roleForPhase('doing')).toBe('work');

    const ids = async (id: string) =>
      (
        (await (await call('GET', `/web/factory/projects/${id}/boards`)).json()) as {
          boards: { id: string; custom: boolean }[];
        }
      ).boards;
    expect(await ids(projectId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'work', custom: false }),
        expect.objectContaining({ id: boardId, title: 'Ops', custom: true }),
      ]),
    );
    expect((await ids(otherProjectId)).map(board => board.id)).not.toContain(boardId);
  });

  it('rejects an invalid board', async () => {
    const response = await call('POST', `/web/factory/projects/${projectId}/boards`, {
      ...BOARD,
      phases: [{ ...BOARD.phases[0], next: ['nowhere'] }, ...BOARD.phases.slice(1)],
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_board' });
    expect(await seed.storedBoards.list({ orgId: 'org1', factoryProjectId: projectId })).toEqual([]);
  });

  it('edits a board, but not away from a phase that holds cards', async () => {
    const boardId = await createBoard();
    const path = `/web/factory/projects/${projectId}/boards/${boardId}`;

    const renamed = await call('PUT', path, { ...BOARD, title: 'Ops 2' });
    expect(renamed.status).toBe(200);
    expect(registry.get(boardId)?.title).toBe('Ops 2');

    await placeCard(boardId);
    const withoutBacklog = {
      ...BOARD,
      initialPhase: 'parked',
      phases: [{ ...BOARD.phases[0], id: 'parked' }, ...BOARD.phases.slice(1)],
    };
    const blocked = await call('PUT', path, withoutBacklog);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ error: 'phase_in_use' });
    expect(registry.get(boardId)?.phases).toHaveProperty('backlog');
  });

  it('deletes only an empty board, clearing its phase kickoffs', async () => {
    const boardId = await createBoard();
    const path = `/web/factory/projects/${projectId}/boards/${boardId}`;
    const kickoff = await call('PUT', `/web/factory/projects/${projectId}/phase-skills/${boardId}/doing`, {
      prompt: 'Be careful.',
    });
    expect(kickoff.status).toBe(200);

    const card = await placeCard(boardId);
    expect((await call('DELETE', path)).status).toBe(409);

    await seed.workItems.delete({ orgId: 'org1', id: card.id });
    expect((await call('DELETE', path)).status).toBe(204);
    expect(registry.has(boardId)).toBe(false);
    expect(await seed.phaseSkills.list({ orgId: 'org1', factoryProjectId: projectId })).toEqual([]);
  });

  it('uninstalls a deleted board even when clearing its kickoffs fails', async () => {
    const boardId = await createBoard();
    vi.spyOn(seed.phaseSkills, 'clearBoard').mockRejectedValueOnce(new Error('storage down'));

    const response = await call('DELETE', `/web/factory/projects/${projectId}/boards/${boardId}`);
    expect(response.status).toBe(500);
    expect(await seed.storedBoards.get({ orgId: 'org1', factoryProjectId: projectId, boardId })).toBeNull();
    expect(registry.has(boardId)).toBe(false);
  });

  it("keeps another Factory's board out of reach", async () => {
    const boardId = await createBoard(otherProjectId);

    expect(await fileCard(projectId, boardId)).toMatchObject({ status: 'refused', code: 'invalid_board' });
    const edit = await call('PUT', `/web/factory/projects/${projectId}/boards/${boardId}`, BOARD);
    expect(edit.status).toBe(404);
    expect((await call('DELETE', `/web/factory/projects/${projectId}/boards/${boardId}`)).status).toBe(404);
    const kickoff = await call('PUT', `/web/factory/projects/${projectId}/phase-skills/${boardId}/doing`, {
      prompt: 'x',
    });
    expect(kickoff.status).toBe(404);
  });
});
