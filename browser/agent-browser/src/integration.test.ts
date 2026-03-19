/**
 * Integration tests for BrowserToolset with a real browser.
 *
 * These tests launch a headless Chromium via agent-browser and exercise
 * actual browser tools against a local data: URI or public test page.
 *
 * Skip when Playwright/Chromium is not available (CI without browsers).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BrowserToolset } from './toolset.js';

// Check if we can actually launch a browser
let canLaunchBrowser = true;
try {
  // Quick probe — if agent-browser isn't installed or Chromium is missing, skip
  const { BrowserManager } = await import('agent-browser/dist/browser.js');
  const mgr = new BrowserManager();
  await mgr.launch({ id: 'probe', action: 'launch', headless: true });
  await mgr.close();
} catch {
  canLaunchBrowser = false;
}

describe.skipIf(!canLaunchBrowser)('BrowserToolset integration', () => {
  let toolset: BrowserToolset;

  beforeAll(() => {
    toolset = new BrowserToolset({ headless: true, timeout: 15_000 });
  });

  afterAll(async () => {
    await toolset.close();
  }, 10_000);

  it('navigates to a URL and returns page info', async () => {
    const result = await toolset.tools.browser_navigate.execute!(
      {
        url: 'data:text/html,<html><head><title>Test Page</title></head><body><h1>Hello</h1><a href="#">Link</a></body></html>',
        waitUntil: 'load',
      },
      {} as any,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.title).toBe('Test Page');
    }
  }, 30_000);

  it('captures an accessibility snapshot', async () => {
    // Navigate first
    await toolset.tools.browser_navigate.execute!(
      {
        url: 'data:text/html,<html><body><button>Click me</button><input type="text" placeholder="Type here" /><a href="#">A link</a></body></html>',
        waitUntil: 'load',
      },
      {} as any,
    );

    const result = await toolset.tools.browser_snapshot.execute!(
      { interactiveOnly: true, maxElements: 50, offset: 0 },
      {} as any,
    );

    expect(result.success).toBe(true);
    if (result.success && result.tree) {
      // Should contain refs like @e1, @e2
      expect(result.tree).toMatch(/@e\d+/);
      // Should contain the button text
      expect(result.tree).toContain('Click me');
    }
  }, 30_000);

  it('takes a screenshot', async () => {
    await toolset.tools.browser_navigate.execute!(
      {
        url: 'data:text/html,<html><body style="background:blue"><h1 style="color:white">Screenshot Test</h1></body></html>',
        waitUntil: 'load',
      },
      {} as any,
    );

    const result = await toolset.tools.browser_screenshot.execute!(
      { fullPage: false, format: 'png', quality: 80 },
      {} as any,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.mimeType).toBe('image/png');
      expect(result.dimensions.width).toBeGreaterThan(0);
      expect(result.dimensions.height).toBeGreaterThan(0);
    }
  }, 30_000);

  it('types text into an input field', async () => {
    await toolset.tools.browser_navigate.execute!(
      {
        url: 'data:text/html,<html><body><input id="name" type="text" /></body></html>',
        waitUntil: 'load',
      },
      {} as any,
    );

    // Get refs via snapshot
    const snapshot = await toolset.tools.browser_snapshot.execute!(
      { interactiveOnly: true, maxElements: 50, offset: 0 },
      {} as any,
    );

    // Find the input ref from the snapshot tree
    const refMatch = snapshot.tree?.match(/@e\d+/);
    expect(refMatch).not.toBeNull();

    if (refMatch) {
      const result = await toolset.tools.browser_type.execute!(
        { ref: refMatch[0], text: 'Hello World', clearFirst: false },
        {} as any,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('Hello World');
      }
    }
  }, 30_000);

  it('scrolls the page', async () => {
    await toolset.tools.browser_navigate.execute!(
      {
        url: 'data:text/html,<html><body style="height:5000px"><h1>Top</h1><div style="position:absolute;top:4000px">Bottom</div></body></html>',
        waitUntil: 'load',
      },
      {} as any,
    );

    const result = await toolset.tools.browser_scroll.execute!({ direction: 'down', amount: 'page' }, {} as any);

    expect(result.success).toBe(true);
    if (result.success && result.position) {
      expect(result.position.y).toBeGreaterThan(0);
    }
  }, 30_000);

  it('clicks a button', async () => {
    await toolset.tools.browser_navigate.execute!(
      {
        url: 'data:text/html,<html><body><button onclick="document.title=\'Clicked\'">Press</button></body></html>',
        waitUntil: 'load',
      },
      {} as any,
    );

    const snapshot = await toolset.tools.browser_snapshot.execute!(
      { interactiveOnly: true, maxElements: 50, offset: 0 },
      {} as any,
    );

    const refMatch = snapshot.tree?.match(/@e\d+/);
    expect(refMatch).not.toBeNull();

    if (refMatch) {
      const result = await toolset.tools.browser_click.execute!({ ref: refMatch[0], button: 'left' }, {} as any);

      expect(result.success).toBe(true);
    }
  }, 30_000);

  it('closes the browser', async () => {
    const result = await toolset.tools.browser_close.execute!({}, {} as any);
    expect(result.success).toBe(true);
    expect(toolset.isBrowserRunning()).toBe(false);
  }, 10_000);
});
