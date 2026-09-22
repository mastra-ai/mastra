import { describe, expect, it, vi } from 'vitest';
import { MastraClient } from './client';

describe('getLiveKitRecording', () => {
  it('uses the root integration path and preserves authentication and fetch configuration', async () => {
    const fetch = vi.fn(async () => Response.json({ status: 'unavailable' }));
    const client = new MastraClient({
      baseUrl: 'https://mastra.example/',
      apiPrefix: '/custom-api',
      headers: { Authorization: 'Bearer session' },
      credentials: 'include',
      fetch,
    });
    await expect(client.getLiveKitRecording('trace/with spaces')).resolves.toEqual({ status: 'unavailable' });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'https://mastra.example/voice/livekit/recordings/trace%2Fwith%20spaces',
      expect.objectContaining({ headers: { Authorization: 'Bearer session' }, credentials: 'include' }),
    );
  });
});
