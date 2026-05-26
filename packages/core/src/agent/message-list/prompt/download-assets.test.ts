import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraError } from '../../../error';
import { downloadFromUrl } from './download-assets';

describe('downloadFromUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mockRetryDelays() {
    const delays: number[] = [];

    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, delay?: number) => {
      if (delay && delay > 100) {
        delays.push(delay);
      }
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    return delays;
  }

  it('should not retry client error responses', async () => {
    const delays = mockRetryDelays();
    const mockFetch = vi.fn().mockResolvedValue(new Response('not found', { status: 404, statusText: 'Not Found' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      downloadFromUrl({ url: new URL('https://example.com/missing.png'), downloadRetries: 3 }),
    ).rejects.toThrow('Failed to download asset');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('includes the failing URL in the error message and details on non-OK response', async () => {
    mockRetryDelays();
    const mockFetch = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403, statusText: 'Forbidden' }));
    vi.stubGlobal('fetch', mockFetch);

    const url = 'https://example.com/blocked.png';
    let caught: unknown;
    try {
      await downloadFromUrl({ url: new URL(url), downloadRetries: 1 });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(MastraError);
    const error = caught as MastraError;
    expect(error.id).toBe('DOWNLOAD_ASSETS_FAILED');
    expect(error.message).toBe(`Failed to download asset: ${url}`);
    expect(error.details).toEqual({ url });
  });

  it('includes the failing URL in the error message and details on fetch rejection', async () => {
    mockRetryDelays();
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', mockFetch);

    const url = 'https://example.com/unreachable.png';
    let caught: unknown;
    try {
      await downloadFromUrl({ url: new URL(url), downloadRetries: 1 });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(MastraError);
    const error = caught as MastraError;
    expect(error.id).toBe('DOWNLOAD_ASSETS_FAILED');
    expect(error.message).toBe(`Failed to download asset: ${url}`);
    expect(error.details).toEqual({ url });
    // The original fetch error is preserved on cause for debugging.
    expect((error.cause as Error | undefined)?.message).toBe('fetch failed');
  });

  it('should retry server error responses', async () => {
    const delays = mockRetryDelays();
    const response = new Response('image-data', {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('server error', { status: 500, statusText: 'Server Error' }))
      .mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      downloadFromUrl({ url: new URL('https://example.com/image.png'), downloadRetries: 3 }),
    ).resolves.toEqual({
      data: new Uint8Array(await new Response('image-data').arrayBuffer()),
      mediaType: 'image/png',
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([2000]);
  });
});
