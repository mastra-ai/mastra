import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreencastStream } from './screencast-stream';
import { SCREENCAST_DEFAULTS } from './types';
import type { CdpSessionLike, CdpSessionProvider, ScreencastFrameData } from './types';

/**
 * Creates a mock CDP session for testing.
 */
function createMockCdpSession(overrides?: Partial<CdpSessionLike>): CdpSessionLike {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock CDP session provider for testing.
 */
function createMockProvider(overrides?: {
  cdpSession?: Partial<CdpSessionLike>;
  isBrowserRunning?: boolean;
}): CdpSessionProvider {
  const mockSession = createMockCdpSession(overrides?.cdpSession);
  return {
    getCdpSession: vi.fn().mockResolvedValue(mockSession),
    isBrowserRunning: vi.fn().mockReturnValue(overrides?.isBrowserRunning ?? true),
  };
}

describe('ScreencastStream', () => {
  let provider: CdpSessionProvider;
  let stream: ScreencastStream;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createMockProvider();
    stream = new ScreencastStream(provider);
  });

  afterEach(async () => {
    if (stream.isActive()) {
      await stream.stop();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('applies default options when none provided', () => {
      const s = new ScreencastStream(provider);
      expect(s.isActive()).toBe(false);
    });

    it('accepts custom options', () => {
      const s = new ScreencastStream(provider, { quality: 50, format: 'png' });
      expect(s.isActive()).toBe(false);
    });
  });

  describe('start', () => {
    it('gets CDP session and starts screencast', async () => {
      await stream.start();

      expect(provider.getCdpSession).toHaveBeenCalledOnce();
      expect(stream.isActive()).toBe(true);
    });

    it('passes options to Page.startScreencast', async () => {
      const customStream = new ScreencastStream(provider, { quality: 50, maxWidth: 640 });
      await customStream.start();

      const mockSession = await provider.getCdpSession();
      expect(mockSession.send).toHaveBeenCalledWith('Page.startScreencast', {
        ...SCREENCAST_DEFAULTS,
        quality: 50,
        maxWidth: 640,
      });
    });

    it('registers frame handler on CDP session', async () => {
      await stream.start();

      const mockSession = await provider.getCdpSession();
      expect(mockSession.on).toHaveBeenCalledWith('Page.screencastFrame', expect.any(Function));
    });

    it('is a no-op if already active', async () => {
      await stream.start();
      await stream.start();
      expect(provider.getCdpSession).toHaveBeenCalledOnce();
    });

    it('throws if browser is not running', async () => {
      provider = createMockProvider({ isBrowserRunning: false });
      stream = new ScreencastStream(provider);

      await expect(stream.start()).rejects.toThrow('Browser is not running');
      expect(stream.isActive()).toBe(false);
    });

    it('emits error event on failure', async () => {
      const mockSession = createMockCdpSession({
        send: vi.fn().mockRejectedValue(new Error('CDP error')),
      });
      provider = {
        getCdpSession: vi.fn().mockResolvedValue(mockSession),
        isBrowserRunning: vi.fn().mockReturnValue(true),
      };
      stream = new ScreencastStream(provider);

      const errorHandler = vi.fn();
      stream.on('error', errorHandler);

      await expect(stream.start()).rejects.toThrow('CDP error');
      expect(errorHandler).toHaveBeenCalledOnce();
    });
  });

  describe('stop', () => {
    it('calls Page.stopScreencast on CDP session', async () => {
      await stream.start();
      const mockSession = await provider.getCdpSession();

      await stream.stop();

      expect(mockSession.send).toHaveBeenCalledWith('Page.stopScreencast');
      expect(stream.isActive()).toBe(false);
    });

    it('removes frame handler from CDP session', async () => {
      await stream.start();
      const mockSession = await provider.getCdpSession();

      await stream.stop();

      expect(mockSession.off).toHaveBeenCalledWith('Page.screencastFrame', expect.any(Function));
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
      expect(provider.getCdpSession).not.toHaveBeenCalled();
    });

    it('emits stop with error reason if stopScreencast fails', async () => {
      const mockSession = createMockCdpSession({
        send: vi.fn().mockImplementation((method: string) => {
          if (method === 'Page.stopScreencast') {
            return Promise.reject(new Error('CDP gone'));
          }
          return Promise.resolve();
        }),
      });
      provider = {
        getCdpSession: vi.fn().mockResolvedValue(mockSession),
        isBrowserRunning: vi.fn().mockReturnValue(true),
      };
      stream = new ScreencastStream(provider);

      await stream.start();

      const stopHandler = vi.fn();
      stream.on('stop', stopHandler);

      // Should not throw
      await expect(stream.stop()).resolves.toBeUndefined();
      expect(stream.isActive()).toBe(false);
      expect(stopHandler).toHaveBeenCalledWith('error');
    });
  });

  describe('frame events', () => {
    it('emits frame events from Page.screencastFrame', async () => {
      // Capture the frame handler
      let capturedHandler: ((params: any) => void) | undefined;
      const mockSession = createMockCdpSession({
        on: vi.fn().mockImplementation((event: string, handler: any) => {
          if (event === 'Page.screencastFrame') {
            capturedHandler = handler;
          }
        }),
      });
      provider = {
        getCdpSession: vi.fn().mockResolvedValue(mockSession),
        isBrowserRunning: vi.fn().mockReturnValue(true),
      };
      stream = new ScreencastStream(provider);

      const frameHandler = vi.fn();
      stream.on('frame', frameHandler);

      await stream.start();

      // Simulate a frame from CDP
      capturedHandler!({
        data: 'base64data',
        sessionId: 1,
        metadata: {
          deviceWidth: 1280,
          deviceHeight: 720,
          offsetTop: 0,
          scrollOffsetX: 0,
          scrollOffsetY: 100,
          pageScaleFactor: 1,
          timestamp: 12345,
        },
      });

      expect(frameHandler).toHaveBeenCalledOnce();
      const emittedFrame: ScreencastFrameData = frameHandler.mock.calls[0][0];
      expect(emittedFrame.data).toBe('base64data');
      expect(emittedFrame.viewport.width).toBe(1280);
      expect(emittedFrame.viewport.height).toBe(720);
      expect(emittedFrame.viewport.scrollOffsetY).toBe(100);
      expect(emittedFrame.sessionId).toBe(1);
      // CDP timestamp is in seconds, converted to milliseconds
      expect(emittedFrame.timestamp).toBe(12345 * 1000);
    });

    it('acknowledges frames via Page.screencastFrameAck', async () => {
      let capturedHandler: ((params: any) => void) | undefined;
      const mockSession = createMockCdpSession({
        on: vi.fn().mockImplementation((event: string, handler: any) => {
          if (event === 'Page.screencastFrame') {
            capturedHandler = handler;
          }
        }),
      });
      provider = {
        getCdpSession: vi.fn().mockResolvedValue(mockSession),
        isBrowserRunning: vi.fn().mockReturnValue(true),
      };
      stream = new ScreencastStream(provider);

      await stream.start();

      // Simulate a frame
      capturedHandler!({
        data: 'data',
        sessionId: 42,
        metadata: {},
      });

      expect(mockSession.send).toHaveBeenCalledWith('Page.screencastFrameAck', { sessionId: 42 });
    });

    it('uses Date.now() when frame has no timestamp', async () => {
      let capturedHandler: ((params: any) => void) | undefined;
      const mockSession = createMockCdpSession({
        on: vi.fn().mockImplementation((event: string, handler: any) => {
          if (event === 'Page.screencastFrame') {
            capturedHandler = handler;
          }
        }),
      });
      provider = {
        getCdpSession: vi.fn().mockResolvedValue(mockSession),
        isBrowserRunning: vi.fn().mockReturnValue(true),
      };
      stream = new ScreencastStream(provider);

      const frameHandler = vi.fn();
      stream.on('frame', frameHandler);

      await stream.start();

      const beforeTime = Date.now();
      capturedHandler!({
        data: 'data',
        sessionId: 2,
        metadata: {
          deviceWidth: 100,
          deviceHeight: 100,
          // no timestamp
        },
      });
      const afterTime = Date.now();

      const emittedFrame: ScreencastFrameData = frameHandler.mock.calls[0][0];
      expect(emittedFrame.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(emittedFrame.timestamp).toBeLessThanOrEqual(afterTime);
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
