/**
 * AgentBrowser profile lifecycle tests.
 *
 * Tests all combinations of scope × profile × headless × close-type.
 * Set BROWSER_TEST_HEADED=1 to include headed tests.
 */
import { createProviderTests } from '@internal/browser-test-utils';
import type { BrowserFactory } from '@internal/browser-test-utils';
import { AgentBrowser } from '../index';

const agentBrowserFactory: BrowserFactory = {
  name: 'AgentBrowser',
  create: ({ profile, scope, headless }) => new AgentBrowser({ headless, scope, profile }),
  navigate: async (browser, url, threadId) => {
    const result = await (browser as AgentBrowser).goto({ url }, threadId);
    if ('error' in result) throw new Error(`Goto failed: ${result.error}`);
  },
};

createProviderTests(agentBrowserFactory);
