import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { CompositeAuth } from '@mastra/core/server';
import type { MastraAuthConfig } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

async function setup(auth: MastraAuthConfig) {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const agent = new Agent({
    id: 'test-agent',
    name: 'Test agent',
    instructions: 'Test',
    model: 'openai/gpt-4o',
    memory,
  });
  const mastra = new Mastra({ logger: false, storage, agents: { 'test-agent': agent }, server: { auth } });
  await memory.createThread({ threadId: 'alice-thread', resourceId: 'alice' });
  await memory.createThread({ threadId: 'bob-thread', resourceId: 'bob' });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return { app, memory, agent };
}

const headers = { Authorization: 'Bearer token', 'Content-Type': 'application/json' };
const authenticateToken = async () => ({ id: 'bob' });

const requests = [
  { path: '/api/memory/threads?agentId=test-agent&resourceId=alice', method: 'GET' },
  { path: '/api/agents/test-agent/suspended-runs?resourceId=alice', method: 'GET' },
  {
    path: '/api/agents/test-agent/stream',
    method: 'POST',
    body: JSON.stringify({ messages: [], resourceId: 'alice' }),
  },
  { path: '/api/v1/responses/alice-response', method: 'GET' },
  { path: '/api/v1/responses/alice-response', method: 'DELETE' },
];

describe('resource mapping at the HTTP authentication boundary', () => {
  it.each(requests)('rejects failed mapping before $method $path accesses memory', async ({ path, ...request }) => {
    const { app, memory, agent } = await setup({ authenticateToken, mapUserToResourceId: () => undefined });
    const listThreads = vi.spyOn(memory, 'listThreads');
    const getThread = vi.spyOn(memory, 'getThreadById');
    const listRuns = vi.spyOn(agent, 'listSuspendedRuns');
    const stream = vi.spyOn(agent, 'stream');
    const response = await app.request(`http://localhost${path}`, { ...request, headers });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to map authenticated user to a resource ID' });
    expect(listThreads).not.toHaveBeenCalled();
    expect(getThread).not.toHaveBeenCalled();
    expect(listRuns).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
  });

  it.each(['mapped', 'unmapped', 'failed'] as const)(
    'uses the selected %s provider in a mixed composite',
    async mode => {
      const selected = {
        authenticateToken,
        authorizeUser: () => true,
        ...(mode === 'unmapped' ? {} : { mapUserToResourceId: () => (mode === 'mapped' ? 'bob' : undefined) }),
      };
      const { app, agent } = await setup(
        new CompositeAuth([
          { authenticateToken: async () => null, authorizeUser: () => true, mapUserToResourceId: () => 'alice' },
          selected,
        ]),
      );
      const response = await app.request('http://localhost/api/memory/threads?agentId=test-agent&resourceId=alice', {
        headers,
      });
      expect(response.status).toBe(mode === 'failed' ? 500 : 200);
      const listRuns = vi.spyOn(agent, 'listSuspendedRuns');
      const runsResponse = await app.request('http://localhost/api/agents/test-agent/suspended-runs?resourceId=alice', {
        headers,
      });
      expect(runsResponse.status).toBe(mode === 'failed' ? 500 : 200);
      if (mode !== 'failed') {
        expect(await response.json()).toMatchObject({
          threads: [{ id: mode === 'mapped' ? 'bob-thread' : 'alice-thread' }],
        });
        expect(listRuns).toHaveBeenCalledWith(
          expect.objectContaining({ resourceId: mode === 'mapped' ? 'bob' : 'alice' }),
        );
      } else {
        expect(listRuns).not.toHaveBeenCalled();
      }
    },
  );
});
