/**
 * CDP-based ScreencastStream implementation.
 *
 * This provides a unified screencast implementation that works with any
 * CDP session provider (Playwright, Puppeteer, direct CDP, etc.).
 */

import { EventEmitter } from 'node:events';
import type { CdpSessionLike, CdpSessionProvider, ScreencastFrameData, ScreencastOptions } from './types';
import { SCREENCAST_DEFAULTS } from './types';

/**
 * CDP screencast frame event data from Page.screencastFrame
 */
interface CdpScreencastFrame {
  data: string;
  sessionId: number;
  metadata?: {
    deviceWidth?: number;
    deviceHeight?: number;
    offsetTop?: number;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
    pageScaleFactor?: number;
    timestamp?: number;
  };
}

/**
 * ScreencastStream wraps CDP screencast with an event emitter interface.
 *
 * Works with any CDP session provider (Playwright, Puppeteer, direct CDP).
 *
 * @example
 * ```typescript
 * const stream = new ScreencastStream(cdpProvider, { quality: 80 });
 * stream.on('frame', (frame) => {
 *   console.log(`Frame: ${frame.viewport.width}x${frame.viewport.height}`);
 * });
 * await stream.start();
 * // Later...
 * await stream.stop();
 * ```
 */
export class ScreencastStream extends EventEmitter {
  /** Whether screencast is currently active */
  private active: boolean = false;

  /** Resolved options with defaults applied */
  private options: Required<ScreencastOptions>;

  /** CDP session provider */
  private provider: CdpSessionProvider;

  /** Current CDP session */
  private cdpSession: CdpSessionLike | null = null;

  /** Frame handler reference (for cleanup) */
  private frameHandler: ((params: CdpScreencastFrame) => void) | null = null;

  /**
   * Creates a new ScreencastStream.
   *
   * @param provider - CDP session provider (browser instance)
   * @param options - Screencast configuration options
   */
  constructor(provider: CdpSessionProvider, options?: ScreencastOptions) {
    super();
    this.provider = provider;
    this.options = { ...SCREENCAST_DEFAULTS, ...options };
  }

  /**
   * Start the screencast.
   * If already active, returns immediately.
   */
  async start(): Promise<void> {
    if (this.active) {
      return;
    }

    if (!this.provider.isBrowserRunning()) {
      throw new Error('Browser is not running');
    }

    try {
      // Get CDP session from provider
      this.cdpSession = await this.provider.getCdpSession();

      // Set up frame handler
      this.frameHandler = (params: CdpScreencastFrame) => {
        const frameData: ScreencastFrameData = {
          data: params.data,
          timestamp: params.metadata?.timestamp ?? Date.now(),
          viewport: {
            width: params.metadata?.deviceWidth ?? 0,
            height: params.metadata?.deviceHeight ?? 0,
            offsetTop: params.metadata?.offsetTop,
            scrollOffsetX: params.metadata?.scrollOffsetX,
            scrollOffsetY: params.metadata?.scrollOffsetY,
            pageScaleFactor: params.metadata?.pageScaleFactor,
          },
          sessionId: params.sessionId,
        };

        this.emit('frame', frameData);

        // Acknowledge frame to continue receiving
        this.acknowledgeFrame(params.sessionId);
      };

      this.cdpSession.on('Page.screencastFrame', this.frameHandler);

      // Start screencast via CDP
      await this.cdpSession.send('Page.startScreencast', {
        format: this.options.format,
        quality: this.options.quality,
        maxWidth: this.options.maxWidth,
        maxHeight: this.options.maxHeight,
        everyNthFrame: this.options.everyNthFrame,
      });

      this.active = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Acknowledge a frame to CDP (required to continue receiving frames).
   */
  private acknowledgeFrame(sessionId: number): void {
    if (!this.cdpSession) return;

    this.cdpSession.send('Page.screencastFrameAck', { sessionId }).catch(() => {
      // Ignore ack errors - session may be closed
    });
  }

  /**
   * Stop the screencast and release resources.
   */
  async stop(): Promise<void> {
    if (!this.active) {
      return;
    }

    this.active = false;

    try {
      if (this.cdpSession) {
        // Remove frame handler
        if (this.frameHandler && this.cdpSession.off) {
          this.cdpSession.off('Page.screencastFrame', this.frameHandler);
        }
        this.frameHandler = null;

        // Stop screencast
        await this.cdpSession.send('Page.stopScreencast');

        // Don't detach - the session may be shared
        this.cdpSession = null;
      }

      this.emit('stop', 'manual');
    } catch (error) {
      console.warn('[ScreencastStream] Error stopping screencast:', error);
      this.emit('stop', 'error');
    }
  }

  /**
   * Check if screencast is currently active.
   */
  isActive(): boolean {
    return this.active;
  }
}
