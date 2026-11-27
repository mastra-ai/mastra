import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { FactoryProjectsStorage } from '../projects/base.js';
import { StoredBoardsStorage } from './base.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('a project’s intake evaluator on %s', backend => {
  async function open({ withBoards = true } = {}) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `intake-evaluator-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `intake-evaluator-${randomUUID()}`, url: ':memory:' });
    const projects = storage.registerDomain(new FactoryProjectsStorage());
    const boards = withBoards ? storage.registerDomain(new StoredBoardsStorage()) : undefined;
    await storage.init();
    onTestFinished(() => storage.close());
    return { storage, projects, boards: boards! };
  }

  it('stamps a project created now with intake order, and its first intake read still adds the default rules', async () => {
    const { projects, boards } = await open();
    const orgId = `org-${randomUUID()}`;
    const project = await projects.create({ orgId, userId: 'admin', input: { name: 'New' } });
    const scope = { orgId, factoryProjectId: project.id };

    expect(await boards.intakeEvaluator(scope)).toBe('intake-order');
    expect((await boards.listIntakeRoutes(scope)).length).toBeGreaterThan(0);
    expect(await boards.intakeEvaluator(scope)).toBe('intake-order');
  });

  it('keeps a new project’s order its own, so a board added later is asked before Work’s catch-all', async () => {
    const { projects, boards } = await open();
    const orgId = `org-${randomUUID()}`;
    const project = await projects.create({ orgId, userId: 'admin', input: { name: 'New' } });
    const scope = { orgId, factoryProjectId: project.id };
    const phases = [
      { key: 'intake', name: 'Intake', kind: 'resting' as const },
      { key: 'done', name: 'Done', kind: 'terminal' as const },
    ];
    await boards.create(scope, { key: 'work', name: 'Work', phases }, 'admin');
    expect(await boards.readIntakeOrder(scope)).toEqual({ boardKeys: ['work'], origin: 'explicit' });

    await boards.create(scope, { key: 'notes', name: 'Notes', phases }, 'admin');
    await boards.createIntakeRoute(
      scope,
      {
        name: 'Notes',
        target: { boardKey: 'notes' },
        when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'notes' }] },
      },
      'admin',
    );
    // Derived from the rule list, Work (whose default rules lead it) would come first and take everything.
    expect(await boards.readIntakeOrder(scope)).toEqual({ boardKeys: ['notes', 'work'], origin: 'explicit' });
  });

  it('creates a project with its setting where the boards domain is not registered', async () => {
    const { storage, projects } = await open({ withBoards: false });
    const orgId = `org-${randomUUID()}`;
    const project = await projects.create({ orgId, userId: 'admin', input: { name: 'Alone' } });

    expect(
      await storage.ops.findOne('factory_intake_route_locks', { org_id: orgId, factory_project_id: project.id }),
    ).toMatchObject({ intake_evaluator: 'intake-order' });
  });
});
