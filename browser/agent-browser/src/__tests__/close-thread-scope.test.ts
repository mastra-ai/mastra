/**
 * Closing a thread-scoped AgentBrowser against a real headless Chromium.
 * Closing used to read "current" browser state by opening a browser for the
 * default thread, which launched Chrome (or, for remote providers such as
 * Firecrawl and Mastra Platform, provisioned a paid session) during shutdown.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentBrowser } from '../agent-browser';
import { BrowserManager } from '../browser-manager';

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

describe.skipIf(!canLaunchBrowser)('closing a thread-scoped AgentBrowser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not open a browser for the default thread while closing', async () => {
    const launches = vi.spyOn(BrowserManager.prototype, 'launch');
    const browser = new AgentBrowser({ headless: true, timeout: 15_000, scope: 'thread' });
    await browser.launch();
    await browser.goto({ url: 'data:text/html,<title>a</title>' }, 'thread-a');
    expect(launches).toHaveBeenCalledTimes(1);

    await browser.close();

    expect(launches).toHaveBeenCalledTimes(1);
  }, 30_000);

  it('opens nothing when no thread ever used a browser', async () => {
    const launches = vi.spyOn(BrowserManager.prototype, 'launch');
    const browser = new AgentBrowser({ headless: true, timeout: 15_000, scope: 'thread' });
    await browser.launch();

    await browser.close();

    expect(launches).not.toHaveBeenCalled();
  }, 30_000);
});
