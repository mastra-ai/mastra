import { LibSQLFactoryStorage } from '@mastra/libsql';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import { SessionCredentialsStorage } from '../storage/domains/session-credentials/base.js';

import { SessionCredentialRoutes } from './session-credentials.js';
import type { SessionCredentialRoutesDeps } from './session-credentials.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const SECRET = 'sk_test_fake_throwaway_0123456789';

const SESSIONS = {
  'sess-a': { sessionId: 'sess-a', orgId: 'org-a', userId: 'alice', title: 'A', factoryProjectId: 'fac-a' },
  'sess-b': { sessionId: 'sess-b', orgId: 'org-a', userId: 'bob', title: 'B', factoryProjectId: 'fac-a' },
};

async function setup(options: { credentials?: boolean; authEnabled?: boolean } = {}) {
  const storage = new LibSQLFactoryStorage({ id: 'credential-routes', url: ':memory:' });
  const credentials = storage.registerDomain(
    new SessionCredentialsStorage(createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } })),
  );
  await storage.init();
  const rows: Record<string, (typeof SESSIONS)[keyof typeof SESSIONS]> = structuredClone(SESSIONS);
  const sessions = {
    getBySessionId: async (id: string) => rows[id] ?? null,
  } as unknown as SourceControlSessionLookup;
  const notifyAvailable = vi.fn<SessionCredentialRoutesDeps['notifyAvailable']>(async () => {});
  const record = vi.fn(async () => null);
  const app = new Hono();
  app.use('*', async (c, next) => {
    const user = c.req.header('x-test-user');
    const org = c.req.header('x-test-org');
    if (user && org) c.set('factoryAuthUser' as never, { workosId: user, organizationId: org } as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new SessionCredentialRoutes({
      auth: fakeRouteAuth({ enabled: options.authEnabled ?? true }),
      ...(options.credentials === false ? {} : { credentials }),
      sessions,
      audit: { record } as never,
      notifyAvailable,
    }).routes(),
  );
  const request = await credentials.createRequest({
    orgId: 'org-a',
    factoryProjectId: 'fac-a',
    sessionId: 'sess-a',
    threadId: 'thread-a',
    ownerUserId: 'alice',
    name: 'FAKE_API_KEY',
    purpose: 'Run the integration tests',
  });
  const as = (user: string, org = 'org-a') => ({ 'x-test-user': user, 'x-test-org': org });
  const submit = (headers: Record<string, string>, body: unknown = { value: SECRET, allowSandbox: true }) =>
    app.request(`/web/credential-requests/${request.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  return { app, credentials, request, notifyAvailable, record, as, submit, rows };
}

describe('session credential routes', () => {
  it('lets the session owner view the request without exposing any value, and hides it from everyone else', async () => {
    const { app, request, as } = await setup();
    const own = await app.request(`/web/credential-requests/${request.id}`, { headers: as('alice') });
    expect(own.status).toBe(200);
    expect(own.headers.get('cache-control')).toBe('no-store');
    expect(own.headers.get('referrer-policy')).toBe('no-referrer');
    const body = await own.json();
    expect(body.request).toMatchObject({ name: 'FAKE_API_KEY', status: 'pending', sessionId: 'sess-a' });

    for (const headers of [as('bob'), as('alice', 'org-b')]) {
      const other = await app.request(`/web/credential-requests/${request.id}`, { headers });
      expect(other.status).toBe(404);
    }
    expect((await app.request(`/web/credential-requests/${request.id}`)).status).toBe(401);
  });

  it('stores a submission once, never echoes the value, and notifies the session by name only', async () => {
    const { request, credentials, notifyAvailable, record, as, submit } = await setup();
    expect((await submit(as('bob'))).status).toBe(404);
    expect((await submit(as('alice', 'org-b'))).status).toBe(404);

    const ok = await submit(as('alice'));
    expect(ok.status).toBe(200);
    const text = await ok.text();
    expect(text).not.toContain(SECRET);
    expect(JSON.parse(text).credential).toMatchObject({
      name: 'FAKE_API_KEY',
      submittedBy: 'alice',
      allowSandbox: true,
    });

    expect(notifyAvailable).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(notifyAvailable.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(record.mock.calls)).not.toContain(SECRET);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'factory.credential.submitted' }));

    const replay = await submit(as('alice'), { value: 'other', allowSandbox: true });
    expect(replay.status).toBe(409);
    await expect(
      credentials.resolveForCommand({ orgId: 'org-a', sessionId: 'sess-a', names: ['FAKE_API_KEY'] }),
    ).resolves.toEqual({ FAKE_API_KEY: SECRET });
    expect(request.id).toBeTruthy();
  });

  it('follows the current session owner after an ownership transfer', async () => {
    const { app, request, as, submit, rows, credentials } = await setup();
    rows['sess-a']!.userId = 'bob';

    expect((await app.request(`/web/credential-requests/${request.id}`, { headers: as('alice') })).status).toBe(404);
    expect((await submit(as('alice'))).status).toBe(404);
    expect((await app.request(`/web/credential-requests/${request.id}`, { headers: as('bob') })).status).toBe(200);
    expect((await submit(as('bob'))).status).toBe(200);
    const stored = await credentials.list({ orgId: 'org-a', sessionId: 'sess-a' });
    expect(stored.map(credential => credential.submittedBy)).toEqual(['bob']);
  });

  it('hides a request whose session no longer exists', async () => {
    const { app, request, as, submit, rows } = await setup();
    delete rows['sess-a'];
    expect((await app.request(`/web/credential-requests/${request.id}`, { headers: as('alice') })).status).toBe(404);
    expect((await submit(as('alice'))).status).toBe(404);
  });

  it('refuses non-JSON bodies, malformed bodies and expired requests', async () => {
    const { app, request, credentials, as, submit } = await setup();
    const form = await app.request(`/web/credential-requests/${request.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...as('alice') },
      body: `value=${SECRET}&allowSandbox=true`,
    });
    expect(form.status).toBe(415);
    const bad = await submit(as('alice'), { value: SECRET });
    expect(bad.status).toBe(400);
    expect(await bad.text()).not.toContain(SECRET);

    const expired = await credentials.createRequest({
      orgId: 'org-a',
      factoryProjectId: 'fac-a',
      sessionId: 'sess-a',
      threadId: 'thread-a',
      ownerUserId: 'alice',
      name: 'OLD_KEY',
      purpose: 'x',
      now: new Date(Date.now() - 60 * 60 * 1000),
    });
    const late = await app.request(`/web/credential-requests/${expired.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...as('alice') },
      body: JSON.stringify({ value: SECRET, allowSandbox: true }),
    });
    expect(late.status).toBe(410);
  });

  it('lists and revokes only for the session owner', async () => {
    const { app, as, submit } = await setup();
    await submit(as('alice'));
    expect((await app.request('/web/session-credentials/sess-a', { headers: as('bob') })).status).toBe(404);
    const list = await app.request('/web/session-credentials/sess-a', { headers: as('alice') });
    const text = await list.text();
    expect(text).not.toContain(SECRET);
    expect(JSON.parse(text).credentials.map((c: { name: string }) => c.name)).toEqual(['FAKE_API_KEY']);

    const del = (headers: Record<string, string>) =>
      app.request('/web/session-credentials/sess-a/FAKE_API_KEY', { method: 'DELETE', headers });
    expect((await del(as('bob'))).status).toBe(404);
    expect((await del(as('alice'))).status).toBe(200);
    expect((await del(as('alice'))).status).toBe(404);
    const after = await app.request('/web/session-credentials/sess-a', { headers: as('alice') });
    expect((await after.json()).credentials).toEqual([]);
  });

  it('is unavailable when credentials cannot be stored encrypted', async () => {
    const { as, submit } = await setup({ credentials: false });
    expect((await submit(as('alice'))).status).toBe(503);
  });
});
