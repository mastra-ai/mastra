import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CreateTaskResultSchema, tasksCapabilityEntry } from '../../shared/tasks';
import type { MCPTask } from '../../shared/tasks';
import { emitTaskResults, taskHandleResult, taskOfHandleResult } from './emit';
import { InMemoryMCPTaskStore } from './in-memory-store';

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

/** A real SDK server whose tools hand back tasks, and a real client recording raw response bodies. */
async function start() {
  const store = new InMemoryMCPTaskStore();
  const createServerForRequest = () => {
    const mcpServer = new McpServer(
      { name: 'emit-test', version: '1.0.0' },
      { capabilities: { tools: {}, extensions: tasksCapabilityEntry() } },
    );
    const connect = mcpServer.server.connect.bind(mcpServer.server);
    mcpServer.server.connect = async transport => {
      emitTaskResults(transport);
      return connect(transport);
    };
    const startTask = async () =>
      taskHandleResult(await store.create({ ttlMs: 60_000, principal: 'anonymous', pollIntervalMs: 250 }));
    mcpServer.registerTool('report', { description: 'Builds a report' }, startTask);
    // The output schema would reject a plain placeholder result if the SDK validated it.
    mcpServer.registerTool('totals', { description: 'Sums', outputSchema: { total: z.number() } }, startTask);
    mcpServer.registerTool('quick', { description: 'Answers inline' }, async () => ({
      content: [{ type: 'text', text: 'done' }],
      _meta: { 'example.com/trace': 'kept' },
    }));
    return mcpServer.server;
  };
  const handler = toNodeHandler(createMcpHandler(createServerForRequest, { legacy: 'reject' }));
  const httpServer: HttpServer = createServer((req, res) => void handler(req, res));
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const { port } = httpServer.address() as AddressInfo;

  const bodies: unknown[] = [];
  const recordingFetch = async (url: string | URL, init?: RequestInit) => {
    const response = await globalThis.fetch(url, init);
    if (init?.method === 'POST' && typeof init.body === 'string' && JSON.parse(init.body).method === 'tools/call') {
      bodies.push(parseBody(await response.clone().text()));
    }
    return response;
  };
  const client = new Client(
    { name: 'emit-test-client', version: '1.0.0' },
    { capabilities: { extensions: tasksCapabilityEntry() }, versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { fetch: recordingFetch }),
  );
  close = async () => {
    await client.close();
    store.close();
    httpServer.closeAllConnections();
    await new Promise(resolve => httpServer.close(resolve));
  };
  return { client, store, bodies };
}

/** Streamable HTTP answers with JSON or a single-event SSE stream. */
function parseBody(text: string): unknown {
  const data = text
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim());
  return JSON.parse(data.length > 0 ? data.join('') : text);
}

const resultOf = (body: unknown) => (body as { result: Record<string, unknown> }).result;

describe('taskOfHandleResult', () => {
  it('finds the task in a handle and in nothing else', () => {
    const task = { taskId: 'secret-id', status: 'working', createdAt: '', lastUpdatedAt: '', ttlMs: 1 } as MCPTask;
    const handle = taskHandleResult(task);
    expect(taskOfHandleResult(handle)).toBe(task);
    expect(JSON.stringify(handle.content)).not.toContain('secret-id');
    expect(taskOfHandleResult({ content: [], _meta: { other: 1 } })).toBeUndefined();
    expect(taskOfHandleResult(undefined)).toBeUndefined();
  });
});

describe('emitTaskResults', () => {
  it('sends a CreateTaskResult that the task store can serve', async () => {
    const { client, store, bodies } = await start();

    // A plain SDK client can't accept tasks on tools/call yet; MCPClient intercepts them.
    await expect(client.callTool({ name: 'report', arguments: {} })).rejects.toThrow(/task/);

    const result = resultOf(bodies[0]);
    expect(CreateTaskResultSchema.parse(result)).toMatchObject({
      resultType: 'task',
      status: 'working',
      ttlMs: 60_000,
    });
    expect(result).not.toHaveProperty('isError');
    expect(result).not.toHaveProperty('content');
    // The SDK's own result metadata survives; the internal marker does not.
    expect(result._meta).toEqual({ 'io.modelcontextprotocol/serverInfo': { name: 'emit-test', version: '1.0.0' } });
    expect(await store.get(result.taskId as string, { principal: 'anonymous' })).toMatchObject({ status: 'working' });
  });

  it('is not blocked by the output schema of the tool', async () => {
    const { client, bodies } = await start();

    await expect(client.callTool({ name: 'totals', arguments: {} })).rejects.toThrow(/task/);
    expect(resultOf(bodies[0])).toMatchObject({ resultType: 'task', status: 'working' });
  });

  it('leaves ordinary results untouched', async () => {
    const { client, bodies } = await start();

    expect(await client.callTool({ name: 'quick', arguments: {} })).toMatchObject({ content: [{ text: 'done' }] });
    expect(resultOf(bodies[0])).toMatchObject({
      resultType: 'complete',
      content: [{ type: 'text', text: 'done' }],
      _meta: { 'example.com/trace': 'kept' },
    });
  });
});
