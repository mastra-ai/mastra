import { FileNotFoundError } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformFilesystem } from './filesystem.js';

function response(body?: BodyInit | null, init?: ResponseInit) {
  return new Response(body, init);
}

describe('PlatformFilesystem', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('writes and reads files through bucket-scoped proxy routes', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(null, { status: 204 }))
      .mockResolvedValueOnce(response('hello', { status: 200 }));

    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    await fs.writeFile('/dir/file.txt', 'hello', { mimeType: 'text/plain' });
    await expect(fs.readFile('/dir/file.txt', { encoding: 'utf8' })).resolves.toBe('hello');

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/fs/dev-bucket/dir/file.txt',
    );
    expect(fetchMock.mock.calls[0]![1].method).toBe('PUT');
    expect((fetchMock.mock.calls[0]![1].headers as Headers).get('content-type')).toBe('text/plain');
    expect((fetchMock.mock.calls[0]![1].headers as Headers).get('authorization')).toBe('Bearer sk_test');
    expect(fetchMock.mock.calls[1]![1].method).toBeUndefined();
  });

  it('copies, moves, and creates directories with proxy operations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(null, { status: 204 }));
    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    await fs.copyFile('/a.txt', '/b.txt');
    await fs.moveFile('/b.txt', '/c.txt');
    await fs.mkdir('/dir');

    expect(String(fetchMock.mock.calls[0]![0])).toContain('/fs/dev-bucket/a.txt?op=copy');
    expect(fetchMock.mock.calls[0]![1].body).toBe(JSON.stringify({ destination: 'b.txt' }));
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/fs/dev-bucket/b.txt?op=rename');
    expect(String(fetchMock.mock.calls[2]![0])).toContain('/fs/dev-bucket/dir?op=mkdir');
  });

  it('percent-encodes reserved URL characters in object key segments', async () => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', 'https://proxy.test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(null, { status: 204 }))
      .mockResolvedValueOnce(response('body', { status: 200 }))
      .mockResolvedValueOnce(response(null, { status: 204 }));

    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    // Reserved URL characters: `?`, `#`, `%`, `&`, ` `, `+`. `/` MUST stay unencoded
    // so it continues to act as a key segment separator on the wire.
    await fs.writeFile('/notes/why?.txt', 'body');
    await fs.readFile('/notes/tag#one.md');
    await fs.deleteFile('/dir with space/a&b.txt');

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/fs/dev-bucket/notes/why%3F.txt',
    );
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/fs/dev-bucket/notes/tag%23one.md',
    );
    expect(String(fetchMock.mock.calls[2]![0])).toBe(
      'https://proxy.test/v1/projects/proj_123/fs/dev-bucket/dir%20with%20space/a%26b.txt',
    );
  });

  it('maps 404 to FileNotFoundError on readFile and stat', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response('not found', { status: 404 }));
    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    await expect(fs.readFile('/missing.txt')).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(fs.stat('/missing.txt')).rejects.toBeInstanceOf(FileNotFoundError);
    // exists() catches the FileNotFoundError from stat() and returns false.
    await expect(fs.exists('/missing.txt')).resolves.toBe(false);
  });

  it('rejects overwrite: false on copy and move because the proxy always overwrites', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(null, { status: 204 }));
    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    await expect(fs.copyFile('/a.txt', '/b.txt', { overwrite: false })).rejects.toThrow(/overwrite: false/);
    await expect(fs.moveFile('/a.txt', '/b.txt', { overwrite: false })).rejects.toThrow(/overwrite: false/);
    // No request should have gone to the proxy when we rejected up front.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
