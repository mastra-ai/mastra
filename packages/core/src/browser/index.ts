// ============================================================================
// MastraBrowser Base Class
// ============================================================================

export { MastraBrowser } from './browser';
export type {
  BrowserStatus,
  BrowserLifecycleHook,
  BrowserConfig,
  CdpUrlProvider,
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

// ============================================================================
// BrowserViewer (for Workspace browser capabilities)
// ============================================================================

export { BrowserViewer, CLI_SKILL_REPOS } from './viewer';
export type {
  BrowserViewerConfig,
  BrowserViewerEvents,
  BuiltInCLIProvider,
  CustomCLIProvider,
  CLIProvider,
} from './viewer';
