import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore, InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { extractStructuredValues } from '../extraction-runner';
import { ObservationalMemory } from '../observational-memory';
import { SubconsciousCaptureExtractor } from '../subconscious/capture';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];
const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function createMemory(options?: { omModel?: any | false }) {
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

  it('composes the entity-description mandate with the cursor protocol', async () => {
    let prompt = '';
    const memory = createMemory({
      omModel: new MockLanguageModelV2({
        doGenerate: async ({ prompt: modelPrompt }) => {
          prompt = JSON.stringify(modelPrompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            content: [{ type: 'text', text: `<curation-complete through="${item.id}" />` }],
            warnings: [],
          };
        },
      }),
    });
    const item = await seedItem(memory);

    await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(prompt).toContain("links only from the entity's own records");
    expect(prompt).toContain('knowledge_write_node_content');
    expect(prompt).toContain('Your final response must end with the marker');
  });

  it('composes canonical identifier and URL preservation into capture extraction', async () => {
    let prompt = '';
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
            content: [{ type: 'text', text: '{"capture":{"nodes":[]}}' }],
            warnings: [],
          };
        },
      }),
    });
    const capture = await new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
    }).resolve({ source: 'observer' });

    await extractStructuredValues({ agent, source: 'observer', extractors: [capture] });

    expect(prompt).toContain(
      'When the conversation states a canonical identifier or URL for an entity, preserve it verbatim in the record text.',
    );
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
    const firstRecord = await seedItem(memory);
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

function createEngine(options: { cadence?: number; memory?: unknown }) {
  return new ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope: 'thread',
    memory: options.memory as any,
    curationCadence: options.cadence,
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

describe('observation-cadence curation trigger', () => {
  it('fires runCuration after every Nth committed observation run and resets the counter', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = createEngine({ cadence: 3, memory: { runCuration } });
    const threadId = 'cadence-thread';

    for (let run = 0; run < 3; run++) {
      const result = await om.observe({
        threadId,
        messages: createBulkMessages(10, threadId, run * 10),
        requestContext: requestContext(),
      });
      expect(result.observed).toBe(true);
      // The trigger is fire-and-forget; let it settle.
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    expect(runCuration).toHaveBeenCalledOnce();
    expect(runCuration).toHaveBeenCalledWith(expect.objectContaining({ threadId, requestContext: expect.anything() }));

    const record = await om.getRecord(threadId);
    expect((record?.config as any)?.subconscious?.observationRuns ?? 0).toBe(0);
  });

  it('leaves the counter untouched and fires nothing when no cadence is configured', async () => {
    const runCuration = vi.fn(async () => ({ outcome: 'ran' }));
    const om = createEngine({ memory: { runCuration } });
    const threadId = 'no-cadence-thread';

    const result = await om.observe({ threadId, messages: createBulkMessages(10, threadId) });
    expect(result.observed).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(runCuration).not.toHaveBeenCalled();
    const record = await om.getRecord(threadId);
    expect((record?.config as any)?.subconscious?.observationRuns).toBeUndefined();
  });
});
