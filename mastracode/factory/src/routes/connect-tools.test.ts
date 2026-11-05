import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { AuditDomain } from '../storage/domains/audit/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { ConnectToolRoutes } from './connect-tools.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ADMIN = 'admin-user';
const MEMBER = 'member-user';

async function setup({ authEnabled = true } = {}) {
  const seed = await createFactoryStorageForTests();
  const auth = fakeRouteAuth({
    enabled: authEnabled,
    isOrganizationAdmin: async (_org, userId) => userId === ADMIN,
  });
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, { workosId: c.req.header('x-user'), organizationId: 'org-1' } as never);
    await next();
  });
  mountApiRoutes(
    app,
    new ConnectToolRoutes({
      auth,
      audit: new AuditDomain({ auth, audit: seed.audit, projects: seed.projects }),
      storage: seed.connectTools,
      available: () => true,
    }).routes(),
  );
  const send = async (user: string, method: 'GET' | 'PUT', body?: unknown) => {
    const response = await app.request('/web/config/connect-tools', {
      method,
      headers: { 'content-type': 'application/json', 'x-user': user },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  return { seed, send };
}

describe('Connect tool settings routes', () => {
  it('shows a member the providers without letting them change them', async () => {
    const { send } = await setup();

    expect(await send(MEMBER, 'GET')).toEqual({
      status: 200,
      body: { available: true, canEdit: false, enabledProviders: [] },
    });
    const refused = await send(MEMBER, 'PUT', { enabledProviders: ['linear'] });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe('organization_admin_required');
    expect((await send(ADMIN, 'GET')).body.enabledProviders).toEqual([]);
  });

  it("saves an admin's providers deduplicated and sorted, and records who changed them", async () => {
    const { seed, send } = await setup();

    const saved = await send(ADMIN, 'PUT', { enabledProviders: ['slack', 'linear', 'slack'] });

    expect(saved).toEqual({
      status: 200,
      body: { available: true, canEdit: true, enabledProviders: ['linear', 'slack'] },
    });
    expect((await send(MEMBER, 'GET')).body.enabledProviders).toEqual(['linear', 'slack']);
    const events = (await seed.audit.list({ orgId: 'org-1' })).events;
    expect(events.map(event => ({ action: event.action, targets: event.targets, metadata: event.metadata }))).toEqual([
      expect.objectContaining({
        action: 'factory.connect_tools.updated',
        targets: [expect.objectContaining({ type: 'connect_tools', id: 'org-1' })],
        metadata: expect.objectContaining({ enabledProviders: ['linear', 'slack'] }),
      }),
    ]);
  });

  it('rejects a provider id that is not a catalog id', async () => {
    const { send } = await setup();

    for (const enabledProviders of [['Linear'], [''], ['-x'], ['a'.repeat(129)], 'linear']) {
      expect((await send(ADMIN, 'PUT', { enabledProviders })).status).toBe(422);
    }
    expect((await send(ADMIN, 'GET')).body.enabledProviders).toEqual([]);
  });
});
