import { Memory } from '@mastra/memory';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { MongoDBStore } from '../storage';
import { MongoDBVector } from './';

/**
 * Observational Memory retrieval driven entirely by MongoDB: `Memory` is constructed with no
 * embedder, so every observation embedding in this suite is produced server-side from the text
 * the store receives.
 *
 * The mocked suite in @mastra/memory asserts which fields `Memory` sends. These assert that
 * MongoDB accepts them, that the filters narrow the results, and that the rows can be removed.
 *
 * Live, so they need an explicit opt-in as well as credentials:
 *   TEST_MONGODB_AUTOEMBEDDING=1 pnpm --filter @mastra/mongodb test
 *
 * Against Atlas: set MONGODB_AUTOEMBED_URL. Against the local container: set VOYAGE_API_KEY
 * and ATLAS_LOCAL_TAG=preview, then recreate the container.
 */
const uri =
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';
const AUTOEMBED_URL = process.env.MONGODB_AUTOEMBED_URL;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const describeAutoEmbed =
  process.env.TEST_MONGODB_AUTOEMBEDDING === '1' && (AUTOEMBED_URL || VOYAGE_API_KEY) ? describe : describe.skip;

describeAutoEmbed('Observational Memory retrieval on a server-embedding store (live)', () => {
  const dbName = `om_autoembed_${Date.now()}`;
  const memoryUri = AUTOEMBED_URL || uri;
  const INDEX_NAME = 'memory_observations_selfembed';
  const resourceId = 'resource-1';

  let memory: Memory;
  let store: MongoDBStore;
  let vector: MongoDBVector;

  const observations = [
    {
      groupId: 'group-deadline',
      threadId: 'thread-a',
      observedAt: new Date('2026-03-01T09:00:00.000Z'),
      text: 'The team agreed the deadline for the migration is the last Friday of March.',
    },
    {
      groupId: 'group-lunch',
      threadId: 'thread-a',
      observedAt: new Date('2026-05-10T09:00:00.000Z'),
      text: 'The team ordered pizza for the retrospective on Tuesday.',
    },
    {
      groupId: 'group-budget',
      threadId: 'thread-b',
      observedAt: new Date('2026-06-20T09:00:00.000Z'),
      text: 'The hosting budget was raised to cover the new analytics cluster.',
    },
  ];

  const index = (observation: (typeof observations)[number], resource = resourceId) =>
    memory.indexObservation({
      text: observation.text,
      groupId: observation.groupId,
      range: `${observation.groupId}-start:${observation.groupId}-end`,
      threadId: observation.threadId,
      resourceId: resource,
      observedAt: observation.observedAt,
      recordId: `record-${observation.groupId}`,
    });

  const isTransient = (error: any) =>
    /rate limit|index not found|not ready|INITIAL_SYNC|cannot query vector index/i.test(
      String(error?.message ?? '') + String(error?.cause?.message ?? ''),
    );

  /**
   * MongoDB embeds the documents asynchronously after the write, and the index reports READY
   * before that finishes. Querying earlier returns whichever rows happen to be embedded
   * already, so every assertion has to wait for the whole set.
   */
  const waitForEveryDocumentEmbedded = async (expected: number) => {
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      try {
        const rows = await vector.query({ indexName: INDEX_NAME, queryText: 'anything', topK: expected });
        if (rows.length === expected) return;
      } catch (error: any) {
        if (!isTransient(error)) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('not every observation was embedded within the timeout');
  };

  // Voyage rate-limits lower tiers, so a transient failure is retried rather than asserted on.
  const searchUntilPopulated = async (params: Parameters<Memory['searchMessages']>[0]) => {
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      try {
        const { results } = await memory.searchMessages(params);
        if (results.length > 0) return results;
      } catch (error: any) {
        if (!isTransient(error)) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error(`search returned nothing within the timeout for "${params.query}"`);
  };

  beforeAll(async () => {
    vector = new MongoDBVector({
      id: 'om-autoembed-vector',
      uri: memoryUri,
      dbName,
      autoEmbed: { model: 'voyage-4' },
    });
    await vector.connect();

    // No embedder: the store reports that it produces embeddings itself.
    expect(vector.isSelfEmbedding).toBe(true);
    store = new MongoDBStore({ id: 'om-autoembed-storage', uri: memoryUri, dbName });
    memory = new Memory({
      storage: store,
      vector,
      options: { observationalMemory: { retrieval: { vector: true } }, generateTitle: false },
    });

    for (const observation of observations) {
      await index(observation);
    }

    // Memory creates the index during the first write. Wait for it to finish building before
    // any test queries it, so a failure below is about retrieval rather than about timing.
    await vector.waitForIndexReady({ indexName: INDEX_NAME, timeoutMs: 300000, checkIntervalMs: 5000 });
    await waitForEveryDocumentEmbedded(observations.length);
  }, 420000);

  afterAll(async () => {
    // Background cleanup can still be writing through the store, so let it finish first.
    await memory?.settled().catch(() => {});
    // Drop the whole database, not just the index. MongoDBStore creates a collection per
    // storage domain, so leaving the database behind consumes ~40 of a cluster's collection
    // budget per run.
    await (vector as any).db?.dropDatabase().catch(() => {});
    await vector.disconnect().catch(() => {});
    await store?.close().catch(() => {});
  });

  it('reports retrieval search as available without an embedder', () => {
    expect(memory.hasRetrievalSearch({ vector: true })).toBe(true);
  });

  it('indexes each observation as one row that MongoDB embeds', async () => {
    const stats = await vector.describeIndex({ indexName: INDEX_NAME });

    expect(stats.count).toBe(observations.length);
    expect(stats.dimension).toBe(1024);
  }, 120000);

  it('finds the observation that matches the meaning of the query', async () => {
    const results = await searchUntilPopulated({ query: 'when is the migration due?', resourceId, topK: 1 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      groupId: 'group-deadline',
      recordId: 'record-group-deadline',
      threadId: 'thread-a',
      range: 'group-deadline-start:group-deadline-end',
      text: observations[0]!.text,
    });
    expect(results[0]!.observedAt).toEqual(observations[0]!.observedAt);
  }, 420000);

  it('narrows the search to one thread', async () => {
    const results = await searchUntilPopulated({
      query: 'when is the migration due?',
      resourceId,
      filter: { threadId: 'thread-b' },
    });

    expect(results.map(r => r.groupId)).toEqual(['group-budget']);
  }, 420000);

  it('narrows the search to a time window', async () => {
    const results = await searchUntilPopulated({
      query: 'when is the migration due?',
      resourceId,
      filter: {
        observedAfter: new Date('2026-04-01T00:00:00.000Z'),
        observedBefore: new Date('2026-06-01T00:00:00.000Z'),
      },
    });

    expect(results.map(r => r.groupId)).toEqual(['group-lunch']);
  }, 420000);

  it('does not return observations of another resource', async () => {
    const { results } = await memory.searchMessages({ query: 'when is the migration due?', resourceId: 'resource-2' });

    expect(results).toEqual([]);
  }, 120000);

  it('writes the same row again instead of adding a duplicate', async () => {
    await index(observations[0]!);
    await waitForEveryDocumentEmbedded(observations.length);

    const stats = await vector.describeIndex({ indexName: INDEX_NAME });
    expect(stats.count).toBe(observations.length);
  }, 420000);

  it('keeps the observations of a transferred thread searchable under the new resource', async () => {
    const moved = {
      groupId: 'group-offsite',
      threadId: 'thread-c',
      observedAt: new Date('2026-07-01T09:00:00.000Z'),
      text: 'The offsite is booked for the second week of June in Lisbon.',
    };
    await memory.saveThread({
      thread: { id: moved.threadId, resourceId, title: 'Offsite', createdAt: new Date(), updatedAt: new Date() },
    });
    await index(moved);
    await waitForEveryDocumentEmbedded(observations.length + 1);

    // Observation rows carry the owning resource, and the store cannot return stored vectors
    // for an autoEmbed index, so moving a thread has to re-tag the rows without reading them back.
    await memory.updateThreadResourceId({ threadId: moved.threadId, resourceId: 'resource-2' });

    const stored = await (vector as any).db
      .collection(INDEX_NAME)
      .find({ 'metadata.thread_id': moved.threadId })
      .toArray();
    expect(stored.map((row: any) => row.metadata.resource_id)).toEqual(['resource-2']);

    const results = await searchUntilPopulated({
      query: 'where is the offsite?',
      resourceId: 'resource-2',
      filter: { threadId: moved.threadId },
    });
    expect(results.map(r => r.groupId)).toEqual([moved.groupId]);

    const previousOwner = await memory.searchMessages({
      query: 'where is the offsite?',
      resourceId,
      filter: { threadId: moved.threadId },
    });
    expect(previousOwner.results).toEqual([]);
  }, 420000);

  it('removes the observations of a deleted thread', async () => {
    await memory.saveThread({
      thread: { id: 'thread-b', resourceId, title: 'Integration', createdAt: new Date(), updatedAt: new Date() },
    });

    await memory.deleteThread('thread-b');
    // The vector cleanup runs in the background; settled() waits for it.
    await memory.settled();

    // Asserted on the stored documents, since a ranking assertion cannot tell a deleted row
    // from one that simply ranked lower.
    const stored = await (vector as any).db.collection(INDEX_NAME).find({}).toArray();
    const texts = stored.map((row: any) => row.document);
    expect(texts).not.toContain(observations[2]!.text);
    expect(texts).toContain(observations[0]!.text);
  }, 120000);
});
