// Main exports
export { BrowserToolset } from './toolset.js';

// Error handling exports
export { createError } from './errors.js';
export type { BrowserToolError, ErrorCode } from './errors.js';

// Type exports
export type {
  BrowserToolsetConfig,
  NavigateInput,
  NavigateOutput,
  SnapshotInput,
  SnapshotOutput,
  ClickInput,
  ClickOutput,
  TypeInput,
  TypeOutput,
  ScrollInput,
  ScrollOutput,
  ScreenshotInput,
  ScreenshotOutput,
} from './types.js';

// Schema exports (for advanced usage)
export {
  navigateInputSchema,
  navigateOutputSchema,
  snapshotInputSchema,
  snapshotOutputSchema,
  clickInputSchema,
  clickOutputSchema,
  typeInputSchema,
  typeOutputSchema,
  scrollInputSchema,
  scrollOutputSchema,
  screenshotInputSchema,
  screenshotOutputSchema,
} from './types.js';

// Screencast exports
export {
  ScreencastStream,
  SCREENCAST_DEFAULTS,
  MAX_RETRIES,
} from './screencast/index.js';

export type {
  ScreencastOptions,
  ScreencastFrameData,
  ScreencastError,
  ScreencastEvents,
} from './screencast/index.js';
