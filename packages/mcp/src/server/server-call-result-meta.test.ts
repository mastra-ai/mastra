/**
 * Successful `tools/call` results carry the MCP App link a tool declares, the
 * same link `tools/list` advertises (Issue #21277).
 */
import { createTool } from '@mastra/core/tools';
import type { Client } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InternalMastraMCPClient, getMcpCallToolMeta } from '../client/client';
import { connectClient, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const APP = 'ui://calculator/main';
const OTHER_APP = 'ui://calculator/other';
const linkTo = (resourceUri: string) => ({ ui: { resourceUri }, 'ui/resourceUri': resourceUri });

/** The `_meta` the server put on a message, without the protocol's own `io.modelcontextprotocol/*` keys. */
function ownMeta(message: { _meta?: Record<string, unknown> }): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(message._meta ?? {}).filter(([key]) => !key.startsWith('io.modelcontextprotocol/')),
  );
}

function createServer(tools: ConstructorParameters<typeof MCPServer>[0]['tools']) {
  return new MCPServer({ name: 'CallResultMetaTestServer', version: '1.0.0', tools });
}

describe('MCPServer tools/call result _meta (Issue #21277)', () => {
  let served: ServedHTTP;
  let client: Client;

  beforeAll(async () => {
    served = await serveHTTP(
      createServer({
        linked: createTool({
          id: 'linked',
          description: 'Declares an MCP App link',
          inputSchema: z.object({}),
          mcp: { _meta: { ui: { resourceUri: APP } } },
          execute: async () => ({ ok: true }),
        }),
        linkedStructured: createTool({
          id: 'linked-structured',
          description: 'Declares an MCP App link and an output schema',
          inputSchema: z.object({ a: z.number(), b: z.number() }),
          outputSchema: z.object({ total: z.number() }),
          mcp: { _meta: { ui: { resourceUri: APP } } },
          execute: async ({ a, b }) => ({ total: a + b }),
        }),
        flatOnly: createTool({
          id: 'flat-only',
          description: 'Declares only the flat MCP App key',
          inputSchema: z.object({}),
          mcp: { _meta: { 'ui/resourceUri': APP } },
          execute: async () => ({ ok: true }),
        }),
        conflicting: createTool({
          id: 'conflicting',
          description: 'Declares two different app links',
          inputSchema: z.object({}),
          mcp: { _meta: { ui: { resourceUri: APP }, 'ui/resourceUri': OTHER_APP } },
          execute: async () => ({ ok: true }),
        }),
        linkedAndDescribed: createTool({
          id: 'linked-and-described',
          description: 'Declares an app link beside metadata about the tool',
          strict: true,
          inputSchema: z.object({}),
          mcp: { _meta: { customField: 'custom-value', ui: { resourceUri: APP, visibility: ['model', 'app'] } } },
          execute: async () => ({ ok: true }),
        }),
        described: createTool({
          id: 'described',
          description: 'Declares metadata about the tool, and no app',
          strict: true,
          inputSchema: z.object({}),
          mcp: { _meta: { customField: 'custom-value' } },
          execute: async () => ({ ok: true }),
        }),
        failing: createTool({
          id: 'failing',
          description: 'Declares an app link and throws',
          inputSchema: z.object({}),
          mcp: { _meta: { ui: { resourceUri: APP } } },
          execute: async () => {
            throw new Error('boom');
          },
        }),
      }),
    );
    client = await connectClient(served.url);
  });

  afterAll(async () => {
    await client?.close();
    await served?.close();
  });

  it('returns the declared app link on results of tools with and without an output schema', async () => {
    const plain = await client.callTool({ name: 'linked', arguments: {} });
    expect(ownMeta(plain)).toEqual(linkTo(APP));

    const structured = await client.callTool({ name: 'linkedStructured', arguments: { a: 1, b: 2 } });
    expect(structured.structuredContent).toEqual({ total: 3 });
    expect(ownMeta(structured)).toEqual(linkTo(APP));
  });

  it('returns the link for a tool that declares only the flat key', async () => {
    const result = await client.callTool({ name: 'flatOnly', arguments: {} });
    expect(ownMeta(result)).toEqual(linkTo(APP));
  });

  it('resolves conflicting nested and flat links to the nested one on tools/list and tools/call', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(t => t.name === 'conflicting')?._meta).toEqual(linkTo(APP));

    const result = await client.callTool({ name: 'conflicting', arguments: {} });
    expect(ownMeta(result)).toEqual(linkTo(APP));
  });

  it('keeps declared keys that describe the tool off results', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(t => t.name === 'linkedAndDescribed')?._meta).toEqual({
      customField: 'custom-value',
      ui: { resourceUri: APP, visibility: ['model', 'app'] },
      'ui/resourceUri': APP,
      mastra: { strict: true },
    });

    const linked = await client.callTool({ name: 'linkedAndDescribed', arguments: {} });
    expect(ownMeta(linked)).toEqual(linkTo(APP));

    const described = await client.callTool({ name: 'described', arguments: {} });
    expect(ownMeta(described)).toEqual({});
  });

  it('leaves error results without the link', async () => {
    const result = await client.callTool({ name: 'failing', arguments: {} });
    expect(result.isError).toBe(true);
    expect(ownMeta(result)).toEqual({});
  });

  // Runtime reproduction from @iamdanielkitchen on #21277: Mastra's own client reads the link off the result.
  it('lets getMcpCallToolMeta read the link from a Mastra MCPClient tool result', async () => {
    const mastraClient = new InternalMastraMCPClient({ name: 'repro', server: { url: served.url } });
    try {
      await mastraClient.connect();
      const tools = await mastraClient.tools();
      const result = await tools['linkedStructured']!.execute!({ a: 1, b: 2 }, {});
      expect(result).toEqual({ total: 3 });
      expect(getMcpCallToolMeta(result)).toMatchObject({
        ui: { resourceUri: APP, serverId: 'repro' },
        'ui/resourceUri': APP,
      });
    } finally {
      await mastraClient.disconnect();
    }
  });
});

describe('MCPServer MCP Apps capability', () => {
  it('advertises the MCP Apps extension for a tool that declares only the flat key', async () => {
    const served = await serveHTTP(
      createServer({
        flatOnly: createTool({
          id: 'flat-only',
          description: 'Declares only the flat MCP App key',
          inputSchema: z.object({}),
          mcp: { _meta: { 'ui/resourceUri': APP } },
          execute: async () => ({ ok: true }),
        }),
      }),
    );
    const client = await connectClient(served.url);
    try {
      expect(client.getServerCapabilities()?.extensions).toEqual({ 'io.modelcontextprotocol/ui': {} });
    } finally {
      await client.close();
      await served.close();
    }
  });
});
