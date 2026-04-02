/**
 * Integration tests for AgentBrowser with a real browser.
 *
 * These tests launch a headless Chromium via agent-browser and exercise
 * actual browser methods against a local data: URI or public test page.
 *
 * Skip when Playwright/Chromium is not available (CI without browsers).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AgentBrowser } from './agent-browser';

// Check if we can actually launch a browser with AgentBrowser
let canLaunchBrowser = true;
try {
  // Quick probe — if agent-browser isn't installed or Chromium is missing, skip
  const testBrowser = new AgentBrowser({ headless: true, scope: 'shared' });
  await testBrowser.ensureReady();
  await testBrowser.close();
} catch {
  canLaunchBrowser = false;
}

describe.skipIf(!canLaunchBrowser)('AgentBrowser integration', () => {
  let browser: AgentBrowser;

  beforeAll(async () => {
    // Use 'none' isolation for simpler shared browser behavior in integration tests
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
    // Refs can be in format [ref=e1] or @e1 depending on agent-browser version
    expect(result.snapshot).toMatch(/(?:\[ref=e\d+\]|@e\d+)/);
    // Should contain the button text
    expect(result.snapshot).toContain('Click me');
  }, 30_000);

  it('types text into an input field', async () => {
    // Use a page with multiple interactive elements to ensure refs are generated
    await browser.goto({
      url: 'data:text/html,<html><body><form><input id="name" type="text" /><button type="submit">Submit</button></form></body></html>',
      waitUntil: 'load',
    });

    // Get refs via snapshot - use interactiveOnly: false to get all elements
    const snapshotResult = await browser.snapshot({});

    // Ensure we got a snapshot
    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshot).toBeDefined();
    expect(snapshotResult.snapshot.length).toBeGreaterThan(0);

    // Find any ref - handle both [ref=e1] and @e1 formats
    const refMatch = snapshotResult.snapshot.match(/\[ref=(e\d+)\]/);
    const atMatch = snapshotResult.snapshot.match(/@(e\d+)/);
    const ref = refMatch ? refMatch[1] : atMatch ? atMatch[0] : null;
    expect(ref).not.toBeNull();

    if (ref) {
      const result = await browser.type({
        ref: ref,
        text: 'Hello World',
      });

      expect(result.success).toBe(true);
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
    // Multiple interactive elements for better ref generation
    await browser.goto({
      url: 'data:text/html,<html><body><button id="btn" onclick="document.title=\'Clicked\'">Press</button><a href="#">Link</a></body></html>',
      waitUntil: 'load',
    });

    const snapshotResult = await browser.snapshot({});

    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshot).toBeDefined();
    expect(snapshotResult.snapshot.length).toBeGreaterThan(0);

    // Find any ref - handle both [ref=e1] and @e1 formats
    const refMatch = snapshotResult.snapshot.match(/\[ref=(e\d+)\]/);
    const atMatch = snapshotResult.snapshot.match(/@(e\d+)/);
    const ref = refMatch ? refMatch[1] : atMatch ? atMatch[0] : null;
    expect(ref).not.toBeNull();

    if (ref) {
      const result = await browser.click({
        ref: ref,
        button: 'left',
      });

      expect(result.success).toBe(true);

      // Check the title was changed (button's onclick handler ran)
      const snapshot2 = await browser.snapshot({});
      expect(snapshot2.title).toBe('Clicked');
    }
  }, 30_000);

  it('supports keyboard actions', async () => {
    // Multiple interactive elements
    await browser.goto({
      url: 'data:text/html,<html><body><input id="test" type="text" /><button>Submit</button></body></html>',
      waitUntil: 'load',
    });

    const snapshotResult = await browser.snapshot({});

    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshot).toBeDefined();
    expect(snapshotResult.snapshot.length).toBeGreaterThan(0);

    // Find any ref - handle both [ref=e1] and @e1 formats
    const refMatch = snapshotResult.snapshot.match(/\[ref=(e\d+)\]/);
    const atMatch = snapshotResult.snapshot.match(/@(e\d+)/);
    const ref = refMatch ? refMatch[1] : atMatch ? atMatch[0] : null;
    expect(ref).not.toBeNull();

    if (ref) {
      // Focus the input by clicking
      await browser.click({ ref: ref });

      // Type using keyboard press
      const result = await browser.press({ key: 'a' });
      expect(result.success).toBe(true);
    }
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
