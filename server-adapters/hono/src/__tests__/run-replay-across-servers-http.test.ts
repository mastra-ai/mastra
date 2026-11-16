import { once } from 'node:events';
import type { Server } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { EventedAgent, createDurableAgent } from '@mastra/core/agent/durable';
import { InMemoryServerCache } from '@mastra/core/cache';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

// Two servers share storage, the run bus and the replay cache, as replicas behind
// a load balancer do. A durable run executes on server A; once it finishes, its
// workflow rows are gone but its replay history is retained until cleanup. Any
// server must then let the owner observe it, and refuse everyone else —
// including a caller on the owner's resource who may not read the thread.
const users: Record<string, { id: string; resourceId: string }> = {
  alice: { id: 'alice', resourceId: 'alice' },
  'alice-no-read': { id: 'alice-no-read', resourceId: 'alice' },
  bob: { id: 'bob', resourceId: 'bob' },
};

const CLEANUP_MS = 1_500;

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

describe.each(['durable', 'evented'] as const)('finished run replay across servers: %s', kind => {
  const instances: { mastra: Mastra; server: Server }[] = [];
  afterEach(async () => {
    for (const { mastra, server } of instances.splice(0)) {
      await mastra.shutdown();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });

  async function startServers() {
    const storage = new InMemoryStore();
    const pubsub = new EventEmitterPubSub();
    const cache = new InMemoryServerCache();
    const memory = new MockMemory({ storage });
    await memory.createThread({ threadId: 'alice-thread', resourceId: 'alice' });
    const fga = {
      check: vi.fn(async () => true),
      require: vi.fn(async (user: { id: string }, { permission }: { permission: string | string[] }) => {
        const permissions = Array.isArray(permission) ? permission : [permission];
        if (user.id === 'alice-no-read' && permissions.includes('memory:read')) {
          throw Object.assign(new Error('read denied'), { status: 403 });
        }
      }),
      filterAccessible: vi.fn(async (_user: unknown, resources: unknown[]) => resources),
    };
    const start = async () => {
      const inner = new Agent({
        id: 'agent',
        name: 'Agent',
        instructions: 'Say done.',
        model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` })('gpt-4o-mini'),
        memory,
      });
      const mastra = new Mastra({
        logger: false,
        storage,
        pubsub,
        cache,
        agents: {
          agent:
            kind === 'durable'
              ? createDurableAgent({ agent: inner, cleanupTimeoutMs: CLEANUP_MS })
              : new EventedAgent({ agent: inner, cleanupTimeoutMs: CLEANUP_MS }),
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
      const app = new Hono();
      await new MastraServer({ app, mastra }).init();
      const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }) as Server;
      if (!server.listening) await once(server, 'listening');
      instances.push({ mastra, server });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
      const base = `http://127.0.0.1:${address.port}/api/agents/agent`;
      return async (path: string, token: string | undefined, body: unknown) => {
        const response = await fetch(`${base}/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5_000),
        });
        return { status: response.status, body: await response.text() };
      };
    };
    const a = await start();
    const b = await start();
    return { a, b, storage };
  }

  it('lets the owner observe the finished run from any server until cleanup, and nobody else', async () => {
    llm.on({ endpoint: 'chat' }, { content: 'retained replay proof' });
    const { a, b, storage } = await startServers();
    const runId = `replay-across-servers-${kind}`;

    const streamed = await a('stream', 'alice', {
      messages: 'Say done',
      runId,
      memory: { thread: 'alice-thread', resource: 'alice' },
    });
    expect(streamed.status).toBe(200);
    expect(streamed.body).toContain('retained replay proof');

    // Barrier: the run has finished and its workflow rows are gone, so only the
    // retained replay history and its owner remain.
    const workflows = await storage.getStore('workflows');
    await vi.waitFor(async () => {
      const { runs } = await workflows!.listWorkflowRuns({});
      expect(runs.filter(run => run.runId === runId)).toEqual([]);
    });

    for (const observe of [a, b]) {
      const replay = await observe('observe', 'alice', { runId });
      expect(replay.status).toBe(200);
      expect(replay.body).toContain('retained replay proof');
      expect(replay.body).toContain('"type":"finish"');
    }
    for (const observe of [a, b]) {
      expect((await observe('observe', 'bob', { runId })).status).toBe(403);
      expect((await observe('observe', 'alice-no-read', { runId })).status).toBe(403);
      expect((await observe('observe', undefined, { runId })).status).toBe(401);
    }
    // Replay ownership grants reading only: the finished run is not reported stopped.
    expect(await b(`runs/${runId}/abort`, 'alice', {})).toEqual({ status: 200, body: '{"aborted":false}' });

    await new Promise(resolve => setTimeout(resolve, CLEANUP_MS + 500));
    for (const observe of [a, b]) {
      expect((await observe('observe', 'alice', { runId })).status).toBe(404);
    }
  });

  it('never lets a caller observe a run unknown to every server', async () => {
    const { a, b } = await startServers();
    for (const observe of [a, b]) {
      expect((await observe('observe', 'alice', { runId: 'never-ran' })).status).toBe(404);
    }
  });
});
