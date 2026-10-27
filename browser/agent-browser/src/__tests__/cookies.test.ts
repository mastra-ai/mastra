/**
 * setCookies against a real headless Chromium and a real HTTP server that
 * reports the Cookie header it received as the page title.
 */
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AgentBrowser } from '../agent-browser';

let canLaunchBrowser = true;
const probe = new AgentBrowser({ headless: true, scope: 'shared' });
try {
  await probe.ensureReady();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/Executable doesn't exist|browserType\.launch|Cannot find module|ENOENT/.test(message)) throw error;
  canLaunchBrowser = false;
} finally {
  await probe.close().catch(() => {});
}

describe.skipIf(!canLaunchBrowser)('AgentBrowser.setCookies', () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<title>${req.headers.cookie ?? 'no cookie'}</title>`);
  });
  let origin: string;
  let browser: AgentBrowser;

  beforeAll(async () => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  afterEach(async () => {
    await browser?.close();
  }, 10_000);

  const cookie = (value: string) => ({ name: 'preview', value, domain: '127.0.0.1', path: '/' });

  async function titleAt(url: string, threadId: string) {
    const result = await browser.goto({ url }, threadId);
    if (!('title' in result)) throw new Error(JSON.stringify(result));
    return result.title;
  }

  it('sends cookies set before the browser starts', async () => {
    browser = new AgentBrowser({ headless: true, timeout: 15_000, scope: 'thread' });

    await browser.setCookies([cookie('early')], 'thread-1');

    expect(await titleAt(origin, 'thread-1')).toBe('preview=early');
  }, 30_000);

  it('adds cookies to a running browser, only for that thread', async () => {
    browser = new AgentBrowser({ headless: true, timeout: 15_000, scope: 'thread' });
    expect(await titleAt(origin, 'thread-1')).toBe('no cookie');
    expect(await titleAt(origin, 'thread-2')).toBe('no cookie');

    await browser.setCookies([cookie('late')], 'thread-1');

    expect(await titleAt(origin, 'thread-1')).toBe('preview=late');
    expect(await titleAt(origin, 'thread-2')).toBe('no cookie');
  }, 30_000);
});
