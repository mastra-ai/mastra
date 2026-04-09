/**
 * Cross-provider profile lifecycle tests.
 *
 * Tests that profiles can be shared between Stagehand and AgentBrowser.
 * Per-provider tests live in each provider's package.
 *
 * Set BROWSER_TEST_HEADED=1 to include headed tests.
 */
import { AgentBrowser } from '@mastra/agent-browser';
import { getStagehandChromePid, StagehandBrowser } from '@mastra/stagehand';

import { createCrossProviderTests, type BrowserFactory } from './factory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    const info = await cdp.send('SystemInfo.getProcessInfo');
    await cdp.detach();

    // Find the browser process (type: 'browser')
    const browserProcess = info.processInfo?.find((p: any) => p.type === 'browser');
    return browserProcess?.id;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const stagehandFactory: BrowserFactory = {
  name: 'Stagehand',
  create: ({ profile, scope, headless }) => new StagehandBrowser({ headless, scope, profile }),
  navigate: async (browser, url, threadId) => {
    const result = await (browser as StagehandBrowser).navigate({ url }, threadId);
    if ('error' in result) throw new Error(`Navigate failed: ${result.error}`);
  },
  getPid: async (browser, threadId) => {
    // Access internal state synchronously (getManagerForThread is async)
    const sb = browser as any;
    const scope = sb.getScope();
    if (scope === 'shared') {
      return sb.sharedManager ? getStagehandChromePid(sb.sharedManager) : undefined;
    }
    const existing = sb.threadManager?.getExistingManagerForThread(threadId);
    return existing ? getStagehandChromePid(existing) : undefined;
  },
};

const agentBrowserFactory: BrowserFactory = {
  name: 'AgentBrowser',
  create: ({ profile, scope, headless }) => new AgentBrowser({ headless, scope, profile }),
  navigate: async (browser, url, threadId) => {
    const result = await (browser as AgentBrowser).goto({ url }, threadId);
    if ('error' in result) throw new Error(`Goto failed: ${result.error}`);
  },
  getPid: (browser, threadId) => getAgentBrowserPid(browser as AgentBrowser, threadId),
};

// ---------------------------------------------------------------------------
// Canary check — skip all if we can't launch a browser
// ---------------------------------------------------------------------------

let canLaunchBrowser = true;
const probe = new AgentBrowser({ headless: true, scope: 'shared' });
try {
  await probe.ensureReady();
  await probe.close();
} catch (error) {
  try {
    await probe.close();
  } catch {}
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("Executable doesn't exist") ||
    msg.includes('browserType.launch') ||
    msg.includes('Cannot find module') ||
    msg.includes('ENOENT')
  ) {
    canLaunchBrowser = false;
  } else {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Run cross-provider tests
// ---------------------------------------------------------------------------

if (canLaunchBrowser) {
  // Stagehand ↔ AgentBrowser
  createCrossProviderTests(stagehandFactory, agentBrowserFactory);

  // AgentBrowser ↔ Stagehand (reverse order)
  createCrossProviderTests(agentBrowserFactory, stagehandFactory);
} else {
  console.warn('⚠ Skipping browser profile lifecycle tests — cannot launch Chromium');
}
