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
