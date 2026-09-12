import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { replayCycles } from '../../../../scripts/simulate/drive';
import { Memory, Subconscious } from '../../../index';
import { applyExtractorHooks } from '../extracted-values';
import { SubconsciousRemindExtractor } from '../subconscious';
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

function cycles() {
  return [
    {
      observations: 'Project Atlas launches on 2026-09-15 and belongs to the Acme roadmap.',
      observedAt: new Date('2026-08-30T10:00:00.000Z'),
      generationCount: 0,
      source: 'generation-head' as const,
    },
    {
      observations: 'Project Atlas launch moved to 2026-10-01; it remains on the Acme roadmap.',
      observedAt: new Date('2026-08-31T10:00:00.000Z'),
      generationCount: 0,
      source: 'boundary' as const,
    },
  ];
}

afterEach(() => vi.restoreAllMocks());

describe('direct Subconscious replay', () => {
  it('directly curates recorded observations and persists reminder-retrievable knowledge', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({
      storage,
      knowledge: new Knowledge({ id: 'default', storage }),
      ...semanticInfrastructure,
    });
    const subconscious = new Subconscious({
      observation: [{ name: 'curate', curatorProfile: 'subconscious' }],
    });
    const scopeContext = new RequestContext();
    scopeContext.set('organizationId', 'acme');
    const scopeIds = await resolveKnowledgeScopeIds(memory, {
      agent: { threadId: 'thread-a', resourceId: 'atlas' },
      requestContext: scopeContext,
    });
    const store = await memory.getKnowledgeStore();
    await memory.getKnowledgeInstance()!.registerCuratorProfile({
      id: 'subconscious',
      identityScope: {
        address: 'curator:subconscious',
        name: 'Subconscious curator',
        contextualScopeAddress: 'curator:subconscious',
      },
      grants: [
        { scopeAddress: 'resource:atlas:thread:thread-a:uncurated', role: 'owner' },
        { scopeAddress: 'resource:atlas', role: 'owner' },
        { scopeAddress: 'resource:atlas:thread:thread-a', role: 'owner' },
      ],
    });
    const provisionalNode = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scopeIds: [scopeIds[4]!],
    });
    const provisionalRecord = await store.createRecord({
      node: provisionalNode.id,
      text: 'Project Atlas launches on 2026-10-01 and belongs to the Acme roadmap.',
      scopeIds: [scopeIds[4]!],
      source: 'thread-a',
      metadata: { sourceThreadId: 'thread-a' },
    });
    const nodeId = provisionalNode.id;
    const getActiveReminderRecord = async () =>
      (
        await store.listRecords({
          node: nodeId,
          scopeIds,
          limit: 10,
        })
      ).records.find(record => !record.deletedAt)!;

    vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation(function (this: Agent, message: any, options: any) {
      const consumeStream = async () => {
        const tools = (await this.listTools({ requestContext: options?.ifIdle?.streamOptions?.requestContext })) as any;
        const reminderRecord = await getActiveReminderRecord();
        const eventId = message.metadata.subconsciousRemind.eventId;
        await tools.send_reminder!.execute?.(
          {
            eventId,
            reminder: `Project Atlas now launches on October 1. Source: ${reminderRecord.id}`,
            sourceIds: [reminderRecord.id],
          },
          {
            agent: {
              threadId: options.threadId,
              resourceId: options.resourceId,
              messages: [{ role: 'user', content: String(message.contents), metadata: message.metadata }],
            },
          } as any,
        );
      };
      return { accepted: Promise.resolve({ action: 'wake', output: { consumeStream } }), signal: {} } as any;
    });
    (vi.spyOn(Agent.prototype, 'generate') as any).mockImplementation(async function (this: Agent) {
      if (this.id.startsWith('subconscious-curate-')) {
        const tools = (await this.listTools({ requestContext: scopeContext })) as any;
        await tools.knowledge_curation_promote!.execute?.(
          { nodeId, version: provisionalNode.version, destinationScopeId: scopeIds[1] },
          {} as any,
        );
        return { text: `<curation-complete through="${provisionalRecord.id}" />` } as any;
      }
      const reminderRecord = await getActiveReminderRecord();
      return { text: `Project Atlas now launches on October 1. Source: ${reminderRecord.id}` } as any;
    });

    const result = await replayCycles({
      cycles: cycles().slice(0, 1),
      threadId: 'thread-a',
      resourceId: 'atlas',
      organizationId: 'acme',
      memory,
      subconscious: subconscious.resolved,
      mainAgent: { getModel: vi.fn(async () => 'openai/test') } as any,
    });

    const records = await store.listRecords({
      node: nodeId,
      scopeIds,
      limit: 10,
      includeDeleted: true,
    });
    const active = records.records.filter(record => !record.deletedAt);
    expect(result).toMatchObject({
      cyclesReplayed: 1,
      curatorOutcomes: [{ cycleIndex: 0, sourceThreadId: 'thread-a', outcome: 'ran' }],
      knowledgeNodes: 1,
      knowledgeRecords: 1,
      warnings: [],
    });
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      text: 'Project Atlas launches on 2026-10-01 and belongs to the Acme roadmap.',
      metadata: { sourceThreadId: 'thread-a' },
    });

    const reminder = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const sendSignal = vi.fn(async () => undefined);
    const hookResult = await applyExtractorHooks({
      source: 'observer',
      extractors: [reminder],
      rawObservations: 'The user is preparing the Project Atlas launch checklist.',
      threadId: 'thread-b',
      resourceId: 'atlas',
      memory,
      requestContext,
      mainAgent: { getModel: vi.fn(async () => 'openai/test') } as any,
      sendSignal: sendSignal as any,
      sendStateSignal: vi.fn(async () => ({ skipped: false })) as any,
    });
    expect(hookResult.failures).toBeUndefined();
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reactive',
        tagName: 'remembered',
        contents: expect.stringContaining(active[0]!.id),
      }),
    );
  });
});
