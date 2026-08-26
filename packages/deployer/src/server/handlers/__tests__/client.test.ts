import type { Context } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { closeRefreshStreams, handleClientsRefresh } from '../client';

function createContext(): Context {
  const request = new Request('http://localhost/__refresh');
  return { req: { raw: request } } as unknown as Context;
}

describe('refresh clients', () => {
  afterEach(() => {
    closeRefreshStreams();
  });

  it('closes every active refresh stream', async () => {
    const firstReader = handleClientsRefresh(createContext()).body!.getReader();
    const secondReader = handleClientsRefresh(createContext()).body!.getReader();

    expect(await firstReader.read()).toEqual({ done: false, value: 'data: connected\n\n' });
    expect(await secondReader.read()).toEqual({ done: false, value: 'data: connected\n\n' });

    closeRefreshStreams();

    expect(await firstReader.read()).toEqual({ done: true, value: undefined });
    expect(await secondReader.read()).toEqual({ done: true, value: undefined });
  });
});
