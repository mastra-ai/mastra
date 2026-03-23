/**
 * Integration tests for AgentBrowser with a real browser.
 *
 * These tests launch a headless Chromium via agent-browser and exercise
 * actual browser methods against a local data: URI or public test page.
 *
 * Skip when Playwright/Chromium is not available (CI without browsers).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AgentBrowser } from './agent-browser.js';
import { loadBrowserManager } from './browser-types.js';

// Check if we can actually launch a browser
let canLaunchBrowser = true;
try {
  // Quick probe — if agent-browser isn't installed or Chromium is missing, skip
  const BrowserManager = await loadBrowserManager();
  const mgr = new BrowserManager();
  await mgr.launch({ id: 'probe', action: 'launch', headless: true });
  await mgr.close();
} catch {
  canLaunchBrowser = false;
}

describe.skipIf(!canLaunchBrowser)('AgentBrowser integration', () => {
  let browser: AgentBrowser;

  beforeAll(async () => {
    browser = new AgentBrowser({ headless: true, timeout: 15_000 });
    await browser.ensureReady();
  });

  afterAll(async () => {
    await browser.close();
  }, 10_000);

  it('navigates to a URL and returns page info', async () => {
    const result = (await browser.navigate({
      action: 'goto',
      url: 'data:text/html,<html><head><title>Test Page</title></head><body><h1>Hello</h1><a href="#">Link</a></body></html>',
      waitUntil: 'load',
    })) as { success: boolean; title: string };

    expect(result.success).toBe(true);
    expect(result.title).toBe('Test Page');
  }, 30_000);

  it('captures an accessibility snapshot', async () => {
    // Navigate first
    await browser.navigate({
      action: 'goto',
      url: 'data:text/html,<html><body><button>Click me</button><input type="text" placeholder="Type here" /><a href="#">A link</a></body></html>',
      waitUntil: 'load',
    });

    const result = (await browser.extract({
      action: 'snapshot',
      interactiveOnly: true,
      maxElements: 50,
      offset: 0,
    })) as { success: boolean; tree: string };

    expect(result.success).toBe(true);
    if (result.tree) {
      // Should contain refs like @e1, @e2
      expect(result.tree).toMatch(/@e\d+/);
      // Should contain the button text
      expect(result.tree).toContain('Click me');
    }
  }, 30_000);

  it('takes a screenshot', async () => {
    await browser.navigate({
      action: 'goto',
      url: 'data:text/html,<html><body style="background:blue"><h1 style="color:white">Screenshot Test</h1></body></html>',
      waitUntil: 'load',
    });

    const result = (await browser.extract({
      action: 'screenshot',
      fullPage: false,
    })) as { success: boolean; mimeType: string; base64: string; dimensions: { width: number; height: number } };

    expect(result.success).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.dimensions.width).toBeGreaterThan(0);
    expect(result.dimensions.height).toBeGreaterThan(0);
  }, 30_000);

  it('types text into an input field', async () => {
    await browser.navigate({
      action: 'goto',
      url: 'data:text/html,<html><body><input id="name" type="text" /></body></html>',
      waitUntil: 'load',
    });

    // Get refs via snapshot
    const snapshot = (await browser.extract({
      action: 'snapshot',
      interactiveOnly: true,
      maxElements: 50,
      offset: 0,
    })) as { success: boolean; tree: string };

    // Find the input ref from the snapshot tree
    const refMatch = snapshot.tree?.match(/@e\d+/);
    expect(refMatch).not.toBeNull();

    if (refMatch) {
      const result = (await browser.input({
        action: 'fill',
        ref: refMatch[0],
        value: 'Hello World',
      })) as { success: boolean; value: string };

      expect(result.success).toBe(true);
      expect(result.value).toBe('Hello World');
    }
  }, 30_000);

  it('scrolls the page', async () => {
    await browser.navigate({
      action: 'goto',
      url: 'data:text/html,<html><body style="height:5000px"><h1>Top</h1><div style="position:absolute;top:4000px">Bottom</div></body></html>',
      waitUntil: 'load',
    });

    const result = (await browser.scroll({
      action: 'scroll',
      direction: 'down',
      amount: 500,
    })) as { success: boolean; scrollY: number };

    expect(result.success).toBe(true);
    expect(result.scrollY).toBeGreaterThan(0);
  }, 30_000);

  it('clicks a button', async () => {
    await browser.navigate({
      action: 'goto',
      url: 'data:text/html,<html><body><button onclick="document.title=\'Clicked\'">Press</button></body></html>',
      waitUntil: 'load',
    });

    const snapshot = (await browser.extract({
      action: 'snapshot',
      interactiveOnly: true,
      maxElements: 50,
      offset: 0,
    })) as { success: boolean; tree: string };

    const refMatch = snapshot.tree?.match(/@e\d+/);
    expect(refMatch).not.toBeNull();

    if (refMatch) {
      const result = (await browser.interact({
        action: 'click',
        ref: refMatch[0],
        button: 'left',
      })) as { success: boolean };

      expect(result.success).toBe(true);

      // Verify the button click worked by checking title
      const titleResult = (await browser.extract({ action: 'title' })) as { success: boolean; title: string };
      expect(titleResult.title).toBe('Clicked');
    }
  }, 30_000);

  it('supports keyboard actions', async () => {
    await browser.navigate({
      action: 'goto',
      url: 'data:text/html,<html><body><input id="test" type="text" /></body></html>',
      waitUntil: 'load',
    });

    // Use keyboard to type directly
    const result = (await browser.keyboard({
      action: 'type',
      text: 'Hello via keyboard',
    })) as { success: boolean };

    expect(result.success).toBe(true);
  }, 30_000);

  it('closes the browser via navigate close action', async () => {
    // Create a separate browser instance for this test
    const tempBrowser = new AgentBrowser({ headless: true, timeout: 15_000 });
    await tempBrowser.ensureReady();
    expect(tempBrowser.isBrowserRunning()).toBe(true);

    // Close via navigate action
    await tempBrowser.navigate({ action: 'close' });

    expect(tempBrowser.status).toBe('closed');
  }, 30_000);
});
