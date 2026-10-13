import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

function modelWithObservations(observations: string, gate?: () => Promise<void>) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Expected the streaming observation path');
    },
    doStream: async () => {
      if (gate) await gate();
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: `<observations>${observations}</observations>` },
          { type: 'text-end', id: 'text' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

it('preserves the just-persisted observation cursor when reflection reads detached records', async () => {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  const getRecord = storage.getObservationalMemory.bind(storage);
  // SQL adapters return detached records rather than sharing mutable in-memory objects.
  vi.spyOn(storage, 'getObservationalMemory').mockImplementation(async (...args) => {
    const record = await getRecord(...args);
    return record ? { ...record } : record;
  });
  const reflect = vi.spyOn(storage, 'createReflectionGeneration');
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: {
      model: modelWithObservations(
        Array.from({ length: 12 }, (_, i) => `* Observation ${i}: ${'useful background context '.repeat(8)}`).join(
          '\n',
        ),
      ),
      messageTokens: 100,
      bufferTokens: false,
      observeAttachments: false,
      threadTitle: false,
    },
    reflection: {
      model: modelWithObservations('* User is testing reflection snapshot cursors'),
      observationTokens: 200,
    },
  });
  await om.getOrCreateRecord('cursor-test');
  const observedAt = new Date('2026-01-01T00:00:00.000Z');
  const result = await om.observe({
    threadId: 'cursor-test',
    messages: [
      {
        id: 'message-1',
        role: 'user',
        type: 'text',
        createdAt: observedAt,
        content: { format: 2, parts: [{ type: 'text', text: 'background information '.repeat(400) }] },
      },
    ],
  });

  expect(result.observed).toBe(true);
  expect(result.reflected).toBe(true);
  expect(reflect).toHaveBeenCalledOnce();
  // The regression under test (snapshot consistency): the record handed to
  // createReflectionGeneration must carry the cursor this cycle persisted.
  expect(reflect.mock.calls[0]?.[0].currentRecord.lastObservedAt).toEqual(observedAt);
  // Durable-cursor sanity, NOT the regression: current adapters re-read the
  // stored row when creating the generation, so this held even without the fix.
  expect(result.record.lastObservedAt).toEqual(observedAt);
});

it('passes the later committed cursor to reflection when another writer already covered the cycle', async () => {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  const getRecord = storage.getObservationalMemory.bind(storage);
  // SQL adapters return detached records rather than sharing mutable in-memory objects.
  vi.spyOn(storage, 'getObservationalMemory').mockImplementation(async (...args) => {
    const record = await getRecord(...args);
    return record ? { ...record } : record;
  });
  const reflect = vi.spyOn(storage, 'createReflectionGeneration');

  // The concurrent commit must land mid-cycle: after this cycle selected its messages
  // (the Observer is streaming) but before the commit loop reads the head.
  const committedCursor = new Date('2026-01-02T00:00:00.000Z');
  let commitConcurrently!: () => Promise<void>;
  const observerGate = () => commitConcurrently();
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: {
      model: modelWithObservations('* This cycle observed the message too', observerGate),
      messageTokens: 100,
      bufferTokens: false,
      observeAttachments: false,
      threadTitle: false,
    },
    reflection: {
      model: modelWithObservations('* User is testing covered-cycle cursors'),
      observationTokens: 200,
    },
  });
  const record = await om.getOrCreateRecord('covered-test');

  // "Another instance" commits the same message with a LATER cursor while the Observer streams.
  commitConcurrently = async () => {
    await storage.commitActiveObservations({
      id: record.id,
      observations: Array.from(
        { length: 12 },
        (_, i) => `* Observation ${i}: ${'committed elsewhere context '.repeat(8)}`,
      ).join('\n'),
      tokenCount: 500,
      lastObservedAt: committedCursor,
      observedMessageIds: ['message-1'],
    });
  };

  const observedAt = new Date('2026-01-01T00:00:00.000Z');
  const result = await om.observe({
    threadId: 'covered-test',
    messages: [
      {
        id: 'message-1',
        role: 'user',
        type: 'text',
        createdAt: observedAt,
        content: { format: 2, parts: [{ type: 'text', text: 'background information '.repeat(400) }] },
      },
    ],
  });

  // The cycle was already covered, so nothing of ours landed — but reflection still runs
  // against the head and must see the head's later cursor, not this cycle's message timestamp.
  expect(result.observed).toBe(true);
  expect(result.reflected).toBe(true);
  expect(reflect).toHaveBeenCalledOnce();
  expect(reflect.mock.calls[0]?.[0].currentRecord.lastObservedAt).toEqual(committedCursor);
  expect(result.record.lastObservedAt).toEqual(committedCursor);
});
