import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { afterEach, describe, expect, it } from 'vitest';

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

function message(threadId: string): MastraDBMessage {
  return {
    id: randomUUID(),
    threadId,
    resourceId: 'workspace',
    role: 'user',
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text: 'Maya Chen owns the Atlas refund launch.' }] },
  };
}

type Step = { toolName: string; input: Record<string, unknown> } | { text: string };

/** A streaming model that plays `steps` in order, one per model call, and records every prompt it sees. */
function scriptedModel(steps: Step[]) {
  const prompts: unknown[] = [];
  let next = 0;
  const doStream = async ({ prompt }: { prompt: unknown }) => {
    prompts.push(prompt);
    const step = steps[next++] ?? { text: 'Done.' };
    const usage = { inputTokens: 20, outputTokens: 8, totalTokens: 28 };
    const chunks =
      'text' in step
        ? [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: `text-${next}` },
            { type: 'text-delta', id: `text-${next}`, delta: step.text },
            { type: 'text-end', id: `text-${next}` },
            { type: 'finish', finishReason: 'stop', usage },
          ]
        : [
            { type: 'stream-start', warnings: [] },
            {
              type: 'tool-call',
              toolCallId: `call-${next}`,
              toolName: step.toolName,
              input: JSON.stringify(step.input),
            },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ];
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  };
  return {
    prompts,
    model: {
      specificationVersion: 'v2' as const,
      provider: 'aimock',
      modelId: 'scripted-knowledge',
      supportedUrls: {},
      doStream,
      doGenerate: async () => {
        throw new Error('This proof runs streaming agent turns only.');
      },
    },
  };
}

const curation: Step[] = [
  {
    toolName: 'knowledge_page',
    input: {
      op: 'write',
      scope: 'resource:workspace',
      key: 'atlas',
      name: 'Atlas refund launch',
      body: 'Atlas is the refund launch for Q4.',
    },
  },
  {
    toolName: 'knowledge_note',
    input: {
      op: 'add',
      page: 'resource:workspace#atlas',
      scope: ['resource:workspace'],
      text: '[[Maya Chen]] owns the [[Atlas refund launch]].',
    },
  },
  {
    toolName: 'knowledge_pin',
    input: { op: 'pin', page: 'resource:workspace#atlas', audience: ['resource:workspace'] },
  },
  { text: 'Recorded.' },
];

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

  const directory = await mkdtemp(join(tmpdir(), 'knowledge-pages-'));
  temporaryDirectories.push(directory);
  const location = join(directory, 'knowledge.db');
  const storage = new LibSQLStore({ id, url: `file:${location}` });
  stores.push(storage);
  return { storage, location };
}

function createRuntime(storage: MastraCompositeStore, steps: Step[]) {
  const knowledge = new Knowledge({
    id: 'mastra',
    name: 'Mastra Knowledge',
    description: 'Product architecture, repository work, and operational knowledge for Mastra.',
    storage,
    scopes: knowledgeMemoryScopes(),
    tools: true,
    pinnedContext: true,
  });
  const curator = scriptedModel(steps);
  const memory = new Memory({ storage });
  memories.push(memory);
  // The run holds its agent `scopes` plus its Memory resource and thread.
  const agent = new Agent({
    id: 'curator',
    name: 'Curator',
    instructions: 'Record durable facts.',
    model: curator.model,
    memory,
    knowledge: 'mastra',
    scopes: ['org:acme'],
  });
  const mastra = new Mastra({
    agents: { curator: agent },
    knowledge: { mastra: knowledge },
    memory: { default: memory },
    logger: false,
  });
  return { knowledge: mastra.getKnowledge('mastra'), memory, agent: mastra.getAgent('curator'), curator };
}

/** Reads the Atlas page, its notes and its pins the way a run holding `org:acme` and `resource:workspace` sees them. */
async function readAtlas(knowledge: Knowledge) {
  const store = await knowledge.getStorage();
  const read = await knowledge.readScopeFor(['org:acme', 'resource:workspace']);
  const [scope] = await store.getScopesByAddress(['resource:workspace']);
  const page = scope ? await store.getPageByPath({ scopeId: scope.id, path: ['atlas'], read }) : null;
  const notes = page ? (await store.listNotes({ pageId: page.id, read })).notes : [];
  const pins = (await store.listPins({ audience: ['resource:workspace'], read })).pins;
  return { scope, page, notes, pins };
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
    '["workspace"]',
    'workspace',
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

describe.each(adapters)('Knowledge pages on a real store, curated by an agent (%s)', adapter => {
  it('writes a page, a note and a pin through agent tools, and a restarted runtime reads and delivers them', async () => {
    const resolvedPackages = {
      core: import.meta.resolve('@mastra/core/knowledge'),
      memory: import.meta.resolve('@mastra/memory'),
      adapter: import.meta.resolve(adapter === 'pg' ? '@mastra/pg' : '@mastra/libsql'),
    };
    // The proof runs against this worktree's builds, not a published package.
    expect(resolvedPackages.core).toContain('/packages/core/dist/knowledge/');
    expect(resolvedPackages.memory).toContain('/packages/memory/dist/');
    expect(resolvedPackages.adapter).toContain(adapter === 'pg' ? '/stores/pg/dist/' : '/stores/libsql/dist/');
    const { storage, location } = await createStorage(`knowledge-${adapter}`, adapter);
    const first = createRuntime(storage, curation);
    const threadId = `proof-${randomUUID()}`;
    await first.memory.createThread({ threadId, resourceId: 'workspace', title: 'Knowledge proof' });
    await (
      await first.agent.stream('Maya Chen owns the Atlas refund launch.', {
        memory: { thread: threadId, resource: 'workspace' },
      })
    ).consumeStream();
    await first.memory.settled();

    const written = await readAtlas(first.knowledge);
    expect(written.page).toMatchObject({ name: 'Atlas refund launch', body: 'Atlas is the refund launch for Q4.' });
    expect(written.notes).toHaveLength(1);
    expect(written.notes[0]).toMatchObject({
      text: '[[Maya Chen]] owns the [[Atlas refund launch]].',
      stampScopeIds: [written.scope!.id],
    });
    expect(written.pins.map(pin => pin.pageId)).toEqual([written.page!.id]);
    // A run that holds only another resource sees none of it.
    const store = await first.knowledge.getStorage();
    const outsider = await first.knowledge.readScopeFor(['org:acme', 'resource:someone-else']);
    expect(await store.getPage({ id: written.page!.id, read: outsider })).toBeNull();

    await first.memory.settled();
    memories.splice(memories.indexOf(first.memory), 1);
    await storage.close();
    stores.splice(stores.indexOf(storage), 1);

    const restartedStorage =
      adapter === 'pg'
        ? new PostgresStore({
            id: `knowledge-${adapter}-restart`,
            connectionString: postgresConnectionString,
            schemaName: location,
          })
        : new LibSQLStore({ id: `knowledge-${adapter}-restart`, url: `file:${location}` });
    stores.push(restartedStorage);
    const restarted = createRuntime(restartedStorage, [{ text: 'Noted.' }]);
    const persisted = await readAtlas(restarted.knowledge);
    expect(persisted.page?.id).toBe(written.page?.id);
    expect(persisted.notes.map(note => note.id)).toEqual(written.notes.map(note => note.id));
    expect(persisted.pins.map(pin => pin.pageId)).toEqual([written.page!.id]);

    // The pinned page reaches the next turn of a fresh runtime without the agent asking for it.
    const nextThread = `next-${randomUUID()}`;
    await restarted.memory.createThread({ threadId: nextThread, resourceId: 'workspace', title: 'Next turn' });
    await (
      await restarted.agent.stream('What is Atlas?', { memory: { thread: nextThread, resource: 'workspace' } })
    ).consumeStream();
    expect(JSON.stringify(restarted.curator.prompts[0])).toContain('Atlas is the refund launch for Q4.');

    await writeProofOutput({
      adapter,
      resolvedPackages: Object.fromEntries(
        Object.entries(resolvedPackages).map(([name, url]) => [name, sanitizePackageUrl(url)]),
      ),
      page: persisted.page?.name,
      notes: persisted.notes.length,
      pins: persisted.pins.length,
      restart: { samePageId: persisted.page?.id === written.page?.id },
    });
  });

  it.skipIf(adapter !== 'libsql')(
    'detects an incompatible Knowledge schema without mutation and resets only Knowledge data',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'knowledge-pages-reset-'));
      temporaryDirectories.push(directory);
      const databasePath = join(directory, 'reset.db');
      const initialStorage = new LibSQLStore({ id: 'knowledge-reset-seed', url: `file:${databasePath}` });
      stores.push(initialStorage);
      const initialMemory = new Memory({ storage: initialStorage });
      await initialMemory.createThread({ threadId: 'preserved-thread', resourceId: 'proof', title: 'Preserved' });
      await initialStorage.getStore('knowledge');
      await initialStorage.close();
      stores.splice(stores.indexOf(initialStorage), 1);

      // A schema-2 table beside the schema-4 ones makes the store need a reset.
      const database = new DatabaseSync(databasePath);
      database.exec('CREATE TABLE mastra_knowledge_nodes (id TEXT PRIMARY KEY)');
      database.close();

      const storage = new LibSQLStore({ id: 'knowledge-reset', url: `file:${databasePath}` });
      stores.push(storage);
      const domain = storage.stores.knowledge!;
      // Inspecting twice proves inspection itself changes nothing.
      expect(await domain.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
      expect(await domain.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });

      if (!databasePath.startsWith(tmpdir()))
        throw new Error(`Refusing to reset non-temporary database ${databasePath}`);
      await domain.dangerouslyReset();
      expect(await domain.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 4 });
      expect(await new Memory({ storage }).getThreadById({ threadId: 'preserved-thread' })).toMatchObject({
        title: 'Preserved',
      });
    },
  );

  it('keeps a published v1 Knowledge database untouched until an explicit reset, while Memory keeps working', async () => {
    const { storage, location } = await createStorage('knowledge-upgrade', adapter);
    const { countV1Nodes, hasTable } = await seedPublishedKnowledgeV1(adapter, storage, location);

    const plainMemory = new Memory({ storage });
    new Mastra({ memory: { default: plainMemory }, logger: false });
    await plainMemory.createThread({ threadId: 'kept-thread', resourceId: 'workspace', title: 'Kept' });
    await plainMemory.saveMessages({ messages: [message('kept-thread')] });
    expect(await countV1Nodes()).toBe(1);

    // Knowledge v1 data is never migrated: the store reports a reset and leaves the rows alone.
    const domain = storage.stores!.knowledge!;
    expect(await domain.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });
    expect(await countV1Nodes()).toBe(1);

    await domain.dangerouslyReset();
    expect(await domain.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 4 });
    if (hasTable) {
      expect(await hasTable('mastra_knowledge_nodes')).toBe(false);
      expect(await hasTable('mastra_knowledge_cursors')).toBe(false);
    }

    const upgraded = createRuntime(storage, curation);
    const threadId = `upgrade-${randomUUID()}`;
    await upgraded.memory.createThread({ threadId, resourceId: 'workspace', title: 'After upgrade' });
    await (
      await upgraded.agent.stream('Maya Chen owns the Atlas refund launch.', {
        memory: { thread: threadId, resource: 'workspace' },
      })
    ).consumeStream();
    await upgraded.memory.settled();
    expect((await readAtlas(upgraded.knowledge)).notes).toHaveLength(1);
    expect(await upgraded.memory.getThreadById({ threadId: 'kept-thread' })).toMatchObject({ title: 'Kept' });
  });
});
