/**
 * Stagehand profile lifecycle tests.
 *
 * Tests all combinations of scope × profile × headless × close-type.
 * Set BROWSER_TEST_HEADED=1 to include headed tests.
 */
import { createProviderTests, type BrowserFactory } from '@internal/browser-test-utils';
import { StagehandBrowser } from '../index';

const stagehandFactory: BrowserFactory = {
  name: 'Stagehand',
  create: ({ profile, scope, headless }) => new StagehandBrowser({ headless, scope, profile }),
  navigate: async (browser, url, threadId) => {
    const result = await (browser as StagehandBrowser).navigate({ url }, threadId);
    if ('error' in result) throw new Error(`Navigate failed: ${result.error}`);
  },
};

createProviderTests(stagehandFactory);
