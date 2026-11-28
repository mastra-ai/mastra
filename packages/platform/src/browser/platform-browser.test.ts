/**
 * PlatformBrowser against a fake workspace proxy that hands out CDP URLs for a real headless Chromium.
 *
 * The browser tests skip only when no Chromium is installed (`npx playwright-core install chromium-headless-shell`).
 */
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PlatformBrowser } from './index';

interface Call {
  method: string;
  path: string;
  authorization: string | undefined;
  body: unknown;
}

/** Starts a real Chromium the way a vendor would, and returns its CDP URL. */
async function startVendorBrowser(): Promise<{ browser: Browser; cdpUrl: string }> {
  const port = await freePort();
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as {
    webSocketDebuggerUrl: string;
  };
  return { browser, cdpUrl: version.webSocketDebuggerUrl };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

let canLaunch = true;
try {
  await (await startVendorBrowser()).browser.close();
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  canLaunch = false;
}

/** Vendor browsers by session id; ending a session closes its browser. */
const vendorBrowsers = new Map<string, { browser: Browser; cdpUrl: string }>();

let proxy: Server;
let calls: Call[];
let nextId: number;
let failWith: { path: RegExp; status: number; type: string; message: string } | undefined;

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : undefined;
}

beforeAll(async () => {
  proxy = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://proxy').pathname;
    calls.push({ method: req.method!, path, authorization: req.headers.authorization, body: await readBody(req) });
    res.setHeader('content-type', 'application/json');
    if (failWith?.path.test(`${req.method} ${path}`)) {
      res.statusCode = failWith.status;
      res.end(JSON.stringify({ error: { type: failWith.type, message: failWith.message } }));
      return;
    }
    if (req.method === 'POST' && path === '/v1/projects/proj_1/browsers') {
      const id = `brs_${++nextId}`;
      if (canLaunch) vendorBrowsers.set(id, await startVendorBrowser());
      res.statusCode = 201;
      res.end(JSON.stringify({ id, status: 'running' }));
    } else if (req.method === 'POST' && /^\/v1\/projects\/proj_1\/browsers\/[^/]+\/cdp-url$/.test(path)) {
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          url: vendorBrowsers.get(path.split('/')[5]!)?.cdpUrl,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        }),
      );
    } else if (req.method === 'DELETE') {
      const id = path.split('/').pop()!;
      await vendorBrowsers.get(id)?.browser.close();
      vendorBrowsers.delete(id);
      res.end(JSON.stringify({ status: 'ended' }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { type: 'not_found', message: 'Not found' } }));
    }
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  process.env.MASTRA_WORKSPACE_PROXY_URL = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
});

afterAll(async () => {
  delete process.env.MASTRA_WORKSPACE_PROXY_URL;
  await new Promise(resolve => proxy.close(resolve));
  await Promise.all([...vendorBrowsers.values()].map(({ browser }) => browser.close()));
});

beforeEach(() => {
  calls = [];
  nextId = 0;
  failWith = undefined;
});

const options = { accessToken: 'tok_secret', projectId: 'proj_1', environmentId: 'env_1' };
const created = () => calls.filter(call => call.method === 'POST' && call.path.endsWith('/browsers'));
const ended = () => calls.filter(call => call.method === 'DELETE').map(call => call.path.split('/').pop());

describe.skipIf(!canLaunch)('PlatformBrowser with a real browser', () => {
  let browser: PlatformBrowser | undefined;
  afterEach(async () => {
    await browser?.close();
    browser = undefined;
  });

  it('gives each thread its own hosted browser and ends it with the thread', async () => {
    browser = new PlatformBrowser({
      ...options,
      viewport: { width: 1024, height: 768 },
      session: { idleTimeoutSeconds: 120, recording: true },
    });
    await browser.launch();

    const page = await (await browser.getManagerForThread('thread-a')).getPage();
    await page.goto('data:text/html,<title>from platform</title>');
    expect(await page.title()).toBe('from platform');
    await browser.getManagerForThread('thread-b');

    expect(created().map(call => call.body)).toEqual([
      { environmentId: 'env_1', idleTimeoutSeconds: 120, recording: true, viewport: { width: 1024, height: 768 } },
      { environmentId: 'env_1', idleTimeoutSeconds: 120, recording: true, viewport: { width: 1024, height: 768 } },
    ]);
    expect(calls.every(call => call.authorization === 'Bearer tok_secret')).toBe(true);

    await browser.closeThreadSession('thread-a');
    expect(ended()).toEqual(['brs_1']);

    await browser.close();
    browser = undefined;
    expect(ended()).toEqual(['brs_1', 'brs_2']);
  });

  it('shares one hosted browser across threads and ends it on close', async () => {
    browser = new PlatformBrowser({ ...options, scope: 'shared' });
    await browser.launch();
    await browser.getManagerForThread('thread-a');
    await browser.getManagerForThread('thread-b');
    expect(created()).toHaveLength(1);

    await browser.close();
    browser = undefined;
    expect(ended()).toEqual(['brs_1']);
  });
});

describe('PlatformBrowser errors', () => {
  it('says when hosted browsers are off for the project, without leaking the token', async () => {
    failWith = { path: /^POST .*\/browsers$/, status: 404, type: 'not_found', message: 'Hosted browsers are off' };
    const browser = new PlatformBrowser({ ...options, scope: 'shared' });
    const error = await browser.launch().then(
      () => undefined,
      (err: unknown) => err as Error,
    );
    expect(error?.message).toContain('PlatformBrowser: hosted browsers are not available for this project (404)');
    expect(error?.message).not.toContain('tok_secret');
    await browser.close();
  });

  it('says when the org has started too many browsers', async () => {
    failWith = { path: /^POST .*\/browsers$/, status: 429, type: 'rate_limited', message: 'Slow down' };
    const browser = new PlatformBrowser({ ...options, scope: 'shared' });
    await expect(browser.launch()).rejects.toThrow('too many browsers started');
    await browser.close();
  });

  it('ends the browser it started when the CDP URL cannot be minted', async () => {
    failWith = { path: /cdp-url$/, status: 501, type: 'provider_unconfigured', message: 'No relay' };
    const browser = new PlatformBrowser({ ...options, scope: 'shared' });
    await expect(browser.launch()).rejects.toThrow('not configured on this Platform deployment (501)');
    expect(ended()).toEqual(['brs_1']);
    await browser.close();
  });

  it('needs an environment', () => {
    const saved = process.env.MASTRA_ENVIRONMENT_ID;
    delete process.env.MASTRA_ENVIRONMENT_ID;
    try {
      expect(() => new PlatformBrowser({ accessToken: 'tok', projectId: 'proj_1' })).toThrow(
        'PlatformBrowser: environmentId is required',
      );
    } finally {
      if (saved !== undefined) process.env.MASTRA_ENVIRONMENT_ID = saved;
    }
  });
});
