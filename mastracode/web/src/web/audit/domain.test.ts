import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetRuntimeConfigForTests } from '../runtime-config';
import { seedFactoryStorageForTests } from '../storage/test-utils';
import { mountApiRoutes } from '../test-utils';
import type { FactoryIntegration } from '../factory-integration';
import { AuditDomain } from './domain';

let closeStorage: (() => Promise<void>) | undefined;

function auditIntegration({
  id,
  audit,
  routes,
}: {
  id: string;
  audit?: FactoryIntegration['audit'];
  routes?: FactoryIntegration['routes'];
}): FactoryIntegration {
  return {
    id,
    audit,
    routes: routes ?? (() => []),
    diagnostics: () => ({}),
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  __resetRuntimeConfigForTests();
  await closeStorage?.();
  closeStorage = undefined;
});

describe('AuditDomain', () => {
  it('records locally before notifying configured integrations', async () => {
    const seed = await seedFactoryStorageForTests();
    closeStorage = () => seed.storage.close();
    const audit = vi.fn(async () => undefined);
    const domain = new AuditDomain({
      storage: seed.storage,
      integrations: [auditIntegration({ id: 'mirror', audit })],
    });

    const row = await domain.record({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'factory.work_item.created',
      targets: [{ type: 'work_item', id: 'wi-1' }],
    });

    expect(row).not.toBeNull();
    await vi.waitFor(() => expect(audit).toHaveBeenCalledWith({ event: row }));
    expect((await seed.audit.list({ orgId: 'org-1' })).events).toHaveLength(1);
  });

  it('isolates integration failures and continues notifying other integrations', async () => {
    const seed = await seedFactoryStorageForTests();
    closeStorage = () => seed.storage.close();
    const good = vi.fn(async () => undefined);
    const integrations: FactoryIntegration[] = [
      auditIntegration({ id: 'bad', audit: async () => Promise.reject(new Error('down')) }),
      auditIntegration({ id: 'good', audit: good }),
    ];
    const domain = new AuditDomain({ storage: seed.storage, integrations });

    await expect(
      domain.record({ orgId: 'org-1', actorId: 'user-1', action: 'test', targets: [] }),
    ).resolves.not.toBeNull();
    await vi.waitFor(() => expect(good).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith('[Audit] Audit integration failed', expect.anything()),
    );
  });

  it('does not notify integrations when local persistence fails', async () => {
    const seed = await seedFactoryStorageForTests();
    closeStorage = () => seed.storage.close();
    const audit = vi.fn(async () => undefined);
    vi.spyOn(seed.audit, 'record').mockRejectedValueOnce(new Error('db down'));
    const domain = new AuditDomain({
      storage: seed.storage,
      integrations: [auditIntegration({ id: 'mirror', audit })],
    });

    await expect(domain.record({ orgId: 'org-1', actorId: 'user-1', action: 'test', targets: [] })).resolves.toBeNull();
    expect(audit).not.toHaveBeenCalled();
  });

  it('resolves request actor and context when emitting a human event', async () => {
    const seed = await seedFactoryStorageForTests();
    closeStorage = () => seed.storage.close();
    const domain = new AuditDomain({ storage: seed.storage });
    const app = new Hono();
    app.post('/emit', async c => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await domain.emit({
        context: c,
        input: {
          action: 'test',
          factoryProjectId: 'project-1',
          projectRepositoryId: 'project-repository-1',
          targets: [],
        },
      });
      return c.json({ ok: true });
    });

    await app.request('/emit', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2', 'user-agent': 'vitest' },
    });

    const [event] = (await seed.audit.list({ orgId: 'org-1' })).events;
    expect(event).toMatchObject({
      actorId: 'user-1',
      factoryProjectId: 'project-1',
      projectRepositoryId: 'project-repository-1',
      context: { location: '10.0.0.1', userAgent: 'vitest' },
    });
  });

  it('keeps integration routes separate from the domain route surface', async () => {
    const seed = await seedFactoryStorageForTests();
    closeStorage = () => seed.storage.close();
    const route = { path: '/plugin', method: 'GET' as const, handler: () => new Response() };

    expect(
      new AuditDomain({
        storage: seed.storage,
        integrations: [auditIntegration({ id: 'plugin', routes: () => [route] })],
      })
        .routes()
        .map(item => item.path),
    ).toEqual(['/web/factory/projects/:id/audit']);
  });

  it('guards project audit routes by auth, organization, and project ownership', async () => {
    const seed = await seedFactoryStorageForTests();
    closeStorage = () => seed.storage.close();
    const project = await seed.projects.create({
      orgId: 'other-org',
      userId: 'user-1',
      input: { name: 'Other project' },
    });
    const buildApp = (domain: AuditDomain, user?: { workosId: string; organizationId?: string }) => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        if (user) c.set('webAuthUser' as never, user as never);
        await next();
      });
      mountApiRoutes(app as never, domain.routes());
      return app;
    };
    const domain = new AuditDomain({ storage: seed.storage });

    expect((await buildApp(domain).request(`/web/factory/projects/${project.id}/audit`)).status).toBe(401);
    expect(
      (await buildApp(domain, { workosId: 'user-1' }).request(`/web/factory/projects/${project.id}/audit`)).status,
    ).toBe(403);
    expect(
      (
        await buildApp(domain, { workosId: 'user-1', organizationId: 'org-1' }).request(
          '/web/factory/projects/not-a-uuid/audit',
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await buildApp(domain, { workosId: 'user-1', organizationId: 'org-1' }).request(
          `/web/factory/projects/${project.id}/audit`,
        )
      ).status,
    ).toBe(404);
  });

  it('normalizes project audit filters before listing', async () => {
    const seed = await seedFactoryStorageForTests();
    closeStorage = () => seed.storage.close();
    const project = await seed.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Acme project' },
    });
    const domain = new AuditDomain({ storage: seed.storage });
    const list = vi.spyOn(domain, 'list').mockResolvedValue({ events: [], nextCursor: undefined });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('webAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
      await next();
    });
    mountApiRoutes(app as never, domain.routes());
    const query = new URLSearchParams({
      actions: 'factory.work_item.created, factory.git.push,',
      actor: 'user-2',
      before: '2026-07-15T00:00:00.000Z_event-9',
      limit: '25',
    });

    expect((await app.request(`/web/factory/projects/${project.id}/audit?${query}`)).status).toBe(200);
    expect(list).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: project.id,
      actions: ['factory.work_item.created', 'factory.git.push'],
      actorId: 'user-2',
      before: '2026-07-15T00:00:00.000Z_event-9',
      limit: 25,
    });

    await app.request(`/web/factory/projects/${project.id}/audit?limit=lots`);
    expect(list.mock.calls[1]?.[0].limit).toBeUndefined();
  });
});
