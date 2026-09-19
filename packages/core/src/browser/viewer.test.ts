import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
import type { MastraBrowser } from './browser';
import { BrowserViewer } from './viewer';

function fixture() {
  const stream = Object.assign(new EventEmitter(), {
    stop: vi.fn(async () => {}),
    reconnect: vi.fn(async () => {}),
  });
  const browser = {
    startScreencastIfBrowserActive: vi.fn(async () => stream),
    getBrowserState: vi.fn(async () => ({ tabs: [{ url: 'about:blank' }], activeTabIndex: 0 })),
    getActivityState: vi.fn(() => ({ incarnation: 'launch-one' })),
    getScreencastFormat: () => 'png',
    getViewerViewport: () => undefined,
    onBrowserClosed: vi.fn(() => vi.fn()),
    isBrowserRunning: vi.fn(() => true),
    executeViewerCommand: vi.fn(async () => {}),
  };
  return { stream, browser, viewer: new BrowserViewer(browser as unknown as MastraBrowser, 'thread-one') };
}

describe('native shared browser viewer', () => {
  it('shares one capture and stops it only after the last viewer disconnects', async () => {
    const { stream, browser, viewer } = fixture();
    const first = vi.fn();
    const second = vi.fn();
    const [releaseFirst, releaseSecond] = await Promise.all([viewer.subscribe(first), viewer.subscribe(second)]);
    expect(browser.startScreencastIfBrowserActive).toHaveBeenCalledTimes(1);
    stream.emit('frame', { data: 'frame', viewport: { width: 640, height: 800 } });
    expect(first).toHaveBeenCalledWith(expect.objectContaining({ type: 'frame', format: 'png' }));
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ type: 'frame' }));
    await releaseFirst();
    await releaseFirst();
    expect(stream.stop).not.toHaveBeenCalled();
    await releaseSecond();
    expect(stream.stop).toHaveBeenCalledTimes(1);
  });

  it('fails without launching when no browser is active', async () => {
    const { browser, viewer } = fixture();
    browser.startScreencastIfBrowserActive.mockResolvedValueOnce(null as never);
    await expect(viewer.subscribe(vi.fn())).rejects.toThrow('not running');
    expect(browser.executeViewerCommand).not.toHaveBeenCalled();
  });

  it('rejects commands queued for an old launch and preserves order', async () => {
    const { browser, viewer } = fixture();
    let finish!: () => void;
    browser.executeViewerCommand.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const first = viewer.command({ type: 'text', text: 'a' }, 'launch-one');
    const second = viewer.command({ type: 'text', text: 'b' }, 'launch-one');
    await vi.waitFor(() => expect(browser.executeViewerCommand).toHaveBeenCalledTimes(1));
    browser.getActivityState.mockReturnValue({ incarnation: 'launch-two' });
    finish();
    await first;
    await expect(second).rejects.toThrow('connection changed');
    expect(browser.executeViewerCommand).toHaveBeenCalledTimes(1);
  });
});
