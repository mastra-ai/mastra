import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

function modelWithObservations(observations: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Expected the streaming observation path');
    },
    doStream: async () => ({
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
    }),
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
      model: modelWithObservations('* User is testing durable observation cursors'),
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
  expect(reflect.mock.calls[0]?.[0].currentRecord.lastObservedAt).toEqual(observedAt);
  expect(result.record.lastObservedAt).toEqual(observedAt);
});
