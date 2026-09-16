import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileContentType } from '../contentTypeFromUrl';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getFileContentType', () => {
  it('returns the content-type header when the HEAD request succeeds', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-type': 'image/png',
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(getFileContentType('https://example.com/image.png')).resolves.toBe('image/png');
    // Only the headers are needed, so the body must never be downloaded.
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/image.png', { method: 'HEAD' });
  });

  it('prefers the served content-type over the one the extension implies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/webp' }),
      }),
    );

    // The server re-encodes on the fly, so `.png` in the path is stale.
    await expect(getFileContentType('https://example.com/photo.png')).resolves.toBe('image/webp');
  });

  it('ignores the content-type header of a failed HEAD request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        headers: new Headers({ 'content-type': 'text/html' }),
      }),
    );

    // An error page's own content type says nothing about the file.
    await expect(getFileContentType('https://example.com/files/report.pdf')).resolves.toBe('application/pdf');
  });

  it('falls back to the extension when a successful HEAD carries no content-type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
      }),
    );

    await expect(getFileContentType('https://example.com/files/report.pdf')).resolves.toBe('application/pdf');
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

  it('infers gs:// content type from the extension without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(getFileContentType('gs://my-bucket/clip.mp4')).resolves.toBe('video/mp4');
    // gs:// is not browser-fetchable — we must not attempt a HEAD request.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('infers s3:// content type from the extension without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(getFileContentType('s3://my-bucket/photo.png')).resolves.toBe('image/png');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
