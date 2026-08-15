import { readFileSync } from 'node:fs';

import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';
import {
  KnowledgeSemanticIndexCoordinator,
  StaleKnowledgeSemanticIndexError,
  SubconsciousCaptureExtractor,
} from '../subconscious';
import type { SubconsciousCaptureHook, SubconsciousCaptureOutput } from '../subconscious';
import { PINNED_INSTRUCTIONS } from '../subconscious/curate';
import { listPinnedKnowledge } from '../subconscious/pinned';

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
  it('deterministically writes scoped nodes, items, mentions, provenance, and ceilings', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'org',
      maxScope: 'resource',
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [
        {
          name: 'Project Atlas',
          kind: 'project',
          items: [
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
    const resourceScope = ['org:acme', 'resource:user-42'];
    const threadScope = [...resourceScope, 'thread:alpha'];
    const atlas = await store.getNodeByName({ name: 'Project Atlas', scope: resourceScope });
    const maya = await store.resolveNode({ name: 'Maya Chen', scope: threadScope });
    expect(atlas).toMatchObject({ kind: 'project', scope: resourceScope });
    expect(maya).toMatchObject({ scope: resourceScope });

    const items = await store.itemsAbout({ nodeId: atlas!.id, scope: threadScope });
    expect(items.items).toHaveLength(2);
    expect(items.items[0]).toMatchObject({
      sourceThreadId: 'alpha',
      maxScope: 'resource',
    });
    expect(items.items.map(item => item.scope)).toEqual(expect.arrayContaining([resourceScope, threadScope]));
    expect(items.items.find(item => item.when)?.when?.toISOString()).toBe('2030-01-15T00:00:00.000Z');
    expect(items.items.every(item => item.capturedAt instanceof Date)).toBe(true);

    const touchingMaya = await store.itemsTouching({ nodeId: maya!.id, scope: threadScope });
    expect(touchingMaya.items.map(item => item.text)).toContain('[[Maya Chen]] owns [[Project Atlas]].');
  });

  it('loads bounded learned guidance after user instructions', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    await store.createNode({
      name: 'capture-guidance',
      kind: 'document',
      content: `Treat Atlas as a project.\n${'x'.repeat(5_000)}`,
      scope: ['org:acme', 'resource:user-42'],
    });
    const extractor = new SubconsciousCaptureExtractor({
      config: { name: 'capture', instructions: 'Record pricing amounts verbatim.' },
      defaultScope: 'resource',
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
    const memory = new Memory({ storage: new InMemoryStore() });
    const routeImpl: SubconsciousCaptureHook = async context => {
      await context.defaultImplementation(context);
    };
    const route = vi.fn(routeImpl);
    const extractor = new SubconsciousCaptureExtractor({
      config: { name: 'capture', onExtracted: route },
      defaultScope: 'resource',
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [{ name: 'Atlas', kind: 'project', items: [] }],
    });

    await extractor.onExtracted?.({ ...context, extractor });
    expect(route).toHaveBeenCalledOnce();
    const store = (await memory.storage.getStore('knowledge'))!;
    expect(
      await store.resolveNode({ name: 'Atlas', scope: ['org:acme', 'resource:user-42', 'thread:alpha'] }),
    ).not.toBeNull();
  });

  it('honors model-selected node scope within the configured ceiling', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [{ name: 'Alpha Secret', kind: 'note', scope: 'thread', items: [] }],
    });

    await extractor.onExtracted?.({ ...context, extractor });

    const store = (await memory.storage.getStore('knowledge'))!;
    expect(
      await store.resolveNode({ name: 'Alpha Secret', scope: ['org:acme', 'resource:user-42', 'thread:beta'] }),
    ).toBeNull();
    expect(
      await store.resolveNode({ name: 'Alpha Secret', scope: ['org:acme', 'resource:user-42', 'thread:alpha'] }),
    ).toMatchObject({ scope: ['org:acme', 'resource:user-42', 'thread:alpha'] });
  });

  it('publishes bounded activity through the state signal lane after capture', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
      activityRecentUpdates: 2,
    });
    const sendStateSignal = vi.fn(async () => ({ skipped: true, reason: 'unchanged' }) as any);
    const context = createContext(memory, {
      nodes: [{ name: 'Atlas', kind: 'project', items: [{ text: 'Atlas launches in January.' }] }],
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
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
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
    } as unknown as MastraVector;
    return { vector, vectors, deleteVectors };
  }

  it('drains durable outbox rows idempotently and deletes stale vectors', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    const node = await knowledge.createNode({
      name: 'Project Atlas',
      kind: 'project',
      content: 'Launch plan',
      scope: ['org:acme', 'resource:user-42'],
    });
    const item = await knowledge.appendItem({
      parentNodeId: node.id,
      text: '[[Maya Chen]] owns Atlas.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'alpha',
      maxScope: 'resource',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });
    const { vector, vectors, deleteVectors } = createVector();
    const embedder = {
      doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => [0.1, 0.2, 0.3]),
      })),
    } as unknown as MastraEmbeddingModel<string>;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, vector, embedder, workerId: 'test' });

    expect(await coordinator.drain(['org:acme', 'resource:user-42'])).toBeGreaterThanOrEqual(2);
    expect(await coordinator.drain(['org:acme', 'resource:user-42'])).toBe(0);
    expect(embedder.doEmbed).toHaveBeenCalledWith(expect.objectContaining({ values: ['Project Atlas\nLaunch plan'] }));
    expect(vectors.get(`knowledge:item:${item.id}`)?.metadata).toMatchObject({
      document_type: 'item',
      scope_org: 'acme',
      scope_resource: 'user-42',
    });

    await knowledge.removeItem({ id: item.id, deletedBy: 'curator' });
    await coordinator.drain(['org:acme', 'resource:user-42']);
    expect(vectors.has(`knowledge:item:${item.id}`)).toBe(false);
    expect(deleteVectors).toHaveBeenCalled();
  });

  it('keeps concurrent drains isolated by visible scope', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    await knowledge.createNode({ name: 'Atlas', kind: 'project', scope: ['org:acme'] });
    await knowledge.createNode({ name: 'Beacon', kind: 'project', scope: ['org:beta'] });
    const { vector } = createVector();
    const embedder = {
      doEmbed: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { embeddings: [[0.1, 0.2]] };
      }),
    } as unknown as MastraEmbeddingModel<string>;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, vector, embedder, workerId: 'scoped' });

    await Promise.all([coordinator.drain(['org:acme']), coordinator.drain(['org:beta'])]);
    expect(await knowledge.listSemanticOutbox({ status: 'completed' })).toHaveLength(2);
  });

  it('releases failed rows and resumes them idempotently after a crash-like failure', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    await knowledge.createNode({ name: 'Atlas', kind: 'project', scope: ['org:acme'] });
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

    await expect(coordinator.drain(['org:acme'])).rejects.toBeInstanceOf(StaleKnowledgeSemanticIndexError);
    expect(await knowledge.listSemanticOutbox({ status: 'pending' })).toHaveLength(1);
    expect(await coordinator.drain(['org:acme'])).toBe(1);
    expect((await knowledge.listSemanticOutbox({ status: 'completed' }))[0]).toMatchObject({ attempts: 2 });
  });
});

describe('Subconscious capture-time pinning', () => {
  const pinsOn = { maxPins: 20, maxCharacters: 2_000, capturePinning: true } as const;

  it('routes pin-marked items onto the reserved pinned node within budget', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
      pins: pinsOn,
    });
    const context = createContext(memory, {
      nodes: [
        {
          name: 'User Preferences',
          kind: 'person',
          items: [
            { text: 'Prefers voice-first replies.', scope: 'resource', pin: true },
            { text: 'Asked about the deploy runbook.' },
          ],
        },
      ],
    });

    await extractor.onExtracted?.({ ...context, extractor });

    const store = (await memory.storage.getStore('knowledge'))!;
    const threadScope = ['org:acme', 'resource:user-42', 'thread:alpha'];
    const { pins } = await listPinnedKnowledge({ store, scope: threadScope });
    expect(pins.map(pin => pin.text)).toEqual(['Prefers voice-first replies.']);

    // No dual write: the pinned text lives only on the reserved entity.
    const node = await store.resolveNode({ name: 'User Preferences', scope: threadScope });
    const items = await store.itemsAbout({ nodeId: node!.id, scope: threadScope });
    expect(items.items.map(item => item.text)).toEqual(['Asked about the deploy runbook.']);
  });

  it('stores the capture reason as KnowledgeItem metadata on regular and pinned items', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
      pins: pinsOn,
    });
    const context = createContext(memory, {
      nodes: [
        {
          name: 'User Preferences',
          kind: 'person',
          items: [
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
    const threadScope = ['org:acme', 'resource:user-42', 'thread:alpha'];
    const { pins } = await listPinnedKnowledge({ store, scope: threadScope });
    expect(pins[0]!.metadata).toEqual({ reason: 'Stated as a standing preference; must apply every session.' });

    const node = await store.resolveNode({ name: 'User Preferences', scope: threadScope });
    const items = (await store.itemsAbout({ nodeId: node!.id, scope: threadScope })).items;
    const byText = new Map(items.map(item => [item.text, item.metadata]));
    expect(byText.get('Asked about the deploy runbook.')).toEqual({ reason: 'Recurring topic worth remembering.' });
    expect(byText.get('Mentioned the weather.')).toBeUndefined();
  });

  it('drops an over-budget pin without failing the extraction cycle', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
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
          items: [
            { text: 'This pin text is far beyond the ten character budget.', pin: true },
            { text: 'A regular fact that must survive.' },
          ],
        },
      ],
    });

    await expect(extractor.onExtracted?.({ ...context, extractor, sendStateSignal })).resolves.toBeDefined();

    const store = (await memory.storage.getStore('knowledge'))!;
    const threadScope = ['org:acme', 'resource:user-42', 'thread:alpha'];
    const { pins } = await listPinnedKnowledge({ store, scope: threadScope });
    expect(pins).toHaveLength(0);
    const node = await store.resolveNode({ name: 'User Preferences', scope: threadScope });
    const items = await store.itemsAbout({ nodeId: node!.id, scope: threadScope });
    expect(items.items.map(item => item.text)).toEqual(['A regular fact that must survive.']);
    // The drop is activity-visible, not silent.
    const signal = sendStateSignal.mock.calls.at(-1)?.[0] as { contents: string } | undefined;
    expect(signal?.contents).toContain('Capture-time pin dropped');
  });

  it('surfaces dropped-pin notes when a custom onExtracted hook delegates to the default implementation', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
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
          items: [{ text: 'This pin text is far beyond the ten character budget.', pin: true }],
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
    const extractor = new SubconsciousCaptureExtractor({ defaultScope: 'resource', learnedGuidance: false });
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
    const extractor = new SubconsciousCaptureExtractor({ defaultScope: 'resource', learnedGuidance: false });
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
      nodes: z.array(z.object({ name: z.string(), kind: z.string(), items: z.array(z.object({ text: z.string() })) })),
    });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
      pins: pinsOn,
      config: { name: 'capture', schema: custom as any },
    });
    expect(extractor.schema).toBe(custom);
  });

  it('omits the reason and pin instructions when a custom schema is configured', async () => {
    const custom = z.object({
      nodes: z.array(z.object({ name: z.string(), kind: z.string(), items: z.array(z.object({ text: z.string() })) })),
    });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
      pins: pinsOn,
      config: { name: 'capture', schema: custom as any },
    });
    const memory = new Memory({ storage: new InMemoryStore() });
    const resolved = await extractor.resolve(createContext(memory, { nodes: [] }));
    expect(resolved.instructions).not.toContain('Every item requires a reason');
    expect(resolved.instructions).not.toContain('pin: true');
  });

  it('includes the reason instruction on the default schemas', async () => {
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
      pins: pinsOn,
    });
    const memory = new Memory({ storage: new InMemoryStore() });
    const resolved = await extractor.resolve(createContext(memory, { nodes: [] }));
    // Reason is REQUIRED on every item (Jamie, 2026-08-13): concrete why, no filler.
    expect(resolved.instructions).toContain('Every item requires a reason');
    expect(resolved.instructions).toContain('Never write generic filler');
    const schema = z.toJSONSchema(extractor.schema) as any;
    const itemSchema = schema.properties.nodes.items.properties.items.items;
    expect(itemSchema.required).toContain('reason');
  });
});
