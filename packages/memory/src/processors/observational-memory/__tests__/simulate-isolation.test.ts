import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { replayCycles } from '../../../../scripts/simulate/drive';
import { Memory, Subconscious } from '../../../index';

const semanticInfrastructure = {
  vector: {
    indexSeparator: '_',
    listIndexes: vi.fn(async () => ['knowledge_documents_dimension_2']),
    createIndex: vi.fn(async () => undefined),
    upsert: vi.fn(async () => []),
    deleteVectors: vi.fn(async () => undefined),
    query: vi.fn(async () => []),
  } as unknown as MastraVector,
  embedder: {
    doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2]) })),
  } as unknown as MastraEmbeddingModel<string>,
};

afterEach(() => vi.restoreAllMocks());

describe('direct replay isolation', () => {
  it('keeps separate replay stores independent', async () => {
    const memoryA = new Memory({ storage: new InMemoryStore(), ...semanticInfrastructure });
    const memoryB = new Memory({ storage: new InMemoryStore(), ...semanticInfrastructure });
    const subconscious = new Subconscious({ defaultScope: 'resource', maxScope: 'resource' });

    vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation(function (this: Agent, message: any, options: any) {
      const consumeStream = async () => {
        const tools = (await this.listTools({ requestContext: options?.ifIdle?.streamOptions?.requestContext })) as any;
        const project = String(message.contents).includes('Atlas') ? 'Atlas' : 'Beacon';
        await tools.knowledge_create.execute(
          {
            name: `Project ${project}`,
            kind: 'project',
            text: `Project ${project} is active.`,
            nodeScope: 'resource',
            scope: 'resource',
          },
          {},
        );
      };
      return { accepted: Promise.resolve({ action: 'wake', output: { consumeStream } }), signal: {} } as any;
    });

    const common = {
      threadId: 'thread-a',
      resourceId: 'projects',
      organizationId: 'acme',
      subconscious: subconscious.resolved,
      mainAgent: { getModel: vi.fn(async () => 'openai/test') } as any,
    };
    await replayCycles({
      ...common,
      memory: memoryA,
      cycles: [
        { observations: 'Project Atlas is active.', observedAt: null, generationCount: 0, source: 'generation-head' },
      ],
    });
    await replayCycles({
      ...common,
      memory: memoryB,
      cycles: [
        { observations: 'Project Beacon is active.', observedAt: null, generationCount: 0, source: 'generation-head' },
      ],
    });

    const scope = ['org:acme', 'resource:projects'];
    const storeA = (await memoryA.storage.getStore('knowledge'))!;
    const storeB = (await memoryB.storage.getStore('knowledge'))!;
    expect((await storeA.listNodes({ scope, limit: 10 })).map(node => node.name)).toEqual(['Project Atlas']);
    expect((await storeB.listNodes({ scope, limit: 10 })).map(node => node.name)).toEqual(['Project Beacon']);
  });
});
