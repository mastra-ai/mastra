/**
 * Regression tests for issue #23588.
 *
 * When AgentBrowser connects to an existing browser over `cdpUrl`, that browser
 * runs in another PID namespace (a container, a cloud browser). Its PID must
 * never be captured or signalled locally: `process.kill(-pid, 'SIGKILL')` would
 * target an unrelated local process group (and `kill(-1)` when the remote PID is
 * a container's PID 1 signals every process the Mastra user owns).
 *
 * Locally launched browsers must still have their process group cleaned up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    on: vi.fn(),
  };

  const mockContext = {
    on: vi.fn(),
    browser: vi.fn().mockReturnValue(null),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    getPages: vi.fn().mockReturnValue([mockPage]),
    getContext: vi.fn().mockReturnValue(mockContext),
    getBrowser: vi.fn().mockReturnValue(null),
  };

  return { mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
    getPages = mockManager.getPages;
    getContext = mockManager.getContext;
    getBrowser = mockManager.getBrowser;
  },
}));

// Control the PID the provider would learn over CDP.
const getBrowserPidMock = vi.fn<[], Promise<number | undefined>>();
vi.mock('../utils', () => ({
  getBrowserPid: () => getBrowserPidMock(),
}));

import { AgentBrowser } from '../agent-browser';

describe('issue #23588 — remote browser PID must not reach process.kill', () => {
  let killSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
  });

  afterEach(() => {
    killSpy.mockRestore();
  });

  it('never signals a PID for a browser connected over cdpUrl (disconnect)', async () => {
    // What a container's Chromium PID 1 looks like once learned over CDP.
    getBrowserPidMock.mockResolvedValue(2_000_000_000);

    const browser = new AgentBrowser({ cdpUrl: 'http://127.0.0.1:1', scope: 'shared' }) as any;
    await browser.launch();

    // Let any (unexpected) PID lookup settle.
    await Promise.all(browser.pidLookups ?? []);
    await Promise.resolve();

    expect(browser.sharedBrowserPid).toBeUndefined();

    browser.handleBrowserDisconnected();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('never signals a PID for a browser connected over cdpUrl (close)', async () => {
    getBrowserPidMock.mockResolvedValue(2_000_000_000);

    const browser = new AgentBrowser({ cdpUrl: 'http://127.0.0.1:1', scope: 'shared' }) as any;
    await browser.launch();
    await Promise.all(browser.pidLookups ?? []);

    await browser.close();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('still kills the process group for a locally launched shared browser', async () => {
    getBrowserPidMock.mockResolvedValue(12345);

    const browser = new AgentBrowser({ scope: 'shared' }) as any;
    await browser.launch();

    // Wait for the PID capture to complete.
    await Promise.all(browser.pidLookups ?? []);
    await Promise.resolve();

    expect(browser.sharedBrowserPid).toBe(12345);

    browser.handleBrowserDisconnected();
    expect(killSpy).toHaveBeenCalledWith(-12345, 'SIGKILL');
  });
});
