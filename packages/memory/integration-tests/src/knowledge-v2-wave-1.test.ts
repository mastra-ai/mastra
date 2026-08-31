import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { Memory, Subconscious } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { afterEach, describe, expect, it, vi } from 'vitest';

const adapter = process.env.KNOWLEDGE_ADAPTER === 'pg' ? 'pg' : 'libsql';
const outputPath = process.env.KNOWLEDGE_PROOF_OUTPUT;
const temporaryDirectories: string[] = [];
const stores: MastraCompositeStore[] = [];
const postgresSchemas: string[] = [];

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

function deterministicCaptureModel() {
  const doStream = vi.fn(async () => ({
    stream: new ReadableStream({
      start(controller) {
        for (const chunk of [
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'wave-1-observation', modelId: 'aimock', timestamp: new Date() },
          { type: 'text-start', id: 'wave-1-text' },
          {
            type: 'text-delta',
            id: 'wave-1-text',
            delta: '<observations>Maya Chen owns the Atlas refund launch.</observations>',
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
  const doGenerate = vi.fn(async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
    warnings: [],
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          capture: {
            nodes: [
              {
                name: 'Atlas refund launch',
                kind: 'feature',
                scope: 'resource',
                records: [
                  {
                    text: '[[Maya Chen]] owns the [[Atlas refund launch]].',
                    scope: 'resource',
                    reason: 'Ownership is required to coordinate the refund launch.',
                  },
                ],
              },
            ],
          },
        }),
      },
    ],
  }));
  return {
    model: {
      specificationVersion: 'v2' as const,
      provider: 'aimock',
      modelId: 'deterministic-wave-1',
      doStream,
      doGenerate,
    },
    doGenerate,
  };
}

async function createStorage(id: string): Promise<{ storage: MastraCompositeStore; location: string }> {
  if (adapter === 'pg') {
    const schemaName = `knowledge_w1_${randomUUID().replaceAll('-', '')}`;
    postgresSchemas.push(schemaName);
    const storage = new PostgresStore({
      id,
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5434,
      database: process.env.POSTGRES_DB || 'postgres',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
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

function createRuntime(storage: MastraCompositeStore) {
  const knowledge = new Knowledge({ id: 'shipyard-knowledge', storage, structure });
  const { model, doGenerate } = deterministicCaptureModel();
  const memory = new Memory({
    storage,
    knowledge: 'default',
    options: {
      observationalMemory: {
        enabled: true,
        model,
        experimental_subconscious: new Subconscious({ observation: ['capture'], reflection: [] }),
        observation: { messageTokens: 1, bufferTokens: false, previousObserverTokens: 1_000 },
      },
    },
  });
  const mastra = new Mastra({ knowledge: { default: knowledge }, memory: { default: memory }, logger: false });
  return { knowledge: mastra.getKnowledge('default'), memory, doGenerate };
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

describe(`Knowledge Wave 1 linked-workspace proof (${adapter})`, () => {
  it('reconciles, captures through OM, and survives a fresh runtime restart', async () => {
    const resolvedPackages = {
      core: import.meta.resolve('@mastra/core/knowledge'),
      memory: import.meta.resolve('@mastra/memory'),
      adapter: import.meta.resolve(adapter === 'pg' ? '@mastra/pg' : '@mastra/libsql'),
    };
    expect(resolvedPackages.core).toContain('/packages/core/dist/knowledge/');
    expect(resolvedPackages.memory).toContain('/packages/memory/dist/');
    expect(resolvedPackages.adapter).toContain(adapter === 'pg' ? '/stores/pg/dist/' : '/stores/libsql/dist/');

    const { storage, location } = await createStorage(`wave-1-${adapter}`);
    const first = createRuntime(storage);
    const reconciled = await first.knowledge.reconcile();
    expect(Object.keys(reconciled.scopes)).toEqual(
      expect.arrayContaining(structure.scopes.map(scope => scope.address)),
    );
    expect(
      Object.values(reconciled.scopes).every(id =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
      ),
    ).toBe(true);
    const knowledgeStore = await first.knowledge.getStorageInternal();
    expect(await knowledgeStore.getNodeScopeIds(reconciled.scopes['features:memory:subconscious']!)).toEqual([
      reconciled.scopes['features:memory'],
    ]);
    expect(await knowledgeStore.getNodeScopeIds(reconciled.scopes['repo:mastra:issues']!)).toEqual([
      reconciled.scopes['repo:mastra'],
    ]);
    expect(await knowledgeStore.getNodeScopeIds(reconciled.scopes['repo:mastra:prs']!)).toEqual([
      reconciled.scopes['repo:mastra'],
    ]);

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
    expect(first.doGenerate).toHaveBeenCalledTimes(1);

    const companion = await first.knowledge.materializeScope({
      address: 'resource:shipyard:uncurated',
      contextualScopeAddress: 'resource:shipyard',
      parentAddresses: ['resource:shipyard'],
      parameters: { resourceId: 'shipyard' },
    });
    const visibleScopeIds = [
      reconciled.scopes['org:acme']!,
      reconciled.scopes['resource:shipyard']!,
      companion.scopes['resource:shipyard:uncurated']!,
    ];
    const captured = await first.knowledge.resolveNode({ name: 'Atlas refund launch', scopeIds: visibleScopeIds });
    expect(captured).toMatchObject({ kind: 'feature' });
    const records = await first.knowledge.listRecords({ node: captured!.id, scopeIds: visibleScopeIds });
    expect(records.records).toHaveLength(1);
    expect(records.records[0]).toMatchObject({
      text: '[[Maya Chen]] owns the [[Atlas refund launch]].',
      source: threadId,
      metadata: {
        reason: 'Ownership is required to coordinate the refund launch.',
        sourceThreadId: threadId,
      },
    });
    expect(await first.knowledge.listActivity({ scopeIds: visibleScopeIds, limit: 100 })).not.toEqual([]);

    await first.memory.settled();
    await storage.close();
    stores.splice(stores.indexOf(storage), 1);

    const restartedStorage =
      adapter === 'pg'
        ? new PostgresStore({
            id: `wave-1-${adapter}-restart`,
            host: process.env.POSTGRES_HOST || 'localhost',
            port: Number(process.env.POSTGRES_PORT) || 5434,
            database: process.env.POSTGRES_DB || 'postgres',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'postgres',
            schemaName: location,
          })
        : new LibSQLStore({ id: `wave-1-${adapter}-restart`, url: `file:${location}` });
    stores.push(restartedStorage);
    const restarted = createRuntime(restartedStorage);
    const replay = await restarted.knowledge.reconcile();
    expect(replay.createdScopeIds).toEqual([]);
    expect(replay.scopes).toEqual(reconciled.scopes);
    const restartedCompanion = await restarted.knowledge.materializeScope({
      address: 'resource:shipyard:uncurated',
      contextualScopeAddress: 'resource:shipyard',
      parentAddresses: ['resource:shipyard'],
      parameters: { resourceId: 'shipyard' },
    });
    expect(restartedCompanion.createdScopeIds).toEqual([]);
    const restartedScopeIds = [
      replay.scopes['org:acme']!,
      replay.scopes['resource:shipyard']!,
      restartedCompanion.scopes['resource:shipyard:uncurated']!,
    ];
    const persisted = await restarted.knowledge.resolveNode({
      name: 'Atlas refund launch',
      scopeIds: restartedScopeIds,
    });
    expect(persisted?.id).toBe(captured?.id);
    expect(
      (await restarted.knowledge.listRecords({ node: persisted!.id, scopeIds: restartedScopeIds })).records,
    ).toHaveLength(1);

    await writeProofOutput({
      adapter,
      resolvedPackages: Object.fromEntries(
        Object.entries(resolvedPackages).map(([name, url]) => [name, sanitizePackageUrl(url)]),
      ),
      structureScopeCount: Object.keys(reconciled.scopes).length,
      capture: { node: captured?.name, records: records.records.length, activity: 'present' },
      restart: { sameNodeId: persisted?.id === captured?.id, duplicateScopes: replay.createdScopeIds.length },
    });
  });

  it.skipIf(adapter !== 'libsql')('clears only disposable Knowledge data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'knowledge-wave-1-clear-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'clear.db');
    const storage = new LibSQLStore({ id: 'wave-1-clear', url: `file:${databasePath}` });
    stores.push(storage);
    const memory = new Memory({ storage });
    await memory.createThread({ threadId: 'preserved-thread', resourceId: 'proof', title: 'Preserved' });

    const runtime = createRuntime(storage);
    const reconciled = await runtime.knowledge.reconcile();
    const resourceScopeId = reconciled.scopes['resource:shipyard']!;
    const node = await runtime.knowledge.createNode({
      name: 'Disposable Knowledge',
      scopeIds: [resourceScopeId],
      isScope: false,
    });
    expect(await runtime.knowledge.getNodeInternal(node.id)).not.toBeNull();

    if (!databasePath.startsWith(tmpdir())) throw new Error(`Refusing to clear non-temporary database ${databasePath}`);
    await storage.stores.knowledge!.dangerouslyClearAll();

    expect(await runtime.knowledge.getNodeInternal(node.id)).toBeNull();
    expect(await memory.getThreadById({ threadId: 'preserved-thread' })).toMatchObject({ title: 'Preserved' });
  });
});
