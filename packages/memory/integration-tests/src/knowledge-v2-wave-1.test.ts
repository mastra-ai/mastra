import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory, Subconscious } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import type { EmbeddingModel } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Adapter = 'libsql' | 'pg';
// CI provides DB_URL for this package, so the PostgreSQL variant runs there alongside LibSQL.
// KNOWLEDGE_ADAPTER pins a single adapter for local runs.
const adapters: Adapter[] = process.env.KNOWLEDGE_ADAPTER
  ? [process.env.KNOWLEDGE_ADAPTER === 'pg' ? 'pg' : 'libsql']
  : process.env.DB_URL
    ? ['libsql', 'pg']
    : ['libsql'];
const outputPath = process.env.KNOWLEDGE_PROOF_OUTPUT;
const temporaryDirectories: string[] = [];
const stores: MastraCompositeStore[] = [];
const memories: Memory[] = [];
const postgresSchemas: string[] = [];
// Same default as with-pg-storage.test.ts: this package's docker-compose.yml PostgreSQL.
const postgresConnectionString = process.env.DB_URL || 'postgres://postgres:password@localhost:5434/mastra';
const publishedKnowledgeV1Fixtures: Record<Adapter, URL> = {
  libsql: new URL(
    '../../../../stores/libsql/src/storage/domains/knowledge/fixtures/published-1.21.1.sql',
    import.meta.url,
  ),
  pg: new URL('../../../../stores/pg/src/storage/domains/knowledge/fixtures/published-1.29.0.sql', import.meta.url),
};

const structure = {
  scopes: [
    { address: 'org:acme', name: 'mastra' },
    { address: 'features', name: 'features', parentAddresses: ['org:acme'] },
    { address: 'features:memory', name: 'memory', parentAddresses: ['features'] },
    { address: 'features:memory:subconscious', name: 'subconscious', parentAddresses: ['features:memory'] },
    { address: 'repo:mastra', name: 'repo:mastra', parentAddresses: ['org:acme'] },
    { address: 'repo:mastra:issues', name: 'issues', parentAddresses: ['repo:mastra'] },
    { address: 'repo:mastra:prs', name: 'prs', parentAddresses: ['repo:mastra'] },
    { address: 'resource:shipyard', name: 'Shipyard', parentAddresses: ['org:acme'] },
  ],
};

function message(threadId: string): MastraDBMessage {
  return {
    id: randomUUID(),
    threadId,
    resourceId: 'shipyard',
    role: 'user',
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text: 'Maya Chen owns the Atlas refund launch.' }] },
  };
}

function deterministicObservationModel(curate = false) {
  let wrote = false;
  const doStream = vi.fn(async () => ({
    stream: new ReadableStream({
      start(controller) {
        if (curate && !wrote) {
          wrote = true;
          controller.enqueue({
            type: 'tool-call',
            toolCallId: 'wave-1-create',
            toolName: 'knowledge_create',
            input: JSON.stringify({
              name: 'Atlas refund launch',
              kind: 'feature',
              text: '[[Maya Chen]] owns the [[Atlas refund launch]].',
              nodeScope: 'resource',
              scope: 'resource',
            }),
          });
          controller.enqueue({
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 20, outputTokens: 8 },
          });
          controller.close();
          return;
        }
        for (const chunk of [
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'wave-1-observation', modelId: 'aimock', timestamp: new Date() },
          { type: 'text-start', id: 'wave-1-text' },
          {
            type: 'text-delta',
            id: 'wave-1-text',
            delta: '<observations>\nMaya Chen owns the Atlas refund launch.\n</observations>',
          },
          { type: 'text-end', id: 'wave-1-text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 } },
        ]) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
  }));
  const doGenerate = vi.fn(async () => {
    throw new Error('Wave 1 proof requires streaming observation-time curate, not structured capture extraction.');
  });
  return {
    model: {
      specificationVersion: 'v2' as const,
      provider: 'aimock',
      modelId: 'deterministic-wave-1',
      supportedUrls: {},
      doStream,
      doGenerate,
    },
    doGenerate,
    doStream,
  };
}

async function createStorage(
  id: string,
  adapter: Adapter,
): Promise<{ storage: MastraCompositeStore; location: string }> {
  if (adapter === 'pg') {
    const schemaName = `knowledge_w1_${randomUUID().replaceAll('-', '')}`;
    postgresSchemas.push(schemaName);
    const storage = new PostgresStore({
      id,
      connectionString: postgresConnectionString,
      schemaName,
    });
    stores.push(storage);
    return { storage, location: schemaName };
  }

  const directory = await mkdtemp(join(tmpdir(), 'knowledge-v2-wave-1-'));
  temporaryDirectories.push(directory);
  const location = join(directory, 'knowledge.db');
  const storage = new LibSQLStore({ id, url: `file:${location}` });
  stores.push(storage);
  return { storage, location };
}

const embedder: EmbeddingModel<string> = {
  specificationVersion: 'v1',
  provider: 'aimock',
  modelId: 'deterministic-embedding',
  maxEmbeddingsPerCall: 128,
  supportsParallelCalls: true,
  async doEmbed({ values }) {
    return { embeddings: values.map(() => [0.1, 0.2, 0.3, 0.4]) };
  },
};

async function createVector() {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-v2-wave-1-vector-'));
  temporaryDirectories.push(directory);
  return new LibSQLVector({ id: `wave-1-vector-${randomUUID()}`, url: `file:${join(directory, 'vector.db')}` });
}

function createRuntime(storage: MastraCompositeStore, vector: LibSQLVector) {
  const knowledge = new Knowledge({
    id: 'mastra',
    name: 'Mastra Knowledge',
    description: 'Product architecture, repository work, and operational knowledge for Mastra.',
    storage,
    structure,
  });
  const { model, doGenerate } = deterministicObservationModel();
  const curator = deterministicObservationModel(true);
  const memory = new Memory({
    storage,
    vector,
    embedder,
    knowledge: 'mastra',
    options: {
      observationalMemory: {
        enabled: true,
        model,
        experimental_subconscious: new Subconscious({ observation: [{ name: 'curate', model: curator.model }] }),
        observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
      },
    },
  });
  memories.push(memory);
  const mastra = new Mastra({ knowledge: { mastra: knowledge }, memory: { default: memory }, logger: false });
  return { knowledge: mastra.getKnowledge('mastra'), memory, doGenerate, curator };
}

/**
 * Loads the Knowledge tables a published v1 store created, with one node and one curation cursor,
 * and returns probes that read the seeded database directly. `hasTable` is PostgreSQL-only: a separate
 * node:sqlite connection does not see what LibSQL writes to its WAL, so it cannot observe a LibSQL reset.
 */
async function seedPublishedKnowledgeV1(
  adapter: Adapter,
  storage: MastraCompositeStore,
  location: string,
): Promise<{ countV1Nodes: () => Promise<number>; hasTable?: (name: string) => Promise<boolean> }> {
  const fixture = await readFile(publishedKnowledgeV1Fixtures[adapter], 'utf8');
  const node = [
    'v1-node',
    'entity',
    'Atlas',
    'atlas',
    '["shipyard"]',
    'shipyard',
    1,
    '2026-01-01T00:00:00.000Z',
  ] as const;
  const cursor = ['v1-thread', 'curate', 'v1-record', '2026-01-01T00:00:00.000Z'] as const;
  if (storage instanceof PostgresStore) {
    const client = await storage.pool.connect();
    try {
      // SET LOCAL keeps the unqualified fixture inside the proof schema and off the pooled connection.
      await client.query(`BEGIN; CREATE SCHEMA "${location}"; SET LOCAL search_path TO "${location}";`);
      await client.query(fixture);
      await client.query(
        'INSERT INTO mastra_knowledge_nodes (id, type, name, "canonicalName", scope, "scopeKey", version, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $8)',
        [...node],
      );
      await client.query(
        'INSERT INTO mastra_knowledge_cursors ("sourceThreadId", agent, "lastKnowledgeId", "updatedAt") VALUES ($1, $2, $3, $4)',
        [...cursor],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return {
      countV1Nodes: async () =>
        Number(
          (
            await storage.db.one<{ count: string }>(
              `SELECT count(*) AS count FROM "${location}".mastra_knowledge_nodes`,
            )
          ).count,
        ),
      hasTable: async name =>
        (await storage.db.one<{ found: string | null }>('SELECT to_regclass($1) AS found', [`"${location}".${name}`]))
          .found !== null,
    };
  }

  const seed = new DatabaseSync(location);
  seed.exec(fixture);
  seed
    .prepare(
      'INSERT INTO mastra_knowledge_nodes (id, type, name, canonicalName, scope, scopeKey, version, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(...node, node[7]);
  seed
    .prepare(
      'INSERT INTO mastra_knowledge_cursors (sourceThreadId, agent, lastKnowledgeId, updatedAt) VALUES (?, ?, ?, ?)',
    )
    .run(...cursor);
  seed.close();
  return {
    countV1Nodes: async () => {
      const rows = new DatabaseSync(location, { readOnly: true });
      try {
        return Number(
          (rows.prepare('SELECT count(*) AS count FROM mastra_knowledge_nodes').get() as { count: number }).count,
        );
      } finally {
        rows.close();
      }
    },
  };
}

function sanitizePackageUrl(url: string): string {
  return new URL(url).pathname.match(/(?:packages|stores)\/.*$/)?.[0] ?? 'outside-worktree';
}

async function writeProofOutput(value: Record<string, unknown>) {
  if (!outputPath) return;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(async () => {
  const cleanupErrors: unknown[] = [];
  for (const memory of memories.splice(0)) {
    try {
      await memory.settled();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  for (const storage of stores.splice(0).reverse()) {
    if (storage instanceof PostgresStore) {
      const schemaName = postgresSchemas.pop();
      if (schemaName) {
        try {
          if (!schemaName.startsWith('knowledge_w1_'))
            throw new Error(`Refusing to drop non-proof schema ${schemaName}`);
          await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    }
    try {
      await storage.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  const directoryResults = await Promise.allSettled(
    temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })),
  );
  cleanupErrors.push(...directoryResults.filter(result => result.status === 'rejected').map(result => result.reason));
  if (cleanupErrors.length) throw cleanupErrors[0];
});

describe.each(adapters)('Knowledge v2 Wave 1 linked-workspace proof (%s)', adapter => {
  it('rejects obsolete observation-agent configuration with migration guidance', () => {
    expect(() => new Subconscious(JSON.parse('{"observation":["capture"]}'))).toThrow(
      'Unknown Subconscious observation agent: capture. Use "curate" for observation-time ingestion or "remind" for retrieval.',
    );
  });

  it('reconciles, curates through OM, and survives a fresh runtime restart', async () => {
    const resolvedPackages = {
      core: import.meta.resolve('@mastra/core/knowledge'),
      memory: import.meta.resolve('@mastra/memory'),
      adapter: import.meta.resolve(adapter === 'pg' ? '@mastra/pg' : '@mastra/libsql'),
    };
    expect(resolvedPackages.core).toContain('/packages/core/dist/knowledge/');
    expect(resolvedPackages.memory).toContain('/packages/memory/dist/');
    expect(resolvedPackages.adapter).toContain(adapter === 'pg' ? '/stores/pg/dist/' : '/stores/libsql/dist/');

    const { storage, location } = await createStorage(`wave-1-${adapter}`, adapter);
    const vector = await createVector();
    const first = createRuntime(storage, vector);
    const reconciled = await first.knowledge.reconcile();
    expect(Object.keys(reconciled.scopes)).toEqual(
      expect.arrayContaining(structure.scopes.map(scope => scope.address)),
    );

    const threadId = `proof-${randomUUID()}`;
    await first.memory.createThread({ threadId, resourceId: 'shipyard', title: 'Wave 1 proof' });
    await first.memory.saveMessages({ messages: [message(threadId)] });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const observed = await (await first.memory.omEngine)!.observe({
      threadId,
      resourceId: 'shipyard',
      requestContext,
      sendStateSignal: async () => ({ skipped: false }) as never,
    });
    expect(observed.observed).toBe(true);
    const visibleScope = ['org:acme', 'resource:shipyard'];
    await first.memory.settled();
    expect(await first.knowledge.resolveNode({ name: 'Atlas refund launch', scope: visibleScope })).toMatchObject({
      kind: 'feature',
      scope: ['org:acme', 'resource:shipyard'],
    });
    expect(first.doGenerate).not.toHaveBeenCalled();
    expect(first.curator.doGenerate).not.toHaveBeenCalled();
    expect(first.curator.doStream).toHaveBeenCalled();
    const captured = await first.knowledge.resolveNode({ name: 'Atlas refund launch', scope: visibleScope });
    const records = await first.knowledge.listKnowledgeAbout({ node: captured!.id, scope: visibleScope });
    expect(records.records).toHaveLength(1);
    expect(records.records[0]).toMatchObject({
      text: '[[Maya Chen]] owns the [[Atlas refund launch]].',
      sourceThreadId: threadId,
      scope: ['org:acme', 'resource:shipyard'],
    });
    expect(records.records[0]?.capturedAt).toBeInstanceOf(Date);
    expect(await first.knowledge.listActivity({ scope: visibleScope, limit: 100 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'node-created', recordId: captured!.id, scope: visibleScope }),
        expect.objectContaining({
          action: 'record-created',
          recordId: records.records[0]!.id,
          sourceThreadId: threadId,
          scope: visibleScope,
        }),
      ]),
    );

    await first.memory.settled();
    memories.splice(memories.indexOf(first.memory), 1);
    await storage.close();
    stores.splice(stores.indexOf(storage), 1);

    const restartedStorage =
      adapter === 'pg'
        ? new PostgresStore({
            id: `wave-1-${adapter}-restart`,
            connectionString: postgresConnectionString,
            schemaName: location,
          })
        : new LibSQLStore({ id: `wave-1-${adapter}-restart`, url: `file:${location}` });
    stores.push(restartedStorage);
    const restarted = createRuntime(restartedStorage, vector);
    const replay = await restarted.knowledge.reconcile();
    expect(replay.createdScopeIds).toEqual([]);
    const persisted = await restarted.knowledge.resolveNode({ name: 'Atlas refund launch', scope: visibleScope });
    expect(persisted?.id).toBe(captured?.id);
    expect(
      (await restarted.knowledge.listKnowledgeAbout({ node: persisted!.id, scope: visibleScope })).records,
    ).toHaveLength(1);

    await writeProofOutput({
      adapter,
      resolvedPackages: Object.fromEntries(
        Object.entries(resolvedPackages).map(([name, url]) => [name, sanitizePackageUrl(url)]),
      ),
      structureScopeCount: Object.keys(reconciled.scopes).length,
      curation: { node: captured?.name, records: records.records.length, activity: 'present' },
      restart: { sameNodeId: persisted?.id === captured?.id, duplicateScopes: replay.createdScopeIds.length },
    });
  });

  it.skipIf(adapter !== 'libsql')(
    'detects incompatibility without mutation and resets only disposable Knowledge data',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'knowledge-v2-wave-1-reset-'));
      temporaryDirectories.push(directory);
      const databasePath = join(directory, 'reset.db');
      const initialStorage = new LibSQLStore({ id: 'wave-1-reset-seed', url: `file:${databasePath}` });
      stores.push(initialStorage);
      const initialMemory = new Memory({ storage: initialStorage });
      await initialMemory.createThread({ threadId: 'preserved-thread', resourceId: 'proof', title: 'Preserved' });
      await initialStorage.getStore('knowledge');
      await initialStorage.close();
      stores.splice(stores.indexOf(initialStorage), 1);

      const database = new DatabaseSync(databasePath);
      database.exec('DROP TABLE mastra_knowledge_proposals');
      database.close();

      const storage = new LibSQLStore({ id: 'wave-1-reset', url: `file:${databasePath}` });
      stores.push(storage);
      const domain = storage.stores.knowledge!;
      expect(await domain.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });

      if (!databasePath.startsWith(tmpdir()))
        throw new Error(`Refusing to reset non-temporary database ${databasePath}`);
      await domain.dangerouslyReset();
      expect(await domain.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 2 });
      expect(await new Memory({ storage }).getThreadById({ threadId: 'preserved-thread' })).toMatchObject({
        title: 'Preserved',
      });
    },
  );

  it('upgrades a database written by the published v1 Knowledge release', async () => {
    const { storage, location } = await createStorage('wave-1-upgrade', adapter);
    const { countV1Nodes, hasTable } = await seedPublishedKnowledgeV1(adapter, storage, location);

    // Ordinary memory keeps working on the upgraded database while Knowledge is unused.
    const plainMemory = new Memory({ storage });
    new Mastra({ memory: { default: plainMemory }, logger: false });
    await plainMemory.createThread({ threadId: 'kept-thread', resourceId: 'shipyard', title: 'Kept' });
    await plainMemory.saveMessages({ messages: [message('kept-thread')] });

    expect(await countV1Nodes()).toBe(1);

    // Knowledge v1 data is not migrated: turning Knowledge on replaces the published v1 tables, rows included.
    const upgraded = createRuntime(storage, await createVector());
    await upgraded.knowledge.reconcile();
    expect(await storage.stores!.knowledge!.getNode('v1-node')).toBeNull();
    // Replacement removes the retired v1 cursor table from this store's own schema.
    if (hasTable) expect(await hasTable('mastra_knowledge_cursors')).toBe(false);
    const threadId = `upgrade-${randomUUID()}`;
    await upgraded.memory.createThread({ threadId, resourceId: 'shipyard', title: 'After upgrade' });
    await upgraded.memory.saveMessages({ messages: [message(threadId)] });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    await (await upgraded.memory.omEngine)!.observe({
      threadId,
      resourceId: 'shipyard',
      requestContext,
      sendStateSignal: async () => ({ skipped: false }) as never,
    });
    await upgraded.memory.settled();
    expect(
      await upgraded.knowledge.resolveNode({ name: 'Atlas refund launch', scope: ['org:acme', 'resource:shipyard'] }),
    ).toMatchObject({ kind: 'feature' });
    expect(await upgraded.memory.getThreadById({ threadId: 'kept-thread' })).toMatchObject({ title: 'Kept' });
  });
});
