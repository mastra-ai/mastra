import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { createCuratorHandler } from '../subconscious/curate';
import { createKnowledgeWriteTools } from '../subconscious/knowledge-write-tools';
import type { ResolvedSubconsciousConfig } from '../subconscious/types';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];
const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function resolved(): ResolvedSubconsciousConfig {
  return {
    observation: [],
    reflection: [{ name: 'curate', maxSteps: 5, builtIn: true }],
    defaultScope: 'resource',
    maxScope: 'resource',
    learnedGuidance: true,
    tools: true,
    activity: { recentUpdates: 10 },
    pins: false,
  };
}

function context() {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  return {
    parentThreadId: 'alpha',
    resourceId: 'user-42',
    observations: '- Project Atlas launches soon.',
    requestContext,
    mainAgent: { getModel: vi.fn(async () => 'mock/model') },
  } as any;
}

describe('Subconscious curator', () => {
  it('composes the entity-description mandate with the cursor protocol', async () => {
    let prompt = '';
    let recordId = '';
    const memory = new Memory({
      storage: new InMemoryStore(),
      ...semanticInfrastructure,
      options: {
        observationalMemory: {
          model: new MockLanguageModelV2({
            doGenerate: async ({ prompt: modelPrompt }) => {
              prompt = JSON.stringify(modelPrompt);
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                content: [{ type: 'text', text: `<curation-complete through="${recordId}" />` }],
                warnings: [],
              };
            },
          }),
          experimental_subconscious: new Subconscious({ defaultScope: 'resource', maxScope: 'resource' }),
        },
      },
    });
    const store = (await memory.storage.getStore('knowledge'))!;
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
    const record = await store.appendKnowledge({
      node: node.id,
      text: 'Atlas launches soon.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    recordId = record.id;
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    await memory.runCuration({ threadId: 'alpha', resourceId: 'user-42', requestContext });

    expect(prompt).toContain("links only from the entity's own records");
    expect(prompt).toContain('knowledge_write_node_content');
    const mandateMarker = 'touched by a KnowledgeRecord in the current worklist';
    const cursorMarker = 'Do not emit a completion marker when no KnowledgeRecord was fully processed';
    expect(prompt).toContain(mandateMarker);
    expect(prompt).toContain(cursorMarker);
    expect(prompt).toContain('Your final response must end with the marker');
    expect(prompt.indexOf(mandateMarker)).toBeLessThan(prompt.indexOf(cursorMarker));
  });

  it('stamps provenance, enforces ceilings, uses CAS, and only soft-deletes KnowledgeRecords', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
    const tools = createKnowledgeWriteTools(memory, {
      scope,
      sourceThreadId: 'alpha',
      defaultScope: 'resource',
      maxScope: 'resource',
    });

    const record = (await tools.knowledge_append!.execute?.(
      { node: node.id, text: '[[Project Atlas]] launches soon.', scope: 'resource' },
      {} as any,
    )) as any;
    expect(record).toMatchObject({ sourceThreadId: 'alpha', maxScope: 'resource' });
    expect(record.capturedAt).toBeInstanceOf(Date);

    await expect(tools.knowledge_rescope!.execute?.({ recordId: record.id, scope: 'org' }, {} as any)).rejects.toThrow(
      'ceiling',
    );
    await expect(
      tools.knowledge_update_node!.execute?.(
        { node: node.id, expectedVersion: node.version + 1, name: 'Atlas' },
        {} as any,
      ),
    ).rejects.toThrow('version');

    await tools.knowledge_remove!.execute?.({ recordId: record.id }, {} as any);
    expect(await store.getKnowledge({ id: record.id })).toBeNull();
    expect(await store.getKnowledge({ id: record.id, includeDeleted: true })).toMatchObject({
      deletedBy: 'subconscious:curate',
    });
    expect(tools).not.toHaveProperty('knowledge_restore_item');
  });

  it('advances its source-thread cursor only after a successful durable run', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
    const record = await store.appendKnowledge({
      node: node.id,
      text: 'Atlas launches soon.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    const second = await store.appendKnowledge({
      node: node.id,
      text: 'Atlas has a readiness review.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    const generate = vi
      .spyOn(Agent.prototype, 'generate')
      .mockRejectedValueOnce(new Error('curator crashed'))
      .mockResolvedValueOnce({ text: 'No completion marker.' } as any)
      .mockResolvedValueOnce({ text: `<curation-complete through="${record.id}" />` } as any)
      .mockResolvedValueOnce({ text: `<curation-complete through="${second.id}" />` } as any);
    const handler = createCuratorHandler(memory, resolved());

    await expect(handler(context())).rejects.toThrow('curator crashed');
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toBeNull();
    await expect(handler(context())).rejects.toThrow('acknowledge');

    await handler(context());
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: record.id,
    });
    await store.removeKnowledge({ id: second.id, deletedBy: 'subconscious:curate' });
    await handler(context());
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: second.id,
    });
    expect(generate).toHaveBeenLastCalledWith(
      expect.stringContaining('Committed pre-reflection observations'),
      expect.objectContaining({
        memory: expect.objectContaining({
          thread: 'subconscious:alpha:curate',
        }),
      }),
    );
  });

  it('honors the last incremental completion marker when the run ends without a final acknowledgment', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
    const first = await store.appendKnowledge({
      node: node.id,
      text: 'Atlas launches soon.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    const second = await store.appendKnowledge({
      node: node.id,
      text: 'Atlas has a readiness review.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    // A step-exhausted run: markers were emitted incrementally per processed item, but the
    // run died mid-batch, so the aggregated text ends with tool chatter, not a final marker.
    vi.spyOn(Agent.prototype, 'generate').mockResolvedValueOnce({
      text: `Processed the first item. <curation-complete through="${first.id}" />\nMoving on, merged a duplicate. <curation-complete through="${second.id}" />\nExploring the next node now.`,
    } as any);
    const handler = createCuratorHandler(memory, resolved());

    await handler(context());
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastKnowledgeId: second.id,
    });
  });

  describe('model resolution', () => {
    async function seedItem(memory: Memory) {
      const store = (await memory.storage.getStore('knowledge'))!;
      const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
      return store.appendKnowledge({
        node: node.id,
        text: 'Atlas launches soon.',
        scope,
        sourceThreadId: 'alpha',
        resolutionScope: scope,
        defaultScope: scope,
      });
    }

    it('runs on the observational memory model when no main agent is available', async () => {
      const memory = new Memory({ storage: new InMemoryStore() });
      const item = await seedItem(memory);
      const generate = vi
        .spyOn(Agent.prototype, 'generate')
        .mockResolvedValueOnce({ text: `<curation-complete through="${item.id}" />` } as any);
      generate.mockClear();
      const handler = createCuratorHandler(memory, resolved(), memory, { omModel: 'openai/om-model' });
      const ctx = context();
      delete ctx.mainAgent;

      await handler(ctx);
      expect(generate).toHaveBeenCalledOnce();
      generate.mockRestore();
    });

    it('prefers the per-agent model over the observational memory model', async () => {
      const memory = new Memory({ storage: new InMemoryStore() });
      const item = await seedItem(memory);
      const generate = vi
        .spyOn(Agent.prototype, 'generate')
        .mockResolvedValueOnce({ text: `<curation-complete through="${item.id}" />` } as any);
      const config = resolved();
      config.reflection[0]!.model = 'per-agent/model' as any;
      const handler = createCuratorHandler(memory, config, memory, { omModel: 'openai/om-model' });
      const ctx = context();

      await handler(ctx);
      expect(ctx.mainAgent.getModel).toHaveBeenCalledWith(expect.objectContaining({ modelConfig: 'per-agent/model' }));
      generate.mockRestore();
    });

    it('keeps the existing throw when no model source is available', async () => {
      const memory = new Memory({ storage: new InMemoryStore() });
      await seedItem(memory);
      const handler = createCuratorHandler(memory, resolved(), memory);
      const ctx = context();
      delete ctx.mainAgent;

      await expect(handler(ctx)).rejects.toThrow('requires the main agent');
    });
  });
});
