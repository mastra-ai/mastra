import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

async function setup() {
  const storage = new InMemoryStore();
  const memory = new Memory({ storage });
  const mastra = new Mastra({
    logger: false,
    storage,
    agents: { agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Test', model: 'openai/gpt-4o', memory }) },
  });
  const memoryStore = (await storage.getStore('memory'))!;
  await memoryStore.saveThread({
    thread: { id: 'source', resourceId: 'user-1', createdAt: new Date(), updatedAt: new Date() },
  });
  await memoryStore.saveMessages({
    messages: ['m1', 'm2', 'm3'].map((id, i) => ({
      id,
      threadId: 'source',
      resourceId: 'user-1',
      role: 'user' as const,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: id }] },
    })),
  });

  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  const clone = (options: Record<string, unknown>) =>
    app.request('/api/memory/threads/source/clone?agentId=agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options }),
    });
  const threadCount = async () => (await memoryStore.listThreads({ filter: { resourceId: 'user-1' } })).threads.length;
  return { clone, threadCount };
}

describe('POST /memory/threads/:threadId/clone with contextWindowOnly', () => {
  it.each([
    ['an empty filter', { messageFilter: {} }],
    ['a limit', { messageLimit: 1 }],
    ['a zero limit', { messageLimit: 0 }],
  ])('answers 400 and clones nothing when contextWindowOnly comes with %s', async (_, selection) => {
    const { clone, threadCount } = await setup();

    const response = await clone({ contextWindowOnly: true, ...selection });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request body');
    expect(body.issues.map((issue: { field: string }) => issue.field)).toEqual(['options.contextWindowOnly']);
    expect(await threadCount()).toBe(1);
  });

  it('copies every message for contextWindowOnly when memory has observed nothing', async () => {
    const { clone } = await setup();

    const response = await clone({ contextWindowOnly: true });

    expect(response.status).toBe(200);
    expect((await response.json()).clonedMessages).toHaveLength(3);
  });

  it('applies the limit when contextWindowOnly is false', async () => {
    const { clone } = await setup();

    const response = await clone({ contextWindowOnly: false, messageLimit: 1 });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      body.clonedMessages.map((m: { content: { parts: { text: string }[] } }) => m.content.parts[0]!.text),
    ).toEqual(['m3']);
  });
});
