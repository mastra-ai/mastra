import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { replayCycles } from '../../../../scripts/simulate/drive';
import { Memory, Subconscious } from '../../../index';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';

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
    const storageA = new InMemoryStore();
    const storageB = new InMemoryStore();
    const memoryA = new Memory({
      storage: storageA,
      knowledge: new Knowledge({ id: 'default', storage: storageA }),
      ...semanticInfrastructure,
    });
    const memoryB = new Memory({
      storage: storageB,
      knowledge: new Knowledge({ id: 'default', storage: storageB }),
      ...semanticInfrastructure,
    });
    const subconscious = new Subconscious({
      observation: [{ name: 'curate', curatorProfile: 'subconscious' }],
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const workByNode = new Map<string, { recordId: string; destinationScopeId: string }>();
    for (const [memory, project] of [
      [memoryA, 'Atlas'],
      [memoryB, 'Beacon'],
    ] as const) {
      const scopeIds = await resolveKnowledgeScopeIds(memory, {
        agent: { threadId: 'thread-a', resourceId: 'projects' },
        requestContext,
      });
      await memory.getKnowledgeInstance()!.registerCuratorProfile({
        id: 'subconscious',
        identityScope: {
          address: 'curator:subconscious',
          name: 'Subconscious curator',
          contextualScopeAddress: 'curator:subconscious',
        },
        grants: [
          { scopeAddress: 'resource:projects:thread:thread-a:uncurated', role: 'owner' },
          { scopeAddress: 'resource:projects', role: 'owner' },
          { scopeAddress: 'resource:projects:thread:thread-a', role: 'owner' },
        ],
      });
      const store = await memory.getKnowledgeStore();
      const node = await store.createNode({ name: `Project ${project}`, kind: 'project', scopeIds: [scopeIds[4]!] });
      const record = await store.createRecord({
        node: node.id,
        text: `Project ${project} is active.`,
        scopeIds: [scopeIds[4]!],
        source: 'thread-a',
      });
      workByNode.set(node.id, { recordId: record.id, destinationScopeId: scopeIds[1]! });
    }

    vi.spyOn(Agent.prototype, 'generate').mockImplementation(async function (this: Agent) {
      const tools = (await this.listTools({ requestContext })) as any;
      const worklist = await tools.knowledge_curation_list.execute({}, {});
      const node = worklist.nodes[0];
      const work = workByNode.get(node.id)!;
      await tools.knowledge_curation_promote.execute(
        { nodeId: node.id, version: node.version, destinationScopeId: work.destinationScopeId },
        {},
      );
      return { text: `<curation-complete through="${work.recordId}" />` } as any;
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

    for (const [memory, expected] of [
      [memoryA, 'Project Atlas'],
      [memoryB, 'Project Beacon'],
    ] as const) {
      const scopeIds = await resolveKnowledgeScopeIds(memory, {
        agent: { threadId: 'thread-a', resourceId: 'projects' },
        requestContext,
      });
      const store = await memory.getKnowledgeStore();
      expect(
        (await store.listNodes({ scopeIds, limit: 10 })).filter(node => !node.isScope).map(node => node.name),
      ).toEqual([expected]);
    }
  });
});
