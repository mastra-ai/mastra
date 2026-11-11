import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { LINEAR_INTAKE_DISCOVERY_MAX_PAGES } from './intake-discovery.js';
import { LinearIntegration } from './integration.js';
import { attachLinearIssueReconciler } from './issue-reconciler.js';

// Real factory storage (LibSQL :memory:) and a real LinearIntegration; only
// Linear's GraphQL endpoint is stubbed.

interface IssueNode {
  id: string;
  identifier: string;
  projectId: string;
  updatedAt?: string;
}

function node(issue: IssueNode) {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: `Issue ${issue.identifier}`,
    url: `https://linear.app/acme/issue/${issue.identifier}`,
    priorityLabel: 'High',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: issue.updatedAt ?? '2026-07-02T00:00:00Z',
    state: { name: 'Todo', type: 'unstarted' },
    project: { id: issue.projectId },
    assignee: { name: 'Ada' },
    creator: { name: 'Grace' },
    team: { id: 'team-1', key: 'ENG' },
    labels: { nodes: [{ name: 'bug' }] },
  };
}

/** Linear's `issues` query, served one issue per page from `pages`. */
function stubLinear(pages: IssueNode[][]) {
  const intakeQueries: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const { query, variables } = JSON.parse(String(init.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      if (!query.includes('query Intake')) throw new Error(`Unexpected Linear query: ${query}`);
      intakeQueries.push(variables);
      const index = variables.after ? Number(String(variables.after).replace('page-', '')) : 0;
      const hasNextPage = index + 1 < pages.length;
      return Response.json({
        data: {
          issues: {
            nodes: (pages[index] ?? []).map(node),
            pageInfo: { hasNextPage, endCursor: hasNextPage ? `page-${index + 1}` : null },
          },
        },
      });
    }),
  );
  return intakeQueries;
}

async function setup() {
  const seed = await createFactoryStorageForTests();
  const linear = new LinearIntegration({ clientId: 'lin_client', clientSecret: 'lin_secret' });
  linear.initialize({
    storage: seed.integrations.forIntegration('linear'),
    projects: seed.projects,
    auth: fakeRouteAuth(),
  });
  const boards = createBoardRegistry();
  const context = {
    auth: fakeRouteAuth({ enabled: true }),
    stateSigner: { stable: true, sign: () => 'state', verify: () => null },
    baseUrl: 'http://localhost:4111',
    storage: { intake: seed.intake, projects: seed.projects },
    runtime: { configVersion: 'factory-config-v1', workItems: seed.workItems, boards },
  };

  const connect = (orgId: string, overrides: Partial<Parameters<LinearIntegration['upsertConnection']>[0]> = {}) =>
    linear.upsertConnection({
      orgId,
      userId: 'u1',
      accessToken: `token-${orgId}`,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      scope: 'read',
      workspaceName: 'Acme',
      workspaceUrlKey: 'acme',
      ...overrides,
    });

  const project = async (orgId: string, sourceIds: string[], bound: string[] = sourceIds) => {
    const created = await seed.projects.create({ orgId, userId: 'u1', input: { name: `${orgId}/repo` } });
    await seed.intake.saveConfig({ orgId, config: { linear: { enabled: true, sourceIds } } });
    for (const sourceId of bound) {
      await seed.intake.setBinding({ orgId, integrationId: 'linear', sourceId, factoryProjectId: created.id });
    }
    return created;
  };

  const filed = async (orgId: string, factoryProjectId: string) =>
    (await seed.workItems.listDeferredDecisions(orgId, factoryProjectId)).map(record => {
      const decision = record.decision as { type: string; sourceKey?: string };
      return { type: decision.type, sourceKey: decision.sourceKey };
    });

  const sweep = () => {
    const reconcile = attachLinearIssueReconciler(linear, context);
    if (!reconcile) throw new Error('Linear reconciler did not attach');
    return reconcile();
  };

  return { seed, linear, context, connect, project, filed, sweep };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Linear intake discovery', () => {
  it('leaves Work untouched when someone views a bound project board', async () => {
    const { linear, context, connect, project, filed } = await setup();
    await connect('org-1');
    const board = await project('org-1', ['proj-1']);
    stubLinear([[{ id: 'issue-1', identifier: 'ENG-1', projectId: 'proj-1' }]]);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: 'u1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app, linear.routes(context as never));
    const res = await app.request(`/web/linear/issues?factoryProjectId=${board.id}`);

    expect(res.status).toBe(200);
    expect((await res.json()).issues).toMatchObject([{ identifier: 'ENG-1' }]);
    expect(await filed('org-1', board.id)).toEqual([]);
  });

  it('files a new issue on a bound source with no board open', async () => {
    const { connect, project, filed, sweep } = await setup();
    await connect('org-1');
    const board = await project('org-1', ['proj-1']);
    const queries = stubLinear([[{ id: 'issue-1', identifier: 'ENG-1', projectId: 'proj-1' }]]);

    const summary = await sweep();

    expect(summary).toMatchObject({ observed: 1, failed: 0, errors: [] });
    expect(queries).toMatchObject([{ projectIds: ['proj-1'] }]);
    expect(await filed('org-1', board.id)).toEqual([{ type: 'upsertLinkedWorkItem', sourceKey: 'linear:ENG-1' }]);
  });

  it('files nothing twice when the issue has not changed between sweeps', async () => {
    const { connect, project, filed, sweep } = await setup();
    await connect('org-1');
    const board = await project('org-1', ['proj-1']);
    stubLinear([[{ id: 'issue-1', identifier: 'ENG-1', projectId: 'proj-1' }]]);

    await sweep();
    await sweep();

    expect(await filed('org-1', board.id)).toEqual([{ type: 'upsertLinkedWorkItem', sourceKey: 'linear:ENG-1' }]);
  });

  it.each([
    { name: 'a selected source no project is bound to', selected: ['proj-1'], bound: [] as string[] },
    { name: 'a bound source the org no longer selects', selected: ['proj-2'], bound: ['proj-1'] },
  ])('does not list or file issues from $name', async ({ selected, bound }) => {
    const { connect, project, filed, sweep } = await setup();
    await connect('org-1');
    const board = await project('org-1', selected, bound);
    const queries = stubLinear([[{ id: 'issue-1', identifier: 'ENG-1', projectId: 'proj-1' }]]);

    expect(await sweep()).toMatchObject({ observed: 0, failed: 0 });
    expect(queries).toEqual([]);
    expect(await filed('org-1', board.id)).toEqual([]);
  });

  it('does not list Linear for an org that turned Linear intake off', async () => {
    const { seed, connect, project, filed, sweep } = await setup();
    await connect('org-1');
    const board = await project('org-1', ['proj-1']);
    await seed.intake.saveConfig({ orgId: 'org-1', config: { linear: { enabled: false, sourceIds: ['proj-1'] } } });
    const queries = stubLinear([[{ id: 'issue-1', identifier: 'ENG-1', projectId: 'proj-1' }]]);

    expect(await sweep()).toMatchObject({ observed: 0, failed: 0 });
    expect(queries).toEqual([]);
    expect(await filed('org-1', board.id)).toEqual([]);
  });

  it(`files issues from at most ${LINEAR_INTAKE_DISCOVERY_MAX_PAGES} pages per project`, async () => {
    const { connect, project, filed, sweep } = await setup();
    await connect('org-1');
    const board = await project('org-1', ['proj-1']);
    const pages = Array.from({ length: LINEAR_INTAKE_DISCOVERY_MAX_PAGES + 2 }, (_, index) => [
      { id: `issue-${index}`, identifier: `ENG-${index}`, projectId: 'proj-1' },
    ]);
    const queries = stubLinear(pages);

    expect(await sweep()).toMatchObject({ observed: LINEAR_INTAKE_DISCOVERY_MAX_PAGES });
    expect(queries).toHaveLength(LINEAR_INTAKE_DISCOVERY_MAX_PAGES);
    expect((await filed('org-1', board.id)).map(decision => decision.sourceKey).sort()).toEqual(
      pages.slice(0, LINEAR_INTAKE_DISCOVERY_MAX_PAGES).map(([issue]) => `linear:${issue!.identifier}`),
    );
  });

  it('keeps filing for other orgs when one org must reconnect Linear', async () => {
    const { connect, project, filed, sweep } = await setup();
    // Expired with no refresh token: the org has to go through OAuth again.
    await connect('org-1', { expiresAt: new Date(Date.now() - 60_000) });
    await connect('org-2');
    const stale = await project('org-1', ['proj-1']);
    const healthy = await project('org-2', ['proj-2']);
    stubLinear([[{ id: 'issue-2', identifier: 'OPS-2', projectId: 'proj-2' }]]);

    const summary = await sweep();

    expect(summary).toMatchObject({ observed: 1, failed: 1, errors: [{ projectId: 'org:org-1' }] });
    expect(await filed('org-1', stale.id)).toEqual([]);
    expect(await filed('org-2', healthy.id)).toEqual([{ type: 'upsertLinkedWorkItem', sourceKey: 'linear:OPS-2' }]);
  });
});
