// ============================================================================
// MastraBrowser Base Class
// ============================================================================

export { MastraBrowser } from './browser';
export type {
  BrowserStatus,
  BrowserLifecycleHook,
  BrowserConfig,
  ScreencastOptions,
  ScreencastStream,
  ScreencastFrameData,
  ScreencastEvents,
  MouseEventParams,
  KeyboardEventParams,
} from './browser';

// ============================================================================
// Screencast
// ============================================================================

export { ScreencastStream as ScreencastStreamImpl, SCREENCAST_DEFAULTS } from './screencast';
export type { CdpSessionLike, CdpSessionProvider } from './screencast';

// ============================================================================
// Error handling
// ============================================================================

export { createError } from './errors';
export type { ErrorCode, BrowserToolError } from './errors';

// ============================================================================
// Processor
// ============================================================================

export { BrowserContextProcessor } from './processor';
export type { BrowserContext } from './processor';
