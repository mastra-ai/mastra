import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RequestContext } from '@mastra/core/request-context';
import { Client, ProtocolError, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryMCPTaskStore } from '../../server/tasks';
import { registerTaskHandlers } from '../../server/tasks/handlers';
import { TASKS_ERROR_CODES, TASKS_EXTENSION_ID, tasksCapabilityEntry } from '../../shared/tasks';
import { TaskRequester } from './requester';

interface Harness {
  httpServer: HttpServer;
  client: Client;
  requester: TaskRequester;
  store: InMemoryMCPTaskStore;
  /** Principal the server resolves for the next request. */
  as: (principal: string) => void;
  /** Every request the client sent: JSON-RPC method plus routing headers. */
  sent: { method: string; mcpName: string | null; mcpMethod: string | null }[];
}

let harness: Harness | undefined;

async function start(): Promise<Harness> {
  const store = new InMemoryMCPTaskStore();
  let principal = 'alice';
  const createServerForRequest = () => {
    const mcpServer = new McpServer(
      { name: 'tasks-test-server', version: '1.0.0' },
      { capabilities: { tools: {}, extensions: tasksCapabilityEntry() } },
    );
    mcpServer.registerTool('noop', { description: 'noop' }, async () => ({ content: [] }));
    registerTaskHandlers(mcpServer.server, {
      store,
      trace: (_server, _method, _params, _ctx, fn) => fn(new RequestContext()),
      principal: () => principal,
    });
    return mcpServer.server;
  };
  const handler = toNodeHandler(createMcpHandler(createServerForRequest, { legacy: 'reject' }));
  const httpServer = createServer((req, res) => void handler(req, res));
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const { port } = httpServer.address() as AddressInfo;

  const sent: Harness['sent'] = [];
  const recordingFetch = async (url: string | URL, init?: RequestInit) => {
    if (init?.method === 'POST' && typeof init.body === 'string') {
      const headers = new Headers(init.headers);
      sent.push({
        method: JSON.parse(init.body).method,
        mcpName: headers.get('mcp-name'),
        mcpMethod: headers.get('mcp-method'),
      });
    }
    return globalThis.fetch(url, init);
  };
  const client = new Client(
    { name: 'tasks-test-client', version: '1.0.0' },
    { capabilities: { extensions: tasksCapabilityEntry() }, versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { fetch: recordingFetch }),
  );
  return {
    httpServer,
    client,
    requester: new TaskRequester(client),
    store,
    as: next => {
      principal = next;
    },
    sent,
  };
}

afterEach(async () => {
  if (!harness) return;
  await harness.client.close();
  harness.store.close();
  await new Promise(resolve => harness!.httpServer.close(resolve));
  harness = undefined;
});

describe('MCP Tasks wire (2026-07-28)', () => {
  it('negotiates the extension on the modern revision', async () => {
    harness = await start();
    expect(harness.client.getServerCapabilities()?.extensions?.[TASKS_EXTENSION_ID]).toEqual({});
  });

  it('reads, answers and cancels tasks over HTTP with the Mcp-Name routing header', async () => {
    harness = await start();
    const { store, requester, sent } = harness;
    const { taskId } = await store.create({ ttlMs: 60_000, principal: 'alice' });
    const handle = store.handle(taskId);
    const answered = handle.requireInput({
      confirm: {
        method: 'elicitation/create',
        params: { mode: 'form', message: 'Proceed?', requestedSchema: { type: 'object', properties: {} } },
      },
    });

    expect(await requester.get(taskId)).toMatchObject({
      taskId,
      status: 'input_required',
      inputRequests: { confirm: { method: 'elicitation/create' } },
      ttlMs: 60_000,
      pollIntervalMs: 2_000,
    });

    await requester.update(taskId, { confirm: { action: 'accept', content: {} } });
    expect(await answered).toEqual({ confirm: { action: 'accept', content: {} } });
    handle.complete({ content: [{ type: 'text', text: 'done' }] });

    const completed = await requester.get(taskId);
    expect(completed).toMatchObject({ status: 'completed', result: { content: [{ type: 'text', text: 'done' }] } });
    expect(completed).not.toHaveProperty('resultType');

    const second = await store.create({ ttlMs: null, principal: 'alice' });
    await requester.cancel(second.taskId);
    expect(store.handle(second.taskId).signal.aborted).toBe(true);
    expect(await requester.get(second.taskId)).toMatchObject({ status: 'cancelled', ttlMs: null });

    const taskRequests = sent.filter(request => request.method.startsWith('tasks/'));
    expect(taskRequests.map(request => request.method)).toEqual([
      'tasks/get',
      'tasks/update',
      'tasks/get',
      'tasks/cancel',
      'tasks/get',
    ]);
    expect(taskRequests.map(({ mcpName, mcpMethod }) => ({ mcpName, mcpMethod }))).toEqual([
      { mcpName: taskId, mcpMethod: 'tasks/get' },
      { mcpName: taskId, mcpMethod: 'tasks/update' },
      { mcpName: taskId, mcpMethod: 'tasks/get' },
      { mcpName: second.taskId, mcpMethod: 'tasks/cancel' },
      { mcpName: second.taskId, mcpMethod: 'tasks/get' },
    ]);
  });

  it('answers unknown and foreign tasks with the same -32602', async () => {
    harness = await start();
    const { store, requester } = harness;
    const { taskId } = await store.create({ ttlMs: null, principal: 'alice' });
    harness.as('mallory');

    const errors = await Promise.all([
      requester.get(taskId).catch(error => error),
      requester.update(taskId, {}).catch(error => error),
      requester.cancel(taskId).catch(error => error),
      requester.get('no-such-task').catch(error => error),
    ]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(ProtocolError);
      expect(error).toMatchObject({ code: TASKS_ERROR_CODES.InvalidParams, message: expect.stringContaining('Task not found') });
    }
    expect(store.handle(taskId).signal.aborted).toBe(false);
  });
});
