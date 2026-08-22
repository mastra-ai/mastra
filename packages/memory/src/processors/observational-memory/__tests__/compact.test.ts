/**
 * compact() Tests (#21657)
 *
 * compact() is the recovery path for a provider rejecting a request for context
 * overflow while OM's local estimate still sits below the observation threshold.
 * It must observe below threshold, without persisting any config override, and it
 * must terminate rather than spin when it cannot make progress.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

const observationText = `<observations>
* User discussed compaction
* Assistant compacted the context
</observations>
<current-task>
- Primary: Compaction
</current-task>`;

function createMockObserverModel(onCall?: () => void) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      onCall?.();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        warnings: [],
        content: [{ type: 'text', text: observationText }],
      };
    },
    doStream: async () => {
      onCall?.();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'obs-1',
            modelId: 'mock-observer-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: observationText });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          });
          controller.close();
        },
      });
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  } as any);
}

/** ~50 tokens per message (200 chars / ~4 chars per token). */
function createMessages(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => {
    const content: MastraMessageContentV2 = {
      format: 2,
      parts: [{ type: 'text', text: `Message ${i}: `.padEnd(200, 'x') }],
    };
    return {
      id: `msg-${i}`,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content,
      type: 'text' as const,
      createdAt: new Date(Date.now() - (count - i) * 1000),
    };
  });
}

describe('compact()', () => {
  let om: ObservationalMemory;
  let observerCalls: number;
  const threadId = 'compact-thread';

  beforeEach(() => {
    observerCalls = 0;
    om = new ObservationalMemory({
      storage: new InMemoryMemory({ db: new InMemoryDB() }),
      scope: 'thread',
      observation: {
        model: createMockObserverModel(() => {
          observerCalls++;
        }),
        // High enough that the messages under test never cross it on their own.
        messageTokens: 100_000,
        bufferTokens: false,
      },
      reflection: {
        model: createMockObserverModel(),
        observationTokens: 50_000,
      },
    });
  });

  it('observes below the threshold, where observe() is a no-op', async () => {
    const messages = createMessages(4);

    const observeResult = await om.observe({ threadId, messages });
    expect(observeResult.observed).toBe(false);
    expect(observeResult.record.activeObservations).toBeFalsy();

    const result = await om.compact({ threadId, messages, targetTokens: 0 });

    expect(result.compacted).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.tokensCompacted).toBeGreaterThan(0);
    expect(result.record.activeObservations).toContain('User discussed compaction');
  });

  it('does not persist a config override onto the record', async () => {
    const messages = createMessages(4);

    await om.compact({ threadId, messages, targetTokens: 0 });

    const record = await om.getStatus({ threadId }).then(status => status.record);
    expect((record as unknown as { _overrides?: unknown })._overrides).toBeFalsy();

    // A later observe() still respects the configured threshold.
    const after = await om.observe({ threadId, messages: createMessages(2) });
    expect(after.observed).toBe(false);
  });

  it('compacts in multiple chunks when chunkTokens is smaller than pending context', async () => {
    const messages = createMessages(6);

    const result = await om.compact({ threadId, messages, targetTokens: 0, chunkTokens: 60 });

    expect(result.iterations).toBeGreaterThan(1);
    expect(observerCalls).toBe(result.iterations);
    expect(result.reachedTarget).toBe(true);
    expect(result.pendingTokens).toBe(0);
  });

  it('respects maxIterations', async () => {
    const messages = createMessages(6);

    const result = await om.compact({ threadId, messages, targetTokens: 0, chunkTokens: 60, maxIterations: 2 });

    expect(result.iterations).toBe(2);
    expect(result.reachedTarget).toBe(false);
  });

  it('is a no-op when there is nothing left to compact', async () => {
    const result = await om.compact({ threadId, messages: [], targetTokens: 0 });

    expect(result.compacted).toBe(false);
    expect(result.iterations).toBe(0);
    expect(observerCalls).toBe(0);
  });

  it('does no work when pending context is already at target', async () => {
    const messages = createMessages(4);

    const result = await om.compact({ threadId, messages, targetTokens: 100_000 });

    expect(result.compacted).toBe(false);
    expect(result.iterations).toBe(0);
    expect(result.reachedTarget).toBe(true);
    expect(observerCalls).toBe(0);
  });

  it('reports the compacted context as observed on the next status read', async () => {
    const messages = createMessages(4);

    await om.compact({ threadId, messages, targetTokens: 0 });

    const status = await om.getStatus({ threadId, messages });
    expect(status.pendingTokens).toBe(0);
  });
});
