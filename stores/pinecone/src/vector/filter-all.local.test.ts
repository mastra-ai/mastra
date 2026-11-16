import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PineconeVector } from './';

// Runs against pinecone-local (ghcr.io/pinecone-io/pinecone-local), which applies metadata filters like Pinecone does.
// Start it with PINECONE_LOCAL_URL=http://localhost:5080; skipped otherwise.
const PINECONE_LOCAL_URL = process.env.PINECONE_LOCAL_URL;

describe.skipIf(!PINECONE_LOCAL_URL)('PineconeVector filters with $all against pinecone-local', () => {
  const indexName = `filter-all-${Date.now()}`;
  let vector: PineconeVector;

  beforeAll(async () => {
    vector = new PineconeVector({ id: 'pinecone-local', apiKey: 'pclocal', controllerHostUrl: PINECONE_LOCAL_URL });
    await vector.createIndex({ indexName, dimension: 3, metric: 'cosine' });
    // pinecone-local serves index data over plain HTTP; the SDK assumes HTTPS unless the host has a scheme.
    const client = (vector as any).client;
    const { host } = await client.describeIndex(indexName);
    const index = client.Index.bind(client);
    client.Index = (name: string) => index(name, `http://${host}`);
    await vector.upsert({
      indexName,
      vectors: [
        [1, 0, 0],
        [0.99, 0.01, 0],
        [0.98, 0.02, 0],
      ],
      ids: ['alice-xy', 'bob-xy', 'alice-x'],
      metadata: [
        { resource_id: 'alice', topic: ['x', 'y'] },
        { resource_id: 'bob', topic: ['x', 'y'] },
        { resource_id: 'alice', topic: ['x'] },
      ],
    });
  }, 120_000);

  afterAll(async () => {
    await vector?.deleteIndex({ indexName }).catch(() => {});
  });

  it('keeps the resource condition next to $all', async () => {
    const results = await vector.query({
      indexName,
      queryVector: [1, 0, 0],
      topK: 10,
      filter: { resource_id: 'alice', topic: { $all: ['x', 'y'] } },
    });
    expect(results.map(r => r.id)).toEqual(['alice-xy']);
  });

  it('keeps the resource condition when $all comes first', async () => {
    const results = await vector.query({
      indexName,
      queryVector: [1, 0, 0],
      topK: 10,
      filter: { topic: { $all: ['x', 'y'] }, resource_id: 'bob' },
    });
    expect(results.map(r => r.id)).toEqual(['bob-xy']);
  });
});
