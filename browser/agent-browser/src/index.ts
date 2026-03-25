// Main exports
export { AgentBrowser } from './agent-browser';

// Type exports
export type { BrowserConfig } from './types';
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
} from './browser-types';

// Screencast exports (re-exported from core)
export { ScreencastStreamImpl, SCREENCAST_DEFAULTS } from '@mastra/core/browser';
export type { ScreencastOptions, ScreencastFrameData, ScreencastEvents } from '@mastra/core/browser';

// Tool exports
export { createAgentBrowserTools, BROWSER_TOOLS } from './tools';
export type { BrowserToolName } from './tools';

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
} from './schemas';

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
} from './schemas';
