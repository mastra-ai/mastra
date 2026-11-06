import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

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
      await domain.resolveForCommand({ orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'] }),
    ).toEqual({
      STRIPE_TEST_KEY: SECRET,
    });
    expect(
      (
        await rejection(
          domain.resolveForCommand({ orgId: 'org-a', sessionId: 'session-2', names: ['STRIPE_TEST_KEY'] }),
        )
      ).code,
    ).toBe('missing');
    expect(
      (
        await rejection(
          domain.resolveForCommand({ orgId: 'org-b', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'] }),
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
      await domain.resolveForCommand({ orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'] }),
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
          domain.resolveForCommand({ orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'] }, after),
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
          domain.resolveForCommand({ orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'] }),
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
          domain.resolveForCommand({ orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'] }),
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
      await domain.resolveForCommand({ orgId: 'org-a', sessionId: 'session-1', names: ['STRIPE_TEST_KEY'] }),
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
});
