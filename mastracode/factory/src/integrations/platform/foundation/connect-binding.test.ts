import { MastraConnectError } from '@mastra/connect';
import { describe, expect, it, vi } from 'vitest';

import { PlatformConnectBinding, PlatformConnectionNotConnectedError } from './connect-binding.js';
import { problem, startFakePlatform } from './test-utils.js';
import type { FakePlatform } from './test-utils.js';

const LISTING = '/v2/projects/proj_factory/connections';

async function jiraPlatform(): Promise<FakePlatform> {
  const platform = await startFakePlatform();
  platform.orgConnections = [
    { id: 'conn-jira', integrationId: 'jira', status: 'active', accountLabel: 'acme' },
    { id: 'conn-jira-reauth', integrationId: 'jira', status: 'needs_reauth' },
    { id: 'conn-jira-pending', integrationId: 'jira', status: 'pending' },
    { id: 'conn-linear', integrationId: 'linear', status: 'active' },
  ];
  for (const connection of platform.orgConnections) platform.linked.add(connection.id);
  return platform;
}

function binding(
  platform: FakePlatform,
  options: Partial<ConstructorParameters<typeof PlatformConnectBinding>[0]> = {},
) {
  return new PlatformConnectBinding({
    integrationId: 'jira',
    providerKeys: ['jira'],
    connect: platform.connect(),
    ...options,
  });
}

describe('PlatformConnectBinding connection listing', () => {
  it("lists the project's usable connections for its providers, not other providers' or unusable ones", async () => {
    const platform = await jiraPlatform();

    await expect(binding(platform).listConnections()).resolves.toEqual([
      {
        id: 'conn-jira',
        integrationId: 'jira',
        status: 'active',
        accountLabel: 'acme',
        resourceId: null,
        connectedAt: null,
      },
      {
        id: 'conn-jira-reauth',
        integrationId: 'jira',
        status: 'needs_reauth',
        accountLabel: null,
        resourceId: null,
        connectedAt: null,
      },
    ]);
    expect(platform.count('GET', '/v2/connections')).toBe(0);
  });

  it('applies the integration filter on top of the provider keys', async () => {
    const platform = await jiraPlatform();
    const filtered = binding(platform, { filter: connection => connection.status === 'active' });

    await expect(filtered.listConnections()).resolves.toMatchObject([{ id: 'conn-jira' }]);
    await expect(filtered.activeConnections()).resolves.toMatchObject([{ id: 'conn-jira' }]);
  });

  it('reuses one listing until it expires, is invalidated, or a fresh read is asked for', async () => {
    const platform = await jiraPlatform();
    let now = 1_000;
    const cached = binding(platform, { cacheTtlMs: 30_000, now: () => now });

    await cached.listConnections();
    await cached.listConnections();
    expect(platform.count('GET', LISTING)).toBe(1);

    await cached.listConnections({ fresh: true });
    expect(platform.count('GET', LISTING)).toBe(2);

    cached.invalidateConnections();
    await cached.listConnections();
    expect(platform.count('GET', LISTING)).toBe(3);

    now += 30_000;
    await cached.listConnections();
    expect(platform.count('GET', LISTING)).toBe(4);
  });

  it('does not keep serving a listing that failed', async () => {
    const platform = await jiraPlatform();
    platform.nextListingReplies.push(problem(503, 'unavailable'));
    const jira = binding(platform);

    await expect(jira.listConnections()).rejects.toMatchObject({ status: 503 });
    await expect(jira.listConnections()).resolves.toMatchObject([{ id: 'conn-jira' }, { id: 'conn-jira-reauth' }]);
  });

  it('finds the first active connection for a provider key, never one that needs reauthentication', async () => {
    const platform = await jiraPlatform();
    const jira = binding(platform);

    await expect(jira.connectionFor('jira')).resolves.toMatchObject({ id: 'conn-jira' });
    await expect(jira.connectionFor('jira', c => c.accountLabel === 'acme')).resolves.toMatchObject({
      id: 'conn-jira',
    });
    await expect(jira.connectionFor('jira', c => c.id === 'conn-jira-reauth')).resolves.toBeNull();
    await expect(jira.connectionFor('linear')).resolves.toBeNull();
  });
});

describe('PlatformConnectBinding proxy', () => {
  it('reports a connection the platform says needs reauthentication as not connected, and re-reads the listing', async () => {
    const platform = await jiraPlatform();
    platform.proxy = () => problem(409, 'connection_needs_reauth');
    const jira = binding(platform);
    await jira.listConnections();

    const error = await jira.proxy('conn-jira', { method: 'GET', path: '/rest/api/3/myself' }).catch(e => e);
    expect(error).toBeInstanceOf(PlatformConnectionNotConnectedError);
    expect(error).toMatchObject({ status: 401, connectionId: 'conn-jira' });

    await jira.listConnections();
    expect(platform.count('GET', LISTING)).toBe(2);
  });

  it("leaves a provider's own 409 as the provider's error and keeps the listing", async () => {
    const platform = await jiraPlatform();
    platform.proxy = () => ({ status: 409, body: { errorMessages: ['Issue is being edited'] } });
    const jira = binding(platform);
    await jira.listConnections();

    const error = await jira.proxy('conn-jira', { method: 'PUT', path: '/rest/api/3/issue/A-1' }).catch(e => e);
    expect(error).toBeInstanceOf(MastraConnectError);
    expect(error).toMatchObject({ status: 409, source: 'provider' });

    await jira.listConnections();
    expect(platform.count('GET', LISTING)).toBe(1);
  });

  it('keeps other platform conflicts as platform errors', async () => {
    const platform = await jiraPlatform();
    platform.proxy = () => problem(409, 'connection_pending');
    const error = await binding(platform)
      .proxy('conn-jira', { method: 'GET', path: '/rest/api/3/myself' })
      .catch(e => e);
    expect(error).toBeInstanceOf(MastraConnectError);
    expect(error).toMatchObject({ status: 409, source: 'platform', problemCode: 'connection_pending' });
  });

  it('maps the same way for provider clients that speak HTTP through proxyFetch', async () => {
    const platform = await jiraPlatform();
    const jira = binding(platform);
    const fetch = jira.proxyFetch();
    const url = `${jira.proxyBaseUrl('conn-jira')}/rest/api/3/myself`;

    platform.proxy = () => ({ status: 200, body: { accountId: 'a-1' } });
    await expect((await fetch(url)).json()).resolves.toEqual({ accountId: 'a-1' });

    platform.proxy = () => ({ status: 409, body: { errorMessages: ['conflict'] } });
    const providerConflict = await fetch(url);
    expect(providerConflict.status).toBe(409);
    await expect(providerConflict.json()).resolves.toEqual({ errorMessages: ['conflict'] });

    await jira.listConnections();
    platform.proxy = () => problem(409, 'connection_needs_reauth');
    await expect(fetch(url)).rejects.toMatchObject({
      name: 'PlatformConnectionNotConnectedError',
      connectionId: 'conn-jira',
    });
    await jira.listConnections();
    expect(platform.count('GET', LISTING)).toBe(2);
  });
});

describe('PlatformConnectBinding.linkOrgConnections', () => {
  async function orgPlatform(): Promise<FakePlatform> {
    const platform = await startFakePlatform();
    platform.orgConnections = [
      { id: 'conn-linked', integrationId: 'jira', status: 'active' },
      { id: 'conn-unlinked', integrationId: 'jira', status: 'active' },
      { id: 'conn-reauth', integrationId: 'jira', status: 'needs_reauth' },
      { id: 'conn-revoked', integrationId: 'jira', status: 'disconnected' },
      { id: 'conn-user', integrationId: 'jira', status: 'active', resourceId: 'user-1' },
      { id: 'conn-other', integrationId: 'linear', status: 'active' },
    ];
    platform.linked.add('conn-linked');
    return platform;
  }

  it("links the org's unlinked global connections for its providers, once", async () => {
    const platform = await orgPlatform();
    const jira = binding(platform);

    await expect(jira.linkOrgConnections()).resolves.toEqual({
      linked: ['conn-unlinked', 'conn-reauth'],
      needsLinking: [],
    });
    expect([...platform.linked].sort()).toEqual(['conn-linked', 'conn-reauth', 'conn-unlinked']);

    const posts = platform.requests.filter(request => request.method === 'POST').length;
    await expect(jira.linkOrgConnections()).resolves.toEqual({ linked: [], needsLinking: [] });
    expect(platform.requests.filter(request => request.method === 'POST')).toHaveLength(posts);
  });

  it('reports refused links with the remedy instead of dropping the connection', async () => {
    const platform = await orgPlatform();
    platform.linkReplies.set('conn-unlinked', problem(403, 'forbidden', 'Missing integrations:write'));
    const jira = binding(platform);

    const result = await jira.linkOrgConnections();

    expect(result.linked).toEqual(['conn-reauth']);
    expect(result.needsLinking).toEqual([
      { connectionId: 'conn-unlinked', reason: expect.stringContaining('integrations:write') },
    ]);
    expect(jira.needsLinking).toEqual(result.needsLinking);
  });

  it('retries transient failures on request but not permission refusals', async () => {
    const platform = await orgPlatform();
    platform.linkReplies.set('conn-unlinked', problem(403, 'forbidden'));
    platform.nextLinkReplies.set('conn-reauth', [problem(503, 'unavailable', 'store unavailable')]);
    const jira = binding(platform);

    const first = await jira.linkOrgConnections();
    expect(first.needsLinking.map(entry => entry.connectionId).sort()).toEqual(['conn-reauth', 'conn-unlinked']);

    const retry = await jira.linkOrgConnections({ retryOnly: 'transient' });
    expect(retry).toEqual({
      linked: ['conn-reauth'],
      needsLinking: [{ connectionId: 'conn-unlinked', reason: expect.stringContaining('integrations:write') }],
    });
    expect(platform.count('POST', '/v2/projects/proj_factory/connections/conn-unlinked')).toBe(1);
  });

  it('clears an entry once the connection shows up linked', async () => {
    const platform = await orgPlatform();
    platform.linkReplies.set('conn-unlinked', problem(403, 'forbidden'));
    const jira = binding(platform);
    await jira.linkOrgConnections();

    // An admin links it in Mastra Platform.
    platform.linked.add('conn-unlinked');
    await jira.linkOrgConnections();

    expect(jira.needsLinking).toEqual([]);
  });

  it('invalidates the listing and notifies listeners only when it links something', async () => {
    const platform = await orgPlatform();
    const jira = binding(platform);
    const listener = vi.fn();
    jira.onConnectionsLinked(listener);

    await expect(jira.listConnections()).resolves.toMatchObject([{ id: 'conn-linked' }]);
    await jira.linkOrgConnections();
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(jira.listConnections()).resolves.toMatchObject([
      { id: 'conn-linked' },
      { id: 'conn-unlinked' },
      { id: 'conn-reauth' },
    ]);

    await jira.linkOrgConnections();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('makes reads wait for boot linking, so they never see the pre-link listing', async () => {
    const platform = await orgPlatform();
    const jira = binding(platform, { linkOrgConnectionsAtBoot: true });

    void jira.ensureBootLinked();
    const listed = await jira.listConnections();

    expect(listed.map(connection => connection.id)).toEqual(['conn-linked', 'conn-unlinked', 'conn-reauth']);
    expect(platform.count('GET', LISTING)).toBe(2);
  });

  it('settles boot linking when the platform refuses, keeping the refusal in needsLinking', async () => {
    const platform = await orgPlatform();
    platform.linkReplies.set('conn-unlinked', problem(403, 'forbidden'));
    platform.linkReplies.set('conn-reauth', problem(403, 'forbidden'));
    const jira = binding(platform, { linkOrgConnectionsAtBoot: true });

    await jira.ensureBootLinked();

    await expect(jira.listConnections()).resolves.toMatchObject([{ id: 'conn-linked' }]);
    expect(jira.needsLinking.map(entry => entry.connectionId)).toEqual(['conn-unlinked', 'conn-reauth']);
  });

  it('does not link anything at boot unless the integration opted in', async () => {
    const platform = await orgPlatform();
    const jira = binding(platform);

    await jira.ensureBootLinked();

    expect(platform.count('GET', '/v2/connections')).toBe(0);
    expect(platform.linked.size).toBe(1);
  });
});
