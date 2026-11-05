import { MCPClient } from '@mastra/mcp';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { CreateMcpServerInput } from '../storage/domains/mcp-servers/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { McpServersRuntime } from './runtime.js';
import { startTestMcpServer } from './test-utils.js';

const TOKEN = 'mcp-test-token-5be1f0a7';

async function setup({ allowPrivateNetwork = true }: { allowPrivateNetwork?: boolean } = {}) {
  const { mcpServers } = await createFactoryStorageForTests();
  const runtime = new McpServersRuntime({ storage: mcpServers, allowPrivateNetwork });
  onTestFinished(() => runtime.close());
  return { storage: mcpServers, runtime };
}

function bearerServer(url: string, token = TOKEN, slug = 'docs'): CreateMcpServerInput {
  return { slug, name: slug, url, authType: 'headers', headers: { Authorization: `Bearer ${token}` } };
}

/** Create a server in `orgId` and persist a real discovery, as the Connect button does. */
async function connectServer(
  { storage, runtime }: Awaited<ReturnType<typeof setup>>,
  orgId: string,
  input: CreateMcpServerInput,
) {
  const record = await storage.create({ orgId, userId: 'admin', input });
  const result = await runtime.discover(record);
  if (result.status !== 'connected') throw new Error(`discovery failed: ${result.error}`);
  const saved = await storage.saveDiscovery({
    orgId,
    id: record.id,
    ifUpdatedAt: record.updatedAt,
    tools: result.tools,
  });
  return saved!;
}

describe('McpServersRuntime.discover', () => {
  it('lists the tools of a server that accepts the saved bearer token', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const record = await ctx.storage.create({ orgId: 'org-a', userId: 'admin', input: bearerServer(server.url) });

    const result = await ctx.runtime.discover(record);

    expect(result.status).toBe('connected');
    const tools = result.status === 'connected' ? result.tools : [];
    expect(tools.map(tool => tool.name).sort()).toEqual(['add', 'echo']);
    expect(tools.find(tool => tool.name === 'echo')).toMatchObject({
      description: 'Echo text back.',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
    });
    expect(JSON.stringify(tools)).not.toContain(TOKEN);

    const saved = await ctx.storage.saveDiscovery({
      orgId: 'org-a',
      id: record.id,
      ifUpdatedAt: record.updatedAt,
      tools,
    });
    expect(saved!.toolCatalog!.echo!.exposedName).toBe('docs_echo');
    expect(saved!.toolCatalog!.add!.exposedName).toBe('docs_add');
  });

  it('reports that the server needs credentials when the token is wrong or missing', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const wrong = await ctx.storage.create({
      orgId: 'org-a',
      userId: 'admin',
      input: bearerServer(server.url, 'wrong-token-91d2c4'),
    });
    const missing = await ctx.storage.create({
      orgId: 'org-a',
      userId: 'admin',
      input: { slug: 'open', name: 'open', url: server.url, authType: 'none' },
    });

    const wrongResult = await ctx.runtime.discover(wrong);
    const missingResult = await ctx.runtime.discover(missing);

    expect(wrongResult).toEqual({
      status: 'needs_auth',
      error: 'The server rejected the saved credentials (HTTP 401). Update the headers and connect again.',
    });
    expect(missingResult).toEqual({ status: 'needs_auth', error: 'The server requires authentication (HTTP 401).' });
    expect(server.calls).toEqual([]);
  });

  it('reports an unreachable server without leaking the saved credentials', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    await server.close();
    const ctx = await setup();
    const record = await ctx.storage.create({ orgId: 'org-a', userId: 'admin', input: bearerServer(server.url) });

    const result = await ctx.runtime.discover(record);

    expect(result.status).toBe('error');
    const error = result.status === 'connected' ? '' : result.error;
    expect(error).toBe('Could not reach the server. Check the URL and that the server is running.');
    expect(error).not.toContain(TOKEN);
  });

  it('refuses to contact a server on a private address unless private networks are allowed', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup({ allowPrivateNetwork: false });
    // Stored before the policy tightened (or by a host that allowed it); requests are re-checked.
    const record = await ctx.storage.create({ orgId: 'org-a', userId: 'admin', input: bearerServer(server.url) });

    const result = await ctx.runtime.discover(record);

    expect(result).toEqual({
      status: 'error',
      error: `Requests to "${server.host}" were blocked because they do not use https.`,
    });
    expect(server.methods).toEqual([]);
  });

  it('leaves out tools whose names are too long to select, and refuses a catalog too large to store', async () => {
    const tooLong = 'x'.repeat(257);
    const named = await startTestMcpServer({ bearerToken: TOKEN, extraToolNames: [tooLong, 'y'.repeat(256)] });
    const huge = await startTestMcpServer({
      bearerToken: TOKEN,
      extraToolNames: ['first', 'second', 'third'],
      extraToolDescription: 'd'.repeat(800 * 1024),
    });
    const ctx = await setup();
    const store = (url: string, slug: string) =>
      ctx.storage.create({ orgId: 'org-a', userId: 'admin', input: bearerServer(url, TOKEN, slug) });

    const listed = await ctx.runtime.discover(await store(named.url, 'named'));
    expect(listed.status === 'connected' && listed.tools.map(tool => tool.name).sort()).toEqual([
      'add',
      'echo',
      'y'.repeat(256),
    ]);
    expect(await ctx.runtime.discover(await store(huge.url, 'huge'))).toEqual({
      status: 'error',
      error: "The server's tool descriptions are larger than the 2 MB supported.",
    });
  });
});

describe('McpServersRuntime.toolsFor', () => {
  it('gives an organization the selected tools of its servers, and calling one reaches the server', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const record = await connectServer(ctx, 'org-a', bearerServer(server.url));
    await ctx.storage.setSelectedTools({ orgId: 'org-a', id: record.id, userId: 'admin', selected: ['echo'] });

    const { tools, skipped } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    expect(Object.keys(tools)).toEqual(['docs_echo']);
    expect(skipped).toEqual([]);
    const result = await tools.docs_echo!.execute!({ text: 'hello from factory' }, {} as never);
    expect(JSON.stringify(result)).toContain('hello from factory');
    expect(server.calls).toEqual([{ tool: 'echo', args: { text: 'hello from factory' } }]);
  });

  it("never gives one organization another organization's servers", async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    await connectServer(ctx, 'org-a', bearerServer(server.url));

    const other = await ctx.runtime.toolsFor({ orgId: 'org-b', existingNames: new Set() });
    const own = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    expect(other.tools).toEqual({});
    expect(Object.keys(own.tools).sort()).toEqual(['docs_add', 'docs_echo']);
  });

  it('skips servers that are not connected or have no tools selected', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const failing = await connectServer(ctx, 'org-a', bearerServer(server.url, TOKEN, 'failing'));
    await ctx.storage.setStatus({
      orgId: 'org-a',
      id: failing.id,
      status: 'needs_auth',
      ifUpdatedAt: failing.updatedAt,
    });
    const empty = await connectServer(ctx, 'org-a', bearerServer(server.url, TOKEN, 'empty'));
    await ctx.storage.setSelectedTools({ orgId: 'org-a', id: empty.id, userId: 'admin', selected: [] });
    await ctx.storage.create({ orgId: 'org-a', userId: 'admin', input: bearerServer(server.url, TOKEN, 'new') });
    await connectServer(ctx, 'org-a', bearerServer(server.url, TOKEN, 'live'));

    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    expect(Object.keys(tools).sort()).toEqual(['live_add', 'live_echo']);
  });

  it('connects a server named like an object built-in and gives sessions its tools named like ones', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN, extraToolNames: ['constructor', 'toString'] });
    const ctx = await setup();
    const record = await connectServer(ctx, 'org-a', bearerServer(server.url, TOKEN, 'constructor'));
    expect(Object.keys(record.toolCatalog!).sort()).toEqual(['add', 'constructor', 'echo', 'toString']);

    const { tools, skipped } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    expect(skipped).toEqual([]);
    expect(Object.keys(tools).sort()).toEqual([
      'constructor_add',
      'constructor_constructor',
      'constructor_echo',
      'constructor_toString',
    ]);
    await tools.constructor_toString!.execute!({ text: 'hi' }, {} as never);
    expect(server.calls).toEqual([{ tool: 'toString', args: { text: 'hi' } }]);
  });

  it('does not rebuild a connection from a read that was in flight when the server changed', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const record = await connectServer(ctx, 'org-a', bearerServer(server.url));

    // The routes invalidate after every change; this turn's read began before that one.
    const turn = ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    ctx.runtime.invalidate(record.id);

    expect((await turn).tools).toEqual({});
    const next = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
    expect(Object.keys(next.tools).sort()).toEqual(['docs_add', 'docs_echo']);
  });

  it('skips a tool whose name is already taken instead of failing the session', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const record = await connectServer(ctx, 'org-a', bearerServer(server.url));

    const { tools, skipped } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set(['docs_echo']) });

    expect(Object.keys(tools)).toEqual(['docs_add']);
    expect(skipped).toEqual([
      { serverId: record.id, toolName: 'echo', exposedName: 'docs_echo', reason: 'name_conflict' },
    ]);
  });

  it("never lets a server tool take a built-in or Factory tool's name, and with it that tool's approval rule", async () => {
    // `web_search` runs without approval, `ask_user` never asks, `delete_file`
    // is a built-in, and `factory_*` tools are allowed on every Factory session.
    const server = await startTestMcpServer({ bearerToken: TOKEN, extraToolNames: ['search', 'user', 'file'] });
    const ctx = await setup();
    for (const slug of ['web', 'ask', 'delete', 'factory']) {
      await connectServer(ctx, 'org-a', bearerServer(server.url, TOKEN, slug));
    }

    const { tools, skipped } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    const reserved = skipped.filter(skip => skip.reason === 'reserved_name').map(skip => skip.exposedName);
    expect(reserved.sort()).toEqual([
      'ask_user',
      'delete_file',
      'factory_add',
      'factory_echo',
      'factory_file',
      'factory_search',
      'factory_user',
      'web_search',
    ]);
    expect(skipped).toHaveLength(reserved.length);
    expect(Object.keys(tools).sort()).toEqual([
      'ask_add',
      'ask_echo',
      'ask_file',
      'ask_search',
      'delete_add',
      'delete_echo',
      'delete_search',
      'delete_user',
      'web_add',
      'web_echo',
      'web_file',
      'web_user',
    ]);
  });

  it('reuses one connection per server until the server changes, then replaces it', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const record = await connectServer(ctx, 'org-a', bearerServer(server.url));
    server.methods.length = 0;
    const disconnect = vi.spyOn(MCPClient.prototype, 'disconnect');
    onTestFinished(() => disconnect.mockRestore());

    // `server/discover` (or `initialize` on older protocol versions) opens each connection.
    const handshakes = () => server.methods.filter(method => method === 'server/discover' || method === 'initialize');
    const turn = async (text: string) => {
      const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });
      await tools.docs_echo!.execute!({ text }, {} as never);
    };
    await turn('one');
    await turn('two');
    expect(handshakes()).toHaveLength(1);
    expect(disconnect).not.toHaveBeenCalled();

    await ctx.storage.update({ orgId: 'org-a', id: record.id, userId: 'admin', input: { name: 'Docs v2' } });
    await turn('three');

    expect(handshakes()).toHaveLength(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(server.calls.map(call => call.args)).toEqual([{ text: 'one' }, { text: 'two' }, { text: 'three' }]);
  });

  it('releases the connection of a server that was removed', async () => {
    const server = await startTestMcpServer({ bearerToken: TOKEN });
    const ctx = await setup();
    const record = await connectServer(ctx, 'org-a', bearerServer(server.url));
    const disconnect = vi.spyOn(MCPClient.prototype, 'disconnect');
    onTestFinished(() => disconnect.mockRestore());
    await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    // Deleted elsewhere (another replica): the next turn in the org notices.
    await ctx.storage.delete({ orgId: 'org-a', id: record.id });
    const { tools } = await ctx.runtime.toolsFor({ orgId: 'org-a', existingNames: new Set() });

    expect(tools).toEqual({});
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
