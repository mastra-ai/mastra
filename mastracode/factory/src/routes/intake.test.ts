import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Intake } from '../capabilities/intake';
import type { AuditEmitter } from '../storage/domains/audit/domain';
import { createFactoryStorageForTests } from '../storage/test-utils';
import type { FactoryStorageTestSeed } from '../storage/test-utils';
import { IntakeRoutes, parseIntakeConfig } from './intake';
import { fakeRouteAuth, mountApiRoutes } from './test-utils';

const auditEvents: Array<Record<string, unknown>> = [];
const audit: AuditEmitter = {
  async emit({ input }) {
    auditEvents.push({ action: input.action, metadata: input.metadata });
  },
};

const github: Pick<Intake, 'listSources' | 'listItems'> = {
  listSources: vi.fn(async () => [{ id: 'repo-1', name: 'acme/app', type: 'repository' }]),
  listItems: vi.fn(async () => ({
    items: [
      {
        source: { type: 'issue', externalId: '17', url: 'https://github.com/acme/app/issues/17' },
        sourceId: 'repo-1',
        title: 'Fix login',
      },
    ],
    nextCursor: 'github-next',
  })),
};

const linear: Pick<Intake, 'listSources' | 'listItems'> = {
  listSources: vi.fn(async () => [{ id: 'team-1', name: 'Platform', type: 'project' }]),
  listItems: vi.fn(async () => ({
    items: [
      {
        source: { type: 'issue', externalId: 'ENG-9', url: 'https://linear.app/acme/issue/ENG-9' },
        sourceId: 'team-1',
        title: 'Ship project model',
      },
    ],
    nextCursor: null,
  })),
};

const integrations = [
  { id: 'github', intake: github },
  { id: 'linear', intake: linear },
];

function buildApp(user: { workosId: string; organizationId?: string } | null, intakeIntegrations = integrations) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    new IntakeRoutes({ auth: fakeRouteAuth(), audit, intake: seed.intake, integrations: intakeIntegrations }).routes(),
  );
  return app;
}

const orgUser = { workosId: 'u1', organizationId: 'org1' };
let seed: FactoryStorageTestSeed;

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  auditEvents.length = 0;
  vi.clearAllMocks();
});

describe('intake configuration', () => {
  it('requires an authenticated organization', async () => {
    expect((await buildApp(null).request('/web/intake/config')).status).toBe(401);
    expect((await buildApp({ workosId: 'u1' }).request('/web/intake/config')).status).toBe(403);
  });

  it('defaults every configured capability to enabled with no selected sources', async () => {
    const response = await buildApp(orgUser).request('/web/intake/config');
    expect(await response.json()).toEqual({
      config: {
        github: { enabled: true, sourceIds: null },
        linear: { enabled: true, sourceIds: null },
      },
    });
  });

  it('persists dynamic integration selections and audits a bounded summary', async () => {
    const config = {
      github: { enabled: true, sourceIds: ['repo-1'] },
      linear: { enabled: false, sourceIds: null },
    };
    const response = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(config),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ config });
    expect(await seed.intake.getConfig({ orgId: 'org1', userId: 'u1' })).toEqual(config);
    expect(auditEvents).toEqual([
      {
        action: 'factory.intake.config_updated',
        metadata: {
          github: { enabled: true, sources: 1 },
          linear: { enabled: false, sources: null },
        },
      },
    ]);
  });

  it('rejects unknown integrations and invalid JSON', async () => {
    const unknown = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jira: { enabled: true, sourceIds: null } }),
    });
    expect(unknown.status).toBe(400);

    const invalid = await buildApp(orgUser).request('/web/intake/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'bad-json',
    });
    expect(invalid.status).toBe(400);
  });
});

describe('aggregated intake', () => {
  it('lists normalized sources from every configured capability', async () => {
    const response = await buildApp(orgUser).request('/web/intake/sources');
    expect(await response.json()).toEqual({
      sources: [
        { integrationId: 'github', id: 'repo-1', name: 'acme/app', type: 'repository' },
        { integrationId: 'linear', id: 'team-1', name: 'Platform', type: 'project' },
      ],
    });
  });

  it('lists selected items with generic external-source references and per-integration cursors', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: {
        github: { enabled: true, sourceIds: ['repo-1'] },
        linear: { enabled: true, sourceIds: ['team-1'] },
      },
    });

    const response = await buildApp(orgUser).request('/web/intake/items');
    const body = await response.json();
    expect(body.items).toEqual([
      expect.objectContaining({
        integrationId: 'github',
        title: 'Fix login',
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '17',
          url: 'https://github.com/acme/app/issues/17',
        },
      }),
      expect.objectContaining({
        integrationId: 'linear',
        title: 'Ship project model',
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: 'ENG-9',
          url: 'https://linear.app/acme/issue/ENG-9',
        },
      }),
    ]);
    expect(typeof body.nextCursor).toBe('string');
  });

  it('does not call disabled or unselected capabilities', async () => {
    await seed.intake.saveConfig({
      orgId: 'org1',
      userId: 'u1',
      config: {
        github: { enabled: false, sourceIds: ['repo-1'] },
        linear: { enabled: true, sourceIds: null },
      },
    });
    const response = await buildApp(orgUser).request('/web/intake/items');
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
    expect(github.listItems).not.toHaveBeenCalled();
    expect(linear.listItems).not.toHaveBeenCalled();
  });
});

describe('parseIntakeConfig', () => {
  it('accepts arbitrary integration ids and defaults omitted source lists to null', () => {
    expect(parseIntakeConfig({ gitlab: { enabled: true }, jira: { enabled: false, sourceIds: ['board-1'] } })).toEqual({
      gitlab: { enabled: true, sourceIds: null },
      jira: { enabled: false, sourceIds: ['board-1'] },
    });
  });

  it('rejects malformed or duplicate source ids', () => {
    expect(parseIntakeConfig(null)).toBeNull();
    expect(parseIntakeConfig({ github: { enabled: 'yes' } })).toBeNull();
    expect(parseIntakeConfig({ github: { enabled: true, sourceIds: ['a', 'a'] } })).toBeNull();
  });
});
