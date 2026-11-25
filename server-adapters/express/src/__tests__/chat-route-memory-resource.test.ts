import type { Server } from 'node:http';
import { chatRoute } from '@mastra/ai-sdk';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { Memory } from '@mastra/memory';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

const RESOURCE_REQUIRED =
  'A resource ID is required when using memory. Provide memory.resource in the request body, or configure server auth with mapUserToResourceId to derive it from the authenticated user.';

const messages = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }];

describe('chatRoute memory resource validation through Express', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server!.close(error => (error ? reject(error) : resolve())));
    server = undefined;
  });

  async function start({ auth = false }: { auth?: boolean } = {}) {
    const storage = new InMemoryStore();
    const model = () => createMockModel({ mockText: 'hello' });
    const memoryAgent = new Agent({
      id: 'memory-agent',
      name: 'Memory agent',
      instructions: 'Reply briefly.',
      model: model(),
      memory: new Memory({ storage, options: { lastMessages: 10, generateTitle: false } }),
    });
    const plainAgent = new Agent({
      id: 'plain-agent',
      name: 'Plain agent',
      instructions: 'Reply briefly.',
      model: model(),
    });
    const mastra = new Mastra({
      agents: { memoryAgent, plainAgent },
      storage,
      logger: false,
    });
    if (auth) {
      const originalGetServer = mastra.getServer.bind(mastra);
      mastra.getServer = () =>
        ({
          ...originalGetServer(),
          auth: {
            authenticateToken: async (token: string) => (token === 'user-token' ? { id: 'user-1' } : null),
            authorize: async () => true,
            mapUserToResourceId: (user: { id: string }) => `resource-${user.id}`,
          },
        }) as any;
    }

    const app = express();
    app.use(express.json());
    const adapter = new MastraServer({
      app,
      mastra,
      customApiRoutes: [
        chatRoute({ path: '/chat/:agentId' }),
        ...chatRoute({ path: '/resumable-chat/:agentId', resumable: true }),
      ],
    });
    await adapter.init();

    const listening: Server = await new Promise(resolve => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    server = listening;
    const address = listening.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    return async (path: string, body: Record<string, unknown>, headers: Record<string, string> = {}) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, text };
    };
  }

  // chatRoute used to return a bare 500 here while the agent API returned a helpful 400.
  it('chatRoute rejects a memory thread without a resource with the same 400 as the agent API', async () => {
    const post = await start();
    const agentApi = await post('/api/agents/memory-agent/stream', { messages, memory: { thread: 't-1' } });
    expect(agentApi.status).toBe(400);
    expect(JSON.parse(agentApi.text).error).toBe(RESOURCE_REQUIRED);

    const res = await post('/chat/memory-agent', { messages, memory: { thread: 't-1' } });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.text)).toEqual({ error: RESOURCE_REQUIRED });
  });

  it('resumable chatRoute rejects a chat without a trusted resource with the same 400', async () => {
    const post = await start();
    const res = await post('/resumable-chat/memory-agent', { id: 't-1', messages });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.text)).toEqual({ error: RESOURCE_REQUIRED });
  });

  it('resumable chatRoute still refuses a body resource instead of trusting it', async () => {
    const post = await start();
    const res = await post('/resumable-chat/memory-agent', {
      id: 't-1',
      messages,
      memory: { thread: 't-1', resource: 'body-resource' },
    });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).error).toContain('Resumable chat resource IDs must be set by authentication');
  });

  it('chatRoute streams when the body provides the resource', async () => {
    const post = await start();
    const res = await post('/chat/memory-agent', { messages, memory: { thread: 't-1', resource: 'r-1' } });
    expect(res.status).toBe(200);
    expect(res.text).toContain('hello');
  });

  it('both chat routes stream when auth derives the resource from the user', async () => {
    const post = await start({ auth: true });
    const authHeader = { Authorization: 'Bearer user-token' };

    const plain = await post('/chat/memory-agent', { messages, memory: { thread: 't-1' } }, authHeader);
    expect(plain.status).toBe(200);
    expect(plain.text).toContain('hello');

    const resumable = await post('/resumable-chat/memory-agent', { id: 't-2', messages }, authHeader);
    expect(resumable.status).toBe(200);
    expect(resumable.text).toContain('hello');
  });

  it('chatRoute is unchanged when no thread is sent or the agent has no memory', async () => {
    const post = await start();

    const noThread = await post('/chat/memory-agent', { messages });
    expect(noThread.status).toBe(200);
    expect(noThread.text).toContain('hello');

    const noMemory = await post('/chat/plain-agent', { messages, memory: { thread: 't-1' } });
    expect(noMemory.status).toBe(200);
    expect(noMemory.text).toContain('hello');
  });
});
