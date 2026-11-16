/**
 * `toolResult` builds a tool's MCP result from its `toModelOutput` (opt-in) and lets the server
 * rewrite results before they are sent (Issue #29136).
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { LocalFilesystem, Workspace, readFileTool } from '@mastra/core/workspace';
import type { Client } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InternalMastraMCPClient } from '../client/client';
import { TaskRequester } from '../client/tasks/requester';
import { tasksCapabilityEntry } from '../shared/tasks';
import type { MCPDetailedTask } from '../shared/tasks';
import { connectClient, rawRequest, serveHTTP } from './__tests__/harness.mock';
import type { ServedHTTP } from './__tests__/harness.mock';
import { MCPServer } from './server';
import type { MCPServerConfig } from './server';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

// A 1x1 transparent PNG.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const APP = 'ui://gallery/main';

let tempDir: string;

function makeTools() {
  const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
  return {
    image: createTool({
      id: 'image',
      description: 'Returns an image through toModelOutput',
      inputSchema: z.object({}),
      execute: async () => ({ path: 'a.png', base64: PNG_BASE64 }),
      toModelOutput: (output: { path: string; base64: string }) => ({
        type: 'content',
        value: [
          { type: 'text', text: output.path },
          { type: 'media', data: output.base64, mediaType: 'image/png' },
        ],
      }),
    }),
    media: createTool({
      id: 'media',
      description: 'Returns audio, a PDF and a data-URI image',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true }),
      toModelOutput: async () => ({
        type: 'content',
        value: [
          { type: 'media', data: 'AAAA', mediaType: 'audio/wav' },
          { type: 'file-data', data: 'JVBERi0=', mediaType: 'application/pdf' },
          { type: 'image-url', url: `data:image/png;base64,${PNG_BASE64}` },
          { type: 'image-url', url: 'https://example.com/a.png' },
        ],
      }),
    }),
    noMapper: createTool({
      id: 'no-mapper',
      description: 'Has no toModelOutput',
      inputSchema: z.object({}),
      execute: async () => ({ answer: 42 }),
    }),
    undefinedMapper: createTool({
      id: 'undefined-mapper',
      description: 'toModelOutput returns undefined',
      inputSchema: z.object({}),
      execute: async () => ({ answer: 42 }),
      toModelOutput: () => undefined,
    }),
    unknownShape: createTool({
      id: 'unknown-shape',
      description: 'toModelOutput returns a shape that is not a model output',
      inputSchema: z.object({}),
      execute: async () => ({ answer: 42 }),
      toModelOutput: (output: unknown) => output,
    }),
    structured: createTool({
      id: 'structured',
      description: 'Has an output schema and a toModelOutput',
      inputSchema: z.object({}),
      outputSchema: z.object({ total: z.number() }),
      execute: async () => ({ total: 3 }),
      toModelOutput: () => ({ type: 'content', value: [{ type: 'media', data: PNG_BASE64, mediaType: 'image/png' }] }),
    }),
    falsyStructured: createTool({
      id: 'falsy-structured',
      description: 'Has an output schema, returns a falsy value and has a toModelOutput',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      execute: async () => 0,
      toModelOutput: () => ({ type: 'content', value: [{ type: 'media', data: PNG_BASE64, mediaType: 'image/png' }] }),
    }),
    errorText: createTool({
      id: 'error-text',
      description: 'toModelOutput reports an error',
      inputSchema: z.object({}),
      outputSchema: z.object({ error: z.string() }),
      execute: async () => ({ error: 'no such file' }),
      toModelOutput: (output: { error: string }) => ({ type: 'error-text', value: output.error }),
    }),
    throwingMapper: createTool({
      id: 'throwing-mapper',
      description: 'toModelOutput throws',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true }),
      toModelOutput: () => {
        throw new Error('mapping failed');
      },
    }),
    linked: createTool({
      id: 'linked',
      description: 'Declares an MCP App link and has a toModelOutput',
      inputSchema: z.object({}),
      mcp: { _meta: { ui: { resourceUri: APP } } },
      execute: async () => ({ ok: true }),
      toModelOutput: () => ({ type: 'text', value: 'mapped' }),
    }),
    // How a server exposes the workspace read_file tool: MCPServer gives tools no workspace of their own.
    readFile: createTool({
      id: 'read_file',
      description: 'Reads a workspace file',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }, context) =>
        readFileTool.execute!({ path, showLineNumbers: true }, { ...context, workspace }),
      toModelOutput: readFileTool.toModelOutput,
    }),
    passthrough: createTool({
      id: 'passthrough',
      description: 'Returns an MCP-shaped result, as a proxied MCP tool does',
      inputSchema: z.object({}),
      execute: async () => ({ content: [{ type: 'image', data: PNG_BASE64, mimeType: 'image/png' }] }),
    }),
  };
}

const agents = {
  helper: new Agent({
    id: 'helper',
    name: 'helper',
    description: 'Helps',
    instructions: 'Mock agent',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text', text: 'generated' }],
        warnings: [],
      }),
    }),
  }),
};

/** The result without the protocol's own `io.modelcontextprotocol/*` `_meta` keys. */
function withoutProtocolMeta({ _meta, ...result }: CallToolResult): CallToolResult {
  const own = Object.entries(_meta ?? {}).filter(([key]) => !key.startsWith('io.modelcontextprotocol/'));
  return own.length ? { ...result, _meta: Object.fromEntries(own) } : result;
}

async function serve(config: Partial<MCPServerConfig> = {}) {
  const served = await serveHTTP(
    new MCPServer({ name: 'ToolResultTestServer', version: '1.0.0', tools: makeTools(), ...config }),
  );
  const client = await connectClient(served.url);
  return {
    served,
    client,
    call: async (name: string, args: Record<string, unknown> = {}) =>
      withoutProtocolMeta((await client.callTool({ name, arguments: args })) as CallToolResult),
    close: async () => {
      await client.close();
      await served.close();
    },
  };
}

type Served = Awaited<ReturnType<typeof serve>>;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'mcp-tool-result-'));
  await writeFile(join(tempDir, 'pixel.png'), Buffer.from(PNG_BASE64, 'base64'));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('MCPServer toolResult (Issue #29136)', () => {
  describe.each([
    ['without a toolResult config', {}],
    ['with modelOutput: false', { toolResult: { modelOutput: false } }],
  ])('%s', (_label, config) => {
    let server: Served;
    beforeAll(async () => {
      server = await serve(config);
    });
    afterAll(async () => {
      await server.close();
    });

    it('sends the raw output as one JSON text block, ignoring toModelOutput', async () => {
      const result = await server.call('image');
      expect(result).toEqual({
        isError: false,
        content: [{ type: 'text', text: JSON.stringify({ path: 'a.png', base64: PNG_BASE64 }) }],
      });
    });

    it('keeps structuredContent and its JSON text block for an output schema tool', async () => {
      const result = await server.call('structured');
      expect(result).toEqual({
        isError: false,
        structuredContent: { total: 3 },
        content: [{ type: 'text', text: '{"total":3}' }],
      });
    });

    it('does not report an error a toModelOutput would map to', async () => {
      const result = await server.call('errorText');
      expect(result).toEqual({
        isError: false,
        structuredContent: { error: 'no such file' },
        content: [{ type: 'text', text: '{"error":"no such file"}' }],
      });
    });

    it('does not call a throwing toModelOutput', async () => {
      const result = await server.call('throwingMapper');
      expect(result).toEqual({ isError: false, content: [{ type: 'text', text: '{"ok":true}' }] });
    });
  });

  describe('with modelOutput: true', () => {
    let server: Served;
    beforeAll(async () => {
      server = await serve({ toolResult: { modelOutput: true } });
    });
    afterAll(async () => {
      await server.close();
    });

    it("builds the content from the tool's toModelOutput", async () => {
      const result = await server.call('image');
      expect(result).toEqual({
        isError: false,
        content: [
          { type: 'text', text: 'a.png' },
          { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
        ],
      });
    });

    it('sends audio as audio, other files as embedded resources, and remote URLs as text', async () => {
      const result = await server.call('media');
      expect(result.content).toEqual([
        { type: 'audio', data: 'AAAA', mimeType: 'audio/wav' },
        {
          type: 'resource',
          resource: { uri: 'mastra://tool-output/media/1', mimeType: 'application/pdf', blob: 'JVBERi0=' },
        },
        { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
        { type: 'text', text: 'https://example.com/a.png' },
      ]);
    });

    it('sends a workspace read_file of an image as an image block', async () => {
      const result = await server.call('readFile', { path: 'pixel.png' });
      expect(result.isError).toBe(false);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('pixel.png') },
        { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
      ]);
    });

    it('keeps the default result when there is no usable toModelOutput', async () => {
      for (const name of ['noMapper', 'undefinedMapper', 'unknownShape']) {
        expect(await server.call(name)).toEqual({ isError: false, content: [{ type: 'text', text: '{"answer":42}' }] });
      }
    });

    it('keeps structuredContent and the JSON text block first for an output schema tool', async () => {
      const result = await server.call('structured');
      expect(result).toEqual({
        isError: false,
        structuredContent: { total: 3 },
        content: [
          { type: 'text', text: '{"total":3}' },
          { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
        ],
      });
    });

    it('keeps the JSON text block for a falsy structured output', async () => {
      const result = await server.call('falsyStructured');
      expect(result.content).toEqual([
        { type: 'text', text: '0' },
        { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
      ]);
    });

    it('reports error outputs as tool errors, without structuredContent', async () => {
      const result = await server.call('errorText');
      expect(result).toEqual({ isError: true, content: [{ type: 'text', text: 'no such file' }] });
    });

    it('answers with the tool error result when toModelOutput throws', async () => {
      const result = await server.call('throwingMapper');
      expect(result.isError).toBe(true);
      expect(JSON.parse((result.content[0] as { text: string }).text)).toMatchObject({
        message: 'mapping failed',
        code: 'TOOL_EXECUTION_FAILED',
      });
    });

    it("keeps the tool's MCP App link on a mapped result", async () => {
      const result = await server.call('linked');
      expect(result.content).toEqual([{ type: 'text', text: 'mapped' }]);
      expect(result._meta).toMatchObject({ ui: { resourceUri: APP }, 'ui/resourceUri': APP });
    });

    it('delivers the image block to a Mastra MCPClient', async () => {
      const mastraClient = new InternalMastraMCPClient({ name: 'tool-result', server: { url: server.served.url } });
      try {
        await mastraClient.connect();
        const tools = await mastraClient.tools();
        const result = await tools['image']!.execute!({}, {});
        expect(result).toMatchObject({
          isError: false,
          content: [
            { type: 'text', text: 'a.png' },
            { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
          ],
        });
      } finally {
        await mastraClient.disconnect();
      }
    });
  });

  describe('with a transform', () => {
    let server: Served;
    const seen: Array<{ toolName: string; output: unknown; result: CallToolResult }> = [];

    beforeAll(async () => {
      server = await serve({
        agents,
        toolResult: {
          modelOutput: true,
          transform: async ({ toolName, output, result }) => {
            seen.push({ toolName, output, result });
            if (toolName === 'passthrough') return output as CallToolResult;
            if (toolName === 'throwingMapper') return undefined;
            if (toolName === 'linked') throw new Error('transform failed');
            if (toolName === 'ask_helper') return { ...result, content: [{ type: 'text', text: 'rewritten' }] };
            return undefined;
          },
        },
      });
    });
    afterAll(async () => {
      await server.close();
    });

    it('receives the raw output and the mapped result, and keeps it when it returns undefined', async () => {
      const result = await server.call('image');
      expect(result.content).toEqual([
        { type: 'text', text: 'a.png' },
        { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
      ]);
      expect(seen.at(-1)).toMatchObject({
        toolName: 'image',
        output: { path: 'a.png', base64: PNG_BASE64 },
        result: { isError: false, content: result.content },
      });
    });

    it('replaces the result, e.g. to pass MCP-shaped output through', async () => {
      const result = await server.call('passthrough');
      expect(result).toEqual({ content: [{ type: 'image', data: PNG_BASE64, mimeType: 'image/png' }] });
    });

    it('runs for agent tools', async () => {
      const result = await server.call('ask_helper', { message: 'hi' });
      expect(result.content).toEqual([{ type: 'text', text: 'rewritten' }]);
    });

    it('is not called when the tool result could not be built', async () => {
      const before = seen.length;
      const result = await server.call('throwingMapper');
      expect(result.isError).toBe(true);
      expect(seen.length).toBe(before);
    });

    it('answers with the tool error result when it throws', async () => {
      const result = await server.call('linked');
      expect(result.isError).toBe(true);
      expect(JSON.parse((result.content[0] as { text: string }).text)).toMatchObject({ message: 'transform failed' });
    });
  });

  it('passes the request context to the transform', async () => {
    let clientId: unknown;
    const served = await serveHTTP(
      new MCPServer({
        name: 'ToolResultContextServer',
        version: '1.0.0',
        tools: makeTools(),
        toolResult: {
          transform: ({ requestContext }) => {
            clientId = (requestContext.get('authInfo') as { clientId?: string } | undefined)?.clientId;
            return undefined;
          },
        },
      }),
      { auth: { token: 'acme-token', clientId: 'acme', scopes: [] } },
    );
    const client = await connectClient(served.url);
    try {
      await client.callTool({ name: 'noMapper', arguments: {} });
      expect(clientId).toBe('acme');
    } finally {
      await client.close();
      await served.close();
    }
  });

  describe('in task mode', () => {
    let server: Served;
    beforeAll(async () => {
      server = await serve({
        tasks: { tools: { image: 'always', throwingMapper: 'always', linked: 'always' } },
        toolResult: {
          modelOutput: true,
          transform: ({ toolName }) => {
            if (toolName === 'linked') throw new Error('transform failed');
            return undefined;
          },
        },
      });
    });
    afterAll(async () => {
      await server.close();
    });

    async function completedTask(name: string): Promise<MCPDetailedTask> {
      const response = await rawRequest(server.served.url, {
        method: 'tools/call',
        params: { name, arguments: {} },
        capabilities: { extensions: tasksCapabilityEntry() },
        headers: { 'mcp-name': name },
      });
      const { taskId } = response.json().result as { taskId: string };
      const tasks = new TaskRequester(server.client);
      for (let i = 0; i < 200; i++) {
        const task = await tasks.get(taskId);
        if (task.status === 'completed') return task;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error(`task for ${name} never completed`);
    }

    it('completes the task with the mapped result', async () => {
      const task = await completedTask('image');
      expect(task.result).toMatchObject({
        isError: false,
        content: [
          { type: 'text', text: 'a.png' },
          { type: 'image', data: PNG_BASE64, mimeType: 'image/png' },
        ],
      });
    });

    it('completes the task with the tool error result when toModelOutput or the transform throws', async () => {
      const mapping = await completedTask('throwingMapper');
      expect(mapping.result).toMatchObject({ isError: true });
      expect(JSON.parse(mapping.result!.content[0].text)).toMatchObject({ message: 'mapping failed' });
      const transform = await completedTask('linked');
      expect(JSON.parse(transform.result!.content[0].text)).toMatchObject({ message: 'transform failed' });
    });
  });
});
