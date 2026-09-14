/**
 * Regression tests for issue #23588 (Stagehand provider).
 *
 * A Browserbase session or a browser reached over `cdpUrl` runs in another PID
 * namespace. Its Chrome PID must never be captured, or the base class would run
 * `process.kill(-pid, 'SIGKILL')` against an unrelated local process group.
 * Locally launched browsers must still have their PID captured for cleanup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStagehandConstructor } = vi.hoisted(() => ({
  mockStagehandConstructor: vi.fn(),
}));

vi.mock('@browserbasehq/stagehand', () => ({
  Stagehand: class MockStagehand {
    constructor(options: unknown) {
      mockStagehandConstructor(options);
    }
  },
}));

import { StagehandBrowser } from '../stagehand-browser';

// A Stagehand instance that reports a local Chrome PID, as the real one does
// for env: 'LOCAL'. getStagehandChromePid reads `state.chrome.process.pid`.
function stagehandWithPid(pid: number): any {
  return { state: { kind: 'LOCAL', chrome: { process: { pid } } } };
}

describe('issue #23588 — Stagehand must not capture a remote browser PID', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('treats cdpUrl and BROWSERBASE as remote, LOCAL as owned', () => {
    const local = new StagehandBrowser({ scope: 'shared' }) as any;
    expect(local.isConnectedToRemoteBrowser()).toBe(false);

    const cdp = new StagehandBrowser({ cdpUrl: 'http://127.0.0.1:9222' }) as any;
    expect(cdp.isConnectedToRemoteBrowser()).toBe(true);

    const bb = new StagehandBrowser({ env: 'BROWSERBASE', apiKey: 'k', projectId: 'p' }) as any;
    expect(bb.isConnectedToRemoteBrowser()).toBe(true);
  });

  it('does not capture the PID when connected over cdpUrl', () => {
    const browser = new StagehandBrowser({ cdpUrl: 'http://127.0.0.1:9222' }) as any;

    browser.setupCloseListener(stagehandWithPid(2_000_000_000), () => {});

    expect(browser.sharedBrowserPid).toBeUndefined();
  });

  it('captures the PID for a locally launched browser', () => {
    const browser = new StagehandBrowser({ scope: 'shared' }) as any;

    browser.setupCloseListener(stagehandWithPid(12345), () => {});

    expect(browser.sharedBrowserPid).toBe(12345);
  });
});
