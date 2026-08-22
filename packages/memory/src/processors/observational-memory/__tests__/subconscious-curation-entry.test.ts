import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore, InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { ObservationalMemory } from '../observational-memory';
import type { ObservationalMemoryModel } from '../types';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];
const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function createMemory(options?: { omModel?: ObservationalMemoryModel | false }) {
  return new Memory({
    storage: new InMemoryStore(),
    ...semanticInfrastructure,
    options: {
      observationalMemory: {
        ...(options?.omModel === false ? {} : { model: options?.omModel ?? 'openai/om-model' }),
        experimental_subconscious: new Subconscious({ defaultScope: 'resource', maxScope: 'resource' }),
      },
    },
  });
}

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

async function seedItem(memory: Memory, text = 'Atlas launches soon.') {
  const store = (await memory.storage.getStore('knowledge'))!;
  const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
  return store.appendKnowledge({
    node: node.id,
    text,
    scope,
    sourceThreadId: 'alpha',
    resolutionScope: scope,
    defaultScope: scope,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Memory.runCuration', () => {
  it('runs the curate agent over the pending worklist and advances the cursor without reflection', async () => {
    const memory = createMemory();
    const item = await seedItem(memory);
    const generate = vi
      .spyOn(Agent.prototype, 'generate')
      .mockResolvedValue({ text: `<curation-complete through="${item.id}" />` } as any);
    generate.mockClear();

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.outcome).toBe('ran');
    expect(generate).toHaveBeenCalledOnce();
    const store = (await memory.storage.getStore('knowledge'))!;
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: item.id,
    });
  });

  it('writes and refines entity content through the curator tool path', async () => {
    let generateCall = 0;
    let currentRecordId = '';
    const description = 'Project Atlas is the current launch project.\n\nLinks: https://github.com/mastra-ai/mastra';
    const refinedDescription =
      'Project Atlas is the current launch project, now expanding its knowledge system.\n\nLinks: https://github.com/mastra-ai/mastra';
    const memory = createMemory({
      omModel: new MockLanguageModelV2({
        doGenerate: async (): Promise<any> => {
          generateCall++;
          if (generateCall === 1 || generateCall === 3) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: `write-${generateCall}`,
                  toolName: 'knowledge_write_node_content',
                  input: JSON.stringify({
                    name: 'Project Atlas',
                    content: generateCall === 1 ? description : refinedDescription,
                    scope: 'thread',
                    expectedVersion: generateCall === 1 ? 1 : 2,
                  }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            content: [{ type: 'text' as const, text: `<curation-complete through="${currentRecordId}" />` }],
            warnings: [],
          };
        },
      }),
    });
    const store = (await memory.storage.getStore('knowledge'))!;
    const firstRecord = await seedItem(
      memory,
      'Project Atlas launches soon. Repository: https://github.com/mastra-ai/mastra',
    );
    currentRecordId = firstRecord.id;

    await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    const written = await store.resolveNode({ name: 'Project Atlas', scope });
    expect(written).toMatchObject({ content: description, version: 2 });

    const secondRecord = await store.appendKnowledge({
      node: written!,
      text: '[[Mastra]] is expanding its knowledge system.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    currentRecordId = secondRecord.id;

    await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(await store.resolveNode({ name: 'Project Atlas', scope })).toMatchObject({
      content: refinedDescription,
      version: 3,
    });
  });

  it('reports no-op when the worklist and prompt are both empty', async () => {
    const memory = createMemory();
    const generate = vi.spyOn(Agent.prototype, 'generate');
    generate.mockClear();

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.outcome).toBe('no-op');
    expect(generate).not.toHaveBeenCalled();
  });

  it('threads the phase prompt into the curator run even with an empty worklist', async () => {
    const memory = createMemory();
    const generate = vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: 'Nothing to keep.' } as any);
    generate.mockClear();

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
      prompt: 'Now that the work item has left the build phase: anything worth remembering?',
    });

    expect(result.outcome).toBe('ran');
    expect(generate).toHaveBeenCalledWith(expect.stringContaining('left the build phase'), expect.objectContaining({}));
  });

  it('skips when a curation for the same thread is already in flight', async () => {
    const memory = createMemory();
    const item = await seedItem(memory);
    let release!: (value: any) => void;
    const pending = new Promise(resolve => {
      release = resolve;
    });
    const generate = vi.spyOn(Agent.prototype, 'generate').mockReturnValue(pending as any);
    generate.mockClear();

    const first = memory.runCuration({ threadId: 'alpha', resourceId: 'user-42', requestContext: requestContext() });
    // Give the first call a tick to enter the handler and register in flight.
    await new Promise(resolve => setTimeout(resolve, 10));
    const second = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(second.outcome).toBe('skipped');
    // Resolve the dangling curation so the first call settles cleanly.
    release({ text: `<curation-complete through="${item.id}" />` });
    expect((await first).outcome).toBe('ran');
  });

  it('maps a missing model to the no-model outcome instead of throwing', async () => {
    const memory = createMemory({ omModel: false });
    await seedItem(memory);

    const result = await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(result.outcome).toBe('no-model');
  });
});

describe('curationCadence config resolution', () => {
  it('validates the cadence as a positive integer', () => {
    expect(() => new Subconscious({ curationCadence: 0 })).toThrow('positive integer');
    expect(() => new Subconscious({ curationCadence: 1.5 })).toThrow('positive integer');
    expect(new Subconscious({ curationCadence: 3 }).resolved.curationCadence).toBe(3);
    expect(new Subconscious({}).resolved.curationCadence).toBeUndefined();
  });
});

// =============================================================================
// Observation-cadence trigger (engine level)
//
// The counter is pinned to the SYNC observation path (om.observe covers both
// the turn-driven and manual triggers). The async-buffer lane bypasses
// observe(); factory's resource scope disables async buffering, so the sync
// path is the only one that fires in the deployment this gates.
// =============================================================================

function createTestMessage(content: string, role: 'user' | 'assistant', id: string): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text: content }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(),
  };
}

function createBulkMessages(count: number, threadId: string, offset = 0): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createTestMessage(
      `Message ${offset + i}: `.padEnd(200, 'x'),
      i % 2 === 0 ? 'user' : 'assistant',
      `${threadId}-msg-${offset + i}`,
    ),
    threadId,
  }));
}

function createMockModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      warnings: [],
      content: [{ type: 'text', text }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
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

/**
 * A `Memory` stand-in that reports a fixed number of uncurated knowledge records, so the volume
 * trigger can be driven without a real curator.
 */
function stubCurationMemory(options: { uncurated: number; cursorUpdatedAt?: Date; runCuration: any }) {
  const records = Array.from({ length: options.uncurated }, (_, i) => ({ id: `k-${i}` }));
  return {
    runCuration: options.runCuration,
    storage: {
      getStore: async (domain: string) =>
        domain === 'knowledge'
          ? {
              getCurationCursor: async () =>
                options.cursorUpdatedAt
                  ? {
                      sourceThreadId: 't',
                      agent: 'curate',
                      lastKnowledgeId: 'k-prev',
                      updatedAt: options.cursorUpdatedAt,
                    }
                  : null,
              knowledgeBySource: async ({ limit }: { limit?: number }) => ({
                records: records.slice(0, limit ?? records.length),
                nextCursor: undefined,
              }),
            }
          : undefined,
    },
  };
}

function createEngine(options: {
  cadence?: number;
  threshold?: number | false;
  maxAgeMs?: number | false;
  now?: () => number;
  memory?: unknown;
}) {
  return new ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope: 'thread',
    memory: options.memory as any,
    curationCadence: options.cadence,
    curationThreshold: options.threshold,
    curationMaxAgeMs: options.maxAgeMs,
    now: options.now,
    observation: {
      model: createMockModel('<observations>\n* Something happened\n</observations>'),
      messageTokens: 100,
      bufferTokens: false,
    },
    reflection: {
      model: createMockModel('<observations>\n* Condensed\n</observations>'),
      observationTokens: 50_000,
    },
  } as any);
}

describe('observation curation trigger', () => {
  // The trigger is fire-and-forget on the observe path; let it settle.
  const settle = () => new Promise(resolve => setTimeout(resolve, 20));

  it('fires runCuration once the uncurated record count reaches the threshold', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = createEngine({ threshold: 3, memory: stubCurationMemory({ uncurated: 3, runCuration }) });
    const threadId = 'threshold-thread';

    const result = await om.observe({
      threadId,
      messages: createBulkMessages(10, threadId),
      requestContext: requestContext(),
    });
    expect(result.observed).toBe(true);
    await settle();

    expect(runCuration).toHaveBeenCalledOnce();
    expect(runCuration).toHaveBeenCalledWith(expect.objectContaining({ threadId, requestContext: expect.anything() }));
  });

  it('does not fire while the uncurated record count is below the threshold', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = createEngine({ threshold: 5, memory: stubCurationMemory({ uncurated: 4, runCuration }) });

    const result = await om.observe({
      threadId: 'below-threshold-thread',
      messages: createBulkMessages(10, 'below-threshold-thread'),
      requestContext: requestContext(),
    });
    expect(result.observed).toBe(true);
    await settle();

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('still honours the deprecated curationCadence spelling as the volume trigger', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = createEngine({ cadence: 2, memory: stubCurationMemory({ uncurated: 2, runCuration }) });

    await om.observe({
      threadId: 'cadence-thread',
      messages: createBulkMessages(10, 'cadence-thread'),
      requestContext: requestContext(),
    });
    await settle();

    expect(runCuration).toHaveBeenCalledOnce();
  });

  it('fires on a stale cursor when there is uncurated work', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const now = Date.parse('2026-08-21T20:00:00.000Z');
    const om = createEngine({
      maxAgeMs: 60_000,
      now: () => now,
      memory: stubCurationMemory({ uncurated: 1, cursorUpdatedAt: new Date(now - 120_000), runCuration }),
    });

    await om.observe({
      threadId: 'stale-thread',
      messages: createBulkMessages(10, 'stale-thread'),
      requestContext: requestContext(),
    });
    await settle();

    expect(runCuration).toHaveBeenCalledOnce();
  });

  it('does not fire on a stale cursor when nothing is uncurated', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const now = Date.parse('2026-08-21T20:00:00.000Z');
    const om = createEngine({
      maxAgeMs: 60_000,
      now: () => now,
      memory: stubCurationMemory({ uncurated: 0, cursorUpdatedAt: new Date(now - 86_400_000), runCuration }),
    });

    await om.observe({
      threadId: 'idle-thread',
      messages: createBulkMessages(10, 'idle-thread'),
      requestContext: requestContext(),
    });
    await settle();

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('fires nothing when both triggers are off (the default)', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = createEngine({ memory: stubCurationMemory({ uncurated: 500, runCuration }) });

    const result = await om.observe({
      threadId: 'no-trigger-thread',
      messages: createBulkMessages(10, 'no-trigger-thread'),
      requestContext: requestContext(),
    });
    expect(result.observed).toBe(true);
    await settle();

    expect(runCuration).not.toHaveBeenCalled();
  });

  it('does not fire without an organizationId in the request context', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = createEngine({ threshold: 1, memory: stubCurationMemory({ uncurated: 5, runCuration }) });

    await om.observe({ threadId: 'no-org-thread', messages: createBulkMessages(10, 'no-org-thread') });
    await settle();

    expect(runCuration).not.toHaveBeenCalled();
  });
});
