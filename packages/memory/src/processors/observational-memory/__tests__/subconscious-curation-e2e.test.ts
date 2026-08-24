import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';

/**
 * End-to-end proof for the curation placement cadence.
 *
 * A real `Memory`, the real knowledge store, the real `Subconscious`, and the real
 * observational-memory engine that `Memory` builds for itself. Nothing calls
 * `Memory.runCuration` by hand — the only way the curator can run is if the pipeline-completion
 * wiring evaluated the trigger and decided to run it, which is exactly the claim under test.
 *
 * Placement sets cadence: `curate` in the observation array → evaluated after each successfully
 * completed observation; in the reflection array (the default, and where legacy options land) →
 * reflection phase only; absent from both arrays → zero curation work.
 */

function createMockModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createMessages(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    threadId: 'alpha',
    role: i % 2 === 0 ? 'user' : 'assistant',
    createdAt: new Date(Date.now() + i),
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Message ${i} with enough text to cross the observation threshold.` }],
    } as MastraMessageContentV2,
  })) as MastraDBMessage[];
}

function createMemory(subconscious: Subconscious) {
  return new Memory({
    storage: new InMemoryStore(),
    vector: {} as MastraVector,
    embedder: {} as MastraEmbeddingModel<string>,
    options: {
      observationalMemory: {
        model: createMockModel('<observations>\n* The conversation was observed.\n</observations>'),
        observation: { messageTokens: 100, bufferTokens: false },
        experimental_subconscious: subconscious,
      },
    },
  });
}

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

/** Put real knowledge records in the real store, so the trigger has a real worklist to see. */
async function seedUncurated(memory: Memory, count: number, resourceId = 'user-42') {
  const recordScope = ['org:acme', `resource:${resourceId}`, 'thread:alpha'];
  const store = (await memory.storage.getStore('knowledge'))!;
  const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope: recordScope });
  let last!: { id: string };
  for (let i = 0; i < count; i++) {
    last = await store.appendKnowledge({
      node: node.id,
      text: `Fact number ${i} about Atlas.`,
      scope: recordScope,
      sourceThreadId: 'alpha',
      resolutionScope: recordScope,
      defaultScope: recordScope,
    });
  }
  return last;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('observation-placed curation, end to end on a real Memory', () => {
  it('curates after the observation completes once the uncurated worklist crosses the threshold', async () => {
    const memory = createMemory(
      new Subconscious({ observation: [{ name: 'curate', trigger: { uncuratedRecords: 3 } }] }),
    );
    const lastRecord = await seedUncurated(memory, 3);

    const generate = vi
      .spyOn(Agent.prototype, 'generate')
      .mockResolvedValue({ text: `<curation-complete through="${lastRecord.id}" />` } as any);
    const runCuration = vi.spyOn(memory, 'runCuration');

    const om = (await memory.omEngine)!;
    const result = await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();

    expect(result.observed).toBe(true);

    // The curator really ran, against the real store, without anyone calling it directly.
    expect(runCuration).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalled();
    const store = (await memory.storage.getStore('knowledge'))!;
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: lastRecord.id,
    });
  });

  it('uses the thread id as the resource scope when resourceId is omitted', async () => {
    const memory = createMemory(
      new Subconscious({ observation: [{ name: 'curate', trigger: { uncuratedRecords: 1 } }] }),
    );
    const lastRecord = await seedUncurated(memory, 1, 'alpha');

    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({
      text: `<curation-complete through="${lastRecord.id}" />`,
    } as any);

    const om = (await memory.omEngine)!;
    await om.finalize({ threadId: 'alpha', messages: createMessages(10), requestContext: requestContext() });
    await memory.settled();

    const store = (await memory.storage.getStore('knowledge'))!;
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: lastRecord.id,
    });
  });

  it('leaves the curator alone while the worklist is below the threshold', async () => {
    const memory = createMemory(
      new Subconscious({ observation: [{ name: 'curate', trigger: { uncuratedRecords: 5 } }] }),
    );
    await seedUncurated(memory, 2);

    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: '<curation-complete />' } as any);
    const runCuration = vi.spyOn(memory, 'runCuration');

    const om = (await memory.omEngine)!;
    const result = await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();

    expect(result.observed).toBe(true);

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('curates after the observation when the cursor is stale and new knowledge arrived', async () => {
    // Age arm: no volume threshold at all, so the only thing that can fire is staleness.
    const memory = createMemory(
      new Subconscious({ observation: [{ name: 'curate', trigger: { uncuratedRecords: false, maxAgeMs: 1 } }] }),
    );
    const alreadyCurated = await seedUncurated(memory, 1);

    const store = (await memory.storage.getStore('knowledge'))!;
    await store.advanceCurationCursor({
      sourceThreadId: 'alpha',
      agent: 'curate',
      lastKnowledgeId: alreadyCurated.id,
    });
    await new Promise(resolve => setTimeout(resolve, 5));

    const lastRecord = await seedUncurated(memory, 1);
    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({
      text: `<curation-complete through="${lastRecord.id}" />`,
    } as any);
    const runCuration = vi.spyOn(memory, 'runCuration');

    const om = (await memory.omEngine)!;
    await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();

    expect(runCuration).toHaveBeenCalledOnce();
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: lastRecord.id,
    });
  });

  it('leaves a stale cursor alone while no new knowledge has arrived', async () => {
    const memory = createMemory(
      new Subconscious({ observation: [{ name: 'curate', trigger: { uncuratedRecords: false, maxAgeMs: 1 } }] }),
    );
    const alreadyCurated = await seedUncurated(memory, 1);

    const store = (await memory.storage.getStore('knowledge'))!;
    await store.advanceCurationCursor({
      sourceThreadId: 'alpha',
      agent: 'curate',
      lastKnowledgeId: alreadyCurated.id,
    });
    await new Promise(resolve => setTimeout(resolve, 5));

    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: '<curation-complete />' } as any);
    const runCuration = vi.spyOn(memory, 'runCuration');

    const om = (await memory.omEngine)!;
    await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();

    expect(runCuration).not.toHaveBeenCalled();
  });
});

describe('reflection-placed curation cadence', () => {
  it('does not curate at observation completion when curate lives in the reflection array (default)', async () => {
    // The default placement — and where the deprecated top-level options land. Observation
    // completion is no longer a curation lifecycle point for reflection-placed curate; this is
    // the deliberate cadence change from the old finalize()-driven behaviour.
    const memory = createMemory(new Subconscious({ observation: [], curationThreshold: 1 }));
    await seedUncurated(memory, 5);

    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: '<curation-complete />' } as any);
    const runCuration = vi.spyOn(memory, 'runCuration');

    const om = (await memory.omEngine)!;
    const result = await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();

    expect(result.observed).toBe(true);
    expect(runCuration).not.toHaveBeenCalled();
  });

  it('runs the curator at reflection commit when the legacy-translated trigger fires', async () => {
    const memory = createMemory(new Subconscious({ observation: [], curationThreshold: 2 }));
    const lastRecord = await seedUncurated(memory, 3);

    const generate = vi
      .spyOn(Agent.prototype, 'generate')
      .mockResolvedValue({ text: `<curation-complete through="${lastRecord.id}" />` } as any);

    const om = (await memory.omEngine)!;
    // Create the OM record the gate re-reads, then drive the reflection-commit seam directly.
    await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();
    generate.mockClear();

    await (om as any).reflector.onReflectionCommitted({
      parentThreadId: 'alpha',
      resourceId: 'user-42',
      observations: '* Something worth reflecting on',
      requestContext: requestContext(),
    });
    await memory.settled();

    expect(generate).toHaveBeenCalled();
    const store = (await memory.storage.getStore('knowledge'))!;
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: lastRecord.id,
    });
  });

  it('gates the reflection-commit curator off when the legacy-translated trigger has not fired', async () => {
    const memory = createMemory(new Subconscious({ observation: [], curationThreshold: 50 }));
    const lastRecord = await seedUncurated(memory, 2);

    const generate = vi
      .spyOn(Agent.prototype, 'generate')
      .mockResolvedValue({ text: `<curation-complete through="${lastRecord.id}" />` } as any);

    const om = (await memory.omEngine)!;
    await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();
    generate.mockClear();

    await (om as any).reflector.onReflectionCommitted({
      parentThreadId: 'alpha',
      resourceId: 'user-42',
      observations: '* Something worth reflecting on',
      requestContext: requestContext(),
    });
    await memory.settled();

    // Only the learner may have run; the curator was gated off, so the cursor never advanced.
    const store = (await memory.storage.getStore('knowledge'))!;
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toBeFalsy();
  });
});

describe('absent curation performs zero work', () => {
  it('never curates when curate is in neither array, however much work piles up', async () => {
    const subconscious = new Subconscious({ observation: [], reflection: ['learn'] });
    expect(subconscious.resolved.curation).toBeNull();

    const memory = createMemory(subconscious);
    await seedUncurated(memory, 25);

    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: '<curation-complete />' } as any);
    const runCuration = vi.spyOn(memory, 'runCuration');
    const store = (await memory.storage.getStore('knowledge'))!;
    const worklistQuery = vi.spyOn(store, 'knowledgeBySource');

    const om = (await memory.omEngine)!;
    const result = await om.finalize({
      threadId: 'alpha',
      resourceId: 'user-42',
      messages: createMessages(10),
      requestContext: requestContext(),
    });
    await memory.settled();

    expect(result.observed).toBe(true);
    expect(runCuration).not.toHaveBeenCalled();
    // No evaluator exists, so not even the bounded trigger query ran.
    expect(worklistQuery).not.toHaveBeenCalled();
  });
});
