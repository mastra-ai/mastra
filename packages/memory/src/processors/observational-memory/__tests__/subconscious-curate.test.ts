import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { createCuratorHandler } from '../subconscious/curate';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import { createKnowledgeWriteTools } from '../subconscious/knowledge-write-tools';
import type { ResolvedSubconsciousConfig } from '../subconscious/types';
const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function resolved(): ResolvedSubconsciousConfig {
  return {
    observation: [],
    reflection: [{ name: 'curate', maxSteps: 5, builtIn: true }],
    learnedGuidance: true,
    tools: true,
    activity: { recentUpdates: 10 },
    pins: false,
  };
}

function createMemory(config: Record<string, unknown> = {}) {
  const storage = new InMemoryStore();
  return new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }), ...config });
}

async function scopeIdsFor(memory: Memory) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  return resolveKnowledgeScopeIds(memory, {
    agent: { threadId: 'alpha', resourceId: 'user-42' },
    requestContext,
  });
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
    const memory = createMemory({
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
          experimental_subconscious: new Subconscious(),
        },
      },
    });
    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await scopeIdsFor(memory);
    const companionScopeIds = [scopeIds[3]!];
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: companionScopeIds });
    const record = await store.createRecord({
      node,
      text: 'Atlas launches soon.',
      scopeIds: companionScopeIds,
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    recordId = record.id;
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');

    await memory.runCuration({ threadId: 'alpha', resourceId: 'user-42', requestContext });

    expect(prompt).toContain("links only from the entity's own records");
    // Synopses target the bounded description tool; content stays long-form (create path still uses the content tool).
    expect(prompt).toContain('knowledge_write_node_description');
    expect(prompt).toContain('re-read it for its fresh version before writing the description');
    expect(prompt).toContain('never shrink content into a synopsis');
    expect(prompt).toContain('knowledge_write_node_content');
    const mandateMarker = 'touched by a KnowledgeRecord in the current worklist';
    const cursorMarker = 'Do not emit a completion marker when no KnowledgeRecord was fully processed';
    expect(prompt).toContain(mandateMarker);
    expect(prompt).toContain(cursorMarker);
    expect(prompt).toContain('Your final response must end with the marker');
    expect(prompt.indexOf(mandateMarker)).toBeLessThan(prompt.indexOf(cursorMarker));
  });

  it('stamps canonical provenance, uses scope-node memberships and CAS, and only soft-deletes records', async () => {
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await scopeIdsFor(memory);
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[1]!] });
    const tools = createKnowledgeWriteTools(memory, {
      scopeIds,
      sourceThreadId: 'alpha',
    });

    const record = (await tools.knowledge_append!.execute?.(
      { node: node.id, text: '[[Project Atlas]] launches soon.', scope: 'resource' },
      {} as any,
    )) as any;
    expect(record).toMatchObject({
      nodeId: node.id,
      source: 'subconscious:curate',
      metadata: { sourceThreadId: 'alpha' },
    });
    expect(await store.getRecordScopeIds(record.id)).toEqual([scopeIds[1]]);

    await tools.knowledge_rescope!.execute?.({ recordId: record.id, scope: 'thread' }, {} as any);
    expect(await store.getRecordScopeIds(record.id)).toEqual([scopeIds[2]]);
    await expect(
      tools.knowledge_update_node!.execute?.(
        { node: node.id, expectedVersion: node.version + 1, name: 'Atlas' },
        {} as any,
      ),
    ).rejects.toThrow('version');

    await tools.knowledge_remove!.execute?.({ recordId: record.id }, {} as any);
    expect(await store.getRecord({ id: record.id })).toBeNull();
    expect(await store.getRecord({ id: record.id, includeDeleted: true })).toMatchObject({
      deletedBy: 'subconscious:curate',
    });
    expect(tools).not.toHaveProperty('knowledge_restore_item');
  });

  it('makes hidden and absent write targets indistinguishable', async () => {
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await scopeIdsFor(memory);
    const hiddenNode = await store.createNode({ name: 'Org secret', scopeIds: [scopeIds[0]!] });
    const hiddenRecord = await store.createRecord({
      node: hiddenNode,
      text: 'Private record',
      scopeIds: [scopeIds[0]!],
      source: 'test',
    });
    const tools = createKnowledgeWriteTools(memory, { scopeIds, sourceThreadId: 'alpha' });

    const appendHidden = tools.knowledge_append!.execute?.({ node: hiddenNode.id, text: 'Probe' }, {} as any);
    const appendAbsent = tools.knowledge_append!.execute?.({ node: 'missing-node', text: 'Probe' }, {} as any);
    await expect(appendHidden).rejects.toThrow(`Knowledge node not found: ${hiddenNode.id}`);
    await expect(appendAbsent).rejects.toThrow('Knowledge node not found: missing-node');

    const removeHidden = tools.knowledge_remove!.execute?.({ recordId: hiddenRecord.id }, {} as any);
    const removeAbsent = tools.knowledge_remove!.execute?.({ recordId: 'missing-record' }, {} as any);
    await expect(removeHidden).rejects.toThrow(`KnowledgeRecord not found: ${hiddenRecord.id}`);
    await expect(removeAbsent).rejects.toThrow('KnowledgeRecord not found: missing-record');

    const mergeHidden = tools.knowledge_merge_nodes!.execute?.(
      { sourceId: hiddenNode.id, targetId: 'missing-target', sourceVersion: hiddenNode.version },
      {} as any,
    );
    const mergeAbsent = tools.knowledge_merge_nodes!.execute?.(
      { sourceId: 'missing-source', targetId: 'missing-target', sourceVersion: 1 },
      {} as any,
    );
    await expect(mergeHidden).rejects.toThrow(`Knowledge node not found: ${hiddenNode.id}`);
    await expect(mergeAbsent).rejects.toThrow('Knowledge node not found: missing-source');
  });

  it('advances its source-thread cursor only after a successful durable run', async () => {
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await scopeIdsFor(memory);
    const recordScopeIds = [scopeIds[3]!];
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: recordScopeIds });
    const record = await store.createRecord({
      node,
      text: 'Atlas launches soon.',
      scopeIds: recordScopeIds,
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    const second = await store.createRecord({
      node,
      text: 'Atlas has a readiness review.',
      scopeIds: recordScopeIds,
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
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
    await store.deleteRecord({ id: second.id, version: second.version, deletedBy: 'subconscious:curate' });
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
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const scopeIds = await scopeIdsFor(memory);
    const recordScopeIds = [scopeIds[3]!];
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: recordScopeIds });
    const first = await store.createRecord({
      node,
      text: 'Atlas launches soon.',
      scopeIds: recordScopeIds,
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    const second = await store.createRecord({
      node,
      text: 'Atlas has a readiness review.',
      scopeIds: recordScopeIds,
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
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
      const scopeIds = await scopeIdsFor(memory);
      const recordScopeIds = [scopeIds[3]!];
      const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: recordScopeIds });
      return store.createRecord({
        node,
        text: 'Atlas launches soon.',
        scopeIds: recordScopeIds,
        source: 'alpha',
        metadata: { sourceThreadId: 'alpha' },
      });
    }

    it('runs on the observational memory model when no main agent is available', async () => {
      const memory = createMemory();
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
      const memory = createMemory();
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
      const memory = createMemory();
      await seedItem(memory);
      const handler = createCuratorHandler(memory, resolved(), memory);
      const ctx = context();
      delete ctx.mainAgent;

      await expect(handler(ctx)).rejects.toThrow('requires the main agent');
    });
  });
});
