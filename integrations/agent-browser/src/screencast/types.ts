/**
 * Screencast event emitter interface for TypedEmitter.
 * Defines all events that ScreencastStream can emit.
 */
export interface ScreencastEvents {
  /** Emitted when a new frame is received from CDP */
  frame: (frame: ScreencastFrameData) => void;

  /** Emitted when an error occurs during screencast */
  error: (error: ScreencastError) => void;

  /** Emitted when screencast stops */
  stop: (reason: 'manual' | 'browser_closed' | 'error') => void;

  /** Emitted when attempting to reconnect after a transient error */
  reconnecting: (attempt: number, maxAttempts: number) => void;

  /** Emitted when reconnection succeeds */
  reconnected: () => void;
}

/**
 * Data for a single screencast frame.
 * Transformed from CDP's Page.screencastFrame event.
 */
export interface ScreencastFrameData {
  /** Base64-encoded image data */
  data: string;

  /** Frame timestamp in milliseconds */
  timestamp: number;

  /** Viewport information at time of capture */
  viewport: {
    /** Viewport width in CSS pixels */
    width: number;

    /** Viewport height in CSS pixels */
    height: number;

    /** Top offset in CSS pixels */
    offsetTop: number;

    /** Horizontal scroll offset in CSS pixels */
    scrollOffsetX: number;

    /** Vertical scroll offset in CSS pixels */
    scrollOffsetY: number;

    /** Page scale factor (zoom level) */
    pageScaleFactor: number;
  };

  /** CDP session ID for frame acknowledgment (handled internally) */
  sessionId: number;
}

/**
 * Error information for screencast failures.
 */
export interface ScreencastError {
  /** Error category */
  code: 'cdp_error' | 'browser_closed' | 'retry_exhausted' | 'unknown';

  /** Human-readable error message */
  message: string;

  /** Original error if available */
  cause?: Error;

  /** Whether the operation can be retried */
  canRetry: boolean;
}

/**
 * User-facing options for screencast configuration.
 * Subset of CDP Page.startScreencast parameters.
 */
export interface ScreencastOptions {
  /** Image format for frames (default: 'jpeg') */
  format?: 'jpeg' | 'png';

  /** Image quality 0-100 for jpeg format (default: 70) */
  quality?: number;

  /** Maximum width in pixels (default: 1280) */
  maxWidth?: number;

  /** Maximum height in pixels (default: 720) */
  maxHeight?: number;

  /** Send every Nth frame (default: 2) */
  everyNthFrame?: number;
}
