import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createOpenAI as createOpenAIV1 } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV3 } from '@ai-sdk/openai-ai6';
import { createOpenAI as createOpenAIV2 } from '@ai-sdk/openai-v5';
import { createOpenAI as createOpenAIV4 } from '@ai-sdk/openai-v6';
import { LLMock } from '@copilotkit/aimock';
import { InMemoryStore } from '@mastra/core/storage';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const savedText = 'My preferred meeting time is nine in the morning.';
const queryText = 'When should we schedule a meeting?';
const embedding = [0.6, 0.8, 0];
let mock: LLMock;
let vector: LibSQLVector;
const requests: Record<string, unknown>[] = [];
// AIMock's embedding journal omits dimensions/user. Record the real HTTP body before forwarding to AIMock.
const proxy = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  requests.push(JSON.parse(body));
  const upstream = await fetch(`${mock.url}${request.url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  response.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  response.end(await upstream.text());
});
let baseURL: string;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  baseURL = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await vector?.close();
  mock.reset();
  requests.length = 0;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => proxy.close(error => (error ? reject(error) : resolve())));
  await mock.stop();
});

describe.each([
  { version: 'v1', createOpenAI: createOpenAIV1 },
  { version: 'v2', createOpenAI: createOpenAIV2 },
  { version: 'v3', createOpenAI: createOpenAIV3 },
  { version: 'v4', createOpenAI: createOpenAIV4 },
])('Memory embedding specification $version', ({ version, createOpenAI }) => {
  // #26884: the legacy SDK fallback rejects v4 models. Routing to the matching SDK must preserve provider options.
  it('saves and semantically recalls messages using the configured embedding model', async () => {
    mock.onEmbedding(savedText, { embedding });
    mock.onEmbedding(queryText, { embedding });
    vector = new LibSQLVector({ id: `embedding-${version}`, url: ':memory:' });
    const embedder = createOpenAI({ apiKey: 'test-key', baseURL }).embedding('text-embedding-3-small');
    expect(embedder.specificationVersion).toBe(version);
    const memory = new Memory({
      storage: new InMemoryStore({ id: `embedding-${version}` }),
      vector,
      embedder,
      embedderOptions: { providerOptions: { openai: { dimensions: 3, user: 'memory-user' } } },
      options: { lastMessages: false, semanticRecall: { topK: 1, messageRange: 0, scope: 'thread' } },
    });
    const thread = await memory.createThread({ resourceId: 'resource', title: 'Meetings' });
    const message = {
      id: 'saved-message',
      threadId: thread.id,
      resourceId: 'resource',
      role: 'user' as const,
      createdAt: new Date('2026-01-01T12:00:00Z'),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: savedText }] },
    };
    const saved = await memory.saveMessages({ messages: [message] });
    expect(saved.messages.map(m => m.id)).toEqual(['saved-message']);
    const recalled = await memory.recall({
      threadId: thread.id,
      resourceId: 'resource',
      vectorSearchString: queryText,
    });
    expect(recalled.messages.map(m => ({ id: m.id, content: m.content }))).toEqual([
      { id: 'saved-message', content: message.content },
    ]);
    expect(requests.map(request => request.input)).toEqual([[savedText], [queryText]]);
    for (const request of requests) {
      expect(request).toEqual({
        model: 'text-embedding-3-small',
        encoding_format: 'float',
        input: expect.any(Array),
        // v1 does not support providerOptions; its historical request shape remains unchanged.
        ...(version !== 'v1' ? { dimensions: 3, user: 'memory-user' } : {}),
      });
    }
    expect(mock.getRequests().map(request => request.response?.status)).toEqual([200, 200]);
    const indexes = await vector.listIndexes();
    expect(indexes).toHaveLength(1);
    const stored = await vector.query({ indexName: indexes[0]!, queryVector: embedding, topK: 1, includeVector: true });
    expect(stored.map(result => ({ vector: result.vector, messageId: result.metadata?.message_id }))).toEqual([
      { vector: embedding, messageId: 'saved-message' },
    ]);
    // AIMock's embedding fixture reports zero tokens.
    expect(recalled.usage).toEqual({ tokens: 0 });
  });
});
