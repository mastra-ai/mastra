import { FileNotFoundError } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformFilesystem } from './filesystem.js';

function response(body?: BodyInit | null, init?: ResponseInit) {
  return new Response(body, init);
}

describe('PlatformFilesystem', () => {
  beforeEach(() => {
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
  });

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
      'https://proxy.test/v1/railway/projects/proj_123/fs/dev-bucket/dir/file.txt',
    );
    expect(fetchMock.mock.calls[0]![1].method).toBe('PUT');
    expect((fetchMock.mock.calls[0]![1].headers as Headers).get('content-type')).toBe('text/plain');
    expect((fetchMock.mock.calls[0]![1].headers as Headers).get('authorization')).toBe('Bearer sk_test');
    expect(fetchMock.mock.calls[1]![1].method).toBeUndefined();
  });

  it('uses the regional workspace proxy URL for filesystem requests', async () => {
    vi.stubEnv('SANDBOX_PROVIDER', 'e2b');
    vi.stubEnv('MASTRA_PLATFORM_REGION', 'us');
    const fetchMock = vi.fn().mockResolvedValueOnce(response('hello', { status: 200 }));

    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    await expect(fs.readFile('/dir/file.txt', { encoding: 'utf8' })).resolves.toBe('hello');

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://workspaces.us.mastra.ai/v1/e2b/projects/proj_123/fs/dev-bucket/dir/file.txt',
    );
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
      'https://proxy.test/v1/railway/projects/proj_123/fs/dev-bucket/notes/why%3F.txt',
    );
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/fs/dev-bucket/notes/tag%23one.md',
    );
    expect(String(fetchMock.mock.calls[2]![0])).toBe(
      'https://proxy.test/v1/railway/projects/proj_123/fs/dev-bucket/dir%20with%20space/a%26b.txt',
    );
  });

  it('maps 404 to FileNotFoundError on readFile and stat', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string | URL) =>
        String(url).includes('delimiter=')
          ? response(JSON.stringify({ contents: [], commonPrefixes: [] }), { status: 200 })
          : response('not found', { status: 404 }),
      );
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

  it('reports prefix-only paths as directories so nested folders can be opened', async () => {
    // Emulates the workspace proxy's GET dispatch (servers/workspace-proxy
    // fs-routes): a GET only reaches the list handler when the URL path key is
    // empty or ends with `/`. Any other key is a GetObject and 404s unless
    // that exact object exists — folders exist only as key prefixes.
    const objects: Record<string, string> = { 'foo/': '', 'foo/bar.md': 'abc' };
    const list = (prefix: string) => {
      const contents: Array<{ key: string; size: number }> = [];
      const commonPrefixes = new Set<string>();
      for (const [key, body] of Object.entries(objects)) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) contents.push({ key, size: body.length });
        else commonPrefixes.add(`${prefix}${rest.slice(0, slash + 1)}`);
      }
      return response(JSON.stringify({ contents, commonPrefixes: [...commonPrefixes] }), { status: 200 });
    };
    const fetchMock = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
      const u = new URL(String(url));
      const key = decodeURIComponent(u.pathname.split('/fs/dev-bucket/')[1] ?? '');
      if (init?.method === 'HEAD') {
        return key in objects
          ? response(null, { status: 200, headers: { 'content-length': String(objects[key]!.length) } })
          : response('not found', { status: 404 });
      }
      if (!key || key.endsWith('/')) return list(u.searchParams.get('prefix') ?? key);
      return key in objects ? response(objects[key], { status: 200 }) : response('not found', { status: 404 });
    });
    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    await expect(fs.stat('/foo')).resolves.toMatchObject({ name: 'foo', path: '/foo', type: 'directory' });
    await expect(fs.exists('foo')).resolves.toBe(true);
    await expect(fs.readdir('/foo')).resolves.toEqual([{ name: 'bar.md', type: 'file', size: 3 }]);
    await expect(fs.readdir('/')).resolves.toEqual([{ name: 'foo', type: 'directory' }]);
  });

  it('does not list when HEAD finds a file', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(null, { status: 200, headers: { 'content-length': '4' } }));
    const fs = new PlatformFilesystem({
      accessToken: 'sk_test',
      projectId: 'proj_123',
      bucketName: 'dev-bucket',
      fetch: fetchMock,
    });
    await fs._init();

    await expect(fs.stat('/a.txt')).resolves.toMatchObject({ type: 'file', size: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
