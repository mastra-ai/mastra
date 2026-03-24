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
  MouseEventParams,
  KeyboardEventParams,
} from './browser';

// ============================================================================
// Error handling
// ============================================================================

export { createError } from './errors';
export type { ErrorCode, BrowserToolError } from './errors';

// ============================================================================
// Tool Configuration & Constants
// ============================================================================

export {
  BROWSER_TOOLS,
  resolveBrowserToolConfig,
  ALL_BROWSER_TOOLS,
  createBrowserTools,
  getBrowserToolNames,
} from './tools';

export type { BrowserToolName, BrowserToolConfig, BrowserToolsConfig } from './tools';

// ============================================================================
// Tool Helpers
// ============================================================================

export { requireBrowser, BrowserNotAvailableError } from './tools/helpers';
export type { BrowserToolExecutionContext } from './tools/helpers';

// ============================================================================
// Individual tool exports (17 flat tools)
// ============================================================================

export {
  // Core (9)
  browserGotoTool,
  browserSnapshotTool,
  browserClickTool,
  browserTypeTool,
  browserPressTool,
  browserSelectTool,
  browserScrollTool,
  browserScreenshotTool,
  browserCloseTool,
  // Extended (7)
  browserHoverTool,
  browserBackTool,
  browserUploadTool,
  browserDialogTool,
  browserWaitTool,
  browserTabsTool,
  browserDragTool,
  // Escape hatch (1)
  browserEvaluateTool,
} from './tools';

// ============================================================================
// Schemas (17 flat tools)
// ============================================================================

export {
  // Core (9)
  gotoInputSchema,
  snapshotInputSchema,
  clickInputSchema,
  typeInputSchema,
  pressInputSchema,
  selectInputSchema,
  scrollInputSchema,
  screenshotInputSchema,
  closeInputSchema,
  // Extended (7)
  hoverInputSchema,
  backInputSchema,
  uploadInputSchema,
  dialogInputSchema,
  waitInputSchema,
  tabsInputSchema,
  dragInputSchema,
  // Escape hatch (1)
  evaluateInputSchema,
  // All schemas
  browserSchemas,
} from './schemas';

export type {
  // Core (9)
  GotoInput,
  SnapshotInput,
  ClickInput,
  TypeInput,
  PressInput,
  SelectInput,
  ScrollInput,
  ScreenshotInput,
  CloseInput,
  // Extended (7)
  HoverInput,
  BackInput,
  UploadInput,
  DialogInput,
  WaitInput,
  TabsInput,
  DragInput,
  // Escape hatch (1)
  EvaluateInput,
} from './schemas';
