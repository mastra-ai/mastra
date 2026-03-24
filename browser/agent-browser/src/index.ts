// Main exports
export { AgentBrowser } from './agent-browser.js';

// Type exports
export type { BrowserConfig } from './types.js';
export type {
  BrowserLocator,
  BrowserPage,
  BrowserKeyboard,
  BrowserContext,
  BrowserCookie,
  BrowserManagerLike,
  ScreencastFrame,
  BrowserTab,
  EnhancedSnapshot,
} from './browser-types.js';

// Screencast exports
export { ScreencastStream, SCREENCAST_DEFAULTS, MAX_RETRIES } from './screencast/index.js';
export type { ScreencastOptions, ScreencastFrameData, ScreencastError, ScreencastEvents } from './screencast/index.js';

// Tool exports
export { createAgentBrowserTools, BROWSER_TOOLS } from './tools/index.js';
export type { BrowserToolName } from './tools/index.js';

// Schema exports
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
} from './schemas.js';

export type {
  GotoInput,
  SnapshotInput,
  ClickInput,
  TypeInput,
  PressInput,
  SelectInput,
  ScrollInput,
  ScreenshotInput,
  CloseInput,
  HoverInput,
  BackInput,
  UploadInput,
  DialogInput,
  WaitInput,
  TabsInput,
  DragInput,
  EvaluateInput,
} from './schemas.js';
