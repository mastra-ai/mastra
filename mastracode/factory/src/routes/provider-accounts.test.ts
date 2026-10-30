import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CredentialTenant } from '../storage/domains/credentials/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { ProviderAccountRoutes } from './provider-accounts.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

let seed: FactoryStorageTestSeed;
const isOrganizationAdmin = vi.fn(async () => true);
const onCredentialsChanged = vi.fn();

const userA = { workosId: 'user-a', organizationId: 'org1' };
const userB = { workosId: 'user-b', organizationId: 'org1' };
const USER_A: CredentialTenant = { orgId: 'org1', userId: 'user-a' };
const ORG: CredentialTenant = { orgId: 'org1' };

function buildApp(user: { workosId: string; organizationId?: string } | null, authStorage?: AuthStorage) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    new ProviderAccountRoutes({
      auth: fakeRouteAuth({ enabled: user !== null || !authStorage, isOrganizationAdmin }),
      authStorage,
      modelCredentials: authStorage ? undefined : seed.credentials,
      onCredentialsChanged,
    }).routes(),
  );
  return app;
}

const send = (app: Hono, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const base = '/web/config/providers/openai/accounts';
const accountPath = (id: string, suffix = '') => `${base}/${encodeURIComponent(id)}${suffix}`;

/** Seed three OAuth accounts (first one active) into a tenant's openai-codex pool. */
async function seedPool(tenant: CredentialTenant) {
  const ids: string[] = [];
  for (const [i, label] of ['one', 'two', 'three'].entries()) {
    const account = await seed.credentials.addAccount(tenant, 'openai-codex', {
      credential: { type: 'oauth', access: `access-${label}`, refresh: `refresh-${label}`, expires: Date.now() + 1e6 },
      label,
      identity: `identity-${label}`,
      activate: i === 0,
    });
    ids.push(account.id);
  }
  return ids;
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  isOrganizationAdmin.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /accounts', () => {
  it("lists the caller's pool in priority order without token material", async () => {
    const [one, two, three] = await seedPool(USER_A);
    const res = await buildApp(userA).request(base);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accounts.map((a: { id: string }) => a.id)).toEqual([one, two, three]);
    expect(json.accounts[0]).toMatchObject({ providerId: 'openai-codex', type: 'oauth', label: 'one', active: true });
    const raw = JSON.stringify(json);
    expect(raw).not.toContain('access-');
    expect(raw).not.toContain('refresh-');
    expect(raw).not.toContain('identity-');
  });

  it("does not show another member's user-scoped accounts", async () => {
    await seedPool(USER_A);
    const json = await (await buildApp(userB).request(base)).json();
    expect(json.accounts).toEqual([]);
  });

  it('lists the org pool with ?scope=org for admins and 403s non-admins', async () => {
    await seedPool(ORG);
    const ok = await buildApp(userA).request(`${base}?scope=org`);
    expect(ok.status).toBe(200);
    expect((await ok.json()).accounts).toHaveLength(3);
    // The user pool is separate from the org pool.
    expect((await (await buildApp(userA).request(base)).json()).accounts).toEqual([]);

    isOrganizationAdmin.mockResolvedValue(false);
    const denied = await buildApp(userA).request(`${base}?scope=org`);
    expect(denied.status).toBe(403);
  });

  it('400s an unknown scope and 401s unauthenticated callers', async () => {
    expect((await buildApp(userA).request(`${base}?scope=team`)).status).toBe(400);
    expect((await buildApp(null).request(base)).status).toBe(401);
  });
});

describe('POST /accounts/:accountId/activate', () => {
  it('makes the account active and returns the pool', async () => {
    const [one, two] = await seedPool(USER_A);
    const res = await send(buildApp(userA), 'POST', accountPath(two!, '/activate'));
    expect(res.status).toBe(200);
    const { accounts } = await res.json();
    expect(accounts.find((a: { id: string }) => a.id === two).active).toBe(true);
    expect(accounts.find((a: { id: string }) => a.id === one).active).toBe(false);
    expect(await seed.credentials.getCredential(USER_A, 'openai-codex')).toMatchObject({ access: 'access-two' });
    expect(onCredentialsChanged).toHaveBeenCalledWith(USER_A);
    expect(JSON.stringify(accounts)).not.toContain('access-');
  });

  it('404s an unknown account and an account from another provider', async () => {
    await seedPool(USER_A);
    const anthropic = await seed.credentials.addAccount(USER_A, 'anthropic', {
      credential: { type: 'api_key', key: 'sk-ant' },
    });
    const app = buildApp(userA);
    expect((await send(app, 'POST', accountPath('openai-codex:missing', '/activate'))).status).toBe(404);
    expect((await send(app, 'POST', accountPath(anthropic.id, '/activate'))).status).toBe(404);
    expect(onCredentialsChanged).not.toHaveBeenCalled();
  });

  it("404s another member's account", async () => {
    const [, two] = await seedPool(USER_A);
    expect((await send(buildApp(userB), 'POST', accountPath(two!, '/activate'))).status).toBe(404);
    expect(await seed.credentials.getCredential(USER_A, 'openai-codex')).toMatchObject({ access: 'access-one' });
  });

  it('403s org-scope writes from non-admins', async () => {
    const [, two] = await seedPool(ORG);
    isOrganizationAdmin.mockResolvedValue(false);
    const res = await send(buildApp(userA), 'POST', accountPath(two!, '/activate?scope=org'));
    expect(res.status).toBe(403);
    expect(await seed.credentials.getCredential(ORG, 'openai-codex')).toMatchObject({ access: 'access-one' });
  });

  it('activates in the org pool for admins', async () => {
    const [, two] = await seedPool(ORG);
    const res = await send(buildApp(userA), 'POST', accountPath(two!, '/activate?scope=org'));
    expect(res.status).toBe(200);
    expect(await seed.credentials.getCredential(ORG, 'openai-codex')).toMatchObject({ access: 'access-two' });
    expect(onCredentialsChanged).toHaveBeenCalledWith(ORG);
  });
});

describe('PATCH /accounts/:accountId', () => {
  it('renames the account', async () => {
    const [one] = await seedPool(USER_A);
    const res = await send(buildApp(userA), 'PATCH', accountPath(one!), { label: '  Work  ' });
    expect(res.status).toBe(200);
    expect((await res.json()).accounts[0]).toMatchObject({ id: one, label: 'Work' });
    expect(onCredentialsChanged).toHaveBeenCalledWith(USER_A);
  });

  it('400s a missing or blank label and 404s an unknown account', async () => {
    const [one] = await seedPool(USER_A);
    const app = buildApp(userA);
    expect((await send(app, 'PATCH', accountPath(one!), {})).status).toBe(400);
    expect((await send(app, 'PATCH', accountPath(one!), { label: '   ' })).status).toBe(400);
    expect((await send(app, 'PATCH', accountPath('openai-codex:missing'), { label: 'x' })).status).toBe(404);
  });

  it('403s org-scope renames from non-admins', async () => {
    const [one] = await seedPool(ORG);
    isOrganizationAdmin.mockResolvedValue(false);
    expect((await send(buildApp(userA), 'PATCH', accountPath(one!, '?scope=org'), { label: 'x' })).status).toBe(403);
  });
});

describe('DELETE /accounts/:accountId', () => {
  it('removes only that account and promotes the next by priority when it was active', async () => {
    const [one, two, three] = await seedPool(USER_A);
    const res = await send(buildApp(userA), 'DELETE', accountPath(one!));
    expect(res.status).toBe(200);
    const { accounts } = await res.json();
    expect(accounts.map((a: { id: string; active: boolean }) => [a.id, a.active])).toEqual([
      [two, true],
      [three, false],
    ]);
    expect(await seed.credentials.getCredential(USER_A, 'openai-codex')).toMatchObject({ access: 'access-two' });
    expect(onCredentialsChanged).toHaveBeenCalledWith(USER_A);
  });

  it('404s an unknown account and 403s org-scope removal from non-admins', async () => {
    const [one] = await seedPool(ORG);
    expect((await send(buildApp(userA), 'DELETE', accountPath('openai-codex:missing'))).status).toBe(404);
    isOrganizationAdmin.mockResolvedValue(false);
    expect((await send(buildApp(userA), 'DELETE', accountPath(one!, '?scope=org'))).status).toBe(403);
    expect(await seed.credentials.listAccounts(ORG, 'openai-codex')).toHaveLength(3);
  });
});

describe('PUT /accounts/order', () => {
  it('puts listed ids first and keeps the rest in their current order', async () => {
    const [one, two, three] = await seedPool(USER_A);
    const res = await send(buildApp(userA), 'PUT', `${base}/order`, { orderedIds: [three] });
    expect(res.status).toBe(200);
    const { accounts } = await res.json();
    expect(accounts.map((a: { id: string }) => a.id)).toEqual([three, one, two]);
    expect(onCredentialsChanged).toHaveBeenCalledWith(USER_A);
  });

  it('400s unknown, duplicate, or malformed ids without reordering', async () => {
    const [one, two, three] = await seedPool(USER_A);
    const app = buildApp(userA);
    expect((await send(app, 'PUT', `${base}/order`, { orderedIds: [two, 'openai-codex:missing'] })).status).toBe(400);
    expect((await send(app, 'PUT', `${base}/order`, { orderedIds: [two, two] })).status).toBe(400);
    expect((await send(app, 'PUT', `${base}/order`, { orderedIds: 'nope' })).status).toBe(400);
    expect((await send(app, 'PUT', `${base}/order`, { orderedIds: [1] })).status).toBe(400);
    const accounts = await seed.credentials.listAccounts(USER_A, 'openai-codex');
    expect(accounts.map(a => a.id)).toEqual([one, two, three]);
    expect(onCredentialsChanged).not.toHaveBeenCalled();
  });

  it('403s org-scope reorders from non-admins', async () => {
    const [, two] = await seedPool(ORG);
    isOrganizationAdmin.mockResolvedValue(false);
    expect((await send(buildApp(userA), 'PUT', `${base}/order?scope=org`, { orderedIds: [two] })).status).toBe(403);
  });
});

describe('local mode (file-backed AuthStorage)', () => {
  let dir: string;
  let authStorage: AuthStorage;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'provider-accounts-'));
    authStorage = new AuthStorage(join(dir, 'auth.json'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function seedLocal() {
    for (const n of ['1', '2']) {
      authStorage.addAccount(
        'openai-codex',
        { access: `access-${n}`, refresh: `refresh-${n}`, expires: Date.now() + 1e6, accountId: `acct-${n}` },
        { label: `local-${n}` },
      );
    }
    return authStorage.listAccounts('openai-codex').map(a => a.id);
  }

  it('lists, activates, renames, reorders, and removes accounts without exposing tokens', async () => {
    const [first, second] = seedLocal();
    const app = buildApp(null, authStorage);

    const listed = await (await app.request(base)).json();
    expect(listed.accounts.map((a: { id: string }) => a.id)).toEqual([first, second]);
    expect(JSON.stringify(listed)).not.toContain('access-');

    expect((await send(app, 'POST', accountPath(first!, '/activate'))).status).toBe(200);
    expect(authStorage.getActiveAccount('openai-codex')?.id).toBe(first);

    expect((await send(app, 'PATCH', accountPath(first!), { label: 'Personal' })).status).toBe(200);
    expect(authStorage.listAccounts('openai-codex').find(a => a.id === first)?.label).toBe('Personal');

    const reordered = await (await send(app, 'PUT', `${base}/order`, { orderedIds: [second] })).json();
    expect(reordered.accounts.map((a: { id: string }) => a.id)).toEqual([second, first]);

    expect((await send(app, 'DELETE', accountPath(first!))).status).toBe(200);
    expect(authStorage.listAccounts('openai-codex').map(a => a.id)).toEqual([second]);
    expect((await send(app, 'DELETE', accountPath(first!))).status).toBe(404);
  });
});
