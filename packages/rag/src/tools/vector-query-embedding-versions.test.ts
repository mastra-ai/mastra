import { once } from 'node:events';
import { createServer } from 'node:http';
import { createOpenAI as createOpenAIV1 } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV2 } from '@ai-sdk/openai-v5';
import { createOpenAI as createOpenAIV3 } from '@ai-sdk/openai-v6';
import { createOpenAI as createOpenAIV4 } from '@ai-sdk/openai-v7';
import { LLMock } from '@copilotkit/aimock';
import { LibSQLVector } from '@mastra/libsql';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createVectorQueryTool } from './vector-query';

const queryText = 'When should we schedule a meeting?';
const savedText = 'My preferred meeting time is nine in the morning.';
const embedding = [0.6, 0.8, 0];
let mock: LLMock;
let vector: LibSQLVector;
const requests: Record<string, unknown>[] = [];
// AIMock's journal omits dimensions/user, so record the real HTTP body before forwarding.
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
  const address = proxy.address();
  if (!address || typeof address === 'string') throw new Error('Expected an HTTP listen address');
  baseURL = `http://127.0.0.1:${address.port}`;
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
])('Vector query embedding specification $version', ({ version, createOpenAI }) => {
  // #26884: v4 previously fell through to the legacy SDK, silently returning no RAG context.
  it('retrieves stored context and sources using the configured embedding model', async () => {
    mock.onEmbedding(queryText, { embedding });
    vector = new LibSQLVector({ id: `rag-embedding-${version}`, url: ':memory:' });
    await vector.createIndex({ indexName: 'meetings', dimension: 3 });
    await vector.upsert({
      indexName: 'meetings',
      vectors: [embedding, [0, 0, 1]],
      ids: ['meeting', 'unrelated'],
      metadata: [{ text: savedText }, { text: 'An unrelated document.' }],
    });
    const model = createOpenAI({ apiKey: 'test-key', baseURL }).embedding('text-embedding-3-small');
    expect(model.specificationVersion).toBe(version);
    const tool = createVectorQueryTool({
      vectorStore: vector,
      indexName: 'meetings',
      model,
      includeVectors: true,
      providerOptions: { openai: { dimensions: 3, user: 'rag-user' } },
    });
    const result = await tool.execute({ queryText, topK: 1 });
    expect(result.relevantContext).toEqual([{ text: savedText }]);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].id).toBe('meeting');
    expect(result.sources[0].vector).toEqual(embedding);
    expect(result.sources[0].metadata).toEqual({ text: savedText });
    expect(result.sources[0].score).toBeCloseTo(1);
    expect(requests.map(request => request.input)).toEqual([[queryText]]);
    for (const request of requests) {
      expect(request.model).toBe('text-embedding-3-small');
      expect(request.encoding_format).toBe('float');
      // Legacy embedding options remain unchanged; modern models receive provider options.
      expect(request.dimensions).toBe(version === 'v1' ? undefined : 3);
      expect(request.user).toBe(version === 'v1' ? undefined : 'rag-user');
    }
    expect(mock.getRequests().map(request => request.response?.status)).toEqual([200]);
  });
});
