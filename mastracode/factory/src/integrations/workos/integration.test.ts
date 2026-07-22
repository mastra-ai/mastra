import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../routes/test-utils';
import type { AuditEventRow } from '../../storage/domains/audit/base';
import type { IntegrationContext } from '../base';
import { toWorkOSEvent, WorkOSAuditIntegration } from './integration';

const createEvent = vi.fn(async () => undefined);
const generateLink = vi.fn(async () => ({ link: 'https://portal.workos.test/link' }));

function makeContext(): IntegrationContext {
  return { auth: fakeRouteAuth() } as IntegrationContext;
}

function makeApp(integration: WorkOSAuditIntegration, user?: { workosId: string; organizationId?: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, integration.routes(makeContext()));
  return app;
}

function makeRow(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    orgId: 'org_123',
    actorId: 'user_abc',
    actorType: 'human',
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix login' }],
    metadata: { fromStages: ['intake'], count: 2, ok: true },
    factoryProjectId: '11111111-1111-4111-8111-111111111111',
    projectRepositoryId: '22222222-2222-4222-8222-222222222222',
    context: { location: '10.0.0.1', userAgent: 'vitest' },
    occurredAt: new Date('2026-07-15T12:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  createEvent.mockClear();
  generateLink.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('WorkOSAuditIntegration', () => {
  it('maps persisted rows to WorkOS audit events', () => {
    expect(toWorkOSEvent(makeRow())).toEqual({
      action: 'factory.work_item.stage_moved',
      occurredAt: new Date('2026-07-15T12:00:00Z'),
      actor: { type: 'user', id: 'user_abc' },
      targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix login' }],
      context: { location: '10.0.0.1', userAgent: 'vitest' },
      metadata: { fromStages: '["intake"]', count: 2, ok: true },
    });
  });

  it('maps agent actors and normalizes missing context and metadata', () => {
    const event = toWorkOSEvent(
      makeRow({ actorId: 'agent:thread-1', actorType: 'agent', context: {}, metadata: { drop: null, keep: 'yes' } }),
    );
    expect(event.actor).toEqual({ type: 'agent', id: 'agent:thread-1' });
    expect(event.context).toEqual({ location: 'unknown' });
    expect(event.metadata).toEqual({ keep: 'yes' });
  });

  it('forwards through its explicit client without consulting auth configuration', async () => {
    const integration = new WorkOSAuditIntegration({
      client: { auditLogs: { createEvent } } as any,
      returnUrl: 'https://app.test/factory/audit',
    });
    const row = makeRow();

    await integration.audit({ event: row });

    expect(createEvent).toHaveBeenCalledWith('org_123', toWorkOSEvent(row));
    expect(integration.routes(makeContext()).map(route => route.path)).toEqual(['/web/audit/portal-link']);
  });

  it('swallows WorkOS forwarding failures', async () => {
    createEvent.mockRejectedValueOnce(new Error('invalid event'));
    const integration = new WorkOSAuditIntegration({
      client: { auditLogs: { createEvent } } as any,
      returnUrl: '/factory/audit',
    });

    await expect(integration.audit({ event: makeRow() })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[Audit] Failed to forward audit event to WorkOS',
      expect.objectContaining({ action: 'factory.work_item.stage_moved' }),
    );
  });

  it('creates an audit-log portal link for the request organization', async () => {
    const integration = new WorkOSAuditIntegration({
      client: { auditLogs: { createEvent }, portal: { generateLink } } as any,
      returnUrl: 'https://app.test/factory/audit',
    });
    const response = await makeApp(integration, { workosId: 'user-1', organizationId: 'org-1' }).request(
      '/web/audit/portal-link',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://portal.workos.test/link' });
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: 'org-1',
        intent: 'audit_logs',
        returnUrl: 'https://app.test/factory/audit',
      }),
    );
  });

  it('requires an authenticated organization for portal links', async () => {
    const integration = new WorkOSAuditIntegration({
      client: { auditLogs: { createEvent }, portal: { generateLink } } as any,
      returnUrl: '/factory/audit',
    });

    expect((await makeApp(integration).request('/web/audit/portal-link')).status).toBe(401);
    expect((await makeApp(integration, { workosId: 'user-1' }).request('/web/audit/portal-link')).status).toBe(403);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it('returns 502 when portal-link generation fails', async () => {
    generateLink.mockRejectedValueOnce(new Error('portal down'));
    const integration = new WorkOSAuditIntegration({
      client: { auditLogs: { createEvent }, portal: { generateLink } } as any,
      returnUrl: '/factory/audit',
    });
    const response = await makeApp(integration, { workosId: 'user-1', organizationId: 'org-1' }).request(
      '/web/audit/portal-link',
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'portal_link_failed' });
  });
});
