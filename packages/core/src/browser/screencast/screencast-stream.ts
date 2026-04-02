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

  /** Resolved options with defaults applied (excludes threadId which is only used for page selection) */
  private options: Required<Omit<ScreencastOptions, 'threadId'>>;

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
    // Extract threadId (used by caller for page selection) and merge remaining options
    const { threadId: _, ...cdpOptions } = options ?? {};
    this.options = { ...SCREENCAST_DEFAULTS, ...cdpOptions };
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
          // CDP provides timestamp in seconds, convert to milliseconds for consistency
          timestamp: params.metadata?.timestamp ? params.metadata.timestamp * 1000 : Date.now(),
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
      try {
        await this.cdpSession.send('Page.startScreencast', {
          format: this.options.format,
          quality: this.options.quality,
          maxWidth: this.options.maxWidth,
          maxHeight: this.options.maxHeight,
          everyNthFrame: this.options.everyNthFrame,
        });
      } catch (startError) {
        // Clean up handler before re-throwing to prevent resource leak
        if (this.cdpSession?.off) {
          try {
            this.cdpSession.off('Page.screencastFrame', this.frameHandler);
          } catch {
            // Ignore cleanup errors
          }
        }
        this.frameHandler = null;
        this.cdpSession = null;
        throw startError;
      }

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
   * Safe to call even if browser/CDP session is already closed.
   */
  async stop(): Promise<void> {
    if (!this.active) {
      return;
    }

    this.active = false;
    let hadError = false;

    // Clean up handler regardless of CDP state
    if (this.cdpSession && this.frameHandler && this.cdpSession.off) {
      try {
        this.cdpSession.off('Page.screencastFrame', this.frameHandler);
      } catch {
        // Ignore - session may be dead
      }
    }
    this.frameHandler = null;

    // Try to stop screencast via CDP (may fail if browser closed)
    if (this.cdpSession) {
      try {
        await this.cdpSession.send('Page.stopScreencast');
      } catch {
        // Browser/session already closed - this is expected in external close scenarios
        hadError = true;
      }
      this.cdpSession = null;
    }

    this.emit('stop', hadError ? 'error' : 'manual');
  }

  /**
   * Check if screencast is currently active.
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Emit a URL update event.
   * Browser providers call this when navigation is detected.
   */
  emitUrl(url: string): void {
    this.emit('url', url);
  }

  /**
   * Reconnect the screencast by stopping and restarting.
   * Use this when the active page/tab changes.
   *
   * @returns Promise that resolves when reconnection is complete
   * @throws Error if reconnection fails (also emits 'error' event)
   */
  async reconnect(): Promise<void> {
    // Clean up existing session
    if (this.cdpSession && this.frameHandler && this.cdpSession.off) {
      try {
        this.cdpSession.off('Page.screencastFrame', this.frameHandler);
      } catch {
        // Ignore - session may be dead
      }
    }
    this.frameHandler = null;

    // Try to stop screencast on old session (may fail if session is dead)
    if (this.cdpSession) {
      try {
        await this.cdpSession.send('Page.stopScreencast');
      } catch {
        // Old session may already be detached - this is expected
      }
      this.cdpSession = null;
    }

    // Mark as inactive so start() will work
    this.active = false;

    // Restart with fresh session from provider
    try {
      await this.start();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[ScreencastStream.reconnect] Failed to reconnect:', err);
      // Don't emit 'error' here - start() already emits it before rejecting
      throw err;
    }
  }
}
