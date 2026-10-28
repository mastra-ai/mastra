import type { MastraBrowser } from '@mastra/core/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeActiveBrowser, replaceActiveBrowser } from './browser-lifecycle.js';

function fakeBrowser(close: () => Promise<void> = async () => {}) {
  return { close: vi.fn(close) } as unknown as MastraBrowser & { close: ReturnType<typeof vi.fn> };
}

describe('browser lifecycle', () => {
  afterEach(async () => {
    vi.useRealTimers();
    await closeActiveBrowser();
  });

  it('closes the active browser on shutdown', async () => {
    const browser = fakeBrowser();
    await replaceActiveBrowser(browser);

    await closeActiveBrowser();

    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('does not close a browser that is re-applied as the active one', async () => {
    const browser = fakeBrowser();
    await replaceActiveBrowser(browser);
    await replaceActiveBrowser(browser);

    expect(browser.close).not.toHaveBeenCalled();
  });

  it('still finishes shutdown when the browser fails to close', async () => {
    const browser = fakeBrowser(async () => {
      throw new Error('CDP gone');
    });
    await replaceActiveBrowser(browser);

    await expect(closeActiveBrowser()).resolves.toBeUndefined();
  });

  it('gives up on a hung browser close so exit is not blocked', async () => {
    vi.useFakeTimers();
    const browser = fakeBrowser(() => new Promise(() => {}));
    await replaceActiveBrowser(browser);

    const closing = closeActiveBrowser();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(closing).resolves.toBeUndefined();
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
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
  });
});
