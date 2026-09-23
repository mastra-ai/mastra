import { getMemoryTokenBoundary, mergeMemoryTokenBoundaries } from '@mastra/core/memory';
import type { StorageThreadType } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import { createMemoryTokenBoundaryConformanceTest } from './boundary-conformance';

function createTransactionalFixture() {
  const threads = new Map<string, StorageThreadType>();
  let tail = Promise.resolve();

  const atomic = async <T>(operation: () => T | Promise<T>): Promise<T> => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };

  const createStore = (): MemoryStorage =>
    ({
      saveThread: async ({ thread }) => {
        threads.set(thread.id, structuredClone(thread));
        return structuredClone(thread);
      },
      getThreadById: async ({ threadId, resourceId }) => {
        const thread = threads.get(threadId);
        if (!thread || (resourceId !== undefined && thread.resourceId !== resourceId)) return null;
        return structuredClone(thread);
      },
      advanceMemoryTokenBoundary: input =>
        atomic(() => {
          const thread = threads.get(input.id);
          if (!thread || (input.resourceId !== undefined && thread.resourceId !== input.resourceId)) {
            return { supported: true, thread: null, boundary: undefined };
          }
          const boundary = mergeMemoryTokenBoundaries(getMemoryTokenBoundary(thread), input.candidate);
          thread.metadata = { ...thread.metadata, memoryTokenLimiter: boundary };
          thread.updatedAt = new Date();
          return { supported: true, thread: structuredClone(thread), boundary };
        }),
    }) as MemoryStorage;

  return { first: createStore(), second: createStore() };
}

createMemoryTokenBoundaryConformanceTest({
  createStores: createTransactionalFixture,
  repetitions: 10,
});
