/**
 * Integration tests for AgentBrowser with a real browser.
 *
 * These tests launch headless Chrome through Playwright and exercise actual
 * browser methods against local data: URIs.
 *
 * Skip only when no Chrome executable is available.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { platform } from 'node:os';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AgentBrowser } from '../agent-browser';
import { BrowserManager, CHROME_NOT_FOUND_MESSAGE } from '../browser-manager';
import { getBrowserPid } from '../utils';

// Check if we can actually launch a browser with AgentBrowser
// Only skip for a missing browser executable, not for launch regressions
let canLaunchBrowser = true;
const testBrowser = new AgentBrowser({ headless: true, scope: 'shared' });
try {
  await testBrowser.ensureReady();
  await testBrowser.close();
} catch (error) {
  // Always try to clean up the probe browser, even if ensureReady() threw
  try {
    await testBrowser.close();
  } catch {
    // Ignore cleanup errors
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const isMissingBrowser =
    errorMessage.includes(CHROME_NOT_FOUND_MESSAGE) ||
    errorMessage.includes("Executable doesn't exist") ||
    errorMessage.includes('Cannot find module');

  if (isMissingBrowser) {
    canLaunchBrowser = false;
  } else {
    // Re-throw actual regressions so tests fail properly
    throw error;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port')),
      );
    });
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!canLaunchBrowser)('AgentBrowser integration', () => {
  let browser: AgentBrowser;

  beforeAll(async () => {
    // Use 'shared' scope for simpler shared browser behavior in integration tests
    browser = new AgentBrowser({ headless: true, timeout: 15_000, scope: 'shared' });
    await browser.ensureReady();
  });

  afterAll(async () => {
    await browser.close();
  }, 10_000);

  it('navigates to a URL and returns page info', async () => {
    const result = await browser.goto({
      url: 'data:text/html,<html><head><title>Test Page</title></head><body><h1>Hello</h1><a href="#">Link</a></body></html>',
      waitUntil: 'load',
    });

    expect(result.success).toBe(true);
    expect(result.title).toBe('Test Page');
  }, 30_000);

  it('captures an accessibility snapshot', async () => {
    // Navigate first
    await browser.goto({
      url: 'data:text/html,<html><body><button>Click me</button><input type="text" placeholder="Type here" /><a href="#">A link</a></body></html>',
      waitUntil: 'load',
    });

    const result = await browser.snapshot({
      interactiveOnly: true,
    });

    expect(result.success).toBe(true);
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.length).toBeGreaterThan(0);
    // Should contain refs like @e1, @e2
    expect(result.snapshot).toMatch(/(?:\[ref=e\d+\]|@e\d+)/);
    // Should contain the button text
    expect(result.snapshot).toContain('Click me');
  }, 30_000);

  it('types text into an input field', async () => {
    // Use a page with a single input to avoid ref ordering issues
    await browser.goto({
      url: 'data:text/html,<html><body><input id="name" type="text" placeholder="Enter name" /></body></html>',
      waitUntil: 'load',
    });

    // Get refs via snapshot
    const snapshotResult = await browser.snapshot({});

    // Ensure we got a snapshot
    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshot).toBeDefined();
    expect(snapshotResult.snapshot.length).toBeGreaterThan(0);

    // Find the input ref by looking for "Enter name" placeholder context
    // Handle both [ref=e1] and @e1 formats
    const snapshot = snapshotResult.snapshot;
    const inputMatch =
      snapshot.match(/(?:\[ref=(e\d+)\]|@(e\d+)).*?(?:Enter name|textbox)/i) ||
      snapshot.match(/(?:Enter name|textbox).*?(?:\[ref=(e\d+)\]|@(e\d+))/i) ||
      snapshot.match(/\[ref=(e\d+)\]/) ||
      snapshot.match(/@(e\d+)/);
    const ref = inputMatch ? inputMatch[1] || inputMatch[2] || inputMatch[3] || inputMatch[4] : null;
    expect(ref).not.toBeNull();

    if (ref) {
      const result = await browser.type({
        ref: ref.startsWith('@') ? ref : `@${ref}`,
        text: 'Hello World',
      });

      expect(result.success).toBe(true);

      // Verify the text was actually typed by checking the input value
      if (result.success) {
        expect(result.value).toBe('Hello World');
      }
    }
  }, 30_000);

  it('scrolls the page', async () => {
    await browser.goto({
      url: 'data:text/html,<html><body style="height:5000px"><h1>Top</h1><div style="position:absolute;top:4000px">Bottom</div></body></html>',
      waitUntil: 'load',
    });

    const result = await browser.scroll({
      direction: 'down',
      amount: 500,
    });

    expect(result.success).toBe(true);
  }, 30_000);

  it('clicks a button', async () => {
    // Single button to avoid ref ordering issues
    await browser.goto({
      url: 'data:text/html,<html><body><button id="btn" onclick="document.title=\'Clicked\'">Press Me</button></body></html>',
      waitUntil: 'load',
    });

    const snapshotResult = await browser.snapshot({});

    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshot).toBeDefined();
    expect(snapshotResult.snapshot.length).toBeGreaterThan(0);

    // Find the button ref by looking for "Press Me" text context
    const snapshot = snapshotResult.snapshot;
    const buttonMatch =
      snapshot.match(/(?:\[ref=(e\d+)\]|@(e\d+)).*?Press Me/i) ||
      snapshot.match(/Press Me.*?(?:\[ref=(e\d+)\]|@(e\d+))/i) ||
      snapshot.match(/\[ref=(e\d+)\]/) ||
      snapshot.match(/@(e\d+)/);
    const ref = buttonMatch ? buttonMatch[1] || buttonMatch[2] || buttonMatch[3] || buttonMatch[4] : null;
    expect(ref).not.toBeNull();

    if (ref) {
      const result = await browser.click({
        ref: ref.startsWith('@') ? ref : `@${ref}`,
        button: 'left',
      });

      expect(result.success).toBe(true);

      // Check the title was changed (button's onclick handler ran)
      const snapshot2 = await browser.snapshot({});
      expect(snapshot2.title).toBe('Clicked');
    }
  }, 30_000);

  it('supports keyboard actions', async () => {
    // Single input to avoid ref ordering issues
    await browser.goto({
      url: 'data:text/html,<html><body><input id="test" type="text" placeholder="Type here" /></body></html>',
      waitUntil: 'load',
    });

    const snapshotResult = await browser.snapshot({});

    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshot).toBeDefined();
    expect(snapshotResult.snapshot.length).toBeGreaterThan(0);

    // Find the input ref by looking for placeholder context
    const snapshot = snapshotResult.snapshot;
    const inputMatch =
      snapshot.match(/(?:\[ref=(e\d+)\]|@(e\d+)).*?Type here/i) ||
      snapshot.match(/Type here.*?(?:\[ref=(e\d+)\]|@(e\d+))/i) ||
      snapshot.match(/\[ref=(e\d+)\]/) ||
      snapshot.match(/@(e\d+)/);
    const ref = inputMatch ? inputMatch[1] || inputMatch[2] || inputMatch[3] || inputMatch[4] : null;
    expect(ref).not.toBeNull();

    if (ref) {
      // Focus the input by clicking
      await browser.click({ ref: ref.startsWith('@') ? ref : `@${ref}` });

      // Type using keyboard press
      const result = await browser.press({ key: 'a' });
      expect(result.success).toBe(true);

      // Verify the character was typed by getting the input value
      const page = await (browser as any).getPage();
      const inputValue = await page.locator('#test').inputValue();
      expect(inputValue).toBe('a');
    }
  }, 30_000);

  it('resolves refs inside iframes', async () => {
    const inner = encodeURIComponent(
      `<button onclick="document.body.dataset.clicked='yes'">Inner</button>`.replace(/"/g, '&quot;'),
    );
    await browser.goto({
      url: `data:text/html,<html><body><button>Outer</button><iframe srcdoc="${inner}"></iframe></body></html>`,
      waitUntil: 'load',
    });

    const snapshotResult = await browser.snapshot({ interactiveOnly: true });
    if (!snapshotResult.success) throw new Error(JSON.stringify(snapshotResult));
    const innerRef = /button "Inner" @(f\d+e\d+)/.exec(snapshotResult.snapshot)?.[1];
    expect(innerRef, snapshotResult.snapshot).toBeDefined();
    // Frame refs count toward elementCount like page refs
    expect(snapshotResult.elementCount).toBe(2);

    const result = await browser.click({ ref: `@${innerRef}` });
    expect(result.success).toBe(true);

    const page = await (browser as any).getPage();
    const frame = page.frames().find((f: any) => f !== page.mainFrame());
    expect(await frame.evaluate('document.body.dataset.clicked')).toBe('yes');
  }, 30_000);

  it('closes the browser via close method', async () => {
    const tempBrowser = new AgentBrowser({ headless: true });
    await tempBrowser.ensureReady();
    expect(tempBrowser.status).toBe('ready');

    // Close the browser
    await tempBrowser.close();

    expect(tempBrowser.status).toBe('closed');
  }, 30_000);
});

describe.skipIf(!canLaunchBrowser)('BrowserManager with real Chrome', () => {
  it('runs Chrome as a child of this process and stops it on close()', async () => {
    const manager = new BrowserManager();
    await manager.launch({ headless: true });
    const pid = await getBrowserPid(manager);
    expect(pid).toBeDefined();
    if (platform() === 'linux') {
      const ppid = /PPid:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1];
      expect(Number(ppid)).toBe(process.pid);
    }

    await manager.close();
    expect(manager.isLaunched()).toBe(false);
    await expect.poll(() => isAlive(pid!), { timeout: 10_000 }).toBe(false);
  }, 30_000);

  it('only disconnects from a cdpUrl browser on close()', async () => {
    const port = await freePort();
    const owner = new BrowserManager();
    await owner.launch({ headless: true, args: [`--remote-debugging-port=${port}`] });
    try {
      await owner.getPage().goto('data:text/html,<title>Remote</title>');

      const attached = new BrowserManager();
      await attached.launch({ cdpUrl: String(port) });
      expect(attached.getPages().some(p => p.url().startsWith('data:'))).toBe(true);
      await attached.close();
      expect(attached.isLaunched()).toBe(false);

      // The remote browser and its page are untouched.
      expect(owner.getBrowser()?.isConnected()).toBe(true);
      expect(await owner.getPage().title()).toBe('Remote');
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      expect(res.ok).toBe(true);
    } finally {
      await owner.close();
    }
  }, 30_000);

  it('rejects a bad cdpUrl and leaves nothing behind', async () => {
    const port = await freePort();
    const manager = new BrowserManager();
    await expect(manager.launch({ cdpUrl: `http://127.0.0.1:${port}` })).rejects.toThrow(/Failed to connect via CDP/);
    expect(manager.isLaunched()).toBe(false);
  }, 90_000);

  it('resolves iframe refs and only shows refs it can resolve', async () => {
    const manager = new BrowserManager();
    await manager.launch({ headless: true });
    try {
      await manager
        .getPage()
        .setContent(
          `<button>Outer</button><iframe srcdoc="<button onclick=&quot;document.title='hit'&quot;>Inner</button><a href='#'>Link</a>"></iframe>`,
        );
      await manager.getPage().frames()[1]?.waitForLoadState();

      for (const options of [{ interactive: true }, { compact: true }, {}]) {
        const snapshot = await manager.getSnapshot(options);
        const shown = [...snapshot.tree.matchAll(/\[ref=([a-z0-9]+)\]/g)].map(m => m[1]!);
        expect(shown.some(ref => ref.startsWith('f'))).toBe(true);
        for (const ref of shown) {
          const locator = manager.getLocatorFromRef(`@${ref}`);
          expect(locator, `${ref} in ${JSON.stringify(options)}`).not.toBeNull();
          expect(await locator!.count(), ref).toBe(1);
        }
      }

      const snapshot = await manager.getSnapshot({ interactive: true });
      const innerRef = Object.entries(snapshot.refs).find(([, r]) => r.name === 'Inner')?.[0];
      expect(innerRef).toMatch(/^f\d+e\d+$/);
      await manager.getLocatorFromRef(innerRef!)!.click();
      expect(await manager.getPage().frames()[1]!.title()).toBe('hit');
    } finally {
      await manager.close();
    }
  }, 30_000);
});
