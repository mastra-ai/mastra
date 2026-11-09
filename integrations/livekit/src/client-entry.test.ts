import { MastraClient, MastraClientError } from '@mastra/client-js';
import { describe, expect, it, vi } from 'vitest';
import { getLiveKitRecording } from './client-entry';
import type { LiveKitRecordingResponse } from './client-entry';

// Browser consumers must never load LiveKit's server or worker runtimes.
vi.mock('livekit-server-sdk', () => {
  throw new Error('client entry loaded livekit-server-sdk');
});
vi.mock('@livekit/protocol', () => {
  throw new Error('client entry loaded @livekit/protocol');
});
vi.mock('@livekit/agents', () => {
  throw new Error('client entry loaded @livekit/agents');
});
vi.mock('@livekit/agents-plugin-livekit', () => {
  throw new Error('client entry loaded a worker plugin');
});
vi.mock('@livekit/agents-plugin-silero', () => {
  throw new Error('client entry loaded a worker plugin');
});

const readyRecording: LiveKitRecordingResponse = {
  status: 'ready',
  url: 'https://recordings.example/call.ogg',
  expiresAt: '2026-10-06T18:00:00Z',
};

describe('getLiveKitRecording', () => {
  it('uses the root integration path and preserves authentication and custom fetch configuration', async () => {
    const fetch = vi.fn(async () => Response.json(readyRecording));
    const client = new MastraClient({
      baseUrl: 'https://mastra.example/',
      apiPrefix: '/custom-api',
      headers: { Authorization: 'Bearer session' },
      credentials: 'include',
      fetch,
    });
    await expect(getLiveKitRecording(client, 'trace/with spaces')).resolves.toEqual(readyRecording);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'https://mastra.example/voice/livekit/recordings/trace%2Fwith%20spaces',
      expect.objectContaining({ headers: { Authorization: 'Bearer session' }, credentials: 'include' }),
    );
    expect(client.options.apiPrefix).toBe('/custom-api');
    await client.getSystemPackages();
    expect(fetch).toHaveBeenLastCalledWith('https://mastra.example/custom-api/system/packages', expect.anything());
  });

  it('returns unavailable recordings without manufacturing a playback URL', async () => {
    const recording: LiveKitRecordingResponse = { status: 'unavailable' };
    const client = new MastraClient({ baseUrl: 'https://mastra.example', fetch: async () => Response.json(recording) });
    await expect(getLiveKitRecording(client, 'trace')).resolves.toEqual(recording);
  });

  it.each([403, 502])('preserves SDK errors and does not retry a recording request with status %s', async status => {
    const fetch = vi.fn(async () => Response.json({ error: 'Unable to load recording.' }, { status }));
    const client = new MastraClient({ baseUrl: 'https://mastra.example', retries: 3, fetch });
    const result = getLiveKitRecording(client, 'trace');
    await expect(result).rejects.toBeInstanceOf(MastraClientError);
    await expect(result).rejects.toMatchObject({ status });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(['client', 'request'])('honors an aborted %s signal before making a request', async source => {
    const controller = new AbortController();
    const error = new DOMException('Cancelled', 'AbortError');
    controller.abort(error);
    const fetch = vi.fn(async () => Response.json(readyRecording));
    const client = new MastraClient({
      baseUrl: 'https://mastra.example',
      fetch,
      abortSignal: source === 'client' ? controller.signal : undefined,
    });
    await expect(
      getLiveKitRecording(client, 'trace', {
        signal: source === 'request' ? controller.signal : undefined,
      }),
    ).rejects.toBe(error);
    expect(fetch).not.toHaveBeenCalled();
  });
});
