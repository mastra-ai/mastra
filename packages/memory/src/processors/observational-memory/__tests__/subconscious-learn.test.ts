import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import {
  composeReflectionAgentHandlers,
  createLearnerHandler,
  createLearnerRecordSkillTool,
} from '../subconscious/learn';
import type { ResolvedSubconsciousConfig } from '../subconscious/types';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

function resolved(): ResolvedSubconsciousConfig {
  return {
    observation: [],
    reflection: [{ name: 'learn', maxSteps: 5, builtIn: true }],
    defaultScope: 'resource',
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
  const entity = await store.createEntity({ name: 'Project Atlas', kind: 'project', scope });
  const first = await store.appendFact({
    parentEntityId: entity.id,
    text: 'Deploy Atlas by validating and publishing.',
    scope,
    sourceThreadId: 'alpha',
    resolutionScope: scope,
    defaultScope: scope,
  });
  const second = await store.appendFact({
    parentEntityId: entity.id,
    text: 'A later deploy used validation, publishing, and a health check.',
    scope,
    sourceThreadId: 'alpha',
    resolutionScope: scope,
    defaultScope: scope,
  });
  return { store, first, second };
}

describe('Subconscious learner', () => {
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

  it('records one scoped skill with retry-safe evidence from repeated source facts', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { store, first, second } = await seed(memory);
    const state = {};
    const tool = createLearnerRecordSkillTool({
      store,
      scope,
      pendingFacts: [first, second],
      parentThreadId: 'alpha',
      defaultScope: 'resource',
      maxScope: undefined,
      state,
    });
    const input = {
      name: 'deploy-atlas-safely',
      procedure: 'Validate, publish, then verify the health check.',
      sourceFactIds: [first.id, second.id],
    };

    await tool.execute?.(input, {} as any);
    await tool.execute?.(input, {} as any);

    const skills = await store.listEntities({ scope, kind: 'skill' });
    expect(skills).toHaveLength(1);
    const evidence = await store.factsAbout({ entityId: skills[0]!.id, scope });
    expect(evidence.facts).toHaveLength(2);
    expect(evidence.facts.every(fact => fact.sourceThreadId === 'subconscious:alpha:learn')).toBe(true);
  });

  it('updates a visible ancestor-scoped skill instead of creating a duplicate', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { store, first, second } = await seed(memory);
    const existing = await store.createEntity({ name: 'deploy-atlas-safely', kind: 'skill', scope: ['org:acme'] });
    const tool = createLearnerRecordSkillTool({
      store,
      scope,
      pendingFacts: [first, second],
      parentThreadId: 'alpha',
      defaultScope: 'resource',
      maxScope: undefined,
      state: {},
    });

    await tool.execute?.(
      {
        name: existing.name,
        procedure: 'Validate, publish, then verify the health check.',
        sourceFactIds: [first.id, second.id],
      },
      {} as any,
    );

    expect(await store.listEntities({ scope, kind: 'skill' })).toEqual([expect.objectContaining({ id: existing.id })]);
    expect((await store.factsAbout({ entityId: existing.id, scope })).facts).toHaveLength(2);
  });

  it('rejects one-off evidence before creating a skill', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const { store, first } = await seed(memory);
    const tool = createLearnerRecordSkillTool({
      store,
      scope,
      pendingFacts: [first],
      parentThreadId: 'alpha',
      defaultScope: 'resource',
      maxScope: undefined,
      state: {},
    });
    await expect(
      tool.execute?.({ name: 'one-off', procedure: 'Do one thing.', sourceFactIds: [first.id] }, {} as any),
    ).resolves.toMatchObject({ error: true });
    expect(await store.listEntities({ scope, kind: 'skill' })).toHaveLength(0);
  });

  it('uses full pre-reflection observations and advances only its independent cursor after success', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
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
      lastFactId: second.id,
    });
    expect(await store.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' })).toBeNull();
    expect(generate).toHaveBeenLastCalledWith(
      expect.stringContaining('Full pre-reflection observations:\nFULL PRE-REFLECTION PROCEDURE'),
      expect.objectContaining({ memory: { thread: 'subconscious:alpha:learn', resource: 'user-42' } }),
    );
  });
});
