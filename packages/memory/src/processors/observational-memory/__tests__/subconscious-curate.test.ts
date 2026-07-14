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
});
