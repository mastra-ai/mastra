import http from 'node:http';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { connectModern, serveHTTP, textOf } from './__tests__/harness';
import type { ServedHTTP } from './__tests__/harness';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const echoTool = createTool({
  id: 'echo',
  description: 'Echoes input',
  inputSchema: z.object({ message: z.string() }),
  execute: async ({ message }) => ({ echo: message }),
});

const createMockAgent = (name: string, description?: string) =>
  new Agent({
    id: name,
    name,
    description,
    instructions: 'Mock agent',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text', text: 'generated' }],
        warnings: [],
      }),
      doStream: async params => {
        const last = params.prompt[params.prompt.length - 1];
        const query =
          last?.role === 'user' && Array.isArray(last.content)
            ? ((last.content.find(part => part.type === 'text') as { text?: string } | undefined)?.text ?? '')
            : '';
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: `Agent response to: "${query}"` },
            { type: 'text-end', id: '1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    }),
  });

describe('MCPServer', () => {
  describe('metadata', () => {
    it('derives defaults and exposes provided metadata through server info and detail', () => {
      const defaults = new MCPServer({ name: 'Defaults', version: '1.0.0', tools: {} });
      expect(defaults.id).toMatch(/[0-9a-f-]{36}/);
      expect(defaults.getServerInfo()).toEqual({
        id: defaults.id,
        name: 'Defaults',
        description: undefined,
        repository: undefined,
        version_detail: { version: '1.0.0', release_date: expect.any(String), is_latest: true },
      });

      const custom = new MCPServer({
        id: 'custom-id',
        name: 'Custom',
        version: '2.0.0',
        description: 'A custom server',
        instructions: 'Use wisely',
        repository: { url: 'https://example.com/repo', source: 'github', id: 'repo' },
        releaseDate: '2026-07-28T00:00:00.000Z',
        isLatest: false,
        packageCanonical: 'npm',
        packages: [{ registry_name: 'npm', name: '@x/y', version: '2.0.0' }],
        remotes: [{ transport_type: 'streamable-http', url: 'https://example.com/mcp' }],
        tools: {},
      });
      expect(custom.getServerDetail()).toEqual({
        id: 'custom-id',
        name: 'Custom',
        description: 'A custom server',
        repository: { url: 'https://example.com/repo', source: 'github', id: 'repo' },
        version_detail: { version: '2.0.0', release_date: '2026-07-28T00:00:00.000Z', is_latest: false },
        package_canonical: 'npm',
        packages: [{ registry_name: 'npm', name: '@x/y', version: '2.0.0' }],
        remotes: [{ transport_type: 'streamable-http', url: 'https://example.com/mcp' }],
      });
      expect(custom.instructions).toBe('Use wisely');
    });

    it('serves instructions and cache hints on discovery', async () => {
      const server = new MCPServer({
        name: 'Instructed',
        version: '1.0.0',
        instructions: 'Read me first',
        cacheHints: { 'server/discover': { ttlMs: 1_000 } },
        tools: {},
      });
      const served = await serveHTTP(server);
      try {
        const client = await connectModern(served.url);
        try {
          expect(client.getInstructions()).toBe('Read me first');
          expect(client.getDiscoverResult()?.ttlMs).toBe(1_000);
        } finally {
          await client.close();
        }
      } finally {
        await served.close();
      }
    });
  });

  describe('agents and workflows as tools', () => {
    it('exposes agents as ask_<key> tools that call generate with the request context', async () => {
      const agent = createMockAgent('MyAgent', 'Answers questions.');
      const generate = vi.spyOn(agent, 'generate');
      const server = new MCPServer({ name: 'Agents', version: '1.0.0', tools: {}, agents: { helper: agent } });
      const tool = server.tools().ask_helper!;
      expect(tool.description).toBe("Ask agent 'MyAgent' a question. Agent description: Answers questions.");
      expect(server.getToolInfo('ask_helper')).toMatchObject({
        toolType: 'agent',
        inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      });

      const requestContext = new RequestContext();
      const result = await server.executeTool('ask_helper', { message: 'Hello' }, { requestContext });
      expect(result).toMatchObject({ status: 'completed', output: { text: 'generated' } });
      expect(generate).toHaveBeenCalledWith('Hello', expect.objectContaining({ requestContext }));
    });

    it('exposes workflows as run_<key> tools that start a run with the request context', async () => {
      const step = createStep({
        id: 'double',
        inputSchema: z.object({ n: z.number() }),
        outputSchema: z.object({ doubled: z.number() }),
        execute: async ({ inputData }) => ({ doubled: inputData.n * 2 }),
      });
      const workflow = createWorkflow({
        id: 'doubler',
        description: 'Doubles a number',
        inputSchema: z.object({ n: z.number() }),
        outputSchema: z.object({ doubled: z.number() }),
      })
        .then(step)
        .commit();
      const server = new MCPServer({
        name: 'Workflows',
        version: '1.0.0',
        tools: {},
        workflows: { doubler: workflow },
      });
      expect(server.tools().run_doubler!.description).toBe(
        "Run workflow 'doubler'. Workflow description: Doubles a number",
      );
      expect(server.getToolInfo('run_doubler')).toMatchObject({
        toolType: 'workflow',
        inputSchema: { type: 'object', properties: { n: { type: 'number' } } },
      });
      const result = await server.executeTool('run_doubler', { n: 21 });
      expect(result).toMatchObject({ status: 'completed', output: { status: 'success', result: { doubled: 42 } } });
    });

    it('requires descriptions and lets explicit tools win name collisions', () => {
      expect(
        () => new MCPServer({ name: 'NoDesc', version: '1.0.0', tools: {}, agents: { a: createMockAgent('A') } }),
      ).toThrow('must have a non-empty description');
      expect(
        () =>
          new MCPServer({
            name: 'NoDesc',
            version: '1.0.0',
            tools: {},
            workflows: { w: createWorkflow({ id: 'w', inputSchema: z.object({}), outputSchema: z.object({}) }) },
          }),
      ).toThrow('must have a non-empty description');

      const explicit = createTool({ id: 'ask_a', description: 'Explicit', execute: async () => 'explicit' });
      const server = new MCPServer({
        name: 'Collision',
        version: '1.0.0',
        tools: { ask_a: explicit },
        agents: { a: createMockAgent('A', 'Described') },
      });
      expect(server.tools().ask_a!.description).toBe('Explicit');
    });
  });

  describe('resources, prompts and app resources over the wire', () => {
    let server: MCPServer;
    let served: ServedHTTP;

    beforeAll(async () => {
      server = new MCPServer({
        name: 'Content',
        version: '1.0.0',
        tools: {},
        appResources: {
          'ui://widget': {
            name: 'Widget',
            description: 'A widget',
            html: '<h1>hi</h1>',
            meta: { csp: { resourceDomains: [] } },
          },
        },
        resources: {
          listResources: async () => [
            { uri: 'weather://current', name: 'Current', mimeType: 'application/json', _meta: { ui: { csp: {} } } },
            { uri: 'weather://binary', name: 'Binary', mimeType: 'application/octet-stream' },
          ],
          getResourceContent: async ({ uri }) =>
            uri === 'weather://binary'
              ? { blob: Buffer.from('bytes').toString('base64') }
              : [{ text: 'sunny' }, { text: 'warm' }],
          resourceTemplates: async () => [{ uriTemplate: 'weather://{city}', name: 'By city' }],
        },
        prompts: {
          listPrompts: async () => [
            { name: 'greet', description: 'Greets', arguments: [{ name: 'who', required: true }, { name: 'tone' }] },
          ],
          getPromptMessages: async ({ name, args }) => [
            { role: 'user', content: { type: 'text', text: `${name} ${args?.who} ${args?.tone ?? 'plain'}` } },
          ],
        },
      });
      served = await serveHTTP(server);
    });

    afterAll(async () => {
      await served.close();
    });

    it('lists and reads application and app resources, preserving _meta', async () => {
      const client = await connectModern(served.url);
      try {
        expect(client.getServerCapabilities()?.extensions).toEqual({ 'io.modelcontextprotocol/ui': {} });
        const listed = await client.listResources();
        expect(listed.resources.map(r => r.uri)).toEqual(['ui://widget', 'weather://current', 'weather://binary']);
        const current = await client.readResource({ uri: 'weather://current' });
        expect(current.contents).toEqual([
          { uri: 'weather://current', mimeType: 'application/json', text: 'sunny', _meta: { ui: { csp: {} } } },
          { uri: 'weather://current', mimeType: 'application/json', text: 'warm', _meta: { ui: { csp: {} } } },
        ]);
        const binary = await client.readResource({ uri: 'weather://binary' });
        expect(binary.contents[0]).toMatchObject({ blob: Buffer.from('bytes').toString('base64') });
        const widget = await client.readResource({ uri: 'ui://widget' });
        expect(widget.contents[0]).toMatchObject({ uri: 'ui://widget', text: '<h1>hi</h1>' });
        await expect(client.readResource({ uri: 'weather://missing' })).rejects.toThrow('Resource not found');
        expect((await client.listResourceTemplates()).resourceTemplates).toEqual([
          { uriTemplate: 'weather://{city}', name: 'By city' },
        ]);
      } finally {
        await client.close();
      }
      expect(await server.listResources()).toEqual({ resources: [expect.objectContaining({ uri: 'ui://widget' })] });
      expect(await server.readResource('ui://widget')).toEqual({
        contents: [{ uri: 'ui://widget', text: '<h1>hi</h1>' }],
      });
      await expect(server.readResource('weather://current')).rejects.toThrow('only readable through an MCP request');
    });

    it('lists and resolves prompts with argument checks', async () => {
      const client = await connectModern(served.url);
      try {
        expect((await client.listPrompts()).prompts.map(p => p.name)).toEqual(['greet']);
        const withTone = await client.getPrompt({ name: 'greet', arguments: { who: 'Ada', tone: 'warm' } });
        expect(withTone.description).toBe('Greets');
        expect(withTone.messages[0]?.content).toEqual({ type: 'text', text: 'greet Ada warm' });
        const plain = await client.getPrompt({ name: 'greet', arguments: { who: 'Ada' } });
        expect(plain.messages[0]?.content).toEqual({ type: 'text', text: 'greet Ada plain' });
        await expect(client.getPrompt({ name: 'greet', arguments: {} })).rejects.toThrow(
          'Missing required argument: who',
        );
        await expect(client.getPrompt({ name: 'missing' })).rejects.toThrow('Prompt "missing" not found');
      } finally {
        await client.close();
      }
    });
  });

  describe('tool results and validation over the wire', () => {
    let served: ServedHTTP;

    beforeAll(async () => {
      const server = new MCPServer({
        name: 'Validation',
        version: '1.0.0',
        tools: {
          echo: echoTool,
          structured: createTool({
            id: 'structured',
            description: 'Structured output',
            inputSchema: z.object({ input: z.string() }),
            outputSchema: z.object({ processedInput: z.string() }),
            execute: async ({ input }) => ({ processedInput: `processed: ${input}` }),
          }),
          strict: createTool({
            id: 'strict',
            description: 'Strict input',
            inputSchema: z.object({
              name: z.string().min(2),
              age: z.number().min(0).max(150),
              email: z.email(),
              tags: z.array(z.string()).min(1),
              role: z.enum(['admin', 'user']),
            }),
            execute: async input => input,
          }),
          broken: createTool({
            id: 'broken',
            description: 'Violates its output schema',
            inputSchema: z.object({}),
            outputSchema: z.object({ ok: z.boolean() }),
            execute: async () => ({ ok: 'nope' }) as unknown as { ok: boolean },
          }),
          plain: {
            name: 'plain',
            description: 'A `{ parameters, execute }` tool object without createTool',
            parameters: z.object({ input: z.string() }),
            execute: async (args: { input: string }) => ({ plain: args.input }),
          },
        },
      });
      served = await serveHTTP(server);
    });

    it('serves `{ parameters, execute }` tool objects alongside createTool tools', async () => {
      const client = await connectModern(served.url);
      try {
        const listed = (await client.listTools()).tools.find(t => t.name === 'plain');
        expect(listed?.inputSchema).toMatchObject({ type: 'object', properties: { input: { type: 'string' } } });
        const result = await client.callTool({ name: 'plain', arguments: { input: 'hi' } });
        expect(result.isError).toBeFalsy();
        expect(textOf(result)).toBe(JSON.stringify({ plain: 'hi' }));
        const invalid = await client.callTool({ name: 'plain', arguments: {} });
        expect(invalid.isError).toBe(true);
      } finally {
        await client.close();
      }
    });

    afterAll(async () => {
      await served.close();
    });

    it('advertises output schemas and returns structuredContent with a JSON text fallback', async () => {
      const client = await connectModern(served.url);
      try {
        const listed = (await client.listTools()).tools.find(t => t.name === 'structured');
        expect(listed?.outputSchema).toMatchObject({
          type: 'object',
          properties: { processedInput: { type: 'string' } },
        });
        // Advertised in the 2020-12 dialect MCP 2026-07-28 assumes by default.
        expect(listed?.outputSchema?.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        const result = await client.callTool({ name: 'structured', arguments: { input: 'hello' } });
        expect(result.structuredContent).toEqual({ processedInput: 'processed: hello' });
        expect(textOf(result)).toBe(JSON.stringify({ processedInput: 'processed: hello' }));
        expect(textOf(await client.callTool({ name: 'echo', arguments: { message: 'x' } }))).toBe(
          JSON.stringify({ echo: 'x' }),
        );
      } finally {
        await client.close();
      }
    });

    it('returns input validation failures as isError results naming every invalid field', async () => {
      const client = await connectModern(served.url);
      try {
        const missing = await client.callTool({ name: 'strict', arguments: {} });
        expect(missing.isError).toBe(true);
        for (const field of ['name', 'age', 'email', 'tags', 'role']) expect(textOf(missing)).toContain(field);

        const invalid = await client.callTool({
          name: 'strict',
          arguments: { name: 'a', age: 200, email: 'nope', tags: [], role: 'root' },
        });
        expect(invalid.isError).toBe(true);
        for (const field of ['name', 'age', 'email', 'tags', 'role']) expect(textOf(invalid)).toContain(field);

        const valid = await client.callTool({
          name: 'strict',
          arguments: { name: 'Ada', age: 36, email: 'ada@example.com', tags: ['x'], role: 'admin' },
        });
        expect(valid.isError).toBeFalsy();
      } finally {
        await client.close();
      }
    });

    it('reports output schema violations as tool errors instead of invalid structured content', async () => {
      const client = await connectModern(served.url);
      try {
        const result = await client.callTool({ name: 'broken', arguments: {} });
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
        expect(textOf(result)).toContain('ok');
      } finally {
        await client.close();
      }
    });
  });

  describe('HTTP body handling', () => {
    it('accepts bodies already parsed by middleware such as express.json()', async () => {
      const server = new MCPServer({ name: 'PreParsed', version: '1.0.0', tools: { echo: echoTool } });
      const httpServer = http.createServer(async (req, res) => {
        if (req.method === 'POST') {
          let data = '';
          for await (const chunk of req) data += chunk;
          (req as http.IncomingMessage & { body?: unknown }).body = JSON.parse(data);
        }
        await server.startHTTP({ url: new URL(req.url ?? '', 'http://localhost'), httpPath: '/mcp', req, res });
      });
      await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
      const { port } = httpServer.address() as { port: number };
      try {
        const client = await connectModern(new URL(`http://127.0.0.1:${port}/mcp`));
        try {
          for (const message of ['first', 'second']) {
            expect(textOf(await client.callTool({ name: 'echo', arguments: { message } }))).toBe(
              JSON.stringify({ echo: message }),
            );
          }
        } finally {
          await client.close();
        }
      } finally {
        await server.close();
        httpServer.closeAllConnections();
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
      }
    });
  });
});
