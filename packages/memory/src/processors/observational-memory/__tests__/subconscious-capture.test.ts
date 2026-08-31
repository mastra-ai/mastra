import { readFileSync } from 'node:fs';

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import { extractStructuredValues } from '../extraction-runner';
import {
  KnowledgeSemanticIndexCoordinator,
  StaleKnowledgeSemanticIndexError,
  Subconscious,
  SubconsciousCaptureExtractor,
} from '../subconscious';
import type { SubconsciousCaptureHook, SubconsciousCaptureOutput } from '../subconscious';
import { PINNED_INSTRUCTIONS } from '../subconscious/curate';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import { createPinnedTools, listPinnedKnowledge } from '../subconscious/pinned';

function createMemory() {
  const storage = new InMemoryStore();
  return new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }) });
}

async function resolveTestScopeIds(
  memory: Memory,
  threadId = 'alpha',
  organizationId = 'acme',
  resourceId = 'user-42',
) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', organizationId);
  return resolveKnowledgeScopeIds(memory, {
    agent: { threadId, resourceId },
    requestContext,
  });
}

function createContext(memory: Memory, current: SubconsciousCaptureOutput) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  return {
    source: 'observer' as const,
    threadId: 'alpha',
    resourceId: 'user-42',
    memory,
    requestContext,
    current,
  };
}

describe('Subconscious capture', () => {
  it('composes canonical identifier and URL preservation into capture extraction', async () => {
    let prompt = '';
    const recordText = 'Project Atlas is tracked as COR-1165 at https://linear.app/kepler-crm/issue/COR-1165.';
    const agent = new Agent({
      id: 'capture-instruction-test',
      name: 'Capture Instruction Test',
      instructions: 'Extract values.',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt: modelPrompt }) => {
          prompt = JSON.stringify(modelPrompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  capture: {
                    nodes: [
                      {
                        name: 'Project Atlas',
                        kind: 'project',
                        records: [{ text: recordText, reason: 'Preserves the canonical issue reference.' }],
                      },
                    ],
                  },
                }),
              },
            ],
            warnings: [],
          };
        },
      }),
    });
    const capture = await new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    }).resolve({ source: 'observer' });

    const result = await extractStructuredValues({ agent, source: 'observer', extractors: [capture] });

    expect(prompt).toContain(
      'When the conversation states a canonical identifier or URL for an entity, preserve it verbatim in the record text.',
    );
    expect(result.values.capture).toMatchObject({
      nodes: [{ records: [{ text: recordText }] }],
    });
  });

  it('deterministically writes scoped nodes, records, mentions, provenance, and companion routing', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [
        {
          name: 'Project Atlas',
          kind: 'project',
          records: [
            {
              text: '[[Maya Chen]] owns [[Project Atlas]].',
              scope: 'org',
              when: '2030-01-15',
            },
            { text: 'The staging region is cobalt.' },
          ],
        },
      ],
    });

    await extractor.onExtracted?.({ ...context, extractor });

    const store = (await memory.storage.getStore('knowledge'))!;
    const threadScopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext: context.requestContext,
    });
    const atlas = await store.resolveNode({ name: 'Project Atlas', scopeIds: threadScopeIds });
    const maya = await store.resolveNode({ name: 'Maya Chen', scopeIds: threadScopeIds });
    expect(atlas).toMatchObject({ kind: 'project' });
    expect(await store.getNodeScopeIds(maya!.id)).toEqual(await store.getNodeScopeIds(atlas!.id));

    const records = await store.listRecords({ node: atlas!.id, scopeIds: threadScopeIds });
    expect(records.records).toHaveLength(2);
    expect(records.records[0]).toMatchObject({ source: 'alpha' });
    expect(records.records.every(record => record.metadata?.sourceThreadId === 'alpha')).toBe(true);
    expect(records.records.find(record => record.metadata?.when)?.metadata?.when).toBe('2030-01-15T00:00:00.000Z');

    const touchingMaya = await store.listRelatedRecords({ node: maya!.id, scopeIds: threadScopeIds });
    expect(touchingMaya.records.map(record => record.text)).toContain('[[Maya Chen]] owns [[Project Atlas]].');
  });

  it('routes a selected keyed Knowledge runtime into mirrored uncurated companions', async () => {
    const memoryStorage = new InMemoryStore();
    const knowledge = new Knowledge({ id: 'analytics', storage: new InMemoryStore() });
    const memory = new Memory({
      storage: memoryStorage,
      knowledge: 'analytics',
      options: {
        observationalMemory: {
          model: 'google/gemini-2.5-flash',
          experimental_subconscious: new Subconscious(),
        },
      },
    });
    new Mastra({ knowledge: { analytics: knowledge }, memory: { default: memory }, logger: false });
    const keyedStore = await knowledge.getStorage();
    const orgScope = await knowledge.materializeScope({
      address: 'org:acme',
      contextualScopeAddress: 'org:acme',
      parameters: { orgId: 'acme' },
    });
    const resourceScope = await knowledge.materializeScope({
      address: 'resource:user-42',
      parentAddresses: ['org:acme'],
      contextualScopeAddress: 'org:acme',
      parameters: { orgId: 'acme', resourceId: 'user-42' },
    });
    const maya = await keyedStore.createNode({
      name: 'Maya Chen',
      kind: 'person',
      scopeIds: [orgScope.scopes['org:acme']!, resourceScope.scopes['resource:user-42']!],
    });
    const reconcile = vi.spyOn(keyedStore, 'reconcileStructure');
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });

    await extractor.onExtracted?.({
      ...createContext(memory, {
        nodes: [
          {
            name: 'Project Atlas',
            kind: 'project',
            records: [
              { text: '[[Maya Chen]] owns this thread-only note.' },
              { text: '[[Thread Secret]] is private.' },
              { text: 'Resource-wide note.', scope: 'resource' },
            ],
          },
        ],
      }),
      extractor,
    });

    const threadCompanion = 'resource:user-42:thread:alpha:uncurated';
    const resourceCompanion = 'resource:user-42:uncurated';
    const threadCompanionCall = reconcile.mock.calls.findIndex(([plan]) =>
      plan.scopes.some(scope => scope.address === threadCompanion),
    );
    const resourceCompanionCall = reconcile.mock.calls.findIndex(([plan]) =>
      plan.scopes.some(scope => scope.address === resourceCompanion),
    );
    const threadCompanionResult = await reconcile.mock.results[threadCompanionCall]!.value;
    const resourceCompanionResult = await reconcile.mock.results[resourceCompanionCall]!.value;
    const threadCompanionId = threadCompanionResult.scopes[threadCompanion]!;
    const resourceCompanionId = resourceCompanionResult.scopes[resourceCompanion]!;
    const companionScopeIds = [threadCompanionId, resourceCompanionId];
    const node = await keyedStore.resolveNode({ name: 'Project Atlas', scopeIds: companionScopeIds });
    expect(await keyedStore.getNodeScopeIds(node!.id)).toEqual([threadCompanionId]);
    expect((await keyedStore.listNodes({ scopeIds: [threadCompanionId] })).map(result => result.id)).toContain(
      node!.id,
    );
    const records = await keyedStore.listRecords({ node: node!.id, scopeIds: companionScopeIds });
    expect(await Promise.all(records.records.map(record => keyedStore.getRecordScopeIds(record.id)))).toEqual(
      expect.arrayContaining([[threadCompanionId], [resourceCompanionId]]),
    );
    expect(
      (
        await keyedStore.listRelatedRecords({
          node: maya.id,
          scopeIds: [...(await keyedStore.getNodeScopeIds(maya.id)), ...companionScopeIds],
        })
      ).records.map(record => record.text),
    ).toContain('[[Maya Chen]] owns this thread-only note.');
    expect(await keyedStore.getNodeByName({ name: 'Thread Secret', scopeIds: [threadCompanionId] })).not.toBeNull();
    expect(await keyedStore.resolveNode({ name: 'Thread Secret', scopeIds: [resourceCompanionId] })).toBeNull();

    const toolRequestContext = new RequestContext();
    toolRequestContext.set('organizationId', 'acme');
    const toolContext = {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext: toolRequestContext,
    } as any;
    const tools = memory.listTools();
    const search = await tools.knowledge_search!.execute?.({ query: 'thread-only' }, toolContext);
    expect((search as any).results.map((result: any) => result.text)).toContain(
      '[[Maya Chen]] owns this thread-only note.',
    );
    const read = await tools.knowledge_read!.execute?.({ id: maya.id, relationship: 'related' }, toolContext);
    expect((read as any).records.map((record: any) => record.text)).toContain(
      '[[Maya Chen]] owns this thread-only note.',
    );
    const browse = await tools.knowledge_browse!.execute?.({}, toolContext);
    expect((browse as any).nodes.map((result: any) => result.id)).toContain(node!.id);

    const plans = reconcile.mock.calls.flatMap(([plan]) => plan.scopes);
    expect(plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          address: threadCompanion,
          parentAddresses: ['resource:user-42:thread:alpha'],
          grants: [expect.objectContaining({ scopeRefAddress: 'resource:user-42:thread:alpha', role: 'owner' })],
        }),
        expect.objectContaining({
          address: resourceCompanion,
          parentAddresses: ['resource:user-42'],
          grants: [expect.objectContaining({ scopeRefAddress: 'resource:user-42', role: 'mirror' })],
        }),
      ]),
    );

    const routedExtractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });
    await routedExtractor.onExtracted?.({
      ...createContext(memory, {
        nodes: [
          { name: 'Routing Test', kind: 'test', scope: 'org', records: [{ text: 'Private.', scope: 'resource' }] },
        ],
      }),
      extractor: routedExtractor,
    });
    const routedNode = await keyedStore.getNodeByName({ name: 'Routing Test', scopeIds: [threadCompanionId] });
    expect(await keyedStore.getNodeScopeIds(routedNode!.id)).toEqual([threadCompanionId]);
    const routedRecords = await keyedStore.listRecords({ node: routedNode!.id, scopeIds: companionScopeIds });
    expect(await keyedStore.getRecordScopeIds(routedRecords.records[0]!.id)).toEqual([resourceCompanionId]);

    const baseScopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext: toolRequestContext,
    });
    const pinTools = createPinnedTools(memory, {
      scopeIds: baseScopeIds,
      sourceThreadId: 'alpha',
      maxPins: 5,
      maxCharacters: 500,
    });
    await pinTools.knowledge_pin!.execute?.(
      { text: 'Always validate the deployment.', reason: 'Hard release constraint.' },
      {} as any,
    );
    expect((await listPinnedKnowledge({ store: keyedStore, scopeIds: baseScopeIds })).pins).toHaveLength(1);

    const legacyStore = (await memoryStorage.getStore('knowledge'))!;
    expect(await legacyStore.listNodes({ scopeIds: baseScopeIds })).toEqual([]);
  });

  it('fails closed when keyed Knowledge is disabled, missing, or unsupported', async () => {
    await expect(new Memory({ knowledge: false }).getKnowledgeStore()).rejects.toThrow(
      'Subconscious Knowledge requires a configured Knowledge instance.',
    );

    const missing = new Memory({ knowledge: 'missing' });
    new Mastra({ memory: { default: missing }, logger: false });
    await expect(missing.getKnowledgeStore()).rejects.toThrow('Knowledge with key missing not found');

    const unsupportedStorage = new InMemoryStore();
    const unsupportedStore = (await unsupportedStorage.getStore('knowledge'))!;
    vi.spyOn(unsupportedStore, 'getCapabilities').mockReturnValue({
      supported: false,
      schemaVersion: 1,
      contractVersion: 1,
    });
    const memory = new Memory({ knowledge: new Knowledge({ id: 'unsupported', storage: unsupportedStorage }) });
    await expect(memory.getKnowledgeStore()).rejects.toThrow('does not support Knowledge');
  });

  it('loads bounded learned guidance after user instructions', async () => {
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const scopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext,
    });
    const guidance = await store.createNode({
      name: 'capture-guidance',
      kind: 'document',
      scopeIds: [scopeIds[1]!],
    });
    await store.createRecord({
      node: guidance,
      text: `Treat Atlas as a project.\n${'x'.repeat(5_000)}`,
      scopeIds: [scopeIds[1]!],
    });
    const extractor = new SubconsciousCaptureExtractor({
      config: { name: 'capture', instructions: 'Record pricing amounts verbatim.' },
      learnedGuidance: true,
    });

    const resolved = await extractor.resolve(createContext(memory, { nodes: [] }));
    expect(resolved.instructions).toContain('Record pricing amounts verbatim.');
    expect(resolved.instructions).toContain('Learned guidance');
    expect(resolved.instructions.indexOf('Record pricing')).toBeLessThan(
      resolved.instructions.indexOf('Learned guidance'),
    );
    expect(resolved.instructions.length).toBeLessThan(6_500);
  });

  it('lets a configured capture hook replace or augment default routing', async () => {
    const memory = createMemory();
    const routeImpl: SubconsciousCaptureHook = async context => {
      await context.defaultImplementation(context);
    };
    const route = vi.fn(routeImpl);
    const extractor = new SubconsciousCaptureExtractor({
      config: { name: 'capture', onExtracted: route },
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [{ name: 'Atlas', kind: 'project', records: [] }],
    });

    await extractor.onExtracted?.({ ...context, extractor });
    expect(route).toHaveBeenCalledOnce();
    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext: context.requestContext,
    });
    expect(await store.resolveNode({ name: 'Atlas', scopeIds })).not.toBeNull();
  });

  it('routes model-selected node scope to an authorized companion', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [{ name: 'Alpha Secret', kind: 'note', scope: 'thread', records: [] }],
    });

    await extractor.onExtracted?.({ ...context, extractor });

    const store = (await memory.storage.getStore('knowledge'))!;
    const alphaScopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext: context.requestContext,
    });
    const betaScopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'beta', resourceId: 'user-42' },
      requestContext: context.requestContext,
    });
    expect(await store.resolveNode({ name: 'Alpha Secret', scopeIds: betaScopeIds })).toBeNull();
    expect(await store.resolveNode({ name: 'Alpha Secret', scopeIds: alphaScopeIds })).not.toBeNull();
  });

  it('publishes bounded activity through the state signal lane after capture', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      activityRecentUpdates: 2,
    });
    const sendStateSignal = vi.fn(async () => ({ skipped: true, reason: 'unchanged' }) as any);
    const context = createContext(memory, {
      nodes: [{ name: 'Atlas', kind: 'project', records: [{ text: 'Atlas launches in January.' }] }],
    });

    await extractor.onExtracted?.({ ...context, extractor, sendStateSignal });

    expect(sendStateSignal).toHaveBeenCalledOnce();
    expect(sendStateSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'subconscious-activity',
        mode: 'snapshot',
        contents: expect.stringContaining('[[Atlas]]'),
      }),
    );
  });

  it('fails explicitly when required conversation scope context is unavailable', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });

    await expect(
      extractor.onExtracted?.({
        source: 'observer',
        threadId: 'alpha',
        resourceId: 'user-42',
        memory,
        current: { nodes: [] },
        extractor,
      }),
    ).rejects.toThrow(/organizationId/);
  });
});

describe('Knowledge semantic indexing', () => {
  function createVector() {
    const indexes = new Set<string>();
    const vectors = new Map<string, { metadata: Record<string, unknown>; vector: number[] }>();
    const deleteVectors = vi.fn(async ({ ids }: { ids?: string[] }) => {
      for (const id of ids ?? []) vectors.delete(id);
    });
    const vector = {
      indexSeparator: '_',
      listIndexes: vi.fn(async () => [...indexes]),
      createIndex: vi.fn(async ({ indexName }: { indexName: string }) => {
        indexes.add(indexName);
      }),
      upsert: vi.fn(
        async ({
          ids,
          metadata,
          vectors: values,
        }: {
          ids?: string[];
          metadata?: Record<string, unknown>[];
          vectors: number[][];
        }) => {
          values.forEach((value, index) => {
            vectors.set(ids![index]!, { vector: value, metadata: metadata![index]! });
          });
          return ids ?? [];
        },
      ),
      deleteVectors,
      query: vi.fn(async () =>
        [...vectors.entries()].map(([id, value]) => ({ id, score: 1, metadata: value.metadata })),
      ),
    } as unknown as MastraVector;
    return { vector, vectors, deleteVectors };
  }

  it('drains durable outbox rows idempotently and deletes stale vectors', async () => {
    const memory = createMemory();
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await resolveTestScopeIds(memory);
    const resourceScopeIds = [scopeIds[1]!];
    const node = await knowledge.createNode({
      name: 'Project Atlas',
      kind: 'project',
      metadata: { description: 'Launch plan' },
      scopeIds: resourceScopeIds,
    });
    const record = await knowledge.createRecord({
      node: node.id,
      text: '[[Maya Chen]] owns Atlas.',
      scopeIds: resourceScopeIds,
      resolutionScopeIds: scopeIds,
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    const { vector, vectors, deleteVectors } = createVector();
    const embedder = {
      doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => [0.1, 0.2, 0.3]),
      })),
    } as unknown as MastraEmbeddingModel<string>;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, vector, embedder, workerId: 'test' });

    expect(await coordinator.drain(scopeIds)).toBeGreaterThanOrEqual(2);
    expect(await coordinator.drain(scopeIds)).toBe(0);
    expect(embedder.doEmbed).toHaveBeenCalledWith(expect.objectContaining({ values: ['Project Atlas\nLaunch plan'] }));
    expect(vectors.get(`knowledge:record:${record.id}`)?.metadata).toMatchObject({
      document_type: 'record',
      scope_ids: resourceScopeIds,
    });

    await knowledge.deleteRecord({ id: record.id, deletedBy: 'curator' });
    await coordinator.drain(scopeIds);
    expect(vectors.has(`knowledge:record:${record.id}`)).toBe(false);
    expect(deleteVectors).toHaveBeenCalled();
  });

  it('retrieves companion-scoped vectors from an augmented visible scope set', async () => {
    const memory = createMemory();
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await resolveTestScopeIds(memory);
    const companionScopeIds = [scopeIds[4]!];
    const node = await knowledge.createNode({ name: 'Draft Atlas', kind: 'project', scopeIds: companionScopeIds });
    const record = await knowledge.createRecord({
      node,
      text: 'Companion semantic record.',
      scopeIds: companionScopeIds,
      resolutionScopeIds: scopeIds,
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    const { vector } = createVector();
    const embedder = {
      doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2]) })),
    } as unknown as MastraEmbeddingModel<string>;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, vector, embedder, workerId: 'companion' });

    await coordinator.drain(scopeIds);
    expect((await coordinator.search('companion', scopeIds)).map(result => result.id)).toContain(
      `knowledge:record:${record.id}`,
    );
  });

  it('retries semantic coordinator creation after a transient Knowledge resolution failure', async () => {
    const storage = new InMemoryStore();
    const knowledge = (await storage.getStore('knowledge'))!;
    const { vector } = createVector();
    const embedder = {
      doEmbed: vi.fn(async () => ({ embeddings: [[0.1, 0.2]] })),
    } as unknown as MastraEmbeddingModel<string>;
    const memory = new Memory({ storage, vector, embedder, knowledge: new Knowledge({ id: 'default', storage }) });
    vi.spyOn(memory, 'getKnowledgeStore')
      .mockRejectedValueOnce(new Error('temporary Knowledge failure'))
      .mockResolvedValue(knowledge);

    await expect(memory.getKnowledgeSemanticIndex()).rejects.toThrow('temporary Knowledge failure');
    await expect(memory.getKnowledgeSemanticIndex()).resolves.toBeInstanceOf(KnowledgeSemanticIndexCoordinator);
  });

  it('keeps concurrent drains isolated by visible scope', async () => {
    const memory = createMemory();
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    const acmeScopeIds = await resolveTestScopeIds(memory);
    const betaScopeIds = await resolveTestScopeIds(memory, 'beta-thread', 'beta', 'beta-user');
    await knowledge.createNode({ name: 'Atlas', kind: 'project', scopeIds: [acmeScopeIds[0]!] });
    await knowledge.createNode({ name: 'Beacon', kind: 'project', scopeIds: [betaScopeIds[0]!] });
    const { vector } = createVector();
    const embedder = {
      doEmbed: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { embeddings: [[0.1, 0.2]] };
      }),
    } as unknown as MastraEmbeddingModel<string>;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, vector, embedder, workerId: 'scoped' });

    await Promise.all([coordinator.drain(acmeScopeIds), coordinator.drain(betaScopeIds)]);
    expect(await knowledge.listSemanticOutbox({ status: 'completed' })).toHaveLength(2);
  });

  it('releases failed rows and resumes them idempotently after a crash-like failure', async () => {
    const memory = createMemory();
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await resolveTestScopeIds(memory);
    await knowledge.createNode({ name: 'Atlas', kind: 'project', scopeIds: [scopeIds[0]!] });
    const { vector } = createVector();
    const doEmbed = vi
      .fn<({ values }: { values: string[] }) => Promise<{ embeddings: number[][] }>>()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValue({ embeddings: [[0.1, 0.2]] });
    const coordinator = new KnowledgeSemanticIndexCoordinator({
      knowledge,
      vector,
      embedder: { doEmbed } as unknown as MastraEmbeddingModel<string>,
      workerId: 'retry-test',
    });

    await expect(coordinator.drain(scopeIds)).rejects.toBeInstanceOf(StaleKnowledgeSemanticIndexError);
    expect(await knowledge.listSemanticOutbox({ status: 'pending' })).toHaveLength(1);
    expect(await coordinator.drain(scopeIds)).toBe(1);
    expect((await knowledge.listSemanticOutbox({ status: 'completed' }))[0]).toMatchObject({ attempts: 2 });
  });
});

describe('Subconscious capture-time pinning', () => {
  const pinsOn = { maxPins: 20, maxCharacters: 2_000, capturePinning: true } as const;

  it('routes pin-marked items onto the reserved pinned node within budget', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      pins: pinsOn,
    });
    const context = createContext(memory, {
      nodes: [
        {
          name: 'User Preferences',
          kind: 'person',
          records: [
            { text: 'Prefers voice-first replies.', scope: 'resource', pin: true },
            { text: 'Asked about the deploy runbook.' },
          ],
        },
      ],
    });

    await extractor.onExtracted?.({ ...context, extractor });

    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await resolveTestScopeIds(memory);
    const { pins } = await listPinnedKnowledge({ store, scopeIds });
    expect(pins.map(pin => pin.text)).toEqual(['Prefers voice-first replies.']);

    // No dual write: the pinned text lives only on the reserved entity.
    const node = await store.resolveNode({ name: 'User Preferences', scopeIds });
    const records = await store.listRecords({ node: node!.id, scopeIds });
    expect(records.records.map(record => record.text)).toEqual(['Asked about the deploy runbook.']);
  });

  it('stores the capture reason as KnowledgeRecord metadata on regular and pinned items', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      pins: pinsOn,
    });
    const context = createContext(memory, {
      nodes: [
        {
          name: 'User Preferences',
          kind: 'person',
          records: [
            {
              text: 'Prefers voice-first replies.',
              pin: true,
              reason: 'Stated as a standing preference; must apply every session.',
            },
            { text: 'Asked about the deploy runbook.', reason: 'Recurring topic worth remembering.' },
            { text: 'Mentioned the weather.' },
          ],
        },
      ],
    });

    await extractor.onExtracted?.({ ...context, extractor });

    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await resolveTestScopeIds(memory);
    const { pins } = await listPinnedKnowledge({ store, scopeIds });
    expect(pins[0]!.metadata).toEqual({
      reason: 'Stated as a standing preference; must apply every session.',
      sourceThreadId: 'alpha',
    });

    const node = await store.resolveNode({ name: 'User Preferences', scopeIds });
    const records = (await store.listRecords({ node: node!.id, scopeIds })).records;
    const byText = new Map(records.map(record => [record.text, record.metadata]));
    expect(byText.get('Asked about the deploy runbook.')).toEqual({
      reason: 'Recurring topic worth remembering.',
      sourceThreadId: 'alpha',
    });
    expect(byText.get('Mentioned the weather.')).toEqual({ sourceThreadId: 'alpha' });
  });

  it('drops an over-budget pin without failing the extraction cycle', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      activityRecentUpdates: 3,
      pins: { maxPins: 20, maxCharacters: 10, capturePinning: true },
    });
    const sendStateSignal = vi.fn(async (_signal: { contents: string }) => ({ skipped: 'unchanged' })) as any;
    const context = createContext(memory, {
      nodes: [
        {
          name: 'User Preferences',
          kind: 'person',
          records: [
            { text: 'This pin text is far beyond the ten character budget.', pin: true },
            { text: 'A regular fact that must survive.' },
          ],
        },
      ],
    });

    await expect(extractor.onExtracted?.({ ...context, extractor, sendStateSignal })).resolves.toBeDefined();

    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await resolveTestScopeIds(memory);
    const { pins } = await listPinnedKnowledge({ store, scopeIds });
    expect(pins).toHaveLength(0);
    const node = await store.resolveNode({ name: 'User Preferences', scopeIds });
    const records = await store.listRecords({ node: node!.id, scopeIds });
    expect(records.records.map(record => record.text)).toEqual(['A regular fact that must survive.']);
    // The drop is activity-visible, not silent.
    const signal = sendStateSignal.mock.calls.at(-1)?.[0] as { contents: string } | undefined;
    expect(signal?.contents).toContain('Capture-time pin dropped');
  });

  it('surfaces dropped-pin notes when a custom onExtracted hook delegates to the default implementation', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      activityRecentUpdates: 3,
      pins: { maxPins: 20, maxCharacters: 10, capturePinning: true },
      config: {
        name: 'capture',
        // The hook receives a SPREAD COPY of the context; the note must survive it.
        onExtracted: async ctx => {
          await ctx.defaultImplementation(ctx);
        },
      },
    });
    const sendStateSignal = vi.fn(async (_signal: { contents: string }) => ({ skipped: 'unchanged' })) as any;
    const context = createContext(memory, {
      nodes: [
        {
          name: 'User Preferences',
          kind: 'person',
          records: [{ text: 'This pin text is far beyond the ten character budget.', pin: true }],
        },
      ],
    });

    await extractor.onExtracted?.({ ...context, extractor, sendStateSignal });

    const signal = sendStateSignal.mock.calls.at(-1)?.[0] as { contents: string } | undefined;
    expect(signal?.contents).toContain('Capture-time pin dropped');
  });

  it('leaves the capture schema and instructions byte-for-byte unchanged when the flag is off', async () => {
    const snapshot = JSON.parse(
      readFileSync(new URL('./__fixtures__/capture-flag-off-snapshot.json', import.meta.url), 'utf8'),
    );
    const extractor = new SubconsciousCaptureExtractor({ learnedGuidance: false });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const resolved = await extractor.resolve({
      source: 'observer',
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext,
    } as any);
    expect(z.toJSONSchema(extractor.schema)).toEqual(snapshot.schema);
    expect(resolved.instructions).toBe(snapshot.instructions);
  });

  it('keeps the curator pin test anchored on rediscovery cost', () => {
    expect(PINNED_INSTRUCTIONS).toContain('costly to rediscover');
  });

  it('tells capture to skip restated instructions but always honor explicit user requests to remember', async () => {
    const extractor = new SubconsciousCaptureExtractor({ learnedGuidance: false });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const resolved = await extractor.resolve({
      source: 'observer',
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext,
    } as any);
    expect(resolved.instructions).toContain('Capture what was learned through the work, not what the session was told');
    expect(resolved.instructions).toContain(
      'explicit request from the user to remember something, which is always captured',
    );
  });

  it('uses a custom capture schema verbatim, never augmenting it with the pin flag', () => {
    const custom = z.object({
      nodes: z.array(
        z.object({ name: z.string(), kind: z.string(), records: z.array(z.object({ text: z.string() })) }),
      ),
    });
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      pins: pinsOn,
      config: { name: 'capture', schema: custom as any },
    });
    expect(extractor.schema).toBe(custom);
  });

  it('omits the reason and pin instructions when a custom schema is configured', async () => {
    const custom = z.object({
      nodes: z.array(
        z.object({ name: z.string(), kind: z.string(), records: z.array(z.object({ text: z.string() })) }),
      ),
    });
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      pins: pinsOn,
      config: { name: 'capture', schema: custom as any },
    });
    const memory = createMemory();
    const resolved = await extractor.resolve(createContext(memory, { nodes: [] }));
    expect(resolved.instructions).not.toContain('Every record requires a reason');
    expect(resolved.instructions).not.toContain('pin: true');
  });

  it('includes the reason instruction on the default schemas', async () => {
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
      pins: pinsOn,
    });
    const memory = createMemory();
    const resolved = await extractor.resolve(createContext(memory, { nodes: [] }));
    // Reason is REQUIRED on every record (Jamie, 2026-08-13): concrete why, no filler.
    expect(resolved.instructions).toContain('Every record requires a reason');
    expect(resolved.instructions).toContain('Never write generic filler');
    const schema = z.toJSONSchema(extractor.schema) as any;
    const recordSchema = schema.properties.nodes.items.properties.records.items;
    expect(recordSchema.required).toContain('reason');
  });
});
