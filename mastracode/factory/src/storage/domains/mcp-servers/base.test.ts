import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import type { SerializableMCPToolDefinition } from '@mastra/mcp';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import { McpServerInputError, McpServerSlugConflictError, McpServersStorage } from './base.js';
import type { CreateMcpServerInput } from './base.js';

const testKey = { id: 'v1', key: new Uint8Array(32).fill(9) };
const BEARER = 'Bearer mcp-secret-token-4f9a2c';
const CLIENT_SECRET = 'oauth-client-secret-71b3e0';

async function makeStore(url = ':memory:', encryption?: FactorySecretEncryption) {
  const backend = new LibSQLFactoryStorage({ id: 'mcp-servers-test', url });
  const domain = backend.registerDomain(new McpServersStorage(encryption));
  await backend.init();
  onTestFinished(() => backend.close());
  return { backend, domain };
}

function tool(name: string): SerializableMCPToolDefinition {
  return {
    name,
    description: `${name} tool`,
    inputSchema: { type: 'object', properties: {} },
    server: { name: 'docs' },
  };
}

const headersServer: CreateMcpServerInput = {
  slug: 'docs',
  name: 'Docs',
  url: 'https://mcp.example.com/mcp',
  authType: 'headers',
  headers: { Authorization: BEARER },
};

const oauthServer: CreateMcpServerInput = {
  slug: 'tracker',
  name: 'Tracker',
  url: 'https://tracker.example.com/mcp',
  authType: 'oauth',
  oauth: { clientId: 'factory-client', clientSecret: CLIENT_SECRET, scopes: ['read'] },
};

describe('McpServersStorage', () => {
  it('only returns servers to the organization that owns them', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin-a', input: headersServer });

    expect((await mcpServers.list({ orgId: 'org-a' })).map(s => s.id)).toEqual([server.id]);
    expect(await mcpServers.list({ orgId: 'org-b' })).toEqual([]);
    expect(await mcpServers.get({ orgId: 'org-b', id: server.id })).toBeNull();
    expect(await mcpServers.update({ orgId: 'org-b', id: server.id, userId: 'b', input: { name: 'Hijacked' } })).toBe(
      null,
    );
    expect(await mcpServers.setSelectedTools({ orgId: 'org-b', id: server.id, userId: 'b', selected: [] })).toBeNull();
    expect(await mcpServers.delete({ orgId: 'org-b', id: server.id })).toBe(false);

    const unchanged = await mcpServers.get({ orgId: 'org-a', id: server.id });
    expect(unchanged?.name).toBe('Docs');
    expect(await mcpServers.countForOrg({ orgId: 'org-a' })).toBe(1);
    expect(await mcpServers.countForOrg({ orgId: 'org-b' })).toBe(0);
  });

  it('rejects a second server with the same slug in an organization but allows it in another', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: headersServer });

    await expect(mcpServers.create({ orgId: 'org-a', userId: 'admin', input: headersServer })).rejects.toBeInstanceOf(
      McpServerSlugConflictError,
    );
    const other = await mcpServers.create({ orgId: 'org-b', userId: 'admin', input: headersServer });
    expect(other.slug).toBe('docs');
  });

  it('stores header values, client secrets, and OAuth tokens encrypted and reads them back', async () => {
    const { backend, domain } = await makeStore(':memory:', createFactorySecretEncryption({ primary: testKey }));
    const headers = await domain.create({ orgId: 'org-a', userId: 'admin', input: headersServer });
    const oauth = await domain.create({ orgId: 'org-a', userId: 'admin', input: oauthServer });
    await domain.oauthStorage(oauth.id).set('tokens', JSON.stringify({ access_token: 'access-token-93ac1d' }));

    const rawHeaders = await backend.ops.findOne<Record<string, unknown>>('mcp_servers', { id: headers.id });
    const rawOAuth = await backend.ops.findOne<Record<string, unknown>>('mcp_servers', { id: oauth.id });
    const rawToken = await backend.ops.findOne<Record<string, unknown>>('mcp_server_oauth', { server_id: oauth.id });
    expect(rawHeaders!.headers).toMatch(/^mastra:factory-secret:v1:/);
    expect(rawOAuth!.oauth_client_secret).toMatch(/^mastra:factory-secret:v1:/);
    expect(rawToken!.value).toMatch(/^mastra:factory-secret:v1:/);
    const raw = JSON.stringify([rawHeaders, rawOAuth, rawToken]);
    expect(raw).not.toContain('mcp-secret-token-4f9a2c');
    expect(raw).not.toContain(CLIENT_SECRET);
    expect(raw).not.toContain('access-token-93ac1d');

    expect((await domain.get({ orgId: 'org-a', id: headers.id }))?.headers).toEqual({ Authorization: BEARER });
    expect((await domain.get({ orgId: 'org-a', id: oauth.id }))?.oauthClientSecret).toBe(CLIENT_SECRET);
    expect(await domain.oauthStorage(oauth.id).get('tokens')).toBe(
      JSON.stringify({ access_token: 'access-token-93ac1d' }),
    );
  });

  it('encrypts secrets written before encryption was configured on the next boot', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-mcp-')), 'enable-encryption.db')}`;
    let serverId: string;
    {
      const { backend, domain } = await makeStore(url);
      serverId = (await domain.create({ orgId: 'org-a', userId: 'admin', input: oauthServer })).id;
      await domain.oauthStorage(serverId).set('tokens', '{"access_token":"plain-token"}');
      const raw = await backend.ops.findOne<Record<string, unknown>>('mcp_servers', { id: serverId });
      expect(raw!.oauth_client_secret).toContain(CLIENT_SECRET);
      await backend.close();
    }

    for (let boot = 0; boot < 2; boot++) {
      const { backend, domain } = await makeStore(url, createFactorySecretEncryption({ primary: testKey }));
      expect((await domain.get({ orgId: 'org-a', id: serverId }))?.oauthClientSecret).toBe(CLIENT_SECRET);
      expect(await domain.oauthStorage(serverId).get('tokens')).toBe('{"access_token":"plain-token"}');
      const raw = await backend.ops.findOne<Record<string, unknown>>('mcp_servers', { id: serverId });
      const rawToken = await backend.ops.findOne<Record<string, unknown>>('mcp_server_oauth', { server_id: serverId });
      expect(raw!.oauth_client_secret).toMatch(/^mastra:factory-secret:v1:/);
      expect(rawToken!.value).toMatch(/^mastra:factory-secret:v1:/);
      await backend.close();
    }
  });

  it('keeps stored headers and tools when an edit does not touch them', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: headersServer });
    await mcpServers.saveDiscovery({ orgId: 'org-a', id: server.id, ifUrl: server.url, tools: [tool('search')] });

    const renamed = await mcpServers.update({
      orgId: 'org-a',
      id: server.id,
      userId: 'other-admin',
      input: { name: 'Docs search', url: 'https://mcp.example.com/v2/mcp' },
    });

    expect(renamed).toMatchObject({
      name: 'Docs search',
      slug: 'docs',
      url: 'https://mcp.example.com/v2/mcp',
      headers: { Authorization: BEARER },
      selectedTools: ['search'],
      status: 'connected',
      updatedBy: 'other-admin',
    });
  });

  it('never lets saved headers follow a server to a new origin', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: headersServer });
    await mcpServers.saveDiscovery({ orgId: 'org-a', id: server.id, ifUrl: server.url, tools: [tool('search')] });

    await expect(
      mcpServers.update({
        orgId: 'org-a',
        id: server.id,
        userId: 'admin',
        input: { url: 'https://attacker.example.net/mcp' },
      }),
    ).rejects.toBeInstanceOf(McpServerInputError);
    expect((await mcpServers.get({ orgId: 'org-a', id: server.id }))?.url).toBe(headersServer.url);

    const moved = await mcpServers.update({
      orgId: 'org-a',
      id: server.id,
      userId: 'admin',
      input: { url: 'https://docs.example.org/mcp', headers: { Authorization: 'Bearer new-token' } },
    });
    expect(moved).toMatchObject({
      url: 'https://docs.example.org/mcp',
      headers: { Authorization: 'Bearer new-token' },
      toolCatalog: null,
      selectedTools: [],
      newTools: [],
      status: 'unknown',
      discoveredAt: null,
    });
  });

  it('clears OAuth tokens and requires the client secret again when the origin changes', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: oauthServer });
    await mcpServers.oauthStorage(server.id).set('tokens', '{"access_token":"t"}');
    await mcpServers.saveDiscovery({ orgId: 'org-a', id: server.id, ifUrl: server.url, tools: [tool('issues')] });

    await expect(
      mcpServers.update({
        orgId: 'org-a',
        id: server.id,
        userId: 'admin',
        input: { url: 'https://new.example.com/mcp' },
      }),
    ).rejects.toBeInstanceOf(McpServerInputError);
    // The rejected edit rolled back: tokens and catalog are intact.
    expect(await mcpServers.oauthStorage(server.id).get('tokens')).toBe('{"access_token":"t"}');
    expect((await mcpServers.get({ orgId: 'org-a', id: server.id }))?.selectedTools).toEqual(['issues']);

    await mcpServers.setAuthorizationServerHosts({
      orgId: 'org-a',
      id: server.id,
      ifUrl: server.url,
      hosts: ['auth.example.com'],
    });
    await mcpServers.createFlow({
      nonce: 'pending-sign-in',
      orgId: 'org-a',
      userId: 'admin',
      serverId: server.id,
      factoryProjectId: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const moved = await mcpServers.update({
      orgId: 'org-a',
      id: server.id,
      userId: 'admin',
      input: { url: 'https://new.example.com/mcp', oauth: { clientSecret: 'new-secret' } },
    });
    expect(moved).toMatchObject({
      oauthClientId: 'factory-client',
      oauthClientSecret: 'new-secret',
      toolCatalog: null,
      selectedTools: [],
      status: 'unknown',
      authorizationServerHosts: [],
    });
    expect(await mcpServers.oauthStorage(server.id).get('tokens')).toBeUndefined();
    // A sign-in started for the old address can no longer finish.
    expect(await mcpServers.consumeFlow('pending-sign-in')).toBeNull();
  });

  it('clears OAuth tokens when the client ID changes or the server stops using OAuth', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: oauthServer });
    await mcpServers.oauthStorage(server.id).set('tokens', '{"access_token":"t"}');

    const rescoped = await mcpServers.update({
      orgId: 'org-a',
      id: server.id,
      userId: 'admin',
      input: { oauth: { scopes: ['read', 'write'] } },
    });
    expect(rescoped).toMatchObject({ oauthScopes: ['read', 'write'], oauthClientSecret: CLIENT_SECRET });
    expect(await mcpServers.oauthStorage(server.id).get('tokens')).toBe('{"access_token":"t"}');

    const newClient = await mcpServers.update({
      orgId: 'org-a',
      id: server.id,
      userId: 'admin',
      input: { oauth: { clientId: 'other-client' } },
    });
    expect(newClient).toMatchObject({ oauthClientId: 'other-client', oauthClientSecret: null, status: 'unknown' });
    expect(await mcpServers.oauthStorage(server.id).get('tokens')).toBeUndefined();

    await mcpServers.oauthStorage(server.id).set('tokens', '{"access_token":"t2"}');
    const plain = await mcpServers.update({
      orgId: 'org-a',
      id: server.id,
      userId: 'admin',
      input: { authType: 'none' },
    });
    expect(plain).toMatchObject({ authType: 'none', oauthClientId: null, oauthScopes: [], headers: null });
    expect(await mcpServers.oauthStorage(server.id).get('tokens')).toBeUndefined();
  });

  it('requires headers when switching a server to header authentication', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({
      orgId: 'org-a',
      userId: 'admin',
      input: { slug: 'open', name: 'Open', url: 'https://open.example.com/mcp', authType: 'none' },
    });
    await expect(
      mcpServers.update({ orgId: 'org-a', id: server.id, userId: 'admin', input: { authType: 'headers' } }),
    ).rejects.toThrow('Add at least one header.');
  });

  it('selects every tool on first discovery and never auto-selects tools added later', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: headersServer });
    const discover = (names: string[]) =>
      mcpServers.saveDiscovery({ orgId: 'org-a', id: server.id, ifUrl: server.url, tools: names.map(tool) });

    const first = await discover(['echo', 'add']);
    expect(first).toMatchObject({ status: 'connected', selectedTools: ['echo', 'add'], newTools: [] });
    expect(first!.toolCatalog!.echo!.exposedName).toBe('docs_echo');
    expect(first!.discoveredAt).toBeInstanceOf(Date);

    await mcpServers.setSelectedTools({ orgId: 'org-a', id: server.id, userId: 'admin', selected: ['echo'] });

    // `add` was deliberately deselected; `search` is new and stays off until reviewed.
    const refreshed = await discover(['echo', 'add', 'search']);
    expect(refreshed).toMatchObject({ selectedTools: ['echo'], newTools: ['search'] });

    // `echo` disappeared from the server; `search` is still awaiting review.
    const shrunk = await discover(['add', 'search']);
    expect(shrunk).toMatchObject({ selectedTools: [], newTools: ['search'] });
    expect(Object.keys(shrunk!.toolCatalog!)).toEqual(['add', 'search']);

    const reviewed = await mcpServers.setSelectedTools({
      orgId: 'org-a',
      id: server.id,
      userId: 'admin',
      selected: ['search'],
    });
    expect(reviewed).toMatchObject({ selectedTools: ['search'], newTools: [] });

    await expect(
      mcpServers.setSelectedTools({ orgId: 'org-a', id: server.id, userId: 'admin', selected: ['search', 'rm_rf'] }),
    ).rejects.toThrow('Unknown tools: rm_rf');
    expect((await mcpServers.get({ orgId: 'org-a', id: server.id }))?.selectedTools).toEqual(['search']);
  });

  it('discards discovery results and status from an address the server no longer has', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: headersServer });
    await mcpServers.update({
      orgId: 'org-a',
      id: server.id,
      userId: 'admin',
      input: { url: 'https://docs.example.org/mcp', headers: { Authorization: 'Bearer new' } },
    });

    expect(
      await mcpServers.saveDiscovery({ orgId: 'org-a', id: server.id, ifUrl: server.url, tools: [tool('stale')] }),
    ).toBeNull();
    expect(
      await mcpServers.setStatus({ orgId: 'org-a', id: server.id, status: 'error', lastError: 'x', ifUrl: server.url }),
    ).toBeNull();
    expect(await mcpServers.get({ orgId: 'org-a', id: server.id })).toMatchObject({
      toolCatalog: null,
      status: 'unknown',
      lastError: null,
    });
  });

  it('keeps OAuth state per server', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const serverA = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: oauthServer });
    const serverB = await mcpServers.create({
      orgId: 'org-a',
      userId: 'admin',
      input: { ...oauthServer, slug: 'other', name: 'Other' },
    });
    const a = mcpServers.oauthStorage(serverA.id);
    const b = mcpServers.oauthStorage(serverB.id);
    await a.set('tokens', 'a-tokens');
    await a.set('tokens', 'a-tokens-refreshed');
    await a.set('code_verifier', 'verifier');
    await b.set('tokens', 'b-tokens');

    expect(await a.get('tokens')).toBe('a-tokens-refreshed');
    expect(await b.get('tokens')).toBe('b-tokens');
    await a.delete('code_verifier');
    expect(await a.get('code_verifier')).toBeUndefined();

    expect(await mcpServers.hasOAuthTokens(serverA.id)).toBe(true);
    await mcpServers.setAuthorizationServerHosts({
      orgId: 'org-a',
      id: serverA.id,
      ifUrl: serverA.url,
      hosts: ['auth.example.com', 'auth.example.com', 'tokens.example.com'],
    });
    await mcpServers.createFlow({
      nonce: 'pending-a',
      orgId: 'org-a',
      userId: 'admin',
      serverId: serverA.id,
      factoryProjectId: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect((await mcpServers.get({ orgId: 'org-a', id: serverA.id }))?.authorizationServerHosts).toEqual([
      'auth.example.com',
      'tokens.example.com',
    ]);

    // Another organization cannot sign the server out.
    expect(await mcpServers.disconnectOAuth({ orgId: 'org-b', id: serverA.id })).toBeNull();
    expect(await a.get('tokens')).toBe('a-tokens-refreshed');

    expect(await mcpServers.disconnectOAuth({ orgId: 'org-a', id: serverA.id })).toMatchObject({
      status: 'needs_auth',
      lastError: 'Sign in to connect this server.',
      authorizationServerHosts: [],
    });
    expect(await a.get('tokens')).toBeUndefined();
    expect(await mcpServers.hasOAuthTokens(serverA.id)).toBe(false);
    expect(await mcpServers.consumeFlow('pending-a')).toBeNull();
    expect(await b.get('tokens')).toBe('b-tokens');
  });

  it('lets an OAuth sign-in flow complete once and never after it expires', async () => {
    const { mcpServers } = await createFactoryStorageForTests();
    const now = new Date('2026-11-04T12:00:00Z');
    const flow = {
      orgId: 'org-a',
      userId: 'admin',
      serverId: 'server-1',
      factoryProjectId: 'project-1',
      expiresAt: new Date(now.getTime() + 10 * 60_000),
    };
    await mcpServers.createFlow({ ...flow, nonce: 'nonce-1' });
    await mcpServers.createFlow({ ...flow, nonce: 'nonce-2', expiresAt: new Date(now.getTime() - 1) });

    expect(await mcpServers.consumeFlow('nonce-1', now)).toMatchObject({
      nonce: 'nonce-1',
      orgId: 'org-a',
      userId: 'admin',
      serverId: 'server-1',
      factoryProjectId: 'project-1',
    });
    expect(await mcpServers.consumeFlow('nonce-1', now)).toBeNull();
    expect(await mcpServers.consumeFlow('nonce-2', now)).toBeNull();
    expect(await mcpServers.consumeFlow('unknown', now)).toBeNull();
  });

  it('removes OAuth state and pending sign-ins with the server', async () => {
    const { storage, mcpServers } = await createFactoryStorageForTests();
    const server = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: oauthServer });
    const other = await mcpServers.create({ orgId: 'org-a', userId: 'admin', input: headersServer });
    await mcpServers.oauthStorage(server.id).set('tokens', 't');
    await mcpServers.oauthStorage(other.id).set('tokens', 'other');
    await mcpServers.createFlow({
      nonce: 'pending',
      orgId: 'org-a',
      userId: 'admin',
      serverId: server.id,
      factoryProjectId: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await mcpServers.delete({ orgId: 'org-a', id: server.id })).toBe(true);

    expect(await mcpServers.get({ orgId: 'org-a', id: server.id })).toBeNull();
    expect(await storage.ops.findMany('mcp_server_oauth', { server_id: server.id })).toEqual([]);
    expect(await storage.ops.findMany('mcp_server_oauth_flows', { server_id: server.id })).toEqual([]);
    expect(await mcpServers.oauthStorage(other.id).get('tokens')).toBe('other');
  });
});
