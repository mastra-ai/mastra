import { describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { StoredIntakeRouteInput } from '../storage/domains/boards/base.js';
import type { CreateWorkItemInput } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactoryWorkItem } from './create-work-item.js';

const DOCS = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }],
} as const;

async function setup(routes: StoredIntakeRouteInput[] = []) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Cards' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  for (const route of routes) await seed.boards.createIntakeRoute(scope, route, 'admin');
  const boards = createBoardRegistry();
  const transitionService = new FactoryTransitionService({
    storage: seed.workItems,
    configVersion: 'cards-v1',
    boards,
  });
  const create = (input: CreateWorkItemInput, { withRoutes = true } = {}) =>
    createFactoryWorkItem({
      workItems: seed.workItems,
      boards,
      transitionService,
      audit: async () => {},
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input,
      ...(withRoutes ? { intakeRoutes: seed.boards } : {}),
    });
  return { create };
}

describe('createFactoryWorkItem with intake routes', () => {
  const toPlanning: StoredIntakeRouteInput = {
    name: 'Docs to planning',
    when: DOCS,
    target: { boardKey: 'work', phaseKey: 'planning' },
  };

  it('files a card without a board where the first matching route says, entering through Intake', async () => {
    const { create } = await setup([toPlanning]);
    const created = await create({ title: 'Write the guide', metadata: { labels: ['docs'] } });
    expect(created.status).toBe('created');
    if (created.status !== 'created') return;
    expect(created.item).toMatchObject({ board: 'work', stages: ['planning'] });
    expect(created.item.stageHistory.map(entry => entry.stage)).toEqual(['intake', 'planning']);
  });

  it('leaves a card no route matches in the default first phase', async () => {
    const { create } = await setup([toPlanning]);
    const created = await create({ title: 'Fix the build', metadata: { labels: ['bug'] } });
    expect(created).toMatchObject({ status: 'created', item: { board: 'work', stages: ['intake'] } });
  });

  it('ignores routes when the person named the board or the stages', async () => {
    const { create } = await setup([toPlanning]);
    expect(await create({ title: 'Named board', board: 'work', metadata: { labels: ['docs'] } })).toMatchObject({
      status: 'created',
      item: { board: 'work', stages: ['intake'] },
    });
    expect(await create({ title: 'Named stages', stages: ['intake'], metadata: { labels: ['docs'] } })).toMatchObject({
      status: 'created',
      item: { board: 'work', stages: ['intake'] },
    });
  });

  it('places nothing without a routes reader', async () => {
    const { create } = await setup([toPlanning]);
    expect(
      await create({ title: 'Write the guide', metadata: { labels: ['docs'] } }, { withRoutes: false }),
    ).toMatchObject({
      status: 'created',
      item: { board: 'work', stages: ['intake'] },
    });
  });

  it("skips a route to the Work board for a pull request card, which Work can't hold", async () => {
    const { create } = await setup([
      { name: 'Everything to triage', target: { boardKey: 'work', phaseKey: 'triage' } },
    ]);
    const created = await create({
      title: 'Review the patch',
      externalSource: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: '7',
        url: 'https://github.com/acme/app/pull/7',
      },
      metadata: {},
    });
    expect(created).toMatchObject({ status: 'created', item: { board: 'review', stages: ['intake'] } });
  });
});
