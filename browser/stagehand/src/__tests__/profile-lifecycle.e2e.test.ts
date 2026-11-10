/**
 * Stagehand profile lifecycle tests.
 *
 * Tests all combinations of scope × profile × headless × close-type.
 * Set BROWSER_TEST_HEADED=1 to include headed tests.
 */
import { createProviderTests } from '@internal/browser-test-utils';
import type { BrowserFactory } from '@internal/browser-test-utils';
import { StagehandBrowser } from '../index';
import { getStagehandChromePid } from '../utils';

const stagehandFactory: BrowserFactory = {
  name: 'Stagehand',
  patchesExitType: true,
  create: ({ profile, scope, headless, executablePath }) =>
    new StagehandBrowser({
      headless,
      scope,
      profile,
      executablePath,
      preserveUserDataDir: Boolean(profile),
    }),
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

createProviderTests(stagehandFactory);
