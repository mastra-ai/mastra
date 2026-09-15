import { describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../request-context';
import { getMemoryRunState, MemoryRunState } from './run-state';

describe('MemoryRunState', () => {
  it('deduplicates concurrent loads and retries rejected loads', async () => {
    let rejectFirst!: (error: Error) => void;
    const loader = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce('loaded');
    const state = new MemoryRunState({ memory: {} });

    const first = state.load('key', loader);
    const duplicate = state.load('key', loader);
    expect(loader).toHaveBeenCalledTimes(1);

    rejectFirst(new Error('failed'));
    await expect(first).rejects.toThrow('failed');
    await expect(duplicate).rejects.toThrow('failed');
    await expect(state.load('key', loader)).resolves.toBe('loaded');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('only returns state matching the active memory scope', () => {
    const memory = {};
    const state = new MemoryRunState({ memory, threadId: 'thread-1', resourceId: 'resource-1' });
    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', {
      thread: { id: 'thread-1' },
      resourceId: 'resource-1',
      runState: () => state,
    });

    expect(getMemoryRunState(requestContext, memory, 'thread-1', 'resource-1')).toBe(state);
    expect(getMemoryRunState(requestContext, memory, 'thread-2', 'resource-1')).toBeUndefined();
    expect(getMemoryRunState(requestContext, {}, 'thread-1', 'resource-1')).toBeUndefined();
  });
});
