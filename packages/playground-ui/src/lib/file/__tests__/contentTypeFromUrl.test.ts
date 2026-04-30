import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileContentType } from '../contentTypeFromUrl';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getFileContentType', () => {
  it('returns the content-type header when the HEAD request succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'image/png',
        }),
      }),
    );

    await expect(getFileContentType('https://example.com/image.png')).resolves.toBe('image/png');
  });

  it('falls back to the absolute URL pathname when the HEAD request is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        headers: new Headers(),
      }),
    );

    await expect(getFileContentType('https://example.com/files/report.pdf')).resolves.toBe('application/pdf');
  });

  it('falls back to the absolute URL pathname when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(getFileContentType('https://example.com/files/report.pdf')).resolves.toBe('application/pdf');
  });

  it('returns a MIME type for a relative path when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(getFileContentType('/files/report.pdf')).resolves.toBe('application/pdf');
  });

  it('returns undefined for a malformed string when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(getFileContentType('not a url')).resolves.toBeUndefined();
  });

  it('strips query strings from the raw fallback extension', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(getFileContentType('https://x.dev/a.pdf?token=1')).resolves.toBe('application/pdf');
  });

  it('strips hash fragments from the raw fallback extension', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(getFileContentType('/files/report.pdf#page=2')).resolves.toBe('application/pdf');
  });

  it('normalizes uppercase extensions in the fallback path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(getFileContentType('/FOO.PDF')).resolves.toBe('application/pdf');
  });

  it('returns undefined for an unknown extension in the fallback path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(getFileContentType('/thing.xyz')).resolves.toBeUndefined();
  });
});
