import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { Memory } from '@mastra/memory';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { MongoDBStore } from '../storage';
import { MongoDBVector } from './';

/**
 * Semantic recall driven entirely by MongoDB: `Memory` is constructed with no embedder, so
 * every embedding in this suite is produced server-side from the text the store receives.
 *
 * The mocked suites assert which fields `Memory` sends. These assert that MongoDB accepts
 * them and that a message saved through `Memory` comes back through recall.
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

describeAutoEmbed('Memory semantic recall on a server-embedding store (live)', () => {
  const dbName = `memory_autoembed_${Date.now()}`;
  const memoryUri = AUTOEMBED_URL || uri;
  const INDEX_NAME = 'memory_messages_selfembed';
  const threadId = 'thread-1';
  const resourceId = 'resource-1';

  let memory: Memory;
  let vector: MongoDBVector;

  // One timestamp for every message, as a batched save produces. Recall has to select on
  // meaning rather than on write order.
  const savedAt = new Date('2026-01-01T00:00:00.000Z');
  const message = (id: string, text: string): MastraDBMessage => ({
    id,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text }], content: text },
    createdAt: savedAt,
    threadId,
    resourceId,
  });

  const messages = [
    message('msg-deadline', 'We agreed the deadline for the migration is the last Friday of March.'),
    message('msg-lunch', 'The team ordered pizza for the retrospective on Tuesday.'),
    message('msg-budget', 'The hosting budget was raised to cover the new analytics cluster.'),
  ];

  const requestContext = () => {
    const ctx = new RequestContext();
    ctx.set('MastraMemory', { thread: { id: threadId, resourceId }, resourceId });
    return ctx;
  };

  /**
   * MongoDB embeds the documents asynchronously after the write, and the index reports READY
   * before that finishes. Querying earlier returns whichever rows happen to be embedded
   * already, so ranking assertions have to wait for the whole set.
   */
  const waitForEveryDocumentEmbedded = async () => {
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      try {
        const rows = await vector.query({ indexName: INDEX_NAME, queryText: 'anything', topK: messages.length });
        if (rows.length === messages.length) return;
      } catch (error: any) {
        const text = String(error?.message ?? '') + String(error?.cause?.message ?? '');
        if (!/rate limit|index not found|not ready|INITIAL_SYNC|cannot query vector index/i.test(text)) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('not every document was embedded within the timeout');
  };

  // Voyage rate-limits lower tiers, so a transient failure is retried rather than asserted on.
  const recallUntilPopulated = async (search: string) => {
    const deadline = Date.now() + 300000;
    let last: Awaited<ReturnType<Memory['recall']>> | undefined;
    while (Date.now() < deadline) {
      try {
        last = await memory.recall({ threadId, resourceId, vectorSearchString: search });
        if (last.messages.length > 0) return last;
      } catch (error: any) {
        const text = String(error?.message ?? '') + String(error?.cause?.message ?? '');
        // INITIAL_SYNC is the index still building its first copy of the data; Atlas reports it
        // as a query failure rather than an empty result.
        if (!/rate limit|index not found|not ready|INITIAL_SYNC|cannot query vector index/i.test(text)) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error(`recall returned nothing within the timeout for "${search}"`);
  };

  /** Polls recall until the expected message surfaces, so re-embedding has time to land. */
  const recallUntilMatches = async (search: string, expectedId: string) => {
    const deadline = Date.now() + 300000;
    let ids: string[] = [];
    while (Date.now() < deadline) {
      try {
        const result = await memory.recall({ threadId, resourceId, vectorSearchString: search });
        ids = result.messages.map(m => m.id);
        if (ids.includes(expectedId)) return ids;
      } catch (error: any) {
        const text = String(error?.message ?? '') + String(error?.cause?.message ?? '');
        if (!/rate limit|index not found|not ready|INITIAL_SYNC|cannot query vector index/i.test(text)) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error(`recall never returned ${expectedId} for "${search}", last saw [${ids.join(', ')}]`);
  };

  beforeAll(async () => {
    vector = new MongoDBVector({
      id: 'memory-autoembed-vector',
      uri: memoryUri,
      dbName,
      autoEmbed: { model: 'voyage-4' },
    });
    await vector.connect();

    // No embedder: the store reports that it produces embeddings itself.
    expect(vector.isSelfEmbedding).toBe(true);
    memory = new Memory({
      storage: new MongoDBStore({ id: 'memory-autoembed-storage', uri: memoryUri, dbName }),
      vector,
      options: {
        semanticRecall: { topK: 1, messageRange: 0, scope: 'thread' },
        // History off, so recall returns only what semantic search selected. Left on, recency
        // alone would return every message and the assertions below would prove nothing.
        lastMessages: false,
        generateTitle: false,
      },
    });

    await memory.saveThread({
      thread: { id: threadId, resourceId, title: 'Integration', createdAt: new Date(), updatedAt: new Date() },
    });
    await memory.saveMessages({ messages });

    // Memory creates the index during the first write. Wait for it to finish building before
    // any test queries it, so a failure below is about recall rather than about timing.
    await vector.waitForIndexReady({ indexName: INDEX_NAME, timeoutMs: 300000, checkIntervalMs: 5000 });
    await waitForEveryDocumentEmbedded();
  }, 420000);

  afterAll(async () => {
    // Drop the whole database, not just the index. MongoDBStore creates a collection per
    // storage domain, so leaving the database behind consumes ~40 of a cluster's collection
    // budget per run.
    await (vector as any).db?.dropDatabase().catch(() => {});
    await vector.disconnect().catch(() => {});
  });

  it('writes text that MongoDB embeds, with no embedder configured', async () => {
    // The index Memory created carries no client-side dimension of its own choosing, and the
    // documents are counted by the text field the index embeds.
    const stats = await vector.describeIndex({ indexName: INDEX_NAME });

    expect(stats.count).toBe(messages.length);
    expect(stats.dimension).toBe(1024);
  }, 120000);

  it('recalls the semantically matching message through recall()', async () => {
    const recalled = await recallUntilPopulated('when is the migration due?');

    const ids = recalled.messages.map(m => m.id);

    expect(ids).toEqual(['msg-deadline']);
  }, 420000);

  it('re-embeds an edited message and drops the text it replaced', async () => {
    const edited = 'The onboarding session moved to the second week of June.';
    const replaced = 'The hosting budget was raised to cover the new analytics cluster.';

    await memory.updateMessages({
      messages: [
        {
          id: 'msg-budget',
          content: { format: 2, parts: [{ type: 'text', text: edited }], content: edited },
        } as any,
      ],
    });

    // The edited text is searchable under its new meaning.
    const ids = await recallUntilMatches('when is the onboarding session?', 'msg-budget');
    expect(ids).toEqual(['msg-budget']);

    // And the text it replaced is gone from the index rather than lingering as a second row.
    // Asserted on the stored documents, since a ranking assertion cannot tell a deleted vector
    // from one that simply ranked lower.
    const stored = await (vector as any).db.collection(INDEX_NAME).find({}).toArray();
    const texts = stored.map((row: any) => row.document);
    expect(texts).toContain(edited);
    expect(texts).not.toContain(replaced);
  }, 420000);

  it('recalls through the SemanticRecall processor, the path an agent turn takes', async () => {
    const inputProcessors = await memory.getInputProcessors();
    const semanticRecall = inputProcessors.find(p => p.id === 'semantic-recall');
    expect(semanticRecall).toBeDefined();

    const incoming = message('msg-query', 'remind me about the migration deadline');
    const messageList = new MessageList();
    messageList.add([incoming], 'input');

    // processInput catches everything it throws and returns the list unchanged, so an
    // embedding-provider rate limit is indistinguishable from an empty result. Retry until
    // something surfaces rather than trusting the first attempt.
    for (let attempt = 0; attempt < 6; attempt++) {
      await semanticRecall!.processInput!({
        messages: [incoming],
        messageList,
        abort: (() => {
          throw new Error('aborted');
        }) as any,
        requestContext: requestContext(),
        state: {},
        retryCount: 0,
      } as any);
      if (messageList.get.all.db().some(m => m.id === 'msg-deadline')) break;
      await new Promise(resolve => setTimeout(resolve, 20000));
    }

    const surfacedIds = messageList.get.all.db().map(m => m.id);
    expect(surfacedIds).toContain('msg-deadline');
  }, 420000);
});
