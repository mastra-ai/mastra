import { createTool } from '@mastra/core/tools';
import {
  Client,
  LOG_LEVEL_META_KEY,
  SdkError,
  SdkErrorCode,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectModern, rawRequest, serveHTTP, textOf } from './__tests__/harness';
import type { ServedHTTP } from './__tests__/harness';
import { MCPServer } from './server';
import type { MCPServerHTTPOptions, MCPServerHTTPRequestOptions } from './types';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const authInfo: AuthInfo = { token: 'test-token', clientId: 'test-client', scopes: ['tools:call'] };

const makeTools = () => ({
  echoTool: createTool({
    id: 'echoTool',
    description: 'Echoes the input back',
    inputSchema: z.object({ text: z.string() }),
    execute: async ({ text }) => `echo: ${text}`,
  }),
  structuredTool: createTool({
    id: 'structuredTool',
    description: 'Returns structured output',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ doubled: z.number() }),
    execute: async ({ n }) => ({ doubled: n * 2 }),
  }),
  authTool: createTool({
    id: 'authTool',
    description: 'Returns the authenticated client id and mapped user',
    inputSchema: z.object({}),
    execute: async (_input, context) => {
      const auth = context.requestContext?.get('authInfo') as AuthInfo | undefined;
      const user = context.requestContext?.get('user') as { id: string } | undefined;
      return `${auth?.clientId ?? 'anonymous'}/${user?.id ?? 'none'}`;
    },
  }),
  loggingTool: createTool({
    id: 'loggingTool',
    description: 'Emits info and error logs, then reports whether it ran',
    inputSchema: z.object({ tag: z.string().default('log') }),
    outputSchema: z.string(),
    execute: async ({ tag }, { mcp }) => {
      await mcp!.log!('info', `info ${tag}`);
      await mcp!.log!('error', `error ${tag}`);
      return `logged ${tag}`;
    },
  }),
  progressTool: createTool({
    id: 'progressTool',
    description: 'Reports progress',
    inputSchema: z.object({}),
    outputSchema: z.string(),
    execute: async (_input, { mcp }) => {
      await mcp!.progress!({ progress: 1, total: 2, message: 'half' });
      await mcp!.progress!({ progress: 2, total: 2, message: 'done' });
      return 'progressed';
    },
  }),
});

describe('MCPServer over Streamable HTTP (2026-07-28)', () => {
  let server: MCPServer;
  let served: ServedHTTP;

  beforeAll(async () => {
    server = new MCPServer({
      name: 'Modern Test Server',
      version: '1.0.0',
      cacheHints: { 'tools/list': { ttlMs: 60_000, cacheScope: 'private' } },
      tools: makeTools(),
      mapAuthInfoToUser: ({ authInfo }) => ({ id: `user-of-${authInfo.clientId}` }),
      resources: {
        listResources: async () => [{ uri: 'test://resource', name: 'Test resource' }],
        getResourceContent: async () => ({ text: 'resource content' }),
      },
      prompts: { listPrompts: async () => [{ name: 'greet' }] },
    });
    served = await serveHTTP(server, { auth: authInfo });
  });

  afterAll(async () => {
    await served.close();
  });

  it('serves discovery, listing and calls to a pinned client without any session', async () => {
    const client = await connectModern(served.url);
    try {
      expect(client.getDiscoverResult()?.supportedVersions).toEqual(['2026-07-28']);
      const tools = await client.listTools();
      expect(tools.tools.map(t => t.name).sort()).toEqual([
        'authTool',
        'echoTool',
        'loggingTool',
        'progressTool',
        'structuredTool',
      ]);
      expect(tools.ttlMs).toBe(60_000);
      expect(tools.cacheScope).toBe('private');

      expect(textOf(await client.callTool({ name: 'echoTool', arguments: { text: 'hi' } }))).toBe('echo: hi');
      const structured = await client.callTool({ name: 'structuredTool', arguments: { n: 2 } });
      expect(structured.structuredContent).toEqual({ doubled: 4 });
      expect(textOf(structured)).toBe(JSON.stringify({ doubled: 4 }));
    } finally {
      await client.close();
    }

    const response = await rawRequest(served.url, { method: 'server/discover' });
    expect(response.status).toBe(200);
    expect(response.headers.has('mcp-session-id')).toBe(false);
  });

  it('advertises only supported capabilities', async () => {
    const client = await connectModern(served.url);
    try {
      const capabilities = client.getServerCapabilities()!;
      expect(capabilities.tools).toEqual({ listChanged: true });
      expect(capabilities.resources).toEqual({ subscribe: true, listChanged: true });
      expect(capabilities.prompts).toEqual({ listChanged: true });
      // Static declaration required by the 2026-07-28 logging utility.
      expect(capabilities.logging).toEqual({});
      expect(capabilities).not.toHaveProperty('roots');
      expect(capabilities).not.toHaveProperty('sampling');
      expect(capabilities).not.toHaveProperty('tasks');
      expect(capabilities).not.toHaveProperty('completions');
    } finally {
      await client.close();
    }
  });

  it('returns validation failures as tool errors the model can correct', async () => {
    const client = await connectModern(served.url);
    try {
      const result = await client.callTool({ name: 'echoTool', arguments: { text: 42 } });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('text');
      const unknown = await client.callTool({ name: 'nope', arguments: {} });
      expect(unknown.isError).toBe(true);
      expect(textOf(unknown)).toBe('Unknown tool: nope');
    } finally {
      await client.close();
    }
  });

  it('derives auth and the mapped user from the transport on every request', async () => {
    const client = await connectModern(served.url);
    try {
      expect(textOf(await client.callTool({ name: 'authTool', arguments: {} }))).toBe(
        'test-client/user-of-test-client',
      );
    } finally {
      await client.close();
    }
    const anonymous = new MCPServer({ name: 'Anonymous', version: '1.0.0', tools: makeTools() });
    const anonymousServed = await serveHTTP(anonymous);
    try {
      const client = await connectModern(anonymousServed.url);
      try {
        expect(textOf(await client.callTool({ name: 'authTool', arguments: {} }))).toBe('anonymous/none');
      } finally {
        await client.close();
      }
    } finally {
      await anonymousServed.close();
    }
  });

  it('publishes catalogue changes through subscriptions/listen', async () => {
    const client = await connectModern(served.url);
    const toolChanges: Array<() => void> = [];
    client.setNotificationHandler('notifications/tools/list_changed', async () => toolChanges.shift()?.());
    const nextToolChange = () => new Promise<void>(resolve => toolChanges.push(resolve));
    const tools = nextToolChange();
    const prompts = new Promise<void>(resolve => {
      client.setNotificationHandler('notifications/prompts/list_changed', async () => resolve());
    });
    const updated = new Promise<string>(resolve => {
      client.setNotificationHandler('notifications/resources/updated', async n => resolve(n.params.uri));
    });
    const subscription = await client.listen({
      toolsListChanged: true,
      promptsListChanged: true,
      resourceSubscriptions: ['test://resource'],
    });
    try {
      expect(subscription.honoredFilter).toMatchObject({ toolsListChanged: true, promptsListChanged: true });
      await server.toolActions.add({
        dynamicTool: createTool({ id: 'dynamicTool', description: 'Added at runtime', execute: async () => 'dynamic' }),
      });
      await server.prompts.notifyListChanged();
      await server.resources.notifyUpdated({ uri: 'test://resource' });
      await server.resources.notifyUpdated({ uri: 'test://other' });
      await expect(tools).resolves.toBeUndefined();
      await expect(prompts).resolves.toBeUndefined();
      await expect(updated).resolves.toBe('test://resource');
      expect((await client.listTools()).tools.map(t => t.name)).toContain('dynamicTool');
      const removed = nextToolChange();
      await server.toolActions.remove(['dynamicTool']);
      await removed;
      expect((await client.listTools()).tools.map(t => t.name)).not.toContain('dynamicTool');
    } finally {
      await subscription.close();
      await client.close();
    }
  });

  describe('per-request logging', () => {
    const collect = (client: Client) => {
      const messages: Array<{ level: string; data: unknown }> = [];
      client.setNotificationHandler('notifications/message', async n => {
        messages.push({ level: n.params.level, data: n.params.data });
      });
      return messages;
    };

    it('delivers logs at or above the level the request opted into', async () => {
      const client = await connectModern(served.url);
      const messages = collect(client);
      try {
        const info = await client.callTool({
          name: 'loggingTool',
          arguments: { tag: 'a' },
          _meta: { [LOG_LEVEL_META_KEY]: 'info' },
        });
        expect(info.structuredContent).toBe('logged a');
        expect(messages).toEqual([
          { level: 'info', data: { message: 'info a' } },
          { level: 'error', data: { message: 'error a' } },
        ]);

        messages.length = 0;
        await client.callTool({
          name: 'loggingTool',
          arguments: { tag: 'b' },
          _meta: { [LOG_LEVEL_META_KEY]: 'warning' },
        });
        expect(messages).toEqual([{ level: 'error', data: { message: 'error b' } }]);
      } finally {
        await client.close();
      }
    });

    it('delivers nothing without an opt-in and never leaks a previous opt-in to later requests', async () => {
      const client = await connectModern(served.url);
      const messages = collect(client);
      try {
        await client.callTool({
          name: 'loggingTool',
          arguments: { tag: 'opted' },
          _meta: { [LOG_LEVEL_META_KEY]: 'debug' },
        });
        expect(messages).toHaveLength(2);
        messages.length = 0;
        expect((await client.callTool({ name: 'loggingTool', arguments: { tag: 'silent' } })).structuredContent).toBe(
          'logged silent',
        );
        expect(messages).toEqual([]);
      } finally {
        await client.close();
      }
    });

    it('isolates concurrent requests on the same server', async () => {
      const opted = await connectModern(served.url);
      const silent = await connectModern(served.url);
      const optedMessages = collect(opted);
      const silentMessages = collect(silent);
      try {
        await Promise.all([
          opted.callTool({ name: 'loggingTool', arguments: { tag: 'x' }, _meta: { [LOG_LEVEL_META_KEY]: 'info' } }),
          silent.callTool({ name: 'loggingTool', arguments: { tag: 'y' } }),
        ]);
        expect(optedMessages.map(m => m.data)).toEqual([{ message: 'info x' }, { message: 'error x' }]);
        expect(silentMessages).toEqual([]);
      } finally {
        await opted.close();
        await silent.close();
      }
    });

    it('does not serve the deprecated session-level logging/setLevel', async () => {
      const response = await rawRequest(served.url, { method: 'logging/setLevel', params: { level: 'debug' } });
      expect(response.json().error.code).toBe(-32601);
      const client = await connectModern(served.url);
      try {
        await expect(client.setLoggingLevel('debug')).rejects.toThrow();
      } finally {
        await client.close();
      }
    });
  });

  it('reports progress on the request stream when the caller supplies a token', async () => {
    const client = await connectModern(served.url);
    const progress: Array<{ progress: number; total?: number; message?: string }> = [];
    try {
      const result = await client.callTool(
        { name: 'progressTool', arguments: {} },
        { onprogress: p => progress.push({ progress: p.progress, total: p.total, message: p.message }) },
      );
      expect(result.structuredContent).toBe('progressed');
      expect(progress).toEqual([
        { progress: 1, total: 2, message: 'half' },
        { progress: 2, total: 2, message: 'done' },
      ]);
      progress.length = 0;
      await client.callTool({ name: 'progressTool', arguments: {} });
      expect(progress).toEqual([]);
    } finally {
      await client.close();
    }
  });

  describe('legacy protocol surface is rejected, not downgraded', () => {
    it('rejects clients that negotiate a legacy revision', async () => {
      for (const options of [{}, { versionNegotiation: { mode: 'legacy' as const } }]) {
        const client = new Client({ name: 'legacy-client', version: '1.0.0' }, options);
        const error = await client.connect(new StreamableHTTPClientTransport(served.url)).then(
          () => undefined,
          e => e,
        );
        expect(error).toBeInstanceOf(SdkError);
        // The SDK surfaces the server's unsupported-version rejection either as a
        // failed negotiation or as the rejected legacy POST itself.
        expect([SdkErrorCode.EraNegotiationFailed, SdkErrorCode.ClientHttpNotImplemented]).toContain(
          (error as SdkError).code,
        );
        expect(client.getServerCapabilities()).toBeUndefined();
        await client.close().catch(() => {});
      }
    });

    it('rejects initialize and ping and serves no session lifecycle', async () => {
      const initialize = await rawRequest(served.url, {
        envelope: false,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'old', version: '1' } },
      });
      expect(initialize.status).toBeGreaterThanOrEqual(400);
      expect(initialize.headers.has('mcp-session-id')).toBe(false);
      expect(initialize.text).not.toContain('"result"');

      const ping = await rawRequest(served.url, { method: 'ping' });
      expect(ping.text).not.toContain('"result"');

      for (const httpMethod of ['GET', 'DELETE']) {
        const response = await rawRequest(served.url, { httpMethod, envelope: false });
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('does not serve legacy resource subscriptions or server-initiated request replies', async () => {
      for (const method of ['resources/subscribe', 'resources/unsubscribe']) {
        const response = await rawRequest(served.url, { method, params: { uri: 'test://resource' } });
        expect(response.json().error.code).toBe(-32601);
      }
      const legacyClient = new Client({ name: 'legacy-client', version: '1.0.0' });
      await expect(legacyClient.connect(new StreamableHTTPClientTransport(served.url))).rejects.toBeInstanceOf(
        SdkError,
      );
    });

    it('exposes no legacy transport entry points or options', async () => {
      // The 1.x entry points stay callable on the base class but are not served here.
      await expect(server.startSSE({} as never)).rejects.toThrow(/removed in MCP 2026-07-28\); use startHTTP instead/);
      await expect(server.startHonoSSE({} as never)).rejects.toThrow(
        /removed in MCP 2026-07-28\); use startHTTP instead/,
      );
      expect(server).not.toHaveProperty('handleServerlessRequest');
      expect(server).not.toHaveProperty('elicitation');
      expect(server).not.toHaveProperty('sendLoggingMessage');
      expect(server).not.toHaveProperty('getServer');
      expectTypeOf<keyof MCPServerHTTPRequestOptions>().toEqualTypeOf<
        'enableDnsRebindingProtection' | 'allowedHosts' | 'allowedOrigins'
      >();
      expectTypeOf<keyof MCPServerHTTPOptions>().toEqualTypeOf<'url' | 'httpPath' | 'req' | 'res' | 'options'>();
    });
  });

  it('applies DNS rebinding protection and path matching before dispatch', async () => {
    const guarded = new MCPServer({ name: 'Guarded', version: '1.0.0', tools: makeTools() });
    const guardedServed = await serveHTTP(guarded, {
      options: {
        enableDnsRebindingProtection: true,
        allowedHosts: ['allowed.example'],
        allowedOrigins: ['https://allowed.example'],
      },
    });
    try {
      const blockedHost = await rawRequest(guardedServed.url, {
        method: 'server/discover',
        headers: { Host: 'blocked.example' },
      });
      expect(blockedHost.status).toBe(403);
      expect(blockedHost.text).toContain('Invalid Host: blocked.example');
      const blockedOrigin = await rawRequest(guardedServed.url, {
        method: 'server/discover',
        headers: { Host: 'allowed.example', Origin: 'https://blocked.example' },
      });
      expect(blockedOrigin.status).toBe(403);
      const allowed = await rawRequest(guardedServed.url, {
        method: 'server/discover',
        headers: { Host: 'allowed.example', Origin: 'https://allowed.example' },
      });
      expect(allowed.status).toBe(200);
      const wrongPath = await fetch(new URL('/other', guardedServed.url), { method: 'POST' });
      expect(wrongPath.status).toBe(404);
    } finally {
      await guardedServed.close();
    }
  });
});
