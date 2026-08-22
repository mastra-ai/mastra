import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

function requestContext() {
  const context = new RequestContext();
  context.set('organizationId', 'acme');
  return context;
}

function createMockModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createBulkMessages(count: number, threadId: string, offset = 0): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${threadId}-${offset + i}`,
    threadId,
    role: i % 2 === 0 ? 'user' : 'assistant',
    createdAt: new Date(Date.now() + offset + i),
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Message ${offset + i} with enough text to move the token counter along.` }],
    } as MastraMessageContentV2,
  })) as MastraDBMessage[];
}

/**
 * A `Memory` stand-in whose curation actually consumes the worklist, so a second evaluation that
 * runs after a completed curation correctly sees no remaining work.
 */
function stubCuratingMemory(uncurated: number) {
  let remaining = uncurated;
  const runCuration = vi.fn(async () => {
    // Model the curator advancing the cursor past everything it processed.
    await new Promise(resolve => setTimeout(resolve, 5));
    remaining = 0;
    return { outcome: 'ran' as const };
  });
  return {
    runCuration,
    storage: {
      getStore: async (domain: string) =>
        domain === 'knowledge'
          ? {
              getCurationCursor: async () => null,
              knowledgeBySource: async ({ limit }: { limit?: number }) => ({
                records: Array.from({ length: Math.min(remaining, limit ?? remaining) }, (_, i) => ({ id: `k-${i}` })),
                nextCursor: undefined,
              }),
            }
          : undefined,
    },
  };
}

function createEngine(memory: unknown, threshold: number) {
  return new ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope: 'thread',
    memory: memory as any,
    curationThreshold: threshold,
    observation: {
      model: createMockModel('<observations>\n* Something happened\n</observations>'),
      messageTokens: 100,
      bufferTokens: false,
    },
    reflection: {
      model: createMockModel('<observations>\n* Condensed\n</observations>'),
      observationTokens: 50_000,
    },
  } as any);
}

describe('curation trigger lifecycle coverage', () => {
  it('evaluates curation at end of turn, so a short conversation still gets curated', async () => {
    const memory = stubCuratingMemory(3);
    const om = createEngine(memory, 3);
    const threadId = 'finalize-thread';

    await om.finalize({ threadId, messages: createBulkMessages(10, threadId), requestContext: requestContext() });

    expect(memory.runCuration).toHaveBeenCalledOnce();
    expect(memory.runCuration).toHaveBeenCalledWith(expect.objectContaining({ threadId }));
  });

  it('does not curate at end of turn when the turn committed nothing', async () => {
    const memory = stubCuratingMemory(50);
    const om = createEngine(memory, 1);

    await om.finalize({ threadId: 'quiet-thread', messages: [], requestContext: requestContext() });

    expect(memory.runCuration).not.toHaveBeenCalled();
  });

  it('serialises same-turn evaluations so two lifecycle sites cannot both curate', async () => {
    const memory = stubCuratingMemory(10);
    const om = createEngine(memory, 5);
    const threadId = 'race-thread';
    const record = await (om as any).getOrCreateRecord(threadId, undefined);

    // Two lifecycle sites evaluating in the same turn, concurrently.
    await Promise.all([
      om.maybeCurate(threadId, undefined, record, requestContext()),
      om.maybeCurate(threadId, undefined, record, requestContext()),
    ]);

    expect(memory.runCuration).toHaveBeenCalledOnce();
  });
});
