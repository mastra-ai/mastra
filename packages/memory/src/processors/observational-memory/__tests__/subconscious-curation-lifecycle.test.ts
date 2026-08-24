import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Extractor } from '../extractor';
import { ObservationalMemory } from '../observational-memory';

/**
 * The generic pipeline-completion seam that curation (and anything else) hangs off.
 *
 * OM knows nothing about curation: it exposes `onObservationCompleted`, fired after a
 * successfully completed observation pipeline — including extractor `onExtracted` hooks — on
 * the sync, async-buffered, and idle-buffered paths, and never on failed cycles. The
 * curation-specific policy driven from this callback is tested against the curator runtime in
 * `subconscious-curation-trigger.test.ts` and end-to-end in `subconscious-curation-e2e.test.ts`.
 */

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

function createFailingModel() {
  return new MockLanguageModelV2({
    doStream: async () => {
      throw new Error('observer exploded');
    },
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

function createEngine(opts: {
  onObservationCompleted: (context: any) => Promise<void> | void;
  bufferTokens?: number | false;
  observerModel?: any;
  extract?: Extractor<any>[];
}) {
  return new ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope: 'thread',
    onObservationCompleted: opts.onObservationCompleted,
    observation: {
      model: opts.observerModel ?? createMockModel('<observations>\n* Something happened\n</observations>'),
      messageTokens: 100,
      bufferTokens: opts.bufferTokens ?? false,
      extract: opts.extract,
    },
    reflection: {
      model: createMockModel('<observations>\n* Condensed\n</observations>'),
      observationTokens: 50_000,
    },
  } as any);
}

describe('onObservationCompleted pipeline-completion seam', () => {
  it('fires after a successfully completed sync observation', async () => {
    const completed = vi.fn(async () => {});
    const om = createEngine({ onObservationCompleted: completed });
    const threadId = 'sync-thread';

    await om.finalize({ threadId, messages: createBulkMessages(10, threadId), requestContext: requestContext() });
    await om.settled();

    expect(completed).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ threadId }));
    expect((completed.mock.calls[0] as any[])[0].requestContext.get('organizationId')).toBe('acme');
  });

  it('does not fire when the turn committed nothing', async () => {
    const completed = vi.fn(async () => {});
    const om = createEngine({ onObservationCompleted: completed });

    await om.finalize({ threadId: 'quiet-thread', messages: [], requestContext: requestContext() });
    await om.settled();

    expect(completed).not.toHaveBeenCalled();
  });

  it('does not fire when the observer fails', async () => {
    const completed = vi.fn(async () => {});
    const om = createEngine({ onObservationCompleted: completed, observerModel: createFailingModel() });
    const threadId = 'failing-thread';

    await expect(
      om.observe({ threadId, messages: createBulkMessages(10, threadId), requestContext: requestContext() }),
    ).rejects.toThrow();
    await om.settled();

    expect(completed).not.toHaveBeenCalled();
  });

  it('fires after a successfully completed async-buffered observation cycle', async () => {
    const completed = vi.fn(async () => {});
    const om = createEngine({ onObservationCompleted: completed, bufferTokens: 0.2 });
    const threadId = 'buffered-thread';

    const result = await om.buffer({
      threadId,
      messages: createBulkMessages(10, threadId),
      requestContext: requestContext(),
    });
    await om.waitForBuffering(threadId, undefined, 5000);
    await om.settled();

    expect(result.buffered).toBe(true);
    expect(completed).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ threadId }));
  });

  it('fires after an idle-triggered buffered cycle (the turn.end() shape)', async () => {
    const completed = vi.fn(async () => {});
    const om = createEngine({ onObservationCompleted: completed, bufferTokens: 0.9 });
    const threadId = 'idle-thread';

    // The exact call turn.end() makes for idle buffering (turn.ts): buffer() with
    // skipMinimumTokenCheck, so any non-empty candidate set is observed.
    const result = await om.buffer({
      threadId,
      messages: createBulkMessages(4, threadId),
      requestContext: requestContext(),
      skipMinimumTokenCheck: true,
    });
    await om.waitForBuffering(threadId, undefined, 5000);
    await om.settled();

    expect(result.buffered).toBe(true);
    expect(completed).toHaveBeenCalledOnce();
  });

  it('fires strictly after extractor onExtracted hooks have resolved (race regression)', async () => {
    // The unit twin of the live proof demo: hold the extractor's onExtracted behind a deferred
    // barrier and prove the completion callback cannot run until the barrier releases.
    const events: string[] = [];
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>(resolve => {
      releaseBarrier = resolve;
    });

    const extractor = new Extractor({
      name: 'Priority',
      instructions: 'Extract the priority.',
      onExtracted: async () => {
        events.push('extract-start');
        await barrier;
        events.push('extract-done');
      },
    });

    const completed = vi.fn(async () => {
      events.push('completed');
    });
    const om = createEngine({
      onObservationCompleted: completed,
      extract: [extractor],
      observerModel: createMockModel('<observations>\n* Urgent request\n</observations>\n<priority>high</priority>'),
    });
    const threadId = 'ordered-thread';

    const observing = om.observe({
      threadId,
      messages: createBulkMessages(10, threadId),
      requestContext: requestContext(),
    });

    // Let the pipeline reach the barrier, then verify the completion callback has NOT fired.
    await vi.waitFor(() => expect(events).toContain('extract-start'));
    expect(events).not.toContain('completed');

    releaseBarrier();
    await observing;
    await om.settled();

    expect(events).toEqual(['extract-start', 'extract-done', 'completed']);
  });
});
