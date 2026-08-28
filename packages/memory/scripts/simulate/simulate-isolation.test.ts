import { Agent } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../src/index';
import { buildArmSubconscious, replayCycles } from './drive';
import type { ArmConfig } from './drive';
import type { ReconstructedCycle } from './reconstruct';

const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

function armConfig(name: string): ArmConfig {
  return {
    name,
    prompts: { capture: `Arm ${name} capture guidance.` },
    curationCadence: 1,
    defaultScope: 'resource',
    maxScope: 'resource',
    curateMaxSteps: 10,
  };
}

/** Each arm gets its own store — this is the boundary the test is here to observe. */
function createArmMemory(arm: ArmConfig) {
  return new Memory({
    storage: new InMemoryStore(),
    ...semanticInfrastructure,
    options: {
      observationalMemory: {
        model: 'openai/om-model',
        experimental_subconscious: buildArmSubconscious(arm),
      },
    },
  });
}

function cycles(): ReconstructedCycle[] {
  return [
    {
      observations: '* The team shipped the milestone.',
      observedAt: new Date('2026-08-01T00:00:00.000Z'),
      generationCount: 0,
      source: 'boundary',
    },
  ];
}

function captureAgent() {
  return {
    generate: vi.fn(async (_prompt: string, _options?: { requestContext?: RequestContext }) => ({
      object: {
        nodes: [
          {
            name: 'Project Atlas',
            kind: 'project',
            records: [{ text: 'Atlas milestone shipped.', reason: 'Stated directly in the conversation.' }],
          },
        ],
      },
    })),
  } as never;
}

function curatorAlwaysCompletes() {
  return vi.spyOn(Agent.prototype, 'generate').mockImplementation(async function (this: Agent, ...args: unknown[]) {
    const prompt = typeof args[0] === 'string' ? args[0] : '';
    const ids = [...prompt.matchAll(/"id":"([^"]+)"/g)].map(match => match[1]);
    return { text: ids.length ? `<curation-complete through="${ids.at(-1)}" />` : 'nothing to do' } as never;
  });
}

function runArm(memory: Memory, arm: ArmConfig) {
  return replayCycles({
    cycles: cycles(),
    threadId: 'alpha',
    resourceId: 'user-42',
    organizationId: 'acme',
    memory: memory as never,
    subconscious: buildArmSubconscious(arm),
    captureAgent: captureAgent(),
    curationCadence: 1,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('arm isolation', () => {
  it('keeps knowledge seeded into one arm out of the other arm', async () => {
    const armA = createArmMemory(armConfig('a'));
    const armB = createArmMemory(armConfig('b'));
    curatorAlwaysCompletes();

    const storeA = (await armA.storage.getStore('knowledge'))!;
    const marker = await storeA.createNode({ name: 'Arm A Only Marker', kind: 'marker', scope });
    await storeA.appendKnowledge({
      node: marker.id,
      text: 'This knowledge exists only in arm A.',
      scope,
      sourceThreadId: 'alpha',
      resolutionScope: scope,
      defaultScope: scope,
    });

    await runArm(armA, armConfig('a'));
    await runArm(armB, armConfig('b'));

    const storeB = (await armB.storage.getStore('knowledge'))!;
    const nodesA = await storeA.listNodes({ scope, limit: 100 });
    const nodesB = await storeB.listNodes({ scope, limit: 100 });

    expect(nodesA.map(node => node.name)).toContain('Arm A Only Marker');
    expect(nodesB.map(node => node.name)).not.toContain('Arm A Only Marker');
  });

  it('advances each arm curation cursor independently', async () => {
    const armA = createArmMemory(armConfig('a'));
    const armB = createArmMemory(armConfig('b'));
    curatorAlwaysCompletes();

    await runArm(armA, armConfig('a'));

    const storeA = (await armA.storage.getStore('knowledge'))!;
    const storeB = (await armB.storage.getStore('knowledge'))!;
    const cursorAAfterA = await storeA.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' });
    const cursorBAfterA = await storeB.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' });

    expect(cursorAAfterA?.lastKnowledgeId).toBeTruthy();
    expect(cursorBAfterA).toBeNull();

    await runArm(armB, armConfig('b'));

    const cursorBAfterB = await storeB.getCurationCursor({ sourceThreadId: 'alpha', agent: 'curate' });
    expect(cursorBAfterB?.lastKnowledgeId).toBeTruthy();
    expect(cursorBAfterB?.lastKnowledgeId).not.toBe(cursorAAfterA?.lastKnowledgeId);
  });
});
