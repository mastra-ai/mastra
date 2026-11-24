import { afterEach, describe, expect, it } from 'vitest';
import { closeRefreshStreams, getTriggerClientsRefreshPayload, handleClientsRefreshRequest } from '../client';

describe('refresh clients', () => {
  afterEach(() => {
    closeRefreshStreams();
  });

  it('identifies the server even when a client connects after the refresh broadcast', async () => {
    expect(getTriggerClientsRefreshPayload().clients).toBe(0);
    const first = handleClientsRefreshRequest(new AbortController().signal, 'dev-instance').body!.getReader();
    const second = handleClientsRefreshRequest(new AbortController().signal, 'dev-instance').body!.getReader();
    const connected = await first.read();
    expect(connected.value).toMatch(/^id: [^\n]+\ndata: connected\n\n$/);
    expect(await second.read()).toEqual(connected);
    getTriggerClientsRefreshPayload();
    expect(await first.read()).toEqual({ done: false, value: 'data: refresh\n\n' });
  });

  it('closes every active refresh stream', async () => {
    const firstReader = handleClientsRefreshRequest(new AbortController().signal).body!.getReader();
    const secondReader = handleClientsRefreshRequest(new AbortController().signal).body!.getReader();

    const connected = await firstReader.read();
    expect(connected).toEqual({ done: false, value: 'data: connected\n\n' });
    expect(await secondReader.read()).toEqual(connected);

    closeRefreshStreams();

    expect(await firstReader.read()).toEqual({ done: true, value: undefined });
    expect(await secondReader.read()).toEqual({ done: true, value: undefined });
  });
});
