import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Import after mocks are set up.
const { createSpaStaticMiddleware, resolveUiDistDir } = await import('./spa-static.js');
const { existsSync } = await import('node:fs');
const { readFile, stat } = await import('node:fs/promises');

const originalUiDist = process.env.MASTRACODE_UI_DIST;
const originalProjectRoot = process.env.MASTRA_PROJECT_ROOT;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalUiDist === undefined) delete process.env.MASTRACODE_UI_DIST;
  else process.env.MASTRACODE_UI_DIST = originalUiDist;
  if (originalProjectRoot === undefined) delete process.env.MASTRA_PROJECT_ROOT;
  else process.env.MASTRA_PROJECT_ROOT = originalProjectRoot;
});

describe('resolveUiDistDir', () => {
  beforeEach(() => {
    delete process.env.MASTRACODE_UI_DIST;
    delete process.env.MASTRA_PROJECT_ROOT;
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('resolves factory assets under the server cwd', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/project/src/mastra/public');
    vi.mocked(existsSync).mockImplementation(path => path === '/project/src/mastra/public/factory/index.html');

    expect(resolveUiDistDir()).toBe('/project/src/mastra/public/factory');
  });

  it('prefers the explicit UI dist override', () => {
    process.env.MASTRACODE_UI_DIST = '/custom/factory-ui';
    vi.spyOn(process, 'cwd').mockReturnValue('/project/src/mastra/public');
    vi.mocked(existsSync).mockImplementation(
      path => path === '/custom/factory-ui/index.html' || path === '/project/src/mastra/public/factory/index.html',
    );

    expect(resolveUiDistDir()).toBe('/custom/factory-ui');
  });

  it('falls back to the source layout under MASTRA_PROJECT_ROOT', () => {
    process.env.MASTRA_PROJECT_ROOT = '/project';
    vi.spyOn(process, 'cwd').mockReturnValue('/runtime');
    vi.mocked(existsSync).mockImplementation(path => path === '/project/src/mastra/public/factory/index.html');

    expect(resolveUiDistDir()).toBe('/project/src/mastra/public/factory');
  });

  it('returns undefined when no Factory UI build exists', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/runtime');

    expect(resolveUiDistDir()).toBeUndefined();
  });
});

/** Minimal Hono-like context stub for middleware tests. */
function mockContext(method: string, path: string, accept = '*/*'): any {
  const headers: Record<string, string> = { Accept: accept };
  const resHeaders: Record<string, string> = {};
  let bodyData: Uint8Array | null = null;
  return {
    req: { method, path, header: (name: string) => headers[name] ?? null },
    header(name: string, value: string) {
      resHeaders[name] = value;
    },
    body(data: Uint8Array) {
      bodyData = data;
      return new Response(data, { headers: resHeaders });
    },
    _resHeaders: resHeaders,
    _body: () => bodyData,
  };
}

describe('createSpaStaticMiddleware – path traversal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks traversal attempts that would escape uiDist', async () => {
    // Even though normalize() collapses ".." at root, the startsWith guard
    // must be correct as defense-in-depth. A request for "../ui.key" should
    // never serve a sibling file outside the uiDist directory.
    vi.mocked(readFile).mockResolvedValue(Buffer.from('secret'));
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as any);

    const middleware = createSpaStaticMiddleware('/app/ui');
    const c = mockContext('GET', '/..%2fui.key');
    await middleware(c, async () => {});

    // readFile must not be called with a path outside uiDist.
    const readPath = vi.mocked(readFile).mock.calls[0]?.[0] as string | undefined;
    expect(readPath?.startsWith('/app/ui.key')).not.toBe(true);
  });

  it('serves a legitimate file inside uiDist', async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from('js'));
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as any);

    const middleware = createSpaStaticMiddleware('/app/ui');
    const c = mockContext('GET', '/assets/app.js');
    await middleware(c, async () => {});

    expect(readFile).toHaveBeenCalledWith('/app/ui/assets/app.js');
    expect(c._resHeaders['Content-Type']).toBe('text/javascript; charset=utf-8');
  });

  it('sets immutable cache for hashed assets', async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from('js'));
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as any);

    const middleware = createSpaStaticMiddleware('/app/ui');
    const c = mockContext('GET', '/assets/app-abc123.js');
    await middleware(c, async () => {});

    expect(c._resHeaders['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('sets no-cache for index.html', async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from('<html>'));
    vi.mocked(stat).mockResolvedValue({ isFile: () => false } as any);

    const middleware = createSpaStaticMiddleware('/app/ui');
    const c = mockContext('GET', '/chat', 'text/html');
    await middleware(c, async () => {});

    expect(readFile).toHaveBeenCalledWith('/app/ui/index.html');
    expect(c._resHeaders['Cache-Control']).toBe('no-cache');
  });

  it('passes through server-owned prefixes', async () => {
    const middleware = createSpaStaticMiddleware('/app/ui');
    for (const prefix of ['/api/foo', '/web/bar', '/auth/callback', '/connect/slack']) {
      const c = mockContext('GET', prefix);
      let calledNext = false;
      await middleware(c, async () => {
        calledNext = true;
      });
      expect(calledNext).toBe(true);
    }
  });

  it('passes through non-GET methods', async () => {
    const middleware = createSpaStaticMiddleware('/app/ui');
    const c = mockContext('POST', '/assets/app.js');
    let calledNext = false;
    await middleware(c, async () => {
      calledNext = true;
    });
    expect(calledNext).toBe(true);
    expect(readFile).not.toHaveBeenCalled();
  });
});
