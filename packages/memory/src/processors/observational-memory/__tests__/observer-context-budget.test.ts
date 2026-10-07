/**
 * `observation.previousObserverTokens` bounds the previous observations each Observer call sees,
 * on every observation path (sync, async buffering, resource scope). Composition still builds on
 * the full stored text, so nothing is dropped from memory.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import { setThreadOMMetadata } from '@mastra/core/memory';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { TokenCounter } from '../token-counter';

const threadId = 'budget-thread';
const resourceId = 'budget-resource';
const OLDEST = '- Oldest observation line 0';
const NEWEST = '- Newest observation line 399';
const previousObservations = [
  OLDEST,
  ...Array.from({ length: 398 }, (_, i) => `- Observation line ${i + 1} about project details`),
  NEWEST,
].join('\n');
const tokenCounter = new TokenCounter();

function message(id: string, role: 'user' | 'assistant', at: number): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text: `${id}: `.padEnd(400, 'x') }] },
    type: 'text',
    createdAt: new Date(at),
    threadId,
    resourceId,
  };
}

async function setup(
  scope: 'thread' | 'resource',
  previousObserverTokens?: number | false,
  observation: Record<string, unknown> = { messageTokens: 100, bufferTokens: false },
) {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  await storage.saveThread({
    thread: { id: threadId, resourceId, title: 't', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
  });
  const om = new ObservationalMemory({
    storage,
    scope,
    observation: {
      model: 'openai/gpt-4o-mini',
      ...observation,
      ...(previousObserverTokens !== undefined ? { previousObserverTokens } : {}),
    },
    reflection: { model: 'openai/gpt-4o-mini', observationTokens: 500_000 },
  });
  const t0 = Date.now() - 60_000;
  const record = await om.getOrCreateRecord(threadId, resourceId);
  await storage.updateActiveObservations({
    id: record.id,
    observations: previousObservations,
    tokenCount: tokenCounter.countObservations(previousObservations),
    lastObservedAt: new Date(t0 - 1000),
  });
  const messages = Array.from({ length: 6 }, (_, i) => message(`m${i}`, i % 2 ? 'assistant' : 'user', t0 + i * 1000));
  await storage.saveMessages({ messages });
  return { storage, om, messages };
}

function stubObserverCall(om: ObservationalMemory) {
  return vi.spyOn(om.observer, 'call').mockResolvedValue({
    observations: '- New observation from this cycle',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  } as Awaited<ReturnType<typeof om.observer.call>>);
}

describe('observation.previousObserverTokens reaches the Observer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sync observation sends the budgeted context and still commits on the full text', async () => {
    const { om, messages } = await setup('thread', 200);
    const call = stubObserverCall(om);

    const result = await om.observe({ threadId, resourceId, messages });

    expect(result.observed).toBe(true);
    const [context, , , options] = call.mock.calls[0]!;
    expect(tokenCounter.countObservations(context!)).toBeLessThanOrEqual(200);
    expect(context).toMatch(/\[\d+ observations truncated here\]/);
    expect(context).toContain(NEWEST);
    expect(context).not.toContain(OLDEST);
    expect(options?.wasTruncated).toBe(true);
    // Truncation only shapes the Observer input; the stored memory keeps every line.
    expect(result.record.activeObservations).toContain(OLDEST);
    expect(result.record.activeObservations).toContain('New observation from this cycle');
  });

  it('applies the 2,000-token default when the option is not set', async () => {
    const { om, messages } = await setup('thread');
    expect(tokenCounter.countObservations(previousObservations)).toBeGreaterThan(2000);
    const call = stubObserverCall(om);

    await om.observe({ threadId, resourceId, messages });

    const [context, , , options] = call.mock.calls[0]!;
    expect(tokenCounter.countObservations(context!)).toBeLessThanOrEqual(2000);
    expect(options?.wasTruncated).toBe(true);
  });

  it('sends the full previous observations when the budget is disabled', async () => {
    const { om, messages } = await setup('thread', false);
    const call = stubObserverCall(om);

    await om.observe({ threadId, resourceId, messages });

    const [context, , , options] = call.mock.calls[0]!;
    expect(context).toBe(previousObservations);
    expect(options?.wasTruncated).toBe(false);
  });

  it('async buffering budgets the active observations plus buffered chunks', async () => {
    const { storage, om, messages } = await setup('thread', 200, { messageTokens: 10_000, bufferTokens: 2_000 });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    await storage.updateBufferedObservations({
      id: record.id,
      chunk: {
        cycleId: 'earlier-chunk',
        observations: '- Earlier buffered chunk observation',
        tokenCount: 10,
        messageIds: ['m0'],
        messageTokens: 100,
        lastObservedAt: new Date(messages[0]!.createdAt.getTime() + 1),
      },
    });
    const call = stubObserverCall(om);

    await om.buffer({ threadId, resourceId, messages: messages.slice(1), skipMinimumTokenCheck: true });

    expect(call).toHaveBeenCalledTimes(1);
    const [context, , , options] = call.mock.calls[0]!;
    expect(tokenCounter.countObservations(context!)).toBeLessThanOrEqual(200);
    expect(context).toContain('Earlier buffered chunk observation');
    expect(context).not.toContain(OLDEST);
    expect(options?.wasTruncated).toBe(true);
  });

  it('resource-scoped observation sends the budgeted context to the multi-thread Observer', async () => {
    const { om, messages } = await setup('resource', 200);
    const call = vi.spyOn(om.observer, 'callMultiThread').mockResolvedValue({
      results: new Map([[threadId, { observations: '- New observation from this cycle' }]]),
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });

    const result = await om.observe({ threadId, resourceId, messages });

    expect(result.observed).toBe(true);
    const args = call.mock.calls[0]!;
    const context = args[0];
    expect(tokenCounter.countObservations(context!)).toBeLessThanOrEqual(200);
    expect(context).toContain(NEWEST);
    expect(context).not.toContain(OLDEST);
    expect(args[10]).toBe(true);
    expect(result.record.activeObservations).toContain(OLDEST);
  });

  it('tells the Observer model its previous observations were truncated', async () => {
    const prompts: string[] = [];
    const text = '<observations>\n* New observation\n</observations>';
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage,
          warnings: [],
          content: [{ type: 'text', text }],
        };
      },
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: text },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage },
          ]),
        };
      },
    });
    const { storage, om, messages } = await setup('thread', 200);
    (om as any).observer.resolveModel = () => ({ model });
    // The note sits with the prior thread metadata, so the thread needs some.
    const thread = (await storage.getThreadById({ threadId }))!;
    await storage.saveThread({
      thread: { ...thread, metadata: setThreadOMMetadata(thread.metadata, { currentTask: 'Ship the budget fix' }) },
    });

    await om.observe({ threadId, resourceId, messages });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('Previous observations were truncated for context budget reasons.');
    expect(prompts[0]).toContain('Newest observation line 399');
    expect(prompts[0]).not.toContain('Oldest observation line 0');
  });
});
