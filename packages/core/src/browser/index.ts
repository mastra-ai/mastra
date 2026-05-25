// ============================================================================
// MastraBrowser Base Class
// ============================================================================

export { MastraBrowser } from './browser';
export type {
  BrowserStatus,
  BrowserLifecycleHook,
  BrowserConfig,
  BrowserConfigBase,
  CdpUrlProvider,
  ScreencastOptions,
  ScreencastStream,
  ScreencastFrameData,
  ScreencastEvents,
  MouseEventParams,
  KeyboardEventParams,
} from './browser';

// ============================================================================
// Thread Manager
// ============================================================================

export { ThreadManager, DEFAULT_THREAD_ID } from './thread-manager';
export type { BrowserState, BrowserTabState, BrowserScope, ThreadSession, ThreadManagerConfig } from './thread-manager';

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

// ============================================================================
// CLI Handler
// ============================================================================

export { BrowserCliHandler, browserCliHandler } from './cli-handler';
export type { BrowserCliConfig, BrowserCliProcessResult } from './cli-handler';
