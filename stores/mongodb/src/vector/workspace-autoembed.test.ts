import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { MongoDBVector } from './';

/**
 * Workspace search driven entirely by MongoDB: the Workspace is built with no embedder, so every
 * embedding in this suite is produced server-side from the file text the store receives.
 *
 * The mocked suites assert which fields the search engine sends. These assert that MongoDB
 * accepts them, including the filter every workspace search adds, and that re-indexing a
 * changed file replaces its old text.
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

describeAutoEmbed('Workspace search on a server-embedding store (live)', () => {
  const runId = Date.now();
  const dbName = `workspace_autoembed_${runId}`;
  const workspaceId = `ws_autoembed_${runId}`;
  const INDEX_NAME = `${workspaceId}_search_selfembed`;

  const files: Record<string, string> = {
    'deadline.md': 'We agreed the deadline for the migration is the last Friday of March.',
    'lunch.md': 'The team ordered pizza for the retrospective on Tuesday.',
    'budget.md': 'The hosting budget was raised to cover the new analytics cluster.',
  };

  let basePath: string;
  let vector: MongoDBVector;
  let workspace: Workspace;

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
    throw new Error('not every file was embedded within the timeout');
  };

  // Voyage rate-limits lower tiers, so a transient failure is retried rather than asserted on.
  const searchUntilPopulated = async (
    target: Workspace,
    query: string,
    options: Parameters<Workspace['search']>[1],
  ) => {
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      try {
        const results = await target.search(query, options);
        if (results.length > 0) return results;
      } catch (error: any) {
        if (!isTransient(error)) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error(`search returned nothing within the timeout for "${query}"`);
  };

  beforeAll(async () => {
    basePath = await mkdtemp(join(tmpdir(), 'workspace-autoembed-'));
    await mkdir(join(basePath, 'notes'));
    for (const [name, text] of Object.entries(files)) {
      await writeFile(join(basePath, 'notes', name), text);
    }

    vector = new MongoDBVector({
      id: 'workspace-autoembed-vector',
      uri: AUTOEMBED_URL || uri,
      dbName,
      autoEmbed: { model: 'voyage-4' },
    });
    await vector.connect();

    // No embedder: the store reports that it produces embeddings itself.
    expect(vector.isSelfEmbedding).toBe(true);
    workspace = new Workspace({
      id: workspaceId,
      filesystem: new LocalFilesystem({ basePath }),
      vectorStore: vector,
      // Keyword search too, so one workspace serves both the vector and the hybrid test.
      bm25: true,
    });
    await workspace.rebuildSearchIndex(['notes']);

    // The engine creates the index during the first write. Wait for it to finish building before
    // any test queries it, so a failure below is about search rather than about timing.
    await vector.waitForIndexReady({ indexName: INDEX_NAME, timeoutMs: 300000, checkIntervalMs: 5000 });
    await waitForEveryDocumentEmbedded(Object.keys(files).length);
  }, 420000);

  afterAll(async () => {
    // Drop the whole database, not just the index, so a run leaves nothing behind on the cluster.
    await (vector as any).db?.dropDatabase().catch(() => {});
    await vector.disconnect().catch(() => {});
    await rm(basePath, { recursive: true, force: true });
  });

  it('offers vector search without an embedder', () => {
    expect(workspace.canVector).toBe(true);
  });

  it('indexes each file as one row that MongoDB embeds', async () => {
    const stats = await vector.describeIndex({ indexName: INDEX_NAME });

    expect(stats.count).toBe(Object.keys(files).length);
    expect(stats.dimension).toBe(1024);
  }, 120000);

  it('finds the file that matches the meaning of the query', async () => {
    const results = await searchUntilPopulated(workspace, 'when is the migration due?', { mode: 'vector', topK: 1 });

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toMatch(/deadline\.md$/);
    expect(results[0]!.content).toBe(files['deadline.md']);
  }, 420000);

  it('combines keyword and semantic results in hybrid mode', async () => {
    const results = await searchUntilPopulated(workspace, 'pizza', { mode: 'hybrid', topK: 3 });

    expect(results[0]!.id).toMatch(/lunch\.md$/);
    expect(results[0]!.scoreDetails?.bm25).toBeDefined();
  }, 420000);

  it('replaces the old text of a file that changed', async () => {
    const replaced = files['budget.md']!;
    const edited = 'The onboarding session moved to the second week of June.';
    await writeFile(join(basePath, 'notes', 'budget.md'), edited);

    await workspace.rebuildSearchIndex(['notes']);
    await waitForEveryDocumentEmbedded(Object.keys(files).length);

    // Asserted on the stored documents, since a ranking assertion cannot tell a deleted row
    // from one that simply ranked lower.
    const stored = await (vector as any).db.collection(INDEX_NAME).find({}).toArray();
    const texts = stored.map((row: any) => row.document);
    expect(texts).toHaveLength(Object.keys(files).length);
    expect(texts).toContain(edited);
    expect(texts).not.toContain(replaced);
  }, 420000);
});
