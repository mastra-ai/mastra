import { EventEmitter } from 'events';
import type TypedEmitter from 'typed-emitter';
import type { BrowserManager, ScreencastFrame } from 'agent-browser/dist/browser.js';

import { SCREENCAST_DEFAULTS } from './constants.js';
import type { ScreencastEvents, ScreencastFrameData, ScreencastOptions } from './types.js';

/**
 * ScreencastStream wraps BrowserManager's screencast callback with an event emitter interface.
 *
 * Provides typed events for frame delivery, errors, and lifecycle management.
 * Frame acknowledgment (screencastFrameAck) is handled internally by BrowserManager.
 *
 * @example
 * ```typescript
 * const stream = new ScreencastStream(browserManager, { quality: 80 });
 * stream.on('frame', (frame) => console.log(`Frame: ${frame.viewport.width}x${frame.viewport.height}`));
 * stream.on('stop', (reason) => console.log('Stopped:', reason));
 * await stream.start();
 * // Later...
 * await stream.stop();
 * ```
 */
export class ScreencastStream extends (EventEmitter as new () => TypedEmitter<ScreencastEvents>) {
  /** Whether screencast is currently active */
  private active: boolean = false;

  /** Resolved options with defaults applied */
  private options: Required<ScreencastOptions>;

  /** Reference to the BrowserManager instance */
  private browserManager: BrowserManager;

  /**
   * Creates a new ScreencastStream.
   *
   * @param browserManager - BrowserManager instance to use for screencast
   * @param options - Screencast configuration options
   */
  constructor(browserManager: BrowserManager, options?: ScreencastOptions) {
    super();
    this.browserManager = browserManager;
    this.options = { ...SCREENCAST_DEFAULTS, ...options };
  }

  /**
   * Start the screencast.
   * If already active, returns immediately.
   */
  async start(): Promise<void> {
    if (this.active) {
      return; // Already running
    }

    await this.startInternal();
    this.active = true;
  }

  /**
   * Internal method to start screencast via BrowserManager.
   */
  private async startInternal(): Promise<void> {
    await this.browserManager.startScreencast(
      (frame: ScreencastFrame) => {
        // Transform CDP frame to our structured format
        const frameData: ScreencastFrameData = {
          data: frame.data,
          timestamp: frame.metadata.timestamp ?? Date.now(),
          viewport: {
            width: frame.metadata.deviceWidth,
            height: frame.metadata.deviceHeight,
            offsetTop: frame.metadata.offsetTop,
            scrollOffsetX: frame.metadata.scrollOffsetX,
            scrollOffsetY: frame.metadata.scrollOffsetY,
            pageScaleFactor: frame.metadata.pageScaleFactor,
          },
          sessionId: frame.sessionId,
        };
        this.emit('frame', frameData);
        // Note: BrowserManager handles screencastFrameAck internally
      },
      this.options
    );
  }

  /**
   * Stop the screencast and release resources.
   * If already stopped, returns immediately.
   * Emits 'stop' event with reason 'manual'.
   */
  async stop(): Promise<void> {
    if (!this.active) {
      return; // Already stopped
    }

    this.active = false;

    try {
      await this.browserManager.stopScreencast();
    } catch (error) {
      // Log but don't throw - cleanup should be best-effort
      console.warn('[ScreencastStream] Error stopping screencast:', error);
    }

    this.emit('stop', 'manual');
  }

  /**
   * Check if screencast is currently active.
   *
   * @returns true if screencast is running
   */
  isActive(): boolean {
    return this.active;
  }
}
