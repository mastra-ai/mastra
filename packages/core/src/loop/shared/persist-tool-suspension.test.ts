import { expect, it, vi } from 'vitest';
import { persistToolSuspension } from './persist-tool-suspension';

it('starts publication in the same continuation as the final cancellation check', async () => {
  let aborted = false;
  const observed: boolean[] = [];
  await persistToolSuspension({
    toolCallId: 'call',
    type: 'suspension',
    addMetadata: vi.fn(),
    flush: async () => {},
    isAborted: () => {
      queueMicrotask(() => {
        aborted = true;
      });
      return aborted;
    },
    publish: () => {
      observed.push(aborted);
    },
  });
  expect(observed).toEqual([false]);
  expect(aborted).toBe(true);
});

it('preserves publication failure as a publication error', async () => {
  const error = new Error('event transport unavailable');
  await expect(
    persistToolSuspension({
      toolCallId: 'call',
      type: 'approval',
      addMetadata: vi.fn(),
      flush: async () => {},
      publish: async () => {
        throw error;
      },
    }),
  ).rejects.toBe(error);
});
