import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import type { ObservationalMemoryModel } from '../types';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];
const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function createMemory(options?: { omModel?: ObservationalMemoryModel | false }) {
  const storage = new InMemoryStore();
  return new Memory({
    storage,
    knowledge: new Knowledge({ id: 'default', storage }),
    ...semanticInfrastructure,
    options: {
      observationalMemory: {
        ...(options?.omModel === false ? {} : { model: options?.omModel ?? 'openai/om-model' }),
        experimental_subconscious: new Subconscious({
          observation: [{ name: 'curate', curatorProfile: 'subconscious' }],
        }),
      },
    },
  });
}

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

async function registerCurator(memory: Memory) {
  const scopeIds = await resolveKnowledgeScopeIds(memory, {
    agent: { threadId: 'alpha', resourceId: 'user-42' },
    requestContext: requestContext(),
  });
  await memory.getKnowledgeInstance()!.registerCuratorProfile({
    id: 'subconscious',
    identityScope: {
      address: 'curator:subconscious',
      name: 'Subconscious curator',
      contextualScopeAddress: 'curator:subconscious',
    },
    grants: [
      { scopeAddress: 'resource:user-42:thread:alpha:uncurated', role: 'owner' },
      { scopeAddress: 'resource:user-42', role: 'owner' },
      { scopeAddress: 'resource:user-42:thread:alpha', role: 'owner' },
    ],
  });
  return scopeIds;
}

async function seedItem(memory: Memory, text = 'Atlas launches soon.') {
  const store = await memory.getKnowledgeStore();
  const scopeIds = await registerCurator(memory);
  const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[1]!] });
  return store.createRecord({
    node,
    text,
    scopeIds: [scopeIds[2]!],
    source: 'alpha',
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

  it('refines provisional knowledge through the governed curator tool path', async () => {
    let generateCall = 0;
    let currentRecordId = '';
    let nodeId = '';
    const descriptions = [
      'Project Atlas is the current launch project.',
      'Project Atlas is expanding its knowledge system.',
    ];
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
                  toolCallId: `refine-${generateCall}`,
                  toolName: 'knowledge_curation_refine',
                  input: JSON.stringify({
                    nodeId,
                    version: generateCall === 1 ? 1 : 2,
                    metadata: { description: descriptions[generateCall === 1 ? 0 : 1] },
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
    const scopeIds = await registerCurator(memory);
    const grantsBefore = await store.listScopeGrants();
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[4]!] });
    nodeId = node.id;
    const firstRecord = await store.createRecord({
      node,
      text: 'Project Atlas launches soon.',
      scopeIds: [scopeIds[4]!],
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    currentRecordId = firstRecord.id;

    await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(await store.getNode(node.id)).toMatchObject({
      version: 2,
      metadata: { description: descriptions[0] },
    });

    const secondRecord = await store.createRecord({
      node: (await store.getNode(node.id))!,
      text: 'Project Atlas is expanding its knowledge system.',
      scopeIds: [scopeIds[4]!],
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    currentRecordId = secondRecord.id;

    await memory.runCuration({
      threadId: 'alpha',
      resourceId: 'user-42',
      requestContext: requestContext(),
    });

    expect(await store.getNode(node.id)).toMatchObject({
      version: 3,
      metadata: { description: descriptions[1] },
    });
    expect(await store.listScopeGrants()).toEqual(grantsBefore);
  });

  it('fails closed without a host-registered curator profile and does not create grants', async () => {
    const memory = createMemory();
    const store = await memory.getKnowledgeStore();
    const scopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'alpha', resourceId: 'user-42' },
      requestContext: requestContext(),
    });
    const node = await store.createNode({ name: 'Unregistered work', scopeIds: [scopeIds[4]!] });
    await store.createRecord({
      node,
      text: 'Do not self-authorize.',
      source: 'alpha',
      scopeIds: [scopeIds[4]!],
    });
    const grantsBefore = await store.listScopeGrants();

    await expect(
      memory.runCuration({
        threadId: 'alpha',
        resourceId: 'user-42',
        requestContext: requestContext(),
      }),
    ).rejects.toThrow('Knowledge curator profile is not registered: subconscious');
    expect(await store.getNode(node.id)).toMatchObject({ version: node.version });
    expect(await store.listScopeGrants()).toEqual(grantsBefore);
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
    await registerCurator(memory);
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
