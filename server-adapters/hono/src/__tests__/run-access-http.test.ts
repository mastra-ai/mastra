import { once } from 'node:events';
import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

// Observe needs read access to the run's thread, abort needs write access. Every
// caller below hits the public routes over real TCP while a real run is executing.
const users: Record<string, { id: string; resourceId: string }> = {
  alice: { id: 'alice', resourceId: 'alice' },
  'alice-viewer': { id: 'alice-viewer', resourceId: 'alice' },
  'alice-no-read': { id: 'alice-no-read', resourceId: 'alice' },
  bob: { id: 'bob', resourceId: 'bob' },
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

describe.each(['plain', 'durable'] as const)('run observe/abort authorization over HTTP: %s', kind => {
  let mastra: Mastra | undefined;
  let server: Server | undefined;
  afterEach(async () => {
    await mastra?.shutdown();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close(error => (error ? reject(error) : resolve())));
    }
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
    mastra = undefined;
    server = undefined;
  });

  // inModelCall parks the run in its first model call, before the loop checkpoints its input.
  async function setup({ inModelCall = false } = {}) {
    const entered = deferred();
    let toolSignal: AbortSignal | undefined;
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const wait = createTool({
      id: 'wait',
      description: 'Wait for work',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        toolSignal = context?.abortSignal;
        entered.resolve();
        await new Promise<void>(resolve => {
          if (toolSignal?.aborted) return resolve();
          toolSignal?.addEventListener('abort', () => resolve(), { once: true });
        });
        return { waited: true };
      },
    });
    const inner = new Agent({
      id: 'agent',
      name: 'Agent',
      instructions: 'Wait.',
      model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` })('gpt-4o-mini'),
      memory,
      tools: { wait },
    });
    const other = new Agent({ id: 'other', name: 'Other', instructions: 'Idle.', model: inner.model as any });
    const fga = {
      check: vi.fn(async () => true),
      require: vi.fn(async (user: { id: string }, { permission }: { permission: string | string[] }) => {
        const permissions = Array.isArray(permission) ? permission : [permission];
        if (user.id === 'alice-no-read' && permissions.includes('memory:read')) {
          throw Object.assign(new Error('read denied'), { status: 403 });
        }
        if (user.id === 'alice-viewer' && permissions.some(p => p.endsWith(':write'))) {
          throw Object.assign(new Error('write denied'), { status: 403 });
        }
      }),
      filterAccessible: vi.fn(async (_user: unknown, resources: unknown[]) => resources),
    };
    mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        agent: kind === 'durable' ? createDurableAgent({ agent: inner }) : inner,
        other: kind === 'durable' ? createDurableAgent({ agent: other }) : other,
      },
      server: {
        auth: {
          authenticateToken: async (token: string) => users[token] ?? null,
          authorizeUser: () => true,
          mapUserToResourceId: (user: { resourceId: string }) => user.resourceId,
        },
        fga: fga as any,
      },
    });
    await memory.createThread({ threadId: 'alice-thread', resourceId: 'alice' });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }) as Server;
    if (!server.listening) await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    const base = `http://127.0.0.1:${address.port}/api/agents`;
    const post = (path: string, token?: string, body?: unknown) =>
      fetch(`${base}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

    if (inModelCall) llm.on({ endpoint: 'chat' }, { content: 'done' }, { latency: 20_000 });
    else {
      llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { toolCalls: [{ id: 'wait-1', name: 'wait', arguments: '{}' }] });
      llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'done' });
    }
    const runId = `run-access-${kind}-${inModelCall}`;
    const client = new AbortController();
    const streaming = fetch(`${base}/agent/stream`, {
      method: 'POST',
      signal: client.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer alice' },
      body: JSON.stringify({ messages: 'Start', runId, memory: { thread: 'alice-thread', resource: 'alice' } }),
    })
      .then(response => response.text())
      .catch(error => {
        if (error.name !== 'AbortError') throw error;
      });
    if (inModelCall) await vi.waitFor(() => expect(llm.getRequests()).toHaveLength(1));
    else await entered.promise;
    return { post, runId, toolSignal: () => toolSignal, fga, stop: () => client.abort(), streaming };
  }

  it('lets the owner and a read-only viewer watch, and only the writer stop, a running run', async () => {
    const { post, runId, toolSignal, fga, stop, streaming } = await setup();
    try {
      expect((await post('agent/observe', undefined, { runId })).status).toBe(401);
      expect((await post('agent/observe', 'bob', { runId })).status).toBe(403);
      const denied = await post('agent/observe', 'alice-no-read', { runId });
      await denied.body?.cancel();
      expect(denied.status).toBe(403);
      expect((await post('agent/observe', 'alice', { runId: 'unknown-run' })).status).toBe(404);

      for (const token of ['alice', 'alice-viewer']) {
        const response = await post('agent/observe', token, { runId });
        expect(response.status).toBe(200);
        await response.body?.cancel();
      }

      expect((await post(`agent/runs/${runId}/abort`)).status).toBe(401);
      expect((await post(`agent/runs/${runId}/abort`, 'bob')).status).toBe(403);
      expect((await post(`agent/runs/${runId}/abort`, 'alice-viewer')).status).toBe(403);
      expect(fga.require).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'alice-viewer' }),
        expect.objectContaining({ resource: { type: 'thread', id: 'alice-thread' }, permission: 'memory:write' }),
      );
      expect((await post(`other/runs/${runId}/abort`, 'alice')).status).toBe(kind === 'plain' ? 404 : 403);
      const unknown = await post('agent/runs/unknown-run/abort', 'alice');
      if (kind === 'plain') expect(unknown.status).toBe(404);
      else expect(await unknown.json()).toEqual({ aborted: false });
      expect(toolSignal()?.aborted).toBe(false);

      const response = await post(`agent/runs/${runId}/abort`, 'alice');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ aborted: true });
      await vi.waitFor(() => expect(toolSignal()?.aborted).toBe(true));
    } finally {
      stop();
      await streaming;
    }
  });

  it('lets only the writer stop a run during its first model call', async () => {
    const { post, runId, stop, streaming } = await setup({ inModelCall: true });
    try {
      expect((await post(`agent/runs/${runId}/abort`, 'bob')).status).toBe(403);
      expect((await post(`agent/runs/${runId}/abort`, 'alice-viewer')).status).toBe(403);
      const watching = await post('agent/observe', 'alice-viewer', { runId });
      expect(watching.status).toBe(200);
      await watching.body?.cancel();

      const response = await post(`agent/runs/${runId}/abort`, 'alice');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ aborted: true });
    } finally {
      stop();
      await streaming;
    }
  });
});
