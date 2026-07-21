import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils';
import { createFactoryStorageForTests } from '../../test-utils';
import type { AuditDomainOptions } from './domain';
import { AuditDomain } from './domain';

function auditDomain(
  seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>,
  options?: Partial<AuditDomainOptions>,
) {
  return new AuditDomain({
    auth: fakeRouteAuth(),
    audit: seed.audit,
    projects: seed.projects,
    ...options,
  });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuditDomain', () => {
  it('records locally before notifying configured sinks', async () => {
    const seed = await createFactoryStorageForTests();
    const audit = vi.fn(async () => undefined);
    const domain = auditDomain(seed, { sinks: [{ id: 'mirror', audit }] });

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

  it('isolates sink failures and continues notifying other sinks', async () => {
    const seed = await createFactoryStorageForTests();
    const good = vi.fn(async () => undefined);
    const domain = auditDomain(seed, {
      sinks: [
        { id: 'bad', audit: async () => Promise.reject(new Error('down')) },
        { id: 'good', audit: good },
      ],
    });

    await expect(
      domain.record({ orgId: 'org-1', actorId: 'user-1', action: 'test', targets: [] }),
    ).resolves.not.toBeNull();
    await vi.waitFor(() => expect(good).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith('[Audit] Audit integration failed', expect.anything()),
    );
  });

  it('does not notify sinks when local persistence fails', async () => {
    const seed = await createFactoryStorageForTests();
    const audit = vi.fn(async () => undefined);
    vi.spyOn(seed.audit, 'record').mockRejectedValueOnce(new Error('db down'));
    const domain = auditDomain(seed, { sinks: [{ id: 'mirror', audit }] });

    await expect(domain.record({ orgId: 'org-1', actorId: 'user-1', action: 'test', targets: [] })).resolves.toBeNull();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects duplicate or empty sink ids', async () => {
    const seed = await createFactoryStorageForTests();
    expect(() => auditDomain(seed, { sinks: [{ id: '' }] })).toThrow('Audit integration id must not be empty');
    expect(() => auditDomain(seed, { sinks: [{ id: 'a' }, { id: 'a' }] })).toThrow(
      "Duplicate audit integration id 'a'",
    );
  });

  it('resolves request actor and context when emitting a human event', async () => {
    const seed = await createFactoryStorageForTests();
    const domain = auditDomain(seed);
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

  it('serves exactly the project audit route', async () => {
    const seed = await createFactoryStorageForTests();
    expect(
      auditDomain(seed)
        .routes()
        .map(item => item.path),
    ).toEqual(['/web/factory/projects/:id/audit']);
  });

  it('guards project audit routes by auth, organization, and project ownership', async () => {
    const seed = await createFactoryStorageForTests();
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
    const domain = auditDomain(seed);

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
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Acme project' },
    });
    const domain = auditDomain(seed);
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
