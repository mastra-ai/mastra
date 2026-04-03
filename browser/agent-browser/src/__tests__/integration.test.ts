/**
 * Integration tests for AgentBrowser with a real browser.
 *
 * These tests launch a headless Chromium via agent-browser and exercise
 * actual browser methods against a local data: URI or public test page.
 *
 * Skip when Playwright/Chromium is not available (CI without browsers).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AgentBrowser } from '../agent-browser';

// Check if we can actually launch a browser with AgentBrowser
// Only skip for known environment/setup failures, not regressions
let canLaunchBrowser = true;
const testBrowser = new AgentBrowser({ headless: true, scope: 'shared' });
try {
  // Quick probe — if agent-browser isn't installed or Chromium is missing, skip
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
  // Only skip for known environment issues (missing browser, playwright not installed)
  const isEnvironmentError =
    errorMessage.includes("Executable doesn't exist") ||
    errorMessage.includes('browserType.launch') ||
    errorMessage.includes('Cannot find module') ||
    errorMessage.includes('ENOENT');

  if (isEnvironmentError) {
    canLaunchBrowser = false;
    // skipReason available for debugging: errorMessage
  } else {
    // Re-throw actual regressions so tests fail properly
    throw error;
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
    // Refs can be in format [ref=e1] or @e1 depending on agent-browser version
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

  it('closes the browser via close method', async () => {
    const tempBrowser = new AgentBrowser({ headless: true });
    await tempBrowser.ensureReady();
    expect(tempBrowser.status).toBe('ready');

    // Close the browser
    await tempBrowser.close();

    expect(tempBrowser.status).toBe('closed');
  }, 30_000);
});
