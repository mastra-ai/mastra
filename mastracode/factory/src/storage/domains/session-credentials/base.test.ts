import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createFactorySecretEncryption } from '../../../secret-encryption.js';
import {
  CREDENTIAL_REQUEST_TTL_MS,
  MAX_CREDENTIAL_TTL_MS,
  SessionCredentialError,
  SessionCredentialsStorage,
  credentialNameProblem,
} from './base.js';

const encryption = createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 9) } });
const SECRET = 'sk_test_51SuperSecretValue';

async function makeStore() {
  const backend = new LibSQLFactoryStorage({ id: 'session-credentials-test', url: ':memory:' });
  const domain = backend.registerDomain(new SessionCredentialsStorage(encryption));
  await backend.init();
  onTestFinished(() => backend.close());
  return { backend, domain };
}

function request(
  domain: SessionCredentialsStorage,
  overrides: Partial<Parameters<SessionCredentialsStorage['createRequest']>[0]> = {},
) {
  return domain.createRequest({
    orgId: 'org-a',
    factoryProjectId: 'factory-1',
    sessionId: 'session-1',
    threadId: 'thread-1',
    ownerUserId: 'user-1',
    name: 'STRIPE_TEST_KEY',
    purpose: 'Run the Stripe integration suite',
    ...overrides,
  });
}

async function rejection(promise: Promise<unknown>): Promise<SessionCredentialError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SessionCredentialError);
  return error as SessionCredentialError;
}

describe('credentialNameProblem', () => {
  it('accepts service-specific env var names and rejects reserved or malformed ones', () => {
    expect(credentialNameProblem('STRIPE_TEST_KEY')).toBeNull();
    for (const bad of [
      'PATH',
      'GH_TOKEN',
      'LD_PRELOAD',
      'GIT_SSH_COMMAND',
      'MASTRA_API_KEY',
      'lower',
      '1ABC',
      'A-B',
      '',
    ]) {
      expect(credentialNameProblem(bad)).not.toBeNull();
    }
  });
});

describe('SessionCredentialsStorage', () => {
  it('stores the value encrypted and only resolves it for its own org and session', async () => {
    const { backend, domain } = await makeStore();
    const req = await request(domain);
    const { credential } = await domain.fulfillRequest({
      requestId: req.id,
      submittedBy: 'user-1',
      value: SECRET,
      allowSandbox: true,
    });
    expect(credential).not.toHaveProperty('value');

    const raw = await backend.ops.findOne<{ value: string }>('session_credentials', { name: 'STRIPE_TEST_KEY' });
    expect(raw?.value).toMatch(/^mastra:factory-secret:v1:/);
    expect(raw?.value).not.toContain(SECRET);

    expect(
      await domain.resolveForCommand({
        orgId: 'org-a',
        sessionId: 'session-1',
        names: ['STRIPE_TEST_KEY'],
        submittedBy: 'user-1',
      }),
    ).toEqual({
      STRIPE_TEST_KEY: SECRET,
    });
    expect(
      (
        await rejection(
          domain.resolveForCommand({
            orgId: 'org-a',
            sessionId: 'session-2',
            names: ['STRIPE_TEST_KEY'],
            submittedBy: 'user-1',
          }),
        )
      ).code,
    ).toBe('missing');
    expect(
      (
        await rejection(
          domain.resolveForCommand({
            orgId: 'org-b',
            sessionId: 'session-1',
            names: ['STRIPE_TEST_KEY'],
            submittedBy: 'user-1',
          }),
        )
      ).code,
    ).toBe('missing');
    expect(await domain.list({ orgId: 'org-b', sessionId: 'session-1' })).toEqual([]);
    expect((await domain.list({ orgId: 'org-a', sessionId: 'session-1' })).map(c => c.name)).toEqual([
      'STRIPE_TEST_KEY',
    ]);
  });

  it('refuses a replayed request', async () => {
    const { domain } = await makeStore();
    const req = await request(domain);
    await domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true });
    const replay = await rejection(
      domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: 'attacker-value', allowSandbox: true }),
    );
    expect(replay.code).toBe('already_used');
    expect(
      await domain.resolveForCommand({
        orgId: 'org-a',
        sessionId: 'session-1',
        names: ['STRIPE_TEST_KEY'],
        submittedBy: 'user-1',
      }),
    ).toEqual({
      STRIPE_TEST_KEY: SECRET,
    });
  });

  it('refuses an expired request and unknown or malformed request ids', async () => {
    const { domain } = await makeStore();
    const created = new Date('2026-01-01T00:00:00Z');
    const req = await request(domain, { now: created });
    const late = new Date(created.getTime() + CREDENTIAL_REQUEST_TTL_MS + 1);
    expect(
      (
        await rejection(
          domain.fulfillRequest({
            requestId: req.id,
            submittedBy: 'user-1',
            value: SECRET,
            allowSandbox: true,
            now: late,
          }),
        )
      ).code,
    ).toBe('expired');
    expect(
      (
        await rejection(
          domain.fulfillRequest({
            requestId: '00000000-0000-4000-8000-000000000000',
            submittedBy: 'user-1',
            value: SECRET,
            allowSandbox: true,
          }),
        )
      ).code,
    ).toBe('not_found');
    expect(await domain.getRequest('not-a-uuid')).toBeNull();
  });

  it('expires credentials at their TTL, capped at the maximum', async () => {
    const { domain } = await makeStore();
    const now = new Date('2026-01-01T00:00:00Z');
    const req = await request(domain, { now });
    const { credential } = await domain.fulfillRequest({
      requestId: req.id,
      submittedBy: 'user-1',
      value: SECRET,
      allowSandbox: true,
      ttlMs: 10 * MAX_CREDENTIAL_TTL_MS,
      now,
    });
    expect(credential.expiresAt.getTime() - now.getTime()).toBe(MAX_CREDENTIAL_TTL_MS);

    const after = new Date(now.getTime() + MAX_CREDENTIAL_TTL_MS + 1);
    expect(await domain.list({ orgId: 'org-a', sessionId: 'session-1' }, after)).toEqual([]);
    expect(
      (
        await rejection(
          domain.resolveForCommand(
            { orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'], submittedBy: 'user-1' },
            after,
          ),
        )
      ).code,
    ).toBe('missing');
  });

  it('stops resolving a revoked credential', async () => {
    const { domain } = await makeStore();
    const req = await request(domain);
    await domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true });
    expect(await domain.revoke({ orgId: 'org-a', sessionId: 'session-1', name: 'STRIPE_TEST_KEY' })).toBe(true);
    expect(await domain.revoke({ orgId: 'org-a', sessionId: 'session-1', name: 'STRIPE_TEST_KEY' })).toBe(false);
    expect(
      (
        await rejection(
          domain.resolveForCommand({
            orgId: 'org-a',
            sessionId: 'session-1',
            names: ['STRIPE_TEST_KEY'],
            submittedBy: 'user-1',
          }),
        )
      ).code,
    ).toBe('missing');
  });

  it('withholds a credential from commands unless sandbox use was allowed', async () => {
    const { domain } = await makeStore();
    const req = await request(domain);
    await domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: false });
    expect(
      (
        await rejection(
          domain.resolveForCommand({
            orgId: 'org-a',
            sessionId: 'session-1',
            names: ['STRIPE_TEST_KEY'],
            submittedBy: 'user-1',
          }),
        )
      ).code,
    ).toBe('sandbox_not_allowed');
  });

  it('replaces an earlier value when a new request for the same name is fulfilled', async () => {
    const { domain } = await makeStore();
    const first = await request(domain);
    await domain.fulfillRequest({ requestId: first.id, submittedBy: 'user-1', value: 'old', allowSandbox: true });
    const second = await request(domain);
    await domain.fulfillRequest({ requestId: second.id, submittedBy: 'user-1', value: 'new', allowSandbox: true });
    expect(
      await domain.resolveForCommand({
        orgId: 'org-a',
        sessionId: 'session-1',
        names: ['STRIPE_TEST_KEY'],
        submittedBy: 'user-1',
      }),
    ).toEqual({
      STRIPE_TEST_KEY: 'new',
    });
    expect(await domain.list({ orgId: 'org-a', sessionId: 'session-1' })).toHaveLength(1);
  });

  it('rejects reserved names, empty values and oversized values', async () => {
    const { domain } = await makeStore();
    expect((await rejection(request(domain, { name: 'PATH' }))).code).toBe('invalid_name');
    const req = await request(domain);
    expect(
      (
        await rejection(
          domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: '', allowSandbox: true }),
        )
      ).code,
    ).toBe('invalid_value');
    expect(
      (
        await rejection(
          domain.fulfillRequest({
            requestId: req.id,
            submittedBy: 'user-1',
            value: 'x'.repeat(17 * 1024),
            allowSandbox: true,
          }),
        )
      ).code,
    ).toBe('invalid_value');
    // Validation failures do not consume the one-time request.
    expect((await domain.getRequest(req.id))?.status).toBe('pending');
  });

  it('purges every credential and request of a session', async () => {
    const { domain } = await makeStore();
    const req = await request(domain);
    await domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true });
    await domain.purgeSession({ orgId: 'org-a', sessionId: 'session-1' });
    expect(await domain.list({ orgId: 'org-a', sessionId: 'session-1' })).toEqual([]);
    expect(await domain.getRequest(req.id)).toBeNull();
  });

  it('deletes expired credentials and stale requests instead of only hiding them', async () => {
    const { backend, domain } = await makeStore();
    const t0 = new Date('2026-01-01T00:00:00Z');
    const req = await request(domain, { now: t0 });
    await domain.fulfillRequest({
      requestId: req.id,
      submittedBy: 'user-1',
      value: SECRET,
      allowSandbox: true,
      ttlMs: 60 * 60_000,
      now: t0,
    });
    const rows = () => backend.ops.findMany('session_credentials', {});

    // Listing a session drops its expired rows.
    await domain.list({ orgId: 'org-a', sessionId: 'session-1' }, new Date(t0.getTime() + 2 * 60 * 60_000));
    expect(await rows()).toHaveLength(0);

    // The sweep drops expired credentials of any session, and requests a day past expiry.
    const other = await request(domain, { sessionId: 'session-2', now: t0 });
    await domain.fulfillRequest({
      requestId: other.id,
      submittedBy: 'user-1',
      value: SECRET,
      allowSandbox: true,
      ttlMs: 60 * 60_000,
      now: t0,
    });
    expect(await rows()).toHaveLength(1);
    await domain.purgeExpired(new Date(t0.getTime() + 2 * 60 * 60_000));
    expect(await rows()).toHaveLength(0);
    expect(await domain.getRequest(other.id)).not.toBeNull();
    await domain.purgeExpired(new Date(t0.getTime() + 25 * 60 * 60_000));
    expect(await domain.getRequest(other.id)).toBeNull();
    expect(await domain.getRequest(req.id)).toBeNull();
  });

  it('lets exactly one of two concurrent submissions claim a request', async () => {
    const { domain } = await makeStore();
    const req = await request(domain);
    const results = await Promise.allSettled(
      ['first', 'second'].map(suffix =>
        domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET + suffix, allowSandbox: true }),
      ),
    );
    const fulfilled = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected.map(result => (result.reason as SessionCredentialError).code)).toEqual(['already_used']);
  });

  it('leaves the request usable when the credential cannot be stored', async () => {
    const { backend, domain } = await makeStore();
    const req = await request(domain);
    const upsert = vi.spyOn(backend.ops, 'upsertOne').mockRejectedValueOnce(new Error('disk full'));
    await expect(
      domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true }),
    ).rejects.toThrow('disk full');
    expect((await domain.getRequest(req.id))?.status).toBe('pending');
    upsert.mockRestore();

    await domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true });
    const env = await domain.resolveForCommand({
      orgId: 'org-a',
      sessionId: 'session-1',
      names: ['STRIPE_TEST_KEY'],
      submittedBy: 'user-1',
    });
    expect(env).toEqual({ STRIPE_TEST_KEY: SECRET });
  });

  it('drops a credential written after its session was purged mid-submit', async () => {
    const { backend, domain } = await makeStore();
    const req = await request(domain);
    const upsert = backend.ops.upsertOne.bind(backend.ops);
    vi.spyOn(backend.ops, 'upsertOne').mockImplementationOnce(async (...args: Parameters<typeof upsert>) => {
      await domain.purgeSession({ orgId: 'org-a', sessionId: 'session-1' });
      return upsert(...args);
    });
    await expect(
      domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true }),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await backend.ops.findMany('session_credentials', {})).toEqual([]);
  });

  it('only resolves credentials the given submitter stored', async () => {
    const { domain } = await makeStore();
    const req = await request(domain);
    await domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true });
    expect(
      await rejection(
        domain.resolveForCommand({
          orgId: 'org-a',
          sessionId: 'session-1',
          names: ['STRIPE_TEST_KEY'],
          submittedBy: 'user-2',
        }),
      ),
    ).toMatchObject({ code: 'missing' });
  });

  it('does not claim the request when encryption fails', async () => {
    const backend = new LibSQLFactoryStorage({ id: 'session-credentials-test', url: ':memory:' });
    const domain = backend.registerDomain(
      new SessionCredentialsStorage({
        ...encryption,
        encrypt: () => Promise.reject(new Error('key unavailable')),
      }),
    );
    await backend.init();
    onTestFinished(() => backend.close());
    const req = await request(domain);
    await expect(
      domain.fulfillRequest({ requestId: req.id, submittedBy: 'user-1', value: SECRET, allowSandbox: true }),
    ).rejects.toThrow('key unavailable');
    expect((await domain.getRequest(req.id))?.status).toBe('pending');
  });

  it('keeps a value resubmitted after an expired copy was read', async () => {
    const { backend, domain } = await makeStore();
    const t0 = new Date('2026-11-06T12:00:00Z');
    const first = await request(domain, { now: t0 });
    await domain.fulfillRequest({
      requestId: first.id,
      submittedBy: 'user-1',
      value: 'old-value-123',
      allowSandbox: true,
      ttlMs: 60_000,
      now: t0,
    });
    const stale = await backend.ops.findMany('session_credentials', {});

    const t1 = new Date(t0.getTime() + 120_000);
    const second = await request(domain, { now: t1 });
    await domain.fulfillRequest({
      requestId: second.id,
      submittedBy: 'user-1',
      value: SECRET,
      allowSandbox: true,
      now: t1,
    });

    // A reader that saw the expired row deletes only that observed version.
    const deleted = await backend.ops.deleteMany('session_credentials', {
      id: stale[0]!.id as string,
      expires_at: stale[0]!.expires_at as Date,
    });
    expect(deleted).toBe(0);
    expect(
      await domain.resolveForCommand(
        { orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'], submittedBy: 'user-1' },
        t1,
      ),
    ).toEqual({
      STRIPE_TEST_KEY: SECRET,
    });
  });
});
