import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { createCuratorHandler } from '../subconscious/curate';
import { createKnowledgeWriteTools } from '../subconscious/knowledge-write-tools';
import type { ResolvedSubconsciousConfig } from '../subconscious/types';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

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
  it('stamps provenance, enforces ceilings, uses CAS, and only soft-deletes facts', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    const entity = await store.createEntity({ name: 'Project Atlas', kind: 'project', scope });
    const tools = createKnowledgeWriteTools(memory, {
      scope,
      sourceThreadId: 'alpha',
      defaultScope: 'resource',
      maxScope: 'resource',
    });

    const fact = (await tools.knowledge_add_fact!.execute?.(
      { parentEntityId: entity.id, text: '[[Project Atlas]] launches soon.', scope: 'resource' },
      {} as any,
    )) as any;
    expect(fact).toMatchObject({ sourceThreadId: 'alpha', maxScope: 'resource' });
    expect(fact.capturedAt).toBeInstanceOf(Date);

    await expect(tools.knowledge_rescope!.execute?.({ factId: fact.id, scope: 'org' }, {} as any)).rejects.toThrow(
      'ceiling',
    );
    await expect(
      tools.knowledge_update_entity!.execute?.(
        { entityId: entity.id, expectedVersion: entity.version + 1, name: 'Atlas' },
        {} as any,
      ),
    ).rejects.toThrow('version');

    await tools.knowledge_remove_fact!.execute?.({ factId: fact.id }, {} as any);
    expect(await store.getFact({ id: fact.id })).toBeNull();
    expect(await store.getFact({ id: fact.id, includeDeleted: true })).toMatchObject({
      deletedBy: 'subconscious:curate',
    });
    expect(tools).not.toHaveProperty('knowledge_restore_fact');
  });

  it('advances its source-thread cursor only after a successful durable run', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    const entity = await store.createEntity({ name: 'Project Atlas', kind: 'project', scope });
    const fact = await store.appendFact({
      parentEntityId: entity.id,
      text: 'Atlas launches soon.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    const second = await store.appendFact({
      parentEntityId: entity.id,
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
      .mockResolvedValueOnce({ text: `<curation-complete through="${fact.id}" />` } as any)
      .mockResolvedValueOnce({ text: `<curation-complete through="${second.id}" />` } as any);
    const handler = createCuratorHandler(memory, resolved());

    await expect(handler(context())).rejects.toThrow('curator crashed');
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toBeNull();
    await expect(handler(context())).rejects.toThrow('acknowledge');

    await handler(context());
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastFactId: fact.id,
    });
    await store.removeFact({ id: second.id, deletedBy: 'subconscious:curate' });
    await handler(context());
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastFactId: second.id,
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
    const entity = await store.createEntity({ name: 'Project Atlas', kind: 'project', scope });
    const first = await store.appendFact({
      parentEntityId: entity.id,
      text: 'Atlas launches soon.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    const second = await store.appendFact({
      parentEntityId: entity.id,
      text: 'Atlas has a readiness review.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });
    // A step-exhausted run: markers were emitted incrementally per processed fact, but the
    // run died mid-batch, so the aggregated text ends with tool chatter, not a final marker.
    vi.spyOn(Agent.prototype, 'generate').mockResolvedValueOnce({
      text: `Processed the first fact. <curation-complete through="${first.id}" />\nMoving on, merged a duplicate. <curation-complete through="${second.id}" />\nExploring the next entity now.`,
    } as any);
    const handler = createCuratorHandler(memory, resolved());

    await handler(context());
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toMatchObject({
      lastFactId: second.id,
    });
  });

  describe('model resolution', () => {
    async function seedFact(memory: Memory) {
      const store = (await memory.storage.getStore('knowledge'))!;
      const entity = await store.createEntity({ name: 'Project Atlas', kind: 'project', scope });
      return store.appendFact({
        parentEntityId: entity.id,
        text: 'Atlas launches soon.',
        scope,
        sourceThreadId: 'alpha',
        resolutionScope: scope,
        defaultScope: scope,
      });
    }

    it('runs on the observational memory model when no main agent is available', async () => {
      const memory = new Memory({ storage: new InMemoryStore() });
      const fact = await seedFact(memory);
      const generate = vi
        .spyOn(Agent.prototype, 'generate')
        .mockResolvedValueOnce({ text: `<curation-complete through="${fact.id}" />` } as any);
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
      const fact = await seedFact(memory);
      const generate = vi
        .spyOn(Agent.prototype, 'generate')
        .mockResolvedValueOnce({ text: `<curation-complete through="${fact.id}" />` } as any);
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
      await seedFact(memory);
      const handler = createCuratorHandler(memory, resolved(), memory);
      const ctx = context();
      delete ctx.mainAgent;

      await expect(handler(ctx)).rejects.toThrow('requires the main agent');
    });
  });
});
