import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { replayCycles } from '../../../../scripts/simulate/drive';
import { Memory, Subconscious } from '../../../index';
import { applyExtractorHooks } from '../extracted-values';
import { SubconsciousRemindExtractor } from '../subconscious';

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
    const memory = new Memory({ storage: new InMemoryStore(), ...semanticInfrastructure });
    const subconscious = new Subconscious({ defaultScope: 'resource', maxScope: 'resource' });
    const store = (await memory.storage.getStore('knowledge'))!;
    const generatedPrompts: string[] = [];
    let firstRecordId = '';
    let nodeId = '';
    const getActiveReminderRecord = async () =>
      (
        await store.listKnowledgeAbout({
          node: nodeId,
          scope: ['org:acme', 'resource:atlas'],
          limit: 10,
        })
      ).records.find(record => !record.deletedAt)!;

    vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation(function (this: Agent, message: any, options: any) {
      const text = String(message.contents);
      generatedPrompts.push(text);
      const consumeStream = async () => {
        const tools = (await this.listTools({ requestContext: options?.ifIdle?.streamOptions?.requestContext })) as any;
        if (this.id.startsWith('subconscious-remind-')) {
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
                messages: [{ role: 'user', content: text, metadata: message.metadata }],
              },
            } as any,
          );
        } else if (!nodeId) {
          const created = (await tools.knowledge_create!.execute?.(
            {
              name: 'Project Atlas',
              kind: 'project',
              text: 'Project Atlas launches on 2026-09-15 and belongs to the Acme roadmap.',
              nodeScope: 'resource',
              scope: 'resource',
              when: '2026-09-15T00:00:00.000Z',
            },
            {} as any,
          )) as any;
          nodeId = created.node.id;
          firstRecordId = created.record.id;
        } else {
          const found = (await tools.knowledge_search!.execute?.(
            { query: 'Project Atlas launch', limit: 10 },
            {} as any,
          )) as any;
          expect(JSON.stringify(found)).toContain(firstRecordId);
          await tools.knowledge_remove!.execute?.({ recordId: firstRecordId }, {} as any);
          await tools.knowledge_append!.execute?.(
            {
              node: nodeId,
              text: 'Project Atlas launches on 2026-10-01 and belongs to the Acme roadmap.',
              scope: 'resource',
              when: '2026-10-01T00:00:00.000Z',
            },
            {} as any,
          );
        }
      };
      return { accepted: Promise.resolve({ action: 'wake', output: { consumeStream } }), signal: {} } as any;
    });
    (vi.spyOn(Agent.prototype, 'generate') as any).mockImplementation(async () => {
      const reminderRecord = await getActiveReminderRecord();
      return { text: `Project Atlas now launches on October 1. Source: ${reminderRecord.id}` } as any;
    });

    const result = await replayCycles({
      cycles: cycles(),
      threadId: 'thread-a',
      resourceId: 'atlas',
      organizationId: 'acme',
      memory,
      subconscious: subconscious.resolved,
      mainAgent: { getModel: vi.fn(async () => 'openai/test') } as any,
    });

    const nodes = await store.listNodes({ scope: ['org:acme', 'resource:atlas'], limit: 10 });
    const records = await store.listKnowledgeAbout({
      node: nodes[0]!.id,
      scope: ['org:acme', 'resource:atlas'],
      limit: 10,
      includeDeleted: true,
    });
    const active = records.records.filter(record => !record.deletedAt);
    expect(result).toMatchObject({
      cyclesReplayed: 2,
      curatorOutcomes: [
        { cycleIndex: 0, sourceThreadId: 'thread-a', outcome: 'ran' },
        { cycleIndex: 1, sourceThreadId: 'thread-a', outcome: 'ran' },
      ],
      knowledgeNodes: 1,
      knowledgeRecords: 1,
      warnings: [],
    });
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      text: 'Project Atlas launches on 2026-10-01 and belongs to the Acme roadmap.',
      sourceThreadId: 'thread-a',
      scope: ['org:acme', 'resource:atlas'],
    });
    expect(generatedPrompts[1]).toContain('Project Atlas launch moved to 2026-10-01');

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
