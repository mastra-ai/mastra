/**
 * Once a buffered chunk is stored and its end marker written, failures in the work that follows
 * (observation indexing, the thread title/metadata patch) must not fail the cycle. Failing it
 * would add a buffering-failed marker for a cycle whose chunk is stored and still activates.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';

const OBSERVATION_TEXT = `<observations>
* The deploy key lives at /etc/secrets/deploy-key
</observations>
<thread-title>Deploy key location</thread-title>`;

const threadId = 'post-persist-thread';
const resourceId = 'post-persist-resource';

function createObserverModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: OBSERVATION_TEXT },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as never);
}

function createMessages(count: number): MastraDBMessage[] {
  const base = Date.now() - count * 1000;
  return Array.from({ length: count }, (_, i) => ({
    id: `${threadId}-msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Message ${i}: `.padEnd(200, 'x') }],
    } as MastraMessageContentV2,
    type: 'text',
    createdAt: new Date(base + i * 1000),
    threadId,
    resourceId,
  }));
}

async function bufferingMarkers(storage: InMemoryMemory) {
  const { messages } = await storage.listMessages({ threadId, perPage: false });
  return messages.flatMap(message =>
    (message.content.parts ?? [])
      .map(part => (part as { type: string }).type)
      .filter(type => type === 'data-om-buffering-end' || type === 'data-om-buffering-failed'),
  );
}

// Static maps leak across tests in this package (`isolate: false` in vitest.config.ts).
beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.observationBoundaryOwners.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

describe('failures after a buffered chunk is stored', () => {
  it.each([
    { name: 'observation indexing', failIndexing: true, failThreadPatch: false },
    { name: 'the thread title patch', failIndexing: false, failThreadPatch: true },
  ])('a failure in $name keeps one end marker and an activatable chunk', async ({ failIndexing, failThreadPatch }) => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: { id: threadId, resourceId, title: '', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
    });
    await storage.saveMessages({ messages: createMessages(5) });

    const onIndexObservations = failIndexing
      ? vi.fn().mockRejectedValue(new Error('vector store unavailable'))
      : vi.fn().mockResolvedValue(undefined);
    if (failThreadPatch) {
      // Only the post-persist patch sets the title; other thread patches during buffering pass.
      const patchThread = storage.patchThread.bind(storage);
      vi.spyOn(storage, 'patchThread').mockImplementation(async input => {
        if ('title' in input) throw new Error('thread update failed');
        return patchThread(input);
      });
    }

    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      retrieval: { vector: true },
      onIndexObservations,
      observation: { model: createObserverModel() as never, messageTokens: 500, bufferTokens: 0.2 },
      reflection: { model: createObserverModel() as never, observationTokens: 10_000_000 },
    });

    await om.buffer({ threadId, resourceId });
    await om.waitForBuffering(threadId, resourceId, 5000);

    if (failIndexing) expect(onIndexObservations).toHaveBeenCalled();
    if (failThreadPatch)
      expect(storage.patchThread).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) }));
    expect(await bufferingMarkers(storage)).toEqual(['data-om-buffering-end']);
    expect((await om.getStatus({ threadId, resourceId })).bufferedChunkCount).toBe(1);

    vi.restoreAllMocks();
    const activation = await om.activate({ threadId, resourceId });
    expect(activation.activated).toBe(true);
    const record = await storage.getObservationalMemory(threadId, resourceId);
    expect(record!.activeObservations).toContain('deploy-key');
  });
});
