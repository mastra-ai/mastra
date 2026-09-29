import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import type { MastraAuthConfig } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

const agentId = 'test-agent';
const headers = { Authorization: 'Bearer token' };

async function setup(auth?: MastraAuthConfig) {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const agent = new Agent({ id: agentId, name: 'Test', instructions: 'Test', model: 'openai/gpt-4o', memory });
  const mastra = new Mastra({ logger: false, storage, agents: { [agentId]: agent }, server: { auth } });
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return { app, memory };
}

function mutationUrl(threadId: string, action: string) {
  return `/api/memory/threads/${encodeURIComponent(threadId)}/${action}?agentId=${agentId}`;
}

describe('thread archiving HTTP contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('archives and restores without changing thread data, and filters before pagination', async () => {
    const { app, memory } = await setup();
    const original = await memory.createThread({
      threadId: 'a',
      resourceId: 'alice',
      title: 'Keep me',
      metadata: { key: 'value' },
    });
    await memory.createThread({ threadId: 'b', resourceId: 'alice' });
    await memory.createThread({ threadId: 'c', resourceId: 'alice' });
    for (const id of ['a', 'b']) {
      const response = await app.request(mutationUrl(id, 'archive'), { method: 'POST' });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.archivedAt).toEqual(expect.any(String));
      expect(new Date(body.archivedAt).toISOString()).toBe(body.archivedAt);
      if (id === 'a') {
        expect(body).toMatchObject({
          id: 'a',
          title: original.title,
          metadata: original.metadata,
          resourceId: 'alice',
          updatedAt: original.updatedAt.toISOString(),
        });
      }
    }
    for (const [filter, total, ids] of [
      ['', 3, ['a', 'b', 'c']],
      ['&archived=true', 2, ['a', 'b']],
      ['&archived=false', 1, ['c']],
    ] as const) {
      const response = await app.request(`/api/memory/threads?agentId=${agentId}&resourceId=alice${filter}`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.total).toBe(total);
      expect(body.threads.map((thread: { id: string }) => thread.id).sort()).toEqual(ids);
    }
    const pages = [];
    for (const page of [0, 1]) {
      const response = await app.request(
        `/api/memory/threads?agentId=${agentId}&resourceId=alice&archived=true&perPage=1&page=${page}`,
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.total).toBe(2);
      expect(body.threads).toHaveLength(1);
      pages.push(body.threads[0].id);
    }
    expect(pages.sort()).toEqual(['a', 'b']);
    for (const action of ['unarchive', 'unarchive']) {
      const response = await app.request(mutationUrl('a', action), { method: 'POST' });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ archivedAt: null, updatedAt: original.updatedAt.toISOString() });
    }
    const response = await app.request(`/api/memory/threads?agentId=${agentId}&archived=false&resourceId=alice`);
    expect(response.status).toBe(200);
    expect((await response.json()).threads.map((thread: { id: string }) => thread.id).sort()).toEqual(['a', 'c']);
  });

  it('preserves messages through repeated archive and restore requests', async () => {
    const { app, memory } = await setup();
    await memory.createThread({ threadId: 'thread', resourceId: 'alice' });
    await memory.saveMessages({
      messages: [
        {
          id: 'message',
          threadId: 'thread',
          resourceId: 'alice',
          role: 'user',
          type: 'text',
          content: 'Keep this message',
          createdAt: new Date(),
        },
      ],
    });
    const messagesUrl = `/api/memory/threads/thread/messages?agentId=${agentId}`;
    const before = await app.request(messagesUrl);
    expect(before.status).toBe(200);
    const original = await before.json();
    expect(original.messages).toHaveLength(1);
    for (const action of ['archive', 'archive', 'unarchive']) {
      const response = await app.request(mutationUrl('thread', action), { method: 'POST' });
      expect(response.status).toBe(200);
      const messages = await app.request(messagesUrl);
      expect(messages.status).toBe(200);
      expect(await messages.json()).toEqual(original);
    }
  });

  it.each(['archive', 'unarchive'])('rejects %s when authorization is denied', async action => {
    const { app, memory } = await setup({
      authenticateToken: async () => ({ id: 'alice' }),
      authorizeUser: () => false,
    });
    await memory.createThread({ threadId: 'thread', resourceId: 'alice' });
    const before = await memory.getThreadById({ threadId: 'thread' });
    const response = await app.request(mutationUrl('thread', action), { method: 'POST', headers });
    expect(response.status).toBe(403);
    expect(await memory.getThreadById({ threadId: 'thread' })).toEqual(before);
  });

  it.each(['archive', 'unarchive'])('returns 404 for %s of a missing thread', async action => {
    const { app } = await setup();
    const response = await app.request(mutationUrl('missing', action), { method: 'POST' });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'Thread not found' });
  });

  it.each(['archive', 'unarchive'])('decodes reserved characters in the %s thread ID', async action => {
    const { app, memory } = await setup();
    const threadId = 'thread/with ?& #%';
    await memory.createThread({ threadId, resourceId: 'alice' });
    const response = await app.request(mutationUrl(threadId, action), { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: threadId });
  });

  it.each(['yes', '1', 'invalid'])('rejects invalid archived filter %s', async archived => {
    const { app } = await setup();
    const response = await app.request(`/api/memory/threads?agentId=${agentId}&archived=${archived}`);
    expect(response.status).toBe(400);
  });

  it.each(['archive', 'unarchive'])('enforces authentication and ownership for %s', async action => {
    const { app, memory } = await setup({
      authenticateToken: async token => (token === 'token' ? { id: 'alice' } : null),
      authorizeUser: () => true,
      mapUserToResourceId: () => 'alice',
    });
    await memory.createThread({ threadId: 'bob-thread', resourceId: 'bob' });
    const unauthenticated = await app.request(mutationUrl('bob-thread', action), { method: 'POST' });
    expect(unauthenticated.status).toBe(401);
    const forbidden = await app.request(`${mutationUrl('bob-thread', action)}&resourceId=bob`, {
      method: 'POST',
      headers,
    });
    expect(forbidden.status).toBe(403);
    expect((await memory.getThreadById({ threadId: 'bob-thread' }))?.archivedAt).toBeFalsy();
    await memory.createThread({ threadId: 'alice-thread', resourceId: 'alice' });
    const allowed = await app.request(mutationUrl('alice-thread', action), { method: 'POST', headers });
    expect(allowed.status).toBe(200);
  });

  it('rejects gateway mutations and returns an empty archived page without fetching', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'test-gateway-key');
    vi.stubEnv('MASTRA_GATEWAY_URL', 'https://gateway.example.test');
    const agent = new Agent({ id: agentId, name: 'Gateway', instructions: 'Test', model: 'mastra/openai/gpt-5-mini' });
    const app = new Hono();
    await new MastraServer({ app, mastra: new Mastra({ logger: false, agents: { [agentId]: agent } }) }).init();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const action of ['archive', 'unarchive']) {
      const response = await app.request(mutationUrl('thread', action), { method: 'POST' });
      expect(response.status).toBe(501);
    }
    const response = await app.request(`/api/memory/threads?agentId=${agentId}&archived=true`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ threads: [], total: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
