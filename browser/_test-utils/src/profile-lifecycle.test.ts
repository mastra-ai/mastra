/**
 * Cross-provider profile lifecycle tests.
 *
 * Tests that profiles can be shared between Stagehand and AgentBrowser.
 * Per-provider tests live in each provider's package.
 *
 * Set BROWSER_TEST_HEADED=1 to include headed tests.
 */
import { AgentBrowser } from '@mastra/agent-browser';
import { StagehandBrowser } from '@mastra/stagehand';

import { createCrossProviderTests, type BrowserFactory } from './factory';

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
};

const agentBrowserFactory: BrowserFactory = {
  name: 'AgentBrowser',
  create: ({ profile, scope, headless }) => new AgentBrowser({ headless, scope, profile }),
  navigate: async (browser, url, threadId) => {
    const result = await (browser as AgentBrowser).goto({ url }, threadId);
    if ('error' in result) throw new Error(`Goto failed: ${result.error}`);
  },
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
