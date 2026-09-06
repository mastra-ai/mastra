import { afterEach, describe, expect, it } from 'vitest';
import { closeRefreshStreams, handleClientsRefreshRequest } from '../client';

describe('refresh clients', () => {
  afterEach(() => {
    closeRefreshStreams();
  });

  it('closes every active refresh stream', async () => {
    const firstReader = handleClientsRefreshRequest(new AbortController().signal).body!.getReader();
    const secondReader = handleClientsRefreshRequest(new AbortController().signal).body!.getReader();

    expect(await firstReader.read()).toEqual({ done: false, value: 'data: connected\n\n' });
    expect(await secondReader.read()).toEqual({ done: false, value: 'data: connected\n\n' });

    closeRefreshStreams();

    expect(await firstReader.read()).toEqual({ done: true, value: undefined });
    expect(await secondReader.read()).toEqual({ done: true, value: undefined });
  });
});
