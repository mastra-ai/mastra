import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrowserManagerLike, ScreencastFrame } from '../browser-types.js';
import { SCREENCAST_DEFAULTS } from './constants.js';
import { ScreencastStream } from './screencast-stream.js';

function createMockManager(overrides?: Partial<BrowserManagerLike>): BrowserManagerLike {
  return {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getPage: vi.fn().mockReturnValue({
      url: () => '',
      title: async () => '',
      goto: vi.fn(),
      screenshot: vi.fn(),
      evaluate: vi.fn(),
      viewportSize: () => null,
    }),
    getLocatorFromRef: vi.fn().mockReturnValue(null),
    getCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
    getSnapshot: vi.fn().mockResolvedValue({ tree: '' }),
    startScreencast: vi.fn().mockResolvedValue(undefined),
    stopScreencast: vi.fn().mockResolvedValue(undefined),
    injectMouseEvent: vi.fn().mockResolvedValue(undefined),
    injectKeyboardEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ScreencastStream', () => {
  let manager: BrowserManagerLike;
  let stream: ScreencastStream;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = createMockManager();
    stream = new ScreencastStream(manager);
  });

  afterEach(async () => {
    if (stream.isActive()) {
      await stream.stop();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('applies default options when none provided', () => {
      const s = new ScreencastStream(manager);
      expect(s.isActive()).toBe(false);
    });

    it('accepts custom options', () => {
      const s = new ScreencastStream(manager, { quality: 50, format: 'png' });
      expect(s.isActive()).toBe(false);
    });
  });

  describe('start', () => {
    it('calls startScreencast on the browser manager', async () => {
      await stream.start();
      expect(manager.startScreencast).toHaveBeenCalledOnce();
      expect(stream.isActive()).toBe(true);
    });

    it('passes resolved options to startScreencast', async () => {
      const customStream = new ScreencastStream(manager, { quality: 50, maxWidth: 640 });
      await customStream.start();

      const [, options] = (manager.startScreencast as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options).toEqual({
        ...SCREENCAST_DEFAULTS,
        quality: 50,
        maxWidth: 640,
      });
    });

    it('is a no-op if already active', async () => {
      await stream.start();
      await stream.start();
      expect(manager.startScreencast).toHaveBeenCalledOnce();
    });
  });

  describe('stop', () => {
    it('calls stopScreencast on the browser manager', async () => {
      await stream.start();
      await stream.stop();
      expect(manager.stopScreencast).toHaveBeenCalledOnce();
      expect(stream.isActive()).toBe(false);
    });

    it('emits stop event with reason manual', async () => {
      await stream.start();
      const stopHandler = vi.fn();
      stream.on('stop', stopHandler);

      await stream.stop();
      expect(stopHandler).toHaveBeenCalledWith('manual');
    });

    it('is a no-op if already stopped', async () => {
      await stream.stop();
      expect(manager.stopScreencast).not.toHaveBeenCalled();
    });

    it('does not throw if stopScreencast fails', async () => {
      manager = createMockManager({
        stopScreencast: vi.fn().mockRejectedValue(new Error('CDP gone')),
      });
      stream = new ScreencastStream(manager);
      await stream.start();

      // Should not throw
      await expect(stream.stop()).resolves.toBeUndefined();
      expect(stream.isActive()).toBe(false);
    });
  });

  describe('frame events', () => {
    it('emits frame events from screencast callback', async () => {
      // Capture the callback passed to startScreencast
      let capturedCallback: ((frame: ScreencastFrame) => void) | undefined;
      manager = createMockManager({
        startScreencast: vi.fn().mockImplementation(cb => {
          capturedCallback = cb;
          return Promise.resolve();
        }),
      });
      stream = new ScreencastStream(manager);

      const frameHandler = vi.fn();
      stream.on('frame', frameHandler);

      await stream.start();

      // Simulate a frame from CDP
      capturedCallback!({
        data: 'base64data',
        metadata: {
          deviceWidth: 1280,
          deviceHeight: 720,
          offsetTop: 0,
          scrollOffsetX: 0,
          scrollOffsetY: 100,
          pageScaleFactor: 1,
          timestamp: 12345,
        },
        sessionId: 1,
      });

      expect(frameHandler).toHaveBeenCalledOnce();
      const emittedFrame = frameHandler.mock.calls[0][0];
      expect(emittedFrame.data).toBe('base64data');
      expect(emittedFrame.viewport.width).toBe(1280);
      expect(emittedFrame.viewport.height).toBe(720);
      expect(emittedFrame.viewport.scrollOffsetY).toBe(100);
      expect(emittedFrame.sessionId).toBe(1);
      expect(emittedFrame.timestamp).toBe(12345);
    });

    it('uses Date.now() when frame has no timestamp', async () => {
      let capturedCallback: ((frame: ScreencastFrame) => void) | undefined;
      manager = createMockManager({
        startScreencast: vi.fn().mockImplementation(cb => {
          capturedCallback = cb;
          return Promise.resolve();
        }),
      });
      stream = new ScreencastStream(manager);

      const frameHandler = vi.fn();
      stream.on('frame', frameHandler);

      await stream.start();

      capturedCallback!({
        data: 'data',
        metadata: {
          deviceWidth: 100,
          deviceHeight: 100,
          offsetTop: 0,
          scrollOffsetX: 0,
          scrollOffsetY: 0,
          pageScaleFactor: 1,
          // no timestamp
        },
        sessionId: 2,
      });

      const emittedFrame = frameHandler.mock.calls[0][0];
      expect(emittedFrame.timestamp).toBeGreaterThan(0);
    });
  });

  describe('isActive', () => {
    it('returns false before start', () => {
      expect(stream.isActive()).toBe(false);
    });

    it('returns true after start', async () => {
      await stream.start();
      expect(stream.isActive()).toBe(true);
    });

    it('returns false after stop', async () => {
      await stream.start();
      await stream.stop();
      expect(stream.isActive()).toBe(false);
    });
  });
});
