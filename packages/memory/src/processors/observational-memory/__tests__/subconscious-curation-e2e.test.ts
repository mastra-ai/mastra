import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';

/**
 * End-to-end proof for the curation triggers.
 *
 * Everything here is the real thing: a real `Memory`, the real knowledge store, the real
 * `Subconscious`, and the real observational-memory engine that `Memory` builds for itself.
 * Nothing calls `Memory.runCuration` by hand — the only way the curator can run is if a
 * lifecycle site evaluated the trigger and decided to run it, which is exactly the claim
 * under test (and the gap Tyler flagged: coverage of the *lifecycle*, not of a predicate).
 *
 * Why this lives here and not in the replay simulator: the simulator drives capture through
 * `applyExtractorHooks` directly and never enters the observation lifecycle, so no arm it can
 * run is able to observe a lifecycle trigger firing. See the simulator gap issue.
 */

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

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
async function seedUncurated(memory: Memory, count: number) {
  const store = (await memory.storage.getStore('knowledge'))!;
  const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
  let last!: { id: string };
  for (let i = 0; i < count; i++) {
    last = await store.appendKnowledge({
      node: node.id,
      text: `Fact number ${i} about Atlas.`,
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
  }
  return last;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('curation triggers, end to end on a real Memory', () => {
  it('curates from the lifecycle once the uncurated worklist crosses the threshold', async () => {
    const memory = createMemory(new Subconscious({ observation: [], curationThreshold: 3 }));
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

  it('leaves the curator alone while the worklist is below the threshold', async () => {
    const memory = createMemory(new Subconscious({ observation: [], curationThreshold: 5 }));
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

  it('never curates when both triggers are off, however much work piles up', async () => {
    // The default-off contract: an existing deployment that never opted in keeps today's behaviour.
    const memory = createMemory(new Subconscious({ observation: [] }));
    await seedUncurated(memory, 25);

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

  it('honours the deprecated curationCadence as the volume trigger', async () => {
    const memory = createMemory(new Subconscious({ observation: [], curationCadence: 2 }));
    const lastRecord = await seedUncurated(memory, 2);

    vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({
      text: `<curation-complete through="${lastRecord.id}" />`,
    } as any);
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

    expect(runCuration).toHaveBeenCalledOnce();
  });
});
