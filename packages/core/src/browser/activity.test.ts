import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraBrowser } from './browser';

class TestBrowser extends MastraBrowser {
  id = 'test';
  name = 'test';
  provider = 'test';
  launches = 0;
  closes = 0;
  enableIdle(ms: number) {
    this.configureIdleTimeout(ms);
  }
  protected async doLaunch() {
    this.launches++;
  }
  protected async doClose() {
    this.closes++;
  }
  protected async getActivePage() {
    return null;
  }
  protected getBrowserStateForThread() {
    return null;
  }
  getTools() {
    return {};
  }
  override async getBrowserState() {
    return { tabs: [{ url: 'https://example.com' }], activeTabIndex: 0 };
  }
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

afterEach(() => vi.useRealTimers());

describe('browser activity ownership', () => {
  it('automatically closes at the deadline without any browser client connected', async () => {
    vi.useFakeTimers();
    const browser = new TestBrowser();
    browser.enableIdle(120000);
    await browser.ensureReady();
    await vi.advanceTimersByTimeAsync(90000);
    expect(browser.getActivityState().idleDeadlineAt! - Date.now()).toBe(30000);
    await vi.advanceTimersByTimeAsync(30000);
    expect(browser.status).toBe('closed');
    expect(browser.closes).toBe(1);
  });
  it('closes only the expired incarnation and preserves saved tabs', async () => {
    vi.useFakeTimers();
    const browser = new TestBrowser();
    await browser.ensureReady();
    const before = browser.getActivityState();
    await vi.advanceTimersByTimeAsync(119999);
    expect(await browser.closeIfIdle(before.incarnation, 120000)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await browser.closeIfIdle(before.incarnation, 120000)).toBe(true);
    expect(browser.getLastBrowserState()?.tabs[0]?.url).toBe('https://example.com');
    await browser.ensureReady();
    await vi.advanceTimersByTimeAsync(120000);
    expect(await browser.closeIfIdle(before.incarnation, 120000)).toBe(false);
    expect(browser.closes).toBe(1);
  });

  it('protects a long operation and starts a fresh idle window when it finishes', async () => {
    vi.useFakeTimers();
    const browser = new TestBrowser();
    await browser.ensureReady();
    const gate = deferred();
    const operation = browser.runBrowserOperation(() => gate.promise);
    await vi.advanceTimersByTimeAsync(300000);
    expect(await browser.closeIfIdle(browser.getActivityState().incarnation, 120000)).toBe(false);
    gate.resolve();
    await operation;
    expect(browser.getActivityState().activeOperations).toBe(0);
    expect(await browser.closeIfIdle(browser.getActivityState().incarnation, 120000)).toBe(false);
  });

  it('releases protection after a failed operation', async () => {
    const browser = new TestBrowser();
    await browser.ensureReady();
    await expect(
      browser.runBrowserOperation(async () => {
        throw new Error('aborted');
      }),
    ).rejects.toThrow('aborted');
    expect(browser.getActivityState().activeOperations).toBe(0);
  });

  it('explicit input resets time; status reads do not', async () => {
    vi.useFakeTimers();
    const browser = new TestBrowser();
    await browser.ensureReady();
    const before = browser.getActivityState();
    await vi.advanceTimersByTimeAsync(90000);
    expect(browser.getActivityState().lastActivityAt).toBe(before.lastActivityAt);
    browser.recordActivity();
    await vi.advanceTimersByTimeAsync(30000);
    expect(await browser.closeIfIdle(before.incarnation, 120000)).toBe(false);
  });

  it('serializes duplicate closes before an asynchronous hook', async () => {
    const gate = deferred();
    const hook = vi.fn(() => gate.promise);
    const browser = new TestBrowser({ onClose: hook });
    await browser.ensureReady();
    const closing = browser.close();
    const duplicate = browser.close();
    await Promise.resolve();
    expect(hook).toHaveBeenCalledTimes(1);
    expect(browser.getActivityState().status).toBe('closing');
    const operation = vi.fn(async () => undefined);
    const queued = browser.runBrowserOperation(operation);
    await Promise.resolve();
    expect(operation).not.toHaveBeenCalled();
    gate.resolve();
    await Promise.all([closing, duplicate, queued]);
    expect(browser.closes).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('allows a launch hook to close without waiting for itself', async () => {
    const browser = new TestBrowser({
      onLaunch: async ({ browser }) => {
        await browser.close();
      },
    });
    await browser.ensureReady();
    expect(browser.status).toBe('closed');
    expect(browser.closes).toBe(1);
  });

  it('allows a close hook to read a ready browser without deadlock', async () => {
    const browser = new TestBrowser({
      onClose: async ({ browser }) => {
        await browser.ensureReady();
        await browser.close();
        expect(browser.status).toBe('ready');
      },
    });
    await browser.ensureReady();
    await browser.close();
    expect(browser.closes).toBe(1);
  });

  it('does not deadlock a launch hook when an external close already awaits launch', async () => {
    const gate = deferred();
    const browser = new TestBrowser({
      onLaunch: async ({ browser }) => {
        await browser.close();
        await browser.ensureReady();
        await browser.runBrowserOperation(async () => undefined);
      },
    });
    vi.spyOn(browser as any, 'doLaunch').mockImplementation(() => gate.promise);
    const launching = browser.ensureReady();
    const closing = browser.close();
    gate.resolve();
    await Promise.all([launching, closing]);
    expect(browser.status).toBe('closed');
    expect(browser.closes).toBe(1);
  });

  it('retains a failed close for an explicit retry', async () => {
    const browser = new TestBrowser();
    await browser.ensureReady();
    const close = vi.spyOn(browser as any, 'doClose').mockRejectedValueOnce(new Error('close failed'));
    await expect(browser.close()).rejects.toThrow('close failed');
    expect(browser.status).toBe('error');
    await browser.close();
    expect(close).toHaveBeenCalledTimes(2);
    expect(browser.status).toBe('closed');
  });

  it('retries the same idle closure after a state-capture error', async () => {
    vi.useFakeTimers();
    const browser = new TestBrowser();
    await browser.ensureReady();
    const state = browser.getActivityState();
    const capture = vi.spyOn(browser, 'getBrowserState').mockRejectedValueOnce(new Error('capture unavailable'));
    await vi.advanceTimersByTimeAsync(120000);
    await expect(browser.closeIfIdle(state.incarnation, 120000)).rejects.toThrow('capture unavailable');
    expect(browser.closes).toBe(0);
    expect(await browser.closeIfIdle(state.incarnation, 120000)).toBe(true);
    expect(browser.closes).toBe(1);
    expect(capture).toHaveBeenCalledTimes(2);
  });
});
