/**
 * setCookies against a real headless Chromium and a real HTTP server that
 * reports the Cookie header it received as the page title.
 */
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromium } from 'playwright-core';
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

  it('sends cookies set before connecting to an external browser', async () => {
    const port = 9300 + Math.floor(Math.random() * 500);
    const external = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${port}`] });
    try {
      viewer = new BrowserViewer({ cli: 'agent-browser', headless: true, scope: 'thread' });

      await viewer.setCookies([cookie('external')], 'thread-1');
      await viewer.connectToExternalCdp(`http://127.0.0.1:${port}`, 'thread-1');

      expect(await titleAt('thread-1')).toBe('preview=external');
    } finally {
      await external.close();
    }
  }, 30_000);

  it('adds waiting cookies before telling ready listeners the browser is ready', async () => {
    for (const scope of ['shared', 'thread'] as const) {
      viewer = new BrowserViewer({ cli: 'agent-browser', headless: true, scope });
      await viewer.setCookies([cookie(scope)], 'thread-1');
      viewer.setCurrentThread('thread-1');
      // Read the cookie jar the moment the listener runs, as a listener that navigates right away would.
      const seen = new Promise<string[]>(resolve => {
        viewer.onBrowserReady(
          () => {
            const context = viewer['threadManager'].getContextForThread('thread-1')!;
            resolve(context.cookies().then(cookies => cookies.map(c => `${c.name}=${c.value}`)));
          },
          scope === 'thread' ? 'thread-1' : undefined,
        );
      });

      await viewer.launch('thread-1');

      expect(await seen).toEqual([`preview=${scope}`]);
      await viewer.close();
    }
  }, 60_000);

  it("doesn't tell ready listeners the browser is ready when its cookies can't be added", async () => {
    for (const scope of ['shared', 'thread'] as const) {
      viewer = new BrowserViewer({ cli: 'agent-browser', headless: true, scope });
      // Passes setCookies' own check, but the browser rejects it.
      await viewer.setCookies([{ name: 'bad', value: 'v', url: 'not-a-url' }], 'thread-1');
      viewer.setCurrentThread('thread-1');
      let ready = 0;
      viewer.onBrowserReady(() => ready++, scope === 'thread' ? 'thread-1' : undefined);

      await expect(viewer.launch('thread-1')).rejects.toThrow();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(ready).toBe(0);
      await viewer.close();
    }
  }, 60_000);

  it.each([
    ['thread', 'thread-1'],
    ['shared', undefined],
  ] as const)(
    'makes %s-scope listeners registered while cookies are being added wait for them',
    async (scope, listenerThread) => {
      viewer = new BrowserViewer({ cli: 'agent-browser', headless: true, scope });
      viewer.setCurrentThread('thread-1');
      await viewer.setCookies([cookie('slow')], 'thread-1');
      // Hold cookie adding open so a listener can register in the middle of it.
      let release!: () => void;
      const held = new Promise<void>(resolve => (release = resolve));
      const add = viewer['addCookiesToOpenBrowser'].bind(viewer);
      viewer['addCookiesToOpenBrowser'] = async (...args) => {
        await held;
        return add(...args);
      };

      const launching = viewer.launch('thread-1');
      while (!viewer['threadManager'].getContextForThread('thread-1')) await new Promise(r => setTimeout(r, 10));
      const seen = new Promise<string[]>(resolve => {
        viewer.onBrowserReady(() => {
          const context = viewer['threadManager'].getContextForThread('thread-1')!;
          resolve(context.cookies().then(cookies => cookies.map(c => `${c.name}=${c.value}`)));
        }, listenerThread);
      });
      release();
      await launching;

      expect(await seen).toEqual(['preview=slow']);
    },
    30_000,
  );

  it("closes the browser when its cookies can't be added, so later listeners never see it ready", async () => {
    viewer = new BrowserViewer({ cli: 'agent-browser', headless: true, scope: 'thread' });
    await viewer.setCookies([{ name: 'bad', value: 'v', url: 'not-a-url' }], 'thread-1');

    await expect(viewer.launch('thread-1')).rejects.toThrow();
    await new Promise(resolve => setTimeout(resolve, 500));
    let ready = 0;
    viewer.onBrowserReady(() => ready++, 'thread-1');

    expect(ready).toBe(0);
    expect(viewer.hasThreadSession('thread-1')).toBe(false);
    expect(viewer['threadManager'].getContextForThread('thread-1')).toBeFalsy();

    // The rejected cookie is gone, so the thread can still open signed in.
    await viewer.setCookies([cookie('retry')], 'thread-1');
    await viewer.launch('thread-1');
    expect(await titleAt('thread-1')).toBe('preview=retry');

    await viewer.closeThreadSession('thread-1');
    expect(viewer['cookieAdds'].size).toBe(0);
  }, 30_000);
});
