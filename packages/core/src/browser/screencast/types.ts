/**
 * Screencast types for CDP-based browser streaming.
 *
 * These types are shared between browser providers (AgentBrowser, Stagehand, etc.)
 * that support screencast via CDP.
 */

/**
 * Options for starting a screencast stream.
 */
export interface ScreencastOptions {
  /** Image format (default: 'jpeg') */
  format?: 'jpeg' | 'png';
  /** JPEG quality 0-100 (default: 80) */
  quality?: number;
  /** Max width in pixels (default: 1280) */
  maxWidth?: number;
  /** Max height in pixels (default: 720) */
  maxHeight?: number;
  /** Capture every Nth frame (default: 1) */
  everyNthFrame?: number;
  /** Thread ID for thread-scoped screencasts (streams from thread's page) */
  threadId?: string;
}

/**
 * Data for a single screencast frame.
 */
export interface ScreencastFrameData {
  /** Base64-encoded image data */
  data: string;
  /** Frame timestamp in milliseconds */
  timestamp: number;
  /** Viewport information */
  viewport: {
    width: number;
    height: number;
    offsetTop?: number;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
    pageScaleFactor?: number;
  };
  /** CDP session ID for acknowledgment (handled internally) */
  sessionId?: number;
}

/**
 * Events emitted by ScreencastStream.
 */
export interface ScreencastEvents {
  /** Emitted when a new frame is received */
  frame: (frame: ScreencastFrameData) => void;
  /** Emitted when screencast stops */
  stop: (reason: 'manual' | 'browser_closed' | 'error') => void;
  /** Emitted on errors */
  error: (error: Error) => void;
  /** Emitted when the page URL changes (navigation detected) */
  url: (url: string) => void;
  /** Index signature for TypedEmitter compatibility */
  [key: string]: (...args: any[]) => void;
}

/**
 * Default screencast options.
 */
export const SCREENCAST_DEFAULTS: Required<Omit<ScreencastOptions, 'threadId'>> = {
  format: 'jpeg',
  quality: 80,
  maxWidth: 1280,
  maxHeight: 720,
  everyNthFrame: 1,
};

/**
 * Abstract CDP session interface.
 * Both Playwright's CDPSession and direct CDP connections implement this.
 */
export interface CdpSessionLike {
  /** Send a CDP command */
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  /** Register an event handler */
  on(event: string, handler: (...args: any[]) => void): void;
  /** Remove an event handler */
  off?(event: string, handler: (...args: any[]) => void): void;
  /** Detach the session */
  detach?(): Promise<void>;
}

/**
 * Provider interface for getting CDP sessions.
 * Browser providers implement this to expose CDP access.
 */
export interface CdpSessionProvider {
  /**
   * Get a CDP session for screencast/input injection.
   * The session should be attached to the current page.
   */
  getCdpSession(): Promise<CdpSessionLike>;

  /**
   * Check if the browser is currently running.
   */
  isBrowserRunning(): boolean;
}
