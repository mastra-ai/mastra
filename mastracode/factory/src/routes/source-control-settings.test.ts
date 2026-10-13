import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { buildSourceControlSettingsRoutes } from './source-control-settings.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const route = (id: string) => `/web/source-control/projects/${id}/settings`;

function buildApp(
  sourceControls: readonly SourceControlStorageHandle[],
  user?: { workosId: string; organizationId?: string },
) {
  const app = new Hono();
  if (user) {
    app.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, user as never);
      await next();
    });
  }
  mountApiRoutes(app as never, buildSourceControlSettingsRoutes({ auth: fakeRouteAuth(), sourceControls }));
  return app;
}

async function seedRepository(integrationId: 'github' | 'gitlab') {
  const storage = await createFactoryStorageForTests();
  const sourceControl = storage.sourceControl.forIntegration(integrationId);
  const project = await storage.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Test Factory' } });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: `${integrationId}-installation`,
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: {
      installationId: installation.id,
      externalId: `${integrationId}-repository`,
      slug: 'acme/repo',
      defaultBranch: 'main',
    },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const linked = await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/acme',
  });
  return { sourceControl, linked };
}

describe('provider-neutral repository settings', () => {
  it.each(['github', 'gitlab'] as const)('reads and writes %s sandbox commands', async integrationId => {
    const { sourceControl, linked } = await seedRepository(integrationId);
    const app = buildApp([sourceControl], { workosId: 'user-1', organizationId: 'org-1' });

    const initial = await app.request(route(linked.id));
    expect(initial.status).toBe(200);
    await expect(initial.json()).resolves.toEqual({ setupCommand: null, teardownCommand: null });

    const saved = await app.request(route(linked.id), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ setupCommand: '  pnpm install  ', teardownCommand: 'pnpm clean' }),
    });
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toEqual({ setupCommand: 'pnpm install', teardownCommand: 'pnpm clean' });
    await expect(sourceControl.projectRepositories.get({ orgId: 'org-1', id: linked.id })).resolves.toMatchObject({
      setupCommand: 'pnpm install',
      teardownCommand: 'pnpm clean',
    });

    const cleared = await app.request(route(linked.id), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ setupCommand: '' }),
    });
    expect(cleared.status).toBe(200);
    await expect(cleared.json()).resolves.toEqual({ setupCommand: null, teardownCommand: 'pnpm clean' });
  });

  it('keeps another organization and unauthenticated callers out', async () => {
    const { sourceControl, linked } = await seedRepository('gitlab');
    const otherOrg = buildApp([sourceControl], { workosId: 'user-2', organizationId: 'org-2' });
    expect((await otherOrg.request(route(linked.id))).status).toBe(404);
    expect(
      (
        await otherOrg.request(route(linked.id), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ setupCommand: 'unsafe' }),
        })
      ).status,
    ).toBe(404);
    expect((await buildApp([sourceControl]).request(route(linked.id))).status).toBe(401);
    expect((await buildApp([sourceControl], { workosId: 'user-3' }).request(route(linked.id))).status).toBe(403);
    await expect(sourceControl.projectRepositories.get({ orgId: 'org-1', id: linked.id })).resolves.toMatchObject({
      setupCommand: null,
    });
  });

  it.each([
    { name: 'non-string', body: { setupCommand: 42 } },
    { name: 'too long', body: { setupCommand: 'x'.repeat(2001) } },
    { name: 'control character', body: { setupCommand: 'echo \u001b[31m' } },
  ])('rejects a $name command without persisting it', async ({ body }) => {
    const { sourceControl, linked } = await seedRepository('gitlab');
    const app = buildApp([sourceControl], { workosId: 'user-1', organizationId: 'org-1' });
    const response = await app.request(route(linked.id), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
    await expect(sourceControl.projectRepositories.get({ orgId: 'org-1', id: linked.id })).resolves.toMatchObject({
      setupCommand: null,
    });
  });

  it('fails closed when multiple provider handles resolve the same repository', async () => {
    const { sourceControl, linked } = await seedRepository('gitlab');
    const app = buildApp([sourceControl, sourceControl], { workosId: 'user-1', organizationId: 'org-1' });
    expect((await app.request(route(linked.id))).status).toBe(409);
  });
});
