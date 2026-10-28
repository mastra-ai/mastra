import type { MastraBrowser } from '@mastra/core/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeActiveBrowser, replaceActiveBrowser } from './browser-lifecycle.js';

function fakeBrowser(retire: () => Promise<void> = async () => {}) {
  return { retire: vi.fn(retire), killProcesses: vi.fn() } as unknown as MastraBrowser & {
    retire: ReturnType<typeof vi.fn>;
    killProcesses: ReturnType<typeof vi.fn>;
  };
}

describe('browser lifecycle', () => {
  afterEach(async () => {
    vi.useRealTimers();
    await closeActiveBrowser();
  });

  it('retires the active browser on shutdown', async () => {
    const browser = fakeBrowser();
    await replaceActiveBrowser(browser);

    await closeActiveBrowser();

    expect(browser.retire).toHaveBeenCalledOnce();
    expect(browser.killProcesses).not.toHaveBeenCalled();
  });

  it('does not close a browser that is re-applied as the active one', async () => {
    const browser = fakeBrowser();
    await replaceActiveBrowser(browser);
    await replaceActiveBrowser(browser);

    expect(browser.retire).not.toHaveBeenCalled();
  });

  it('kills the browser processes when close fails', async () => {
    const browser = fakeBrowser(async () => {
      throw new Error('CDP gone');
    });
    await replaceActiveBrowser(browser);

    await expect(closeActiveBrowser()).resolves.toBeUndefined();
    expect(browser.killProcesses).toHaveBeenCalledOnce();
  });

  it('kills the browser processes when close hangs, so exit and replacement are not blocked', async () => {
    vi.useFakeTimers();
    const old = fakeBrowser(() => new Promise(() => {}));
    await replaceActiveBrowser(old);

    const next = fakeBrowser();
    const applied = replaceActiveBrowser(next);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(old.killProcesses).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(await applied).toBe(true);
    expect(old.killProcesses).toHaveBeenCalledOnce();
  });

  // Startup loads its browser while /browser can already run: the replacement
  // that finishes closing the old browser last must not win over a newer one.
  it('reports a browser replaced while the previous one was closing as no longer active', async () => {
    let finishClose!: () => void;
    const old = fakeBrowser(() => new Promise<void>(r => (finishClose = r)));
    await replaceActiveBrowser(old);

    const first = fakeBrowser();
    const second = fakeBrowser();
    const firstApplied = replaceActiveBrowser(first);
    const secondApplied = replaceActiveBrowser(second);
    finishClose();

    expect(await firstApplied).toBe(false);
    expect(await secondApplied).toBe(true);
    expect(first.retire).toHaveBeenCalledOnce();
    expect(second.retire).not.toHaveBeenCalled();
  });
});
