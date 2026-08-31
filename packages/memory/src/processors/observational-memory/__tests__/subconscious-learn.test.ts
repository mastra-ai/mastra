import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import {
  composeReflectionAgentHandlers,
  createLearnerHandler,
  createLearnerRecordSkillTool,
} from '../subconscious/learn';
import type { ResolvedSubconsciousConfig } from '../subconscious/types';

function createMemory() {
  const storage = new InMemoryStore();
  return new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }) });
}

function resolved(): ResolvedSubconsciousConfig {
  return {
    observation: [],
    reflection: [{ name: 'learn', maxSteps: 5, builtIn: true }],
    learnedGuidance: true,
    tools: true,
    activity: { recentUpdates: 10 },
  };
}

function context(observations = '- Repeated deploy procedure with validation and health checks.') {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  return {
    parentThreadId: 'alpha',
    resourceId: 'user-42',
    observations,
    requestContext,
    mainAgent: { getModel: vi.fn(async () => 'mock/model') },
  } as any;
}

async function seed(memory: Memory) {
  const store = (await memory.storage.getStore('knowledge'))!;
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const scopeIds = await resolveKnowledgeScopeIds(memory, {
    agent: { threadId: 'alpha', resourceId: 'user-42' },
    requestContext,
  });
  const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
  const first = await store.createRecord({
    node: node.id,
    text: 'Deploy Atlas by validating and publishing.',
    scopeIds,
    source: 'alpha',
    metadata: { sourceThreadId: 'alpha' },
  });
  const second = await store.createRecord({
    node: node.id,
    text: 'A later deploy used validation, publishing, and a health check.',
    scopeIds,
    source: 'alpha',
    metadata: { sourceThreadId: 'alpha' },
  });
  return { store, first, second, scopeIds };
}

describe('Subconscious learner', () => {
  describe('model resolution', () => {
    it('runs on the observational memory model when no main agent is available', async () => {
      const memory = createMemory();
      const { second } = await seed(memory);
      const generate = vi
        .spyOn(Agent.prototype, 'generate')
        .mockResolvedValueOnce({ text: `<learning-complete through="${second.id}" />` } as any);
      const handler = createLearnerHandler(memory, resolved(), memory, { omModel: 'openai/om-model' });
      const ctx = context();
      delete ctx.mainAgent;

      await handler(ctx);
      expect(generate).toHaveBeenCalledOnce();
      generate.mockRestore();
    });

    it('prefers the per-agent model over the observational memory model', async () => {
      const memory = createMemory();
      const { second } = await seed(memory);
      const generate = vi
        .spyOn(Agent.prototype, 'generate')
        .mockResolvedValueOnce({ text: `<learning-complete through="${second.id}" />` } as any);
      const config = resolved();
      config.reflection[0]!.model = 'per-agent/model' as any;
      const handler = createLearnerHandler(memory, config, memory, { omModel: 'openai/om-model' });
      const ctx = context();

      await handler(ctx);
      expect(ctx.mainAgent.getModel).toHaveBeenCalledWith(expect.objectContaining({ modelConfig: 'per-agent/model' }));
      generate.mockRestore();
    });

    it('keeps the existing throw when no model source is available', async () => {
      const memory = createMemory();
      await seed(memory);
      const handler = createLearnerHandler(memory, resolved(), memory);
      const ctx = context();
      delete ctx.mainAgent;

      await expect(handler(ctx)).rejects.toThrow('requires the main agent');
    });
  });

  it('runs curator before learner while isolating either failure', async () => {
    const calls: string[] = [];
    const curate = vi.fn(async () => {
      calls.push('curate');
      throw new Error('curate failed');
    });
    const learn = vi.fn(async () => {
      calls.push('learn');
    });
    await composeReflectionAgentHandlers([curate, learn])(context());
    expect(calls).toEqual(['curate', 'learn']);
  });

  it('propagates aborts instead of starting the next reflection agent', async () => {
    const controller = new AbortController();
    controller.abort();
    const learn = vi.fn();
    const abortedContext = { ...context(), abortSignal: controller.signal };

    await expect(
      composeReflectionAgentHandlers([
        async () => {
          throw new Error('aborted');
        },
        learn,
      ])(abortedContext),
    ).rejects.toThrow('aborted');
    expect(learn).not.toHaveBeenCalled();
  });

  it('records one scoped skill with retry-safe evidence from repeated source knowledge records', async () => {
    const memory = createMemory();
    const { store, first, second, scopeIds } = await seed(memory);
    const state = {};
    const tool = createLearnerRecordSkillTool({
      store,
      scopeIds,
      pendingRecords: [first, second],
      parentThreadId: 'alpha',
      state,
    });
    const input = {
      name: 'deploy-atlas-safely',
      procedure: 'Validate, publish, then verify the health check.',
      sourceRecordIds: [first.id, second.id],
    };

    await tool.execute?.(input, {} as any);
    await tool.execute?.(input, {} as any);

    const skills = await store.listNodes({ scopeIds, kind: 'skill' });
    expect(skills).toHaveLength(1);
    const evidence = await store.listRecords({
      node: skills[0]!.id,
      scopeIds,
    });
    expect(evidence.records).toHaveLength(2);
    expect(evidence.records.every(record => record.source === 'subconscious:alpha:learn')).toBe(true);
  });

  it('updates a visible ancestor-scoped skill instead of creating a duplicate', async () => {
    const memory = createMemory();
    const { store, first, second, scopeIds } = await seed(memory);
    const existing = await store.createNode({
      name: 'deploy-atlas-safely',
      kind: 'skill',
      scopeIds: [scopeIds[0]!],
    });
    const tool = createLearnerRecordSkillTool({
      store,
      scopeIds,
      pendingRecords: [first, second],
      parentThreadId: 'alpha',
      state: {},
    });

    await tool.execute?.(
      {
        name: existing.name,
        procedure: 'Validate, publish, then verify the health check.',
        sourceRecordIds: [first.id, second.id],
      },
      {} as any,
    );

    expect(await store.listNodes({ scopeIds, kind: 'skill' })).toEqual([expect.objectContaining({ id: existing.id })]);
    expect((await store.listRecords({ node: existing.id, scopeIds })).records).toHaveLength(2);
  });

  it('rejects one-off evidence before creating a skill', async () => {
    const memory = createMemory();
    const { store, first, scopeIds } = await seed(memory);
    const tool = createLearnerRecordSkillTool({
      store,
      scopeIds,
      pendingRecords: [first],
      parentThreadId: 'alpha',
      state: {},
    });
    await expect(
      tool.execute?.({ name: 'one-off', procedure: 'Do one thing.', sourceRecordIds: [first.id] }, {} as any),
    ).resolves.toMatchObject({ error: true });
    expect(await store.listNodes({ scopeIds, kind: 'skill' })).toHaveLength(0);
  });

  it('uses full pre-reflection observations and advances only its independent cursor after success', async () => {
    const memory = createMemory();
    const { store, second } = await seed(memory);
    const generate = vi
      .spyOn(Agent.prototype, 'generate')
      .mockRejectedValueOnce(new Error('learner crashed'))
      .mockResolvedValueOnce({ text: `<learning-complete through="${second.id}" />` } as any);
    const handler = createLearnerHandler(memory, resolved());

    await expect(handler(context('FULL PRE-REFLECTION PROCEDURE'))).rejects.toThrow('learner crashed');
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'learn' })).toBeNull();
    await handler(context('FULL PRE-REFLECTION PROCEDURE'));
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'learn' })).toMatchObject({
      lastKnowledgeId: second.id,
    });
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toBeNull();
    expect(generate).toHaveBeenLastCalledWith(
      expect.stringContaining('Full pre-reflection observations:\nFULL PRE-REFLECTION PROCEDURE'),
      expect.objectContaining({ memory: { thread: 'subconscious:alpha:learn', resource: 'user-42' } }),
    );
  });
});
