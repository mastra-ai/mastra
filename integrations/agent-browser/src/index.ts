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
  BrowserError,
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
} from './types.js';
