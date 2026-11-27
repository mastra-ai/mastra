import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSystemChromePath } from '@internal/browser-test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraProject, PlatformBrowser } from '../index';
import type { PlatformBrowserSession } from '../index';

const TOKEN = 'project-token';
const PROJECT_ID = 'proj_1';
const CHROME = getSystemChromePath();

/** A headless Chrome serving CDP: the browser a hosted session's CDP URL leads to. */
async function launchChrome(executable: string) {
  const profile = mkdtempSync(join(tmpdir(), 'platform-browser-'));
  const chrome = spawn(
    executable,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const wsUrl = await new Promise<string>((resolve, reject) => {
    let output = '';
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]!);
    });
    chrome.once('exit', code => reject(new Error(`Chrome exited with ${code}: ${output}`)));
  });
  return {
    wsUrl,
    async close() {
      if (chrome.exitCode === null) {
        const exited = new Promise(resolve => chrome.once('exit', resolve));
        chrome.kill();
        await exited;
      }
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

/**
 * A stand-in for the workspace proxy's hosted browser routes (`/v1/projects/:projectId/browsers`).
 * Sessions start running; a CDP URL is only issued for a running one, and leads to `cdpTarget`.
 */
function browserProxy() {
  const sessions = new Map<string, PlatformBrowserSession>();
  const requests: string[] = [];
  let nextId = 1;
  const state = { cdpTarget: '' };

  function send(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url!, 'http://proxy');
    const method = req.method!;
    requests.push(`${method} ${url.pathname}`);
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      return send(res, 401, { error: { type: 'authentication_error', message: 'Unauthorized' } });
    }
    const match = url.pathname.match(/^\/v1\/projects\/([^/]+)\/browsers(?:\/([^/]+))?(?:\/([^/]+))?$/);
    if (!match || match[1] !== PROJECT_ID) return send(res, 404, { error: { type: 'not_found', message: 'nope' } });
    const [, , sessionId, action] = match;
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};

    if (sessionId === 'capabilities') {
      return send(res, 200, {
        region: 'us',
        stealth: true,
        liveView: { readOnly: false },
        recording: { formats: ['rrweb'] },
        activityLog: true,
        maxIdleTimeoutSeconds: 3600,
        maxDurationSeconds: 21600,
      });
    }
    if (sessionId === 'usage') {
      const environmentId = url.searchParams.get('environmentId');
      const inEnv = [...sessions.values()].filter(s => s.environmentId === environmentId);
      return send(res, 200, {
        since: '2026-10-28T00:00:00.000Z',
        until: '2026-11-27T00:00:00.000Z',
        sessions: inEnv.length,
        failed: 0,
        live: inEnv.filter(s => s.status === 'running').length,
        browserSeconds: Number(url.searchParams.get('days')) * 10,
      });
    }
    if (!sessionId && method === 'POST') {
      if (!body.environmentId) return send(res, 400, { error: { type: 'invalid_request', message: 'environmentId' } });
      const now = new Date().toISOString();
      const session: PlatformBrowserSession = {
        id: `brs_${nextId++}`,
        environmentId: body.environmentId,
        platformProjectId: PROJECT_ID,
        provider: 'browserbase',
        region: 'us',
        status: 'running',
        endReason: null,
        error: null,
        idleTimeoutSeconds: body.idleTimeoutSeconds ?? 300,
        maxDurationSeconds: body.maxDurationSeconds ?? null,
        viewport: body.viewport ?? null,
        stealth: body.stealth ?? false,
        recording: body.recording ?? true,
        startedAt: now,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      sessions.set(session.id, session);
      return send(res, 201, session);
    }
    if (!sessionId && method === 'GET') {
      const environmentId = url.searchParams.get('environmentId');
      const page = Number(url.searchParams.get('page'));
      const all = [...sessions.values()].filter(s => s.environmentId === environmentId).reverse();
      return send(res, 200, {
        browserSessions: all.slice((page - 1) * 2, page * 2),
        hasMore: all.length > page * 2,
        pageSize: 2,
      });
    }
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) return send(res, 404, { error: { type: 'not_found', message: 'Browser session not found' } });
    if (!action && method === 'GET') return send(res, 200, session);
    if (!action && method === 'DELETE') {
      Object.assign(session, { status: 'ended', endReason: 'user', endedAt: new Date().toISOString() });
      return send(res, 200, session);
    }
    if (action === 'cdp-url' || action === 'live-view') {
      if (session.status !== 'running') {
        return send(res, 409, { error: { type: 'invalid_request', message: 'Browser session is not running' } });
      }
      return action === 'cdp-url'
        ? send(res, 200, {
            url: state.cdpTarget,
            expiresAt: new Date(Date.now() + (body.ttlSeconds ?? 300) * 1000).toISOString(),
          })
        : send(res, 200, { url: `https://live.example/${session.id}?readOnly=${body.readOnly}`, expiresAt: null });
    }
    if (action === 'activity') {
      return send(res, 200, {
        entries: [
          {
            at: session.createdAt,
            kind: 'navigation',
            level: 'info',
            message: 'Navigated',
            url: 'https://example.com/',
            details: null,
          },
        ],
        nextCursor: url.searchParams.get('cursor') ? null : 'next',
      });
    }
    if (action === 'recordings') {
      return send(res, 200, {
        recordings: [
          { recordingId: 'rec_1', format: 'rrweb', status: 'ready', startedAt: session.startedAt, endedAt: null },
        ],
      });
    }
    return send(res, 404, { error: { type: 'not_found', message: `no route for ${method} ${url.pathname}` } });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(error => send(res, 500, { error: { type: 'server_error', message: String(error) } }));
  });
  return { server, sessions, requests, state };
}

describe('Platform hosted browsers', () => {
  let proxy: ReturnType<typeof browserProxy>;
  let proxyUrl: string;

  beforeAll(async () => {
    proxy = browserProxy();
    await new Promise<void>(resolve => proxy.server.listen(0, '127.0.0.1', resolve));
    const address = proxy.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
    proxyUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => proxy.server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.stubEnv('MASTRA_WORKSPACE_PROXY_URL', proxyUrl);
    proxy.requests.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const project = (accessToken = TOKEN) => new MastraProject({ accessToken, projectId: PROJECT_ID, apiUrl: proxyUrl });

  it('lists, reads, and reports on sessions', async () => {
    const { browsers } = project();
    const first = await browsers.create({ environmentId: 'env_list', idleTimeoutSeconds: 60, stealth: true });
    expect(first).toMatchObject({ status: 'running', idleTimeoutSeconds: 60, stealth: true });
    await browsers.create({ environmentId: 'env_list' });
    await browsers.create({ environmentId: 'env_list' });

    // Three sessions over two pages, newest first.
    expect((await browsers.list('env_list')).map(s => s.id)).toEqual(
      [...proxy.sessions.values()]
        .filter(s => s.environmentId === 'env_list')
        .map(s => s.id)
        .reverse(),
    );
    expect(await browsers.get(first.id)).toEqual(first);
    expect((await browsers.capabilities()).liveView).toEqual({ readOnly: false });
    expect(await browsers.usage('env_list', { days: 7 })).toMatchObject({ sessions: 3, live: 3, browserSeconds: 70 });
    expect((await browsers.activity(first.id)).nextCursor).toBe('next');
    expect((await browsers.activity(first.id, { cursor: 'next', limit: 10 })).nextCursor).toBeNull();
    expect(await browsers.recordings(first.id)).toEqual([expect.objectContaining({ recordingId: 'rec_1' })]);
    expect((await browsers.liveView(first.id, { readOnly: false })).url).toBe(
      `https://live.example/${first.id}?readOnly=false`,
    );
    expect((await browsers.cdpUrl(first.id, { ttlSeconds: 60 })).expiresAt).toEqual(expect.any(String));

    expect(await browsers.end(first.id)).toMatchObject({ status: 'ended', endReason: 'user' });
    await expect(browsers.cdpUrl(first.id)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a request made with a token the proxy does not accept', async () => {
    await expect(project('sk_wrong').browsers.capabilities()).rejects.toMatchObject({ status: 401 });
  });

  it('needs an environment to start a session', () => {
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', '');
    expect(() => new PlatformBrowser({ accessToken: TOKEN, projectId: PROJECT_ID })).toThrow(
      'PlatformBrowser: environmentId is required',
    );
  });

  describe.skipIf(!CHROME)('with a real browser', () => {
    let chrome: Awaited<ReturnType<typeof launchChrome>>;
    const opened: PlatformBrowser[] = [];

    beforeEach(async () => {
      chrome = await launchChrome(CHROME!);
      proxy.state.cdpTarget = chrome.wsUrl;
    });

    afterEach(async () => {
      for (const browser of opened.splice(0)) await browser.close().catch(() => {});
      await chrome.close();
    });

    async function visit(browser: PlatformBrowser, title: string) {
      const url = `data:text/html,<title>${title}</title>`;
      // What the browser tools do before each action.
      await browser.ensureReady();
      expect(await browser.navigate({ url })).toMatchObject({ success: true, title });
      expect(await browser.getCurrentUrl()).toBe(url);
    }

    it('starts a session and drives the browser it leads to', async () => {
      const browser = await project().createBrowser({ environmentId: 'env_1', session: { idleTimeoutSeconds: 60 } });
      opened.push(browser);

      expect(browser.sessionId).toMatch(/^brs_/);
      expect(proxy.sessions.get(browser.sessionId!)).toMatchObject({ environmentId: 'env_1', idleTimeoutSeconds: 60 });
      await visit(browser, 'started');
    });

    it('connects to a running session by ID, and refuses one that has ended', async () => {
      // Even with an environment to start a replacement in.
      vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'env_1');
      const platform = project();
      const session = await platform.browsers.create({ environmentId: 'env_1' });

      const browser = await platform.getBrowser(session.id);
      opened.push(browser);
      expect(browser.sessionId).toBe(session.id);
      await visit(browser, 'reattached');

      await platform.browsers.end(session.id);
      const started = proxy.sessions.size;
      await expect(platform.getBrowser(session.id)).rejects.toThrow();
      // It didn't start a replacement.
      expect(proxy.sessions.size).toBe(started);
    });

    it('starts another session when the one it started has ended', async () => {
      vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'env_from_env');
      const browser = new PlatformBrowser({ accessToken: TOKEN, projectId: PROJECT_ID });
      opened.push(browser);
      expect(browser.sessionId).toBeUndefined();

      await visit(browser, 'first');
      const first = browser.sessionId!;
      expect(proxy.sessions.get(first)?.environmentId).toBe('env_from_env');

      await browser.close();
      await project().browsers.end(first);
      // The next session is a different browser.
      await chrome.close();
      chrome = await launchChrome(CHROME!);
      proxy.state.cdpTarget = chrome.wsUrl;

      await visit(browser, 'second');
      expect(browser.sessionId).not.toBe(first);
      expect(proxy.sessions.get(browser.sessionId!)?.status).toBe('running');
    });

    it('connects to a supplied CDP URL without calling the Platform', async () => {
      vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
      vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
      const browser = new PlatformBrowser({ cdpUrl: chrome.wsUrl });
      opened.push(browser);

      await visit(browser, 'direct');
      expect(browser.sessionId).toBeUndefined();
      expect(proxy.requests).toEqual([]);
    });
  });
});
