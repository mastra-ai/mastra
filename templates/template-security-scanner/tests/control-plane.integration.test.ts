import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config/settings.js';
import type { IdentityBinding, Policy, Profile, Target } from '../src/core/contracts.js';
import { ownedLoopbackIdentityTransport } from '../src/core/identity.js';
import { startControlPlane } from '../src/http/server.js';
import { startIdentityFixture } from './fixtures/identity-server.js';

type ProfileDto = Profile & { identity: IdentityBinding & { status: string; reason: string } };
const KEY = 'ab'.repeat(32);
const BOOTSTRAP = 'test_bootstrap_secret_with_more_than_32_characters';
const limits = { maxRequests: 100, maxDurationSeconds: 60, maxResponseBytes: 8192, maxConcurrency: 2 };
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
function targetInput(policy: Policy, origin: string, name = 'Account portal') {
  return {
    name,
    entryUrl: `${origin}/`,
    approvedOrigins: [origin],
    allowedPaths: ['/'],
    excludedPaths: ['/excluded'],
    permittedMethods: ['GET'],
    environment: 'lab',
    authorizationEvidenceRef: 'approval:owned-lab',
    authorizationConfirmed: true,
    policyId: policy.id,
    policyRevision: policy.revision,
    schedule: { enabled: false, timezone: 'UTC' },
    scanLimits: limits,
    authProfileIds: [],
  };
}
function targetBody(target: Target) {
  const { id, owner, revision, ...body } = target;
  return body;
}
function policyBody(policy: Policy) {
  const { id, owner, revision, ...body } = policy;
  return body;
}
function profileInput(origin: string, role: string, value: string, kind: 'bearer' | 'header' = 'bearer') {
  return {
    name: `${role} profile`,
    role,
    kind,
    identityEndpoint: `${origin}/identity`,
    expectedIdentity: `${role}-account`,
    credential: kind === 'bearer' ? { value } : { name: 'cookie', value },
  };
}
function binding(profile: ProfileDto): IdentityBinding {
  const { targetRevision, policyRevision, profileId, profileRevision, credentialRevision } = profile.identity;
  return { targetRevision, policyRevision, profileId, profileRevision, credentialRevision };
}
async function startHarness(withFixture = true, sessionTtlSeconds = 1800) {
  const root = await mkdtemp(join(tmpdir(), 'security-scanner-control-'));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const fixture = await startIdentityFixture();
  cleanup.push(fixture.close);
  let settings = loadSettings(
    {
      CONTROL_BOOTSTRAP_SECRET: BOOTSTRAP,
      SCANNER_ENCRYPTION_KEY: KEY,
      CONTROL_SESSION_TTL_SECONDS: String(sessionTtlSeconds),
    },
    root,
  );
  const transport = withFixture ? ownedLoopbackIdentityTransport(fixture.server) : undefined;
  let running = await startControlPlane(settings, 0, transport);
  let active = true;
  cleanup.push(async () => {
    if (active) await running.close();
  });
  let cookie = '';
  let csrf = '';
  async function login() {
    const response = await fetch(`${running.url}/api/session`, {
      method: 'POST',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: BOOTSTRAP }),
    });
    expect(response.status).toBe(201);
    const data = (await response.json()) as { csrfToken: string };
    cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    csrf = data.csrfToken;
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
  }
  await login();
  async function call<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    revision?: number,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(`${running.url}${path}`, {
      method,
      headers: {
        cookie,
        origin: running.url,
        'x-csrf-token': csrf,
        'content-type': 'application/json',
        ...(revision ? { 'if-match': `"${revision}"` } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: (text ? JSON.parse(text) : null) as T,
      text,
      etag: response.headers.get('etag'),
    };
  }
  const createPolicy = async () => {
    const result = await call<Policy>('/api/policies', 'POST', {
      name: 'Read only lab',
      permittedMethods: ['GET'],
      scanLimits: limits,
    });
    expect(result.status).toBe(201);
    return result.body;
  };
  const createTarget = async (policy: Policy, name?: string) => {
    const result = await call<Target>('/api/targets', 'POST', targetInput(policy, fixture.url, name));
    expect(result.status).toBe(201);
    return result.body;
  };
  const createProfile = async (target: Target, input: unknown) => {
    const result = await call<ProfileDto>(`/api/targets/${target.id}/profiles`, 'POST', input, target.revision);
    expect(result.status).toBe(201);
    return result.body;
  };
  const getTarget = async (id: string) => (await call<Target>(`/api/targets/${id}`)).body;
  const getProfile = async (targetId: string, id: string) =>
    (await call<ProfileDto>(`/api/targets/${targetId}/profiles/${id}`)).body;
  return {
    root,
    fixture,
    call,
    createPolicy,
    createTarget,
    createProfile,
    getTarget,
    getProfile,
    url: () => running.url,
    cookie: () => cookie,
    csrf: () => csrf,
    async restart(key: string | undefined = KEY) {
      await running.close();
      active = false;
      settings = loadSettings(
        { CONTROL_BOOTSTRAP_SECRET: BOOTSTRAP, ...(key ? { SCANNER_ENCRYPTION_KEY: key } : {}) },
        root,
      );
      running = await startControlPlane(settings, 0, transport);
      active = true;
      await login();
    },
    async records() {
      const client = createClient({ url: settings.databaseUrl });
      try {
        return {
          records: (await client.execute('SELECT * FROM scanner_records')).rows,
          envelopes: (await client.execute('SELECT * FROM scanner_credentials')).rows,
        };
      } finally {
        client.close();
      }
    },
    async db<T>(operation: (client: ReturnType<typeof createClient>) => Promise<T>) {
      const client = createClient({ url: settings.databaseUrl });
      try {
        return await operation(client);
      } finally {
        client.close();
      }
    },
  };
}
async function wireRequest(url: string, headers: Record<string, string>, chunks: string[]) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const outgoing = request(url, { method: chunks.length ? 'POST' : 'GET', headers }, incoming => {
      const data: Buffer[] = [];
      incoming.on('data', chunk => data.push(chunk));
      incoming.on('end', () => resolve({ status: incoming.statusCode!, text: Buffer.concat(data).toString() }));
    });
    outgoing.once('error', reject);
    for (const chunk of chunks) outgoing.write(chunk);
    outgoing.end();
  });
}

describe('protected local control plane over real HTTP and libSQL', () => {
  it('target_and_sealed_profiles_persist_without_secret_readback', async () => {
    const app = await startHarness();
    const policy = await app.createPolicy();
    let target = await app.createTarget(policy);
    const readerSecret = 'private_reader_persistence_marker';
    const adminSecret = 'private_admin_persistence_marker';
    const reader = await app.createProfile(target, profileInput(app.fixture.url, 'reader', readerSecret));
    target = await app.getTarget(target.id);
    const admin = await app.createProfile(target, profileInput(app.fixture.url, 'admin', adminSecret, 'header'));
    target = await app.getTarget(target.id);
    expect([...target.authProfileIds].sort()).toEqual([reader.id, admin.id].sort());
    const before = await app.records();
    expect(before.records).toHaveLength(4);
    expect(before.envelopes).toHaveLength(2);
    expect(JSON.stringify(before.records)).not.toMatch(/private_(reader|admin)_persistence_marker/);
    expect(JSON.stringify(before.envelopes)).not.toContain(readerSecret);
    expect(JSON.stringify(before.envelopes)).not.toContain(adminSecret);
    await app.restart();
    expect(await app.getTarget(target.id)).toEqual(target);
    const profiles = await app.call<{ items: ProfileDto[] }>(`/api/targets/${target.id}/profiles?limit=1&offset=0`);
    expect(profiles.body.items).toHaveLength(1);
    for (const secret of [readerSecret, adminSecret]) expect(profiles.text).not.toContain(secret);
    expect((await app.getProfile(target.id, reader.id)).role).toBe('reader');
    expect((await app.getProfile(target.id, admin.id)).kind).toBe('header');
    // The official metadata route actually executes behind the outer boundary, including public adapter routes.
    expect((await app.call('/native/agents')).status).toBe(200);
    expect((await app.call('/native/workflows')).status).toBe(200);
    expect((await app.call('/native/openapi.json')).status).toBe(200);
    expect((await app.call('/native/auth/capabilities')).body).toEqual({ enabled: false, login: null });
    for (const path of ['/native/agents', '/native/workflows', '/native/openapi.json', '/native/auth/capabilities']) {
      expect((await fetch(`${app.url()}${path}`)).status).toBe(403);
    }
    expect((await app.call('/native/agents/any/generate', 'POST', { messages: [] })).body).toEqual({
      code: 'EXECUTION_DISABLED',
    });
    expect((await app.call('/native/agents?requestContext=%7B%22resourceId%22%3A%22admin%22%7D')).status).toBe(400);
    expect(await (await fetch(`${app.url()}/api/runtime`)).json()).toEqual({
      status: 'control-plane',
      scanningEnabled: false,
      discoveryRequested: false,
      nativeExecutionEnabled: false,
    });
    // Missing/wrong keys leave metadata readable, but invalidate every encrypted identity.
    await app.restart('');
    expect((await app.getProfile(target.id, reader.id)).identity.status).toBe('CREDENTIAL_UNAVAILABLE');
    target = await app.getTarget(target.id);
    expect(
      (
        await app.call(
          `/api/targets/${target.id}/profiles`,
          'POST',
          profileInput(app.fixture.url, 'writer', 'missing_key_marker'),
          target.revision,
        )
      ).body,
    ).toEqual({ code: 'CREDENTIAL_KEY_REQUIRED' });
    expect((await app.records()).records).toHaveLength(4);
    await app.restart('cd'.repeat(32));
    expect((await app.getProfile(target.id, admin.id)).identity.status).toBe('CREDENTIAL_UNAVAILABLE');
    const reRegistered = await app.call<ProfileDto>(
      `/api/targets/${target.id}/profiles/${reader.id}`,
      'PUT',
      profileInput(app.fixture.url, 'reader', 'new_credential_marker'),
      reader.revision,
    );
    expect(reRegistered.status).toBe(200);
    expect(reRegistered.body.credentialRevision).toBe(2);
    expect(reRegistered.body.identity.status).toBe('CHECK_REQUIRED');
    expect((await app.getProfile(target.id, admin.id)).identity.status).toBe('CREDENTIAL_UNAVAILABLE');
    // Deleting a target removes its credential envelopes and owned revision records atomically.
    expect((await app.call(`/api/targets/${target.id}`, 'DELETE', undefined, target.revision)).status).toBe(204);
    const remaining = await app.records();
    expect(remaining.records).toHaveLength(1);
    expect(remaining.envelopes).toHaveLength(0);
    const history = await app.db(client =>
      client.execute("SELECT count(*) AS count FROM scanner_record_revisions WHERE kind IN ('target','profile')"),
    );
    expect(Number(history.rows[0]?.count)).toBe(0);
    expect((await app.call(`/api/policies/${policy.id}`, 'DELETE', undefined, policy.revision)).status).toBe(204);
  }, 60000);

  it('target_mutations_reject_csrf_scope_and_revision_conflicts', async () => {
    const app = await startHarness();
    const policy = await app.createPolicy();
    let target = await app.createTarget(policy);
    const baseline = await app.records();
    for (const headers of [
      { 'x-csrf-token': '' },
      { cookie: '' },
      { origin: 'https://untrusted.example' },
      { origin: '' },
    ] as Record<string, string>[]) {
      expect(
        (await app.call('/api/targets', 'POST', targetInput(policy, app.fixture.url), undefined, headers)).status,
      ).toBe(403);
    }
    expect((await wireRequest(`${app.url()}/api/runtime`, { host: 'evil.example' }, [])).status).toBe(403);
    const headers = {
      origin: app.url(),
      cookie: app.cookie(),
      'x-csrf-token': app.csrf(),
      'content-type': 'application/json',
    };
    expect(
      (await wireRequest(`${app.url()}/api/targets`, headers, ['{"name":"', 'x'.repeat(17000), '"}'])).status,
    ).toBe(413);
    expect((await wireRequest(`${app.url()}/native/agents`, headers, ['x'.repeat(17000)])).status).toBe(413);
    expect((await app.call('/api/targets', 'POST', '{')).body).toEqual({ code: 'INVALID_JSON' });
    for (const change of [
      { entryUrl: 'not-a-url' },
      { entryUrl: 'https://other.example/' },
      { entryUrl: `${app.fixture.url}/excluded/child` },
      { owner: 'forged-operator' },
      { authorizationConfirmed: false },
      { scanLimits: { ...limits, maxRequests: Infinity } },
      { policyRevision: 999 },
      { permittedMethods: ['POST'] },
      { scanLimits: { ...limits, maxRequests: 101 } },
    ]) {
      const result = await app.call('/api/targets', 'POST', { ...targetInput(policy, app.fixture.url), ...change });
      expect([400, 403, 409]).toContain(result.status);
      expect(result.text).not.toContain('forged-operator');
    }
    expect(await app.records()).toEqual(baseline);
    const profile = await app.createProfile(target, profileInput(app.fixture.url, 'reader', 'scope_secret_marker'));
    target = await app.getTarget(target.id);
    const other = await app.createTarget(policy, 'Other portal');
    expect(
      (
        await app.call(
          `/api/targets/${other.id}`,
          'PUT',
          { ...targetBody(other), authProfileIds: [profile.id] },
          other.revision,
        )
      ).body,
    ).toEqual({ code: 'PROFILE_SCOPE_DENIED' });
    expect((await app.call(`/api/targets/${other.id}/profiles/${profile.id}`)).body).toEqual({
      code: 'PROFILE_SCOPE_DENIED',
    });
    expect(
      (await app.call(`/api/targets/${other.id}/profiles/${profile.id}`, 'DELETE', undefined, profile.revision)).body,
    ).toEqual({ code: 'PROFILE_SCOPE_DENIED' });
    expect(
      (
        await app.call(
          `/api/targets/${target.id}/profiles`,
          'POST',
          {
            ...profileInput(app.fixture.url, 'writer', 'outside_secret_marker'),
            identityEndpoint: 'https://outside.example/identity',
          },
          target.revision,
        )
      ).body,
    ).toEqual({ code: 'IDENTITY_SCOPE_DENIED' });
    // Competing actual socket requests must not both win the same persisted revision.
    for (let index = 0; index < 20; index++) {
      const body = targetBody(target);
      const replies = await Promise.all([
        app.call<Target>(`/api/targets/${target.id}`, 'PUT', { ...body, name: `First ${index}` }, target.revision),
        app.call<Target>(`/api/targets/${target.id}`, 'PUT', { ...body, name: `Second ${index}` }, target.revision),
      ]);
      expect(replies.map(reply => reply.status).sort()).toEqual([200, 409]);
      target = await app.getTarget(target.id);
      expect(target.revision).toBe(3 + index);
    }
    expect((await app.call(`/api/targets/${target.id}`, 'DELETE', undefined, 1)).status).toBe(409);
    const update = await app.call<Policy>(
      `/api/policies/${policy.id}`,
      'PUT',
      { ...policyBody(policy), name: 'Updated lab policy' },
      policy.revision,
    );
    expect(update.status).toBe(200);
    const staleProfile = await app.getProfile(target.id, profile.id);
    expect(staleProfile.identity.status).toBe('CHECK_REQUIRED');
    expect(
      (await app.call(`/api/targets/${target.id}/profiles/${profile.id}/check`, 'POST', binding(staleProfile))).status,
    ).toBe(409);
    expect((await app.call(`/api/policies/${policy.id}/revisions`)).body).toMatchObject({
      items: [{ revision: 2 }, { revision: 1 }],
    });
    expect((await app.call(`/api/policies/${policy.id}`, 'DELETE', undefined, 2)).body).toEqual({
      code: 'POLICY_IN_USE',
    });
    expect((await app.call(`/api/targets/${randomUUID()}`)).status).toBe(404);
    const recovered = await app.call<Target>(
      `/api/targets/${target.id}`,
      'PUT',
      { ...targetBody(target), policyRevision: 2 },
      target.revision,
    );
    expect(recovered.status).toBe(200);
    target = recovered.body;
    const publicProfile = await app.createProfile(target, { kind: 'public', name: 'Visitor', role: 'visitor' });
    target = await app.getTarget(target.id);
    const publicCurrent = await app.getProfile(target.id, publicProfile.id);
    expect((await app.call(`/api/targets/${target.id}/scans`, 'POST', binding(publicCurrent))).body).toEqual({
      code: 'EXECUTION_DISABLED',
    });
    const production = await app.call<Target>(
      `/api/targets/${target.id}`,
      'PUT',
      { ...targetBody(target), environment: 'production' },
      target.revision,
    );
    expect(production.status).toBe(200);
    const prodProfile = await app.getProfile(target.id, publicProfile.id);
    expect((await app.call(`/api/targets/${target.id}/scans`, 'POST', binding(prodProfile))).body).toEqual({
      code: 'RETENTION_REQUIRED',
    });
    const tables = await app.db(client =>
      client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'scanner_%'"),
    );
    expect(tables.rows.map(row => row.name)).not.toContain('scanner_scans');
    expect(app.fixture.observations).toHaveLength(0);
    expect((await app.call('/api/session', 'DELETE')).status).toBe(204);
    expect((await app.call('/api/targets')).body).toEqual({ code: 'LOCAL_SESSION_REQUIRED' });
    const expiring = await startHarness(true, 1);
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect((await expiring.call('/api/targets')).body).toEqual({ code: 'LOCAL_SESSION_REQUIRED' });
    expect(
      (
        await expiring.call('/api/policies', 'POST', {
          name: 'Expired operator',
          permittedMethods: ['GET'],
          scanLimits: limits,
        })
      ).body,
    ).toEqual({ code: 'LOCAL_SESSION_REQUIRED' });
    expect((await expiring.records()).records).toHaveLength(0);
  }, 60000);

  it('profile_expiry_and_refresh_preserve_identity_attribution', async () => {
    const app = await startHarness();
    const policy = await app.createPolicy();
    let target = await app.createTarget(policy);
    const readerSecret = 'reader_identity_private_marker';
    const adminSecret = 'admin_identity_private_marker';
    app.fixture.accounts.set(readerSecret, { identity: 'reader-account', role: 'reader' });
    app.fixture.accounts.set(adminSecret, { identity: 'admin-account', role: 'admin' });
    let reader = await app.createProfile(target, profileInput(app.fixture.url, 'reader', readerSecret));
    target = await app.getTarget(target.id);
    let admin = await app.createProfile(target, profileInput(app.fixture.url, 'admin', adminSecret, 'header'));
    reader = await app.getProfile(target.id, reader.id);
    admin = await app.getProfile(target.id, admin.id);
    const check = async (profile: ProfileDto) =>
      app.call<ProfileDto>(`/api/targets/${target.id}/profiles/${profile.id}/check`, 'POST', binding(profile));
    reader = (await check(reader)).body;
    admin = (await check(admin)).body;
    expect(reader.identity.status).toBe('READY');
    expect(admin.identity.status).toBe('READY');
    expect(app.fixture.observations).toEqual([
      { method: 'GET', path: '/identity', identity: 'reader-account' },
      { method: 'GET', path: '/identity', identity: 'admin-account' },
    ]);
    await app.restart();
    reader = await app.getProfile(target.id, reader.id);
    expect(reader.identity.status).toBe('READY');
    app.fixture.accounts.delete(readerSecret);
    reader = (await check(reader)).body;
    expect(reader.identity.status).toBe('AUTH_REQUIRED');
    expect(reader.identity.reason).toBe('SESSION_REJECTED');
    expect((await app.getProfile(target.id, admin.id)).identity.status).toBe('READY');
    const oldBinding = binding(reader);
    const refreshedInput = profileInput(app.fixture.url, 'reader', 'refreshed_reader_private_marker');
    app.fixture.accounts.set('refreshed_reader_private_marker', { identity: 'reader-account', role: 'reader' });
    const refreshed = await app.call<ProfileDto>(
      `/api/targets/${target.id}/profiles/${reader.id}`,
      'PUT',
      refreshedInput,
      reader.revision,
    );
    expect(refreshed.status).toBe(200);
    reader = refreshed.body;
    expect(reader.credentialRevision).toBe(2);
    expect(reader.identity.status).toBe('CHECK_REQUIRED');
    expect((await app.call(`/api/targets/${target.id}/scans`, 'POST', oldBinding)).status).toBe(409);
    expect((await app.call(`/api/targets/${target.id}/profiles/${reader.id}/check`, 'POST', oldBinding)).status).toBe(
      409,
    );
    reader = (await check(reader)).body;
    expect(reader.identity.status).toBe('READY');
    // Valid account with wrong role is authentication failure, never a vulnerability verdict.
    app.fixture.accounts.set('refreshed_reader_private_marker', { identity: 'reader-account', role: 'admin' });
    reader = (await check(reader)).body;
    expect(reader.identity.status).toBe('AUTH_REQUIRED');
    expect(reader.identity.reason).toBe('IDENTITY_MISMATCH');
    app.fixture.accounts.set('refreshed_reader_private_marker', { identity: 'reader-account', role: 'reader' });
    for (const [mode, status, reason] of [
      ['redirect', 'AUTH_REQUIRED', 'SESSION_REJECTED'],
      ['malformed', 'UNAVAILABLE', 'IDENTITY_RESPONSE_INVALID'],
      ['oversized', 'UNAVAILABLE', 'IDENTITY_RESPONSE_TOO_LARGE'],
      ['failure', 'UNAVAILABLE', 'IDENTITY_RESPONSE_INVALID'],
      ['timeout', 'UNAVAILABLE', 'IDENTITY_TIMEOUT'],
    ] as const) {
      app.fixture.setMode(mode);
      reader = (await check(reader)).body;
      expect(reader.identity).toMatchObject({ status, reason });
      expect(JSON.stringify(reader)).not.toMatch(
        /NOT_REPRODUCED|private_marker|private-fixture-error|invalid-json-marker/,
      );
    }
    app.fixture.setMode('normal');
    const expired = await app.call<ProfileDto>(
      `/api/targets/${target.id}/profiles/${reader.id}`,
      'PUT',
      { ...refreshedInput, expiresAt: '2020-01-01T00:00:00.000Z' },
      reader.revision,
    );
    reader = expired.body;
    const count = app.fixture.observations.length;
    reader = (await check(reader)).body;
    expect(reader.identity.status).toBe('AUTH_REQUIRED');
    expect(reader.identity.reason).toBe('SESSION_EXPIRED');
    expect(app.fixture.observations).toHaveLength(count);
    // A late result cannot revive the credential that was replaced while the socket request was in flight.
    reader = (
      await app.call<ProfileDto>(
        `/api/targets/${target.id}/profiles/${reader.id}`,
        'PUT',
        refreshedInput,
        reader.revision,
      )
    ).body;
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const paused = new Promise<void>(resolve => {
      release = resolve;
    });
    app.fixture.pause(async () => {
      entered();
      await paused;
    });
    const pending = check(reader);
    await started;
    const changed = await app.call<ProfileDto>(
      `/api/targets/${target.id}/profiles/${reader.id}`,
      'PUT',
      { ...refreshedInput, credential: { value: 'replacement_during_check_marker' } },
      reader.revision,
    );
    release();
    app.fixture.pause();
    expect((await pending).status).toBe(409);
    reader = changed.body;
    expect((await app.getProfile(target.id, reader.id)).identity.status).toBe('CHECK_REQUIRED');
    // Swapping stored authenticated envelopes cannot make either profile READY.
    const envelopes = (await app.records()).envelopes;
    const readerEnvelope = String(envelopes.find(row => row.profile_id === reader.id)!.envelope);
    const adminEnvelope = String(envelopes.find(row => row.profile_id === admin.id)!.envelope);
    await app.db(client =>
      client.batch(
        [
          { sql: 'UPDATE scanner_credentials SET envelope=? WHERE profile_id=?', args: [adminEnvelope, reader.id] },
          { sql: 'UPDATE scanner_credentials SET envelope=? WHERE profile_id=?', args: [readerEnvelope, admin.id] },
        ],
        'write',
      ),
    );
    await app.restart();
    expect((await app.getProfile(target.id, reader.id)).identity.status).toBe('CREDENTIAL_UNAVAILABLE');
    expect((await app.getProfile(target.id, admin.id)).identity.status).toBe('CREDENTIAL_UNAVAILABLE');
    const ordinary = await app.call(`/api/targets/${target.id}/profiles`);
    expect(ordinary.text).not.toMatch(/private_marker|replacement_during_check_marker/);
    // Default production transport refuses even the same local endpoint without an owned fixture capability.
    const production = await startHarness(false);
    const prodPolicy = await production.createPolicy();
    let prodTarget = await production.createTarget(prodPolicy);
    const prodProfile = await production.createProfile(
      prodTarget,
      profileInput(production.fixture.url, 'reader', readerSecret),
    );
    prodTarget = await production.getTarget(prodTarget.id);
    const disabled = await production.call<ProfileDto>(
      `/api/targets/${prodTarget.id}/profiles/${prodProfile.id}/check`,
      'POST',
      binding(await production.getProfile(prodTarget.id, prodProfile.id)),
    );
    expect(disabled.body.identity).toMatchObject({ status: 'UNAVAILABLE', reason: 'REMOTE_IDENTITY_DISABLED' });
    expect(production.fixture.observations).toHaveLength(0);
  }, 60000);
});
