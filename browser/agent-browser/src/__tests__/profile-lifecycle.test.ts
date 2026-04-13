/**
 * AgentBrowser profile lifecycle tests.
 *
 * Tests all combinations of scope × profile × headless × close-type.
 * Set BROWSER_TEST_HEADED=1 to include headed tests.
 */
import { createProviderTests } from '@internal/browser-test-utils';
import type { BrowserFactory } from '@internal/browser-test-utils';
import { AgentBrowser } from '../index';

/**
 * Get the browser process PID via CDP's SystemInfo.getProcessInfo.
 * This is the most reliable way to get the PID since Playwright doesn't
 * expose process() on the Browser object.
 */
async function getAgentBrowserPid(browser: AgentBrowser, threadId?: string): Promise<number | undefined> {
  try {
    const ab = browser as any;
    const scope = ab.getScope();
    let manager;
    if (scope === 'shared') {
      manager = ab.sharedManager;
    } else {
      manager = ab.threadManager?.getExistingManagerForThread(threadId);
    }
    if (!manager) return undefined;

    // Try getBrowser() first, fall back to context.browser() for persistent contexts
    let playwrightBrowser = manager.getBrowser();
    if (!playwrightBrowser) {
      const ctx = manager.getContext();
      playwrightBrowser = ctx?.browser?.();
    }
    if (!playwrightBrowser) return undefined;

    const cdp = await playwrightBrowser.newBrowserCDPSession();
    try {
      const info = await cdp.send('SystemInfo.getProcessInfo');
      const browserProcess = info.processInfo?.find((p: any) => p.type === 'browser');
      return browserProcess?.id;
    } finally {
      await cdp.detach().catch(() => undefined);
    }
  } catch {
    return undefined;
  }
}

const agentBrowserFactory: BrowserFactory = {
  name: 'AgentBrowser',
  patchesExitType: false,
  create: ({ profile, scope, headless, executablePath }) =>
    new AgentBrowser({ headless, scope, profile, executablePath }),
  navigate: async (browser, url, threadId) => {
    const result = await (browser as AgentBrowser).goto({ url }, threadId);
    if ('error' in result) throw new Error(`Goto failed: ${result.error}`);
  },
  getPid: (browser, threadId) => getAgentBrowserPid(browser as AgentBrowser, threadId),
};

createProviderTests(agentBrowserFactory);
