import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recordAuditEvent = vi.fn(async (input: any) => ({ id: 'evt-1', ...input, occurredAt: new Date() }));
const forwardToWorkOS = vi.fn(async (_event: any) => undefined);

vi.mock('./store', () => ({ recordAuditEvent: (input: any) => recordAuditEvent(input) }));
vi.mock('./workos-sink', () => ({ forwardToWorkOS: (event: any) => forwardToWorkOS(event) }));

import { emitAudit } from './audit';

/** Run `emitAudit` inside a real Hono request with an optional stashed user. */
async function emit(user: { workosId: string; organizationId?: string } | null, headers: Record<string, string> = {}) {
  const app = new Hono();
  app.post('/t', async c => {
    if (user) c.set('webAuthUser' as never, user as never);
    await emitAudit(c, {
      action: 'factory.work_item.created',
      projectId: '11111111-1111-4111-8111-111111111111',
      targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix login' }],
      metadata: { source: 'github-issue' },
    });
    return c.json({ ok: true });
  });
  const res = await app.request('/t', { method: 'POST', headers });
  expect(res.status).toBe(200);
}

beforeEach(() => {
  recordAuditEvent.mockClear();
  forwardToWorkOS.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('emitAudit', () => {
  it('records the event with the tenant actor and request context, then forwards it', async () => {
    await emit(
      { workosId: 'user_abc', organizationId: 'org_123' },
      { 'x-forwarded-for': '10.0.0.1, 172.16.0.1', 'user-agent': 'vitest' },
    );

    expect(recordAuditEvent).toHaveBeenCalledWith({
      orgId: 'org_123',
      actorId: 'user_abc',
      action: 'factory.work_item.created',
      targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix login' }],
      metadata: { source: 'github-issue' },
      githubProjectId: '11111111-1111-4111-8111-111111111111',
      context: { location: '10.0.0.1', userAgent: 'vitest' },
    });
    // Forward fires with the recorded row (fire-and-forget).
    await vi.waitFor(() => expect(forwardToWorkOS).toHaveBeenCalledTimes(1));
    expect(forwardToWorkOS.mock.calls[0]![0]).toMatchObject({ id: 'evt-1', actorId: 'user_abc' });
  });

  it('is a silent no-op without an org-scoped tenant', async () => {
    await emit(null);
    await emit({ workosId: 'user_abc' }); // personal account, no org
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(forwardToWorkOS).not.toHaveBeenCalled();
  });

  it('never throws when recording fails', async () => {
    recordAuditEvent.mockRejectedValueOnce(new Error('db down'));
    await emit({ workosId: 'user_abc', organizationId: 'org_123' });
    expect(forwardToWorkOS).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });
});
