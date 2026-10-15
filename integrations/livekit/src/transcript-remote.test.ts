import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { initializeLogger, llm, voice } from '@livekit/agents';
import { MastraClient } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MastraServer } from '@mastra/hono';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MastraLLM } from './llm-plugin';
import { createLiveKitTranscriptPersistence } from './transcript';

beforeAll(() => initializeLogger({ level: 'silent', pretty: false }));
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function serverFixture() {
  const storage = new LibSQLStore({ id: crypto.randomUUID(), url: ':memory:' });
  cleanups.push(() => storage.close());
  const memory = new Memory({ storage, options: { lastMessages: 20, semanticRecall: false } });
  const contexts: unknown[] = [];
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'reply' },
          { type: 'text-delta', id: 'reply', delta: 'Remote generated draft' },
          { type: 'text-end', id: 'reply' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
      };
    },
  });
  const agent = new Agent({
    id: 'support',
    name: 'Support',
    instructions: 'Help.',
    model,
    memory: ({ requestContext }) => {
      contexts.push(requestContext.get('tenant'));
      return memory;
    },
  });
  const mastra = new Mastra({
    agents: { support: agent },
    storage,
    logger: false,
    server: {
      auth: {
        protected: ['/voice-api/*'],
        authenticateToken: async token => (token === 'test-token' ? { id: 'caller' } : null),
        authorize: async () => true,
      },
    },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra, prefix: '/voice-api' }).init();
  const requests: Request[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    // Use the real server router, authentication, schemas, and Memory handlers.
    return app.fetch(request);
  };
  const client = new MastraClient({
    baseUrl: 'http://mastra.test',
    apiPrefix: '/voice-api',
    headers: { Authorization: 'Bearer test-token' },
    fetch,
    retries: 0,
  });
  return { memory, agent, requests, client, fetch, contexts, prompts };
}

describe('remote transcript persistence through the existing authenticated Mastra server', () => {
  it('uses the same prefix, credentials, request context and thread for generation and persistence', async () => {
    const f = await serverFixture();
    const persistence = await createLiveKitTranscriptPersistence({
      remote: { client: f.client, agentId: 'support' },
      sessionId: 'job',
      memory: { thread: 'thread', resource: 'caller' },
      requestContext: { tenant: 'acme' },
    });
    const plugin = new MastraLLM({ transcriptPersistence: persistence });
    const session = new voice.AgentSession({});
    persistence.attach(session);
    cleanups.push(() => persistence.close());
    const user = llm.ChatMessage.create({ id: 'u', role: 'user', content: 'My question' });
    session.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
      type: voice.AgentSessionEventTypes.ConversationItemAdded,
      item: user,
      createdAt: Date.now(),
    });
    const stream = plugin.chat({
      chatCtx: new llm.ChatContext([user]),
      connOptions: { maxRetry: 0, retryIntervalMs: 0, timeoutMs: 1000 },
    });
    let text = '';
    for await (const chunk of stream) text += chunk.delta?.content ?? '';
    expect(text).toBe('Remote generated draft');
    const partial = llm.ChatMessage.create({ id: 'a', role: 'assistant', content: 'Remote spoken', interrupted: true });
    session.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
      type: voice.AgentSessionEventTypes.ConversationItemAdded,
      item: partial,
      createdAt: Date.now(),
    });
    await persistence.flush();
    const rows = (await f.memory.recall({ threadId: 'thread', resourceId: 'caller' })).messages;
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain('Remote generated draft');
    expect(rows[1]?.content.metadata).toMatchObject({ interrupted: true, liveKitItemId: 'a' });
    expect(f.contexts.length).toBeGreaterThan(3);
    expect(f.contexts.every(value => value === 'acme')).toBe(true);
    expect(f.requests.every(request => new URL(request.url).pathname.startsWith('/voice-api/'))).toBe(true);
    expect(f.requests.every(request => request.headers.get('Authorization') === 'Bearer test-token')).toBe(true);
    const generation = f.requests.find(request => request.url.endsWith('/agents/support/stream'))!;
    expect(await generation.json()).toMatchObject({
      memory: { thread: 'thread', resource: 'caller', options: { readOnly: true } },
    });
    expect(JSON.stringify(f.prompts[0]).match(/My question/g)).toHaveLength(1);
  });

  it('fails setup for missing authorization, conflicting resource, and unsupported overrides', async () => {
    const f = await serverFixture();
    const badClient = new MastraClient({ ...f.client.options, headers: {} });
    await expect(
      createLiveKitTranscriptPersistence({
        remote: { client: badClient, agentId: 'support' },
        sessionId: 'j',
        memory: { thread: 't', resource: 'caller' },
      }),
    ).rejects.toMatchObject({ status: 401 });
    await f.memory.createThread({ threadId: 't', resourceId: 'owner' });
    await expect(
      createLiveKitTranscriptPersistence({
        remote: { client: f.client, agentId: 'support' },
        sessionId: 'j',
        memory: { thread: 't', resource: 'intruder' },
      }),
    ).rejects.toThrow(/different resource/);
    await expect(
      createLiveKitTranscriptPersistence({
        remote: { client: f.client, agentId: 'support' },
        sessionId: 'j',
        memory: { thread: 't', options: { semanticRecall: false } },
      }),
    ).rejects.toThrow(/overrides/);
  });

  it('reuses the client retry behavior after a saved response is lost', async () => {
    const f = await serverFixture();
    let lost = false;
    const client = new MastraClient({
      ...f.client.options,
      retries: 1,
      backoffMs: 1,
      fetch: async (input, init) => {
        const response = await f.fetch(input, init);
        if (String(input).includes('/memory/save-messages') && !lost) {
          lost = true;
          throw new Error('lost acknowledgement');
        }
        return response;
      },
    });
    const persistence = await createLiveKitTranscriptPersistence({
      remote: { client, agentId: 'support' },
      sessionId: 'j',
      memory: { thread: 't', resource: 'caller' },
    });
    new MastraLLM({ transcriptPersistence: persistence });
    const session = new voice.AgentSession({});
    persistence.attach(session);
    cleanups.push(() => persistence.close());
    const item = llm.ChatMessage.create({ id: 'u', role: 'user', content: 'Retry me' });
    session.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
      type: voice.AgentSessionEventTypes.ConversationItemAdded,
      item,
      createdAt: Date.now(),
    });
    expect(await persistence.flush()).toEqual({ saved: 1, failed: 0, pending: 0 });
    expect((await f.memory.recall({ threadId: 't', resourceId: 'caller' })).messages).toHaveLength(1);
    const saves = await Promise.all(
      f.requests.filter(request => request.url.includes('/memory/save-messages')).map(request => request.json()),
    );
    expect(saves).toHaveLength(2);
    expect(saves[0]).toEqual(saves[1]);
  });
});
