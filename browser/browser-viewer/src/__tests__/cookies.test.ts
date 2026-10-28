/**
 * setCookies against a real headless Chromium and a real HTTP server that
 * reports the Cookie header it received as the page title.
 */
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { BrowserViewer } from '../browser-viewer';

let canLaunchBrowser = true;
const probe = new BrowserViewer({ cli: 'agent-browser', headless: true });
try {
  await probe.launch('probe');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/Executable doesn't exist|browserType\.launch|Cannot find module|ENOENT/.test(message)) throw error;
  canLaunchBrowser = false;
} finally {
  await probe.close().catch(() => {});
}

describe.skipIf(!canLaunchBrowser)('BrowserViewer.setCookies', () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<title>${req.headers.cookie ?? 'no cookie'}</title>`);
  });
  let origin: string;
  let viewer: BrowserViewer;

  beforeAll(async () => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  afterEach(async () => {
    await viewer?.close();
  }, 10_000);

  const cookie = (value: string) => ({ name: 'preview', value, domain: '127.0.0.1', path: '/' });

  // The CLI drives the browser in production; open a page in the thread's context the same way it would.
  async function titleAt(threadId: string) {
    const context = viewer['threadManager'].getContextForThread(threadId);
    if (!context) throw new Error(`no browser for ${threadId}`);
    const page = await context.newPage();
    await page.goto(origin);
    const title = await page.title();
    await page.close();
    return title;
  }

  it('sends cookies set before the browser starts', async () => {
    viewer = new BrowserViewer({ cli: 'agent-browser', headless: true });

    await viewer.setCookies([cookie('early')], 'thread-1');
    await viewer.launch('thread-1');

    expect(await titleAt('thread-1')).toBe('preview=early');
  }, 30_000);

  it('adds cookies to a running browser, only for that thread', async () => {
    viewer = new BrowserViewer({ cli: 'agent-browser', headless: true });
    await viewer.launch('thread-1');
    await viewer.launch('thread-2');

    await viewer.setCookies([cookie('late')], 'thread-1');

    expect(await titleAt('thread-1')).toBe('preview=late');
    expect(await titleAt('thread-2')).toBe('no cookie');
  }, 30_000);
});
