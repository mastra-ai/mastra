import { once } from 'node:events';
import { createServer } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai-v7';
import { LLMock } from '@copilotkit/aimock';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLVector } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGraphRAGTool } from './graph-rag';

const queryText = 'Find my document';
const embedding = [1, 0, 0];
let mock: LLMock;
let vector: LibSQLVector;
let baseURL: string;
const proxy = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const upstream = await fetch(`${mock.url}${request.url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: Buffer.concat(chunks),
  });
  response.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  response.end(await upstream.text());
});

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  const address = proxy.address();
  if (!address || typeof address === 'string') throw new Error('Expected an HTTP listen address');
  baseURL = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await vector?.close();
  await new Promise<void>((resolve, reject) => proxy.close(error => (error ? reject(error) : resolve())));
  await mock.stop();
});

describe('GraphRAG tool request isolation', () => {
  it('only reranks documents retrieved for the current request, including empty and overlapping requests', async () => {
    mock.onEmbedding(queryText, { embedding });
    vector = new LibSQLVector({ id: 'graph-rag-isolation', url: ':memory:' });
    for (const indexName of ['tenantA', 'tenantB', 'empty']) {
      await vector.createIndex({ indexName, dimension: 3 });
    }
    await vector.upsert({
      indexName: 'tenantA',
      vectors: [embedding],
      ids: ['a'],
      metadata: [{ text: 'Tenant A private document' }],
    });
    await vector.upsert({
      indexName: 'tenantB',
      vectors: [embedding],
      ids: ['b'],
      metadata: [{ text: 'Tenant B private document' }],
    });

    const tool = createGraphRAGTool({
      vectorStore: vector,
      indexName: 'tenantA',
      model: createOpenAI({ apiKey: 'test-key', baseURL }).embedding('text-embedding-3-small'),
      graphOptions: { dimension: 3 },
    });
    const executeFor = (indexName: string) => {
      const requestContext = new RequestContext();
      requestContext.set('indexName', indexName);
      return tool.execute({ queryText, topK: 1 }, { requestContext });
    };

    expect((await executeFor('tenantA')).relevantContext).toEqual(['Tenant A private document']);
    const tenantB = await executeFor('tenantB');
    expect(tenantB.relevantContext).toEqual(['Tenant B private document']);
    expect(tenantB.sources).toEqual([expect.objectContaining({ metadata: { text: 'Tenant B private document' } })]);
    expect(await executeFor('empty')).toEqual({ relevantContext: [], sources: [] });
    const [a, b] = await Promise.all([executeFor('tenantA'), executeFor('tenantB')]);
    expect(a.relevantContext).toEqual(['Tenant A private document']);
    expect(b.relevantContext).toEqual(['Tenant B private document']);
  });
});
