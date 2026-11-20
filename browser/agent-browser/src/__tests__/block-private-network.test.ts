/**
 * blockPrivateNetwork against a real Chromium and real local servers.
 *
 * "Secret" is a server on 127.0.0.1 standing in for anything private on the
 * machine (a dev server, a database admin page, cloud metadata). "Public" is
 * another local server let through with `allow`, standing in for a public site.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AgentBrowser } from '../agent-browser';
import { isPrivateAddress } from '../network-guard';

let canLaunchBrowser = true;
try {
  const probe = new AgentBrowser({ headless: true, scope: 'shared' });
  await probe.ensureReady();
  await probe.close();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/Executable doesn't exist|browserType\.launch|Cannot find module|ENOENT/.test(message)) throw error;
  canLaunchBrowser = false;
}

function listen(handler: http.RequestListener): Promise<http.Server> {
  return new Promise(done => {
    const server = http.createServer(handler).listen(0, '127.0.0.1', () => done(server));
  });
}
const portOf = (server: http.Server) => (server.address() as AddressInfo).port;

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '127.8.9.10',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.100.100.100',
    '0.0.0.0',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:a9fe:a9fe',
  ])('treats %s as private', address => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'treats %s as public',
    address => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});

describe.skipIf(!canLaunchBrowser)('blockPrivateNetwork', () => {
  let secret: http.Server;
  let pub: http.Server;
  const secretHits: string[] = [];
  let SECRET: string;
  let PUBLIC: string;

  beforeAll(async () => {
    secret = await listen((req, res) => {
      secretHits.push(req.url ?? '');
      res.setHeader('content-type', 'text/html');
      res.end('<title>Secret</title><p>the secret</p>');
    });
    secret.on('upgrade', (req, socket) => {
      secretHits.push(`upgrade ${req.url}`);
      socket.destroy();
    });
    SECRET = `http://127.0.0.1:${portOf(secret)}`;
    pub = await listen((req, res) => {
      if (req.url === '/to-secret') {
        res.writeHead(302, { location: `${SECRET}/via-redirect` });
        res.end();
        return;
      }
      res.setHeader('content-type', 'text/html');
      res.end('<title>Public</title><p>public page</p>');
    });
    PUBLIC = `http://127.0.0.1:${portOf(pub)}`;
  });

  afterAll(() => {
    secret.close();
    pub.close();
  });

  describe('a shared browser', () => {
    let browser: AgentBrowser;

    beforeAll(async () => {
      browser = new AgentBrowser({
        headless: true,
        timeout: 10_000,
        scope: 'shared',
        blockPrivateNetwork: { allow: [`127.0.0.1:${portOf(pub)}`] },
      });
      await browser.ensureReady();
    });

    afterAll(async () => {
      await browser.close();
    }, 10_000);

    const page = () => browser.getManagerForThread().then(manager => manager.getPage());

    it('opens public sites', async () => {
      const result = await browser.goto({ url: `${PUBLIC}/` });
      expect(result).toMatchObject({ success: true, title: 'Public' });
    }, 20_000);

    it.each(['', '/x', 'localhost'])(
      'refuses to navigate to a private address (%s)',
      async variant => {
        const url = variant === 'localhost' ? SECRET.replace('127.0.0.1', 'localhost') : `${SECRET}${variant}`;
        secretHits.length = 0;
        const result = await browser.goto({ url });
        expect(result).toMatchObject({ success: false });
        expect(JSON.stringify(result)).toContain('private network');
        expect(secretHits).toEqual([]);
      },
      20_000,
    );

    it('refuses file: URLs', async () => {
      const result = await browser.goto({ url: 'file:///etc/hosts' });
      expect(result).toMatchObject({ success: false });
      expect(JSON.stringify(result)).toContain("file: URLs can't be opened");
    }, 20_000);

    it("doesn't follow a public site's redirect to a private address", async () => {
      secretHits.length = 0;
      await browser.goto({ url: `${PUBLIC}/to-secret` });
      expect(await (await page()).content()).not.toContain('the secret');
      expect(secretHits).toEqual([]);
    }, 20_000);

    it("keeps a page's own requests off private addresses", async () => {
      await browser.goto({ url: `${PUBLIC}/` });
      secretHits.length = 0;
      // The proxy answers blocked requests itself, so a no-cors fetch still resolves;
      // what matters is that nothing reaches the secret server.
      await (
        await page()
      ).evaluate(async secretUrl => {
        await fetch(`${secretUrl}/fetch`, { mode: 'no-cors' }).catch(() => undefined);
        await new Promise(done => {
          const ws = new WebSocket(`${secretUrl.replace('http', 'ws')}/socket`);
          ws.onopen = ws.onerror = done;
        });
      }, SECRET);
      expect(secretHits).toEqual([]);
    }, 20_000);

    it('keeps navigations that skip the agent tools off local files', async () => {
      // navigateTo restores saved tabs and doesn't go through browser_goto's check.
      const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'block-private-network-')), 'secret.html');
      writeFileSync(file, '<p>local file secret</p>');
      await browser.navigateTo(pathToFileURL(file).href);
      const current = await page();
      // The blocked navigation swaps in Chromium's error page; read once it settles.
      const settled = await vi.waitUntil(() => current.content().catch(() => undefined), { timeout: 5_000 });
      expect(settled).not.toContain('local file secret');
      expect(current.url()).not.toMatch(/^file:/);
    }, 20_000);

    it('refuses to open a new tab on a private address', async () => {
      secretHits.length = 0;
      const result = await browser.tabs({ action: 'new', url: SECRET });
      expect(result).toMatchObject({ success: false });
      expect(secretHits).toEqual([]);
    }, 20_000);
  });

  it('protects each browser in thread scope', async () => {
    const browser = new AgentBrowser({ headless: true, timeout: 10_000, scope: 'thread', blockPrivateNetwork: true });
    try {
      browser.setCurrentThread('thread-a');
      await browser.ensureReady();
      const manager = await browser.getManagerForThread('thread-a');
      secretHits.length = 0;
      await manager
        .getPage()
        .goto(`${SECRET}/thread`)
        .catch(() => undefined);
      expect(secretHits).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 30_000);

  it("can't be combined with a browser it doesn't launch", () => {
    expect(() => new AgentBrowser({ cdpUrl: 'ws://127.0.0.1:9222', blockPrivateNetwork: true })).toThrow(
      /can't be combined with cdpUrl/,
    );
  });
});
