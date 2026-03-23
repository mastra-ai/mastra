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
// Legacy types (for backwards compatibility - will be removed)
// ============================================================================

export type { BaseBrowserConfig } from './types';

// ============================================================================
// Tool Factory & Helpers
// ============================================================================

export {
  createBrowserTools,
  resolveBrowserToolConfig,
  BROWSER_TOOLS,
  requireBrowser,
  BrowserNotAvailableError,
  browserTools,
} from './tools';

export type { BrowserToolName, BrowserToolConfig, BrowserToolsConfig, BrowserToolExecutionContext } from './tools';

// Individual tool exports
export {
  browserNavigateTool,
  browserInteractTool,
  browserInputTool,
  browserKeyboardTool,
  browserFormTool,
  browserScrollTool,
  browserExtractTool,
  browserElementStateTool,
  browserStateTool,
  browserStorageTool,
  browserEmulationTool,
  browserFramesTool,
  browserDialogsTool,
  browserTabsTool,
  browserRecordingTool,
  browserMonitoringTool,
  browserClipboardTool,
  browserDebugTool,
  browserWaitTool,
} from './tools';

// ============================================================================
// Schemas (19 grouped tools)
// ============================================================================

export {
  // 1. Navigate (5 actions: goto, back, forward, reload, close)
  navigateInputSchema,
  // 2. Interact (6 actions: click, double_click, hover, focus, drag, tap)
  interactInputSchema,
  // 3. Input (5 actions: fill, type, press, clear, select_all)
  inputInputSchema,
  // 4. Keyboard (4 actions: type, insert_text, key_down, key_up)
  keyboardInputSchema,
  // 5. Form (4 actions: select, check, uncheck, upload)
  formInputSchema,
  // 6. Scroll (2 actions: scroll, into_view)
  scrollInputSchema,
  // 7. Extract (12 actions: snapshot, screenshot, text, html, value, attribute, title, url, count, bounding_box, styles, evaluate)
  extractInputSchema,
  // 8. Element State (3 actions: is_visible, is_enabled, is_checked)
  elementStateInputSchema,
  // 9. Browser State (5 actions: set_viewport, set_credentials, get_cookies, set_cookie, clear_cookies)
  browserStateInputSchema,
  // 10. Storage (6 actions via type + action)
  storageInputSchema,
  // 11. Emulation (5 actions: device, media, geolocation, offline, headers)
  emulationInputSchema,
  // 12. Frames (2 actions: switch, main)
  framesInputSchema,
  // 13. Dialogs (2 actions: handle, clear)
  dialogsInputSchema,
  // 14. Tabs (4 actions: list, new, switch, close)
  tabsInputSchema,
  // 15. Recording (4 actions: record_start, record_stop, trace_start, trace_stop)
  recordingInputSchema,
  // 16. Monitoring (9 actions via type + action)
  monitoringInputSchema,
  // 17. Clipboard (4 actions: copy, paste, read, write)
  clipboardInputSchema,
  // 18. Debug (2 actions: inspect, highlight)
  debugInputSchema,
  // 19. Wait
  waitInputSchema,
} from './schemas';

export type {
  NavigateInput,
  InteractInput,
  InputInput,
  KeyboardInput,
  FormInput,
  ScrollInput,
  ExtractInput,
  ElementStateInput,
  BrowserStateInput,
  StorageInput,
  EmulationInput,
  FramesInput,
  DialogsInput,
  TabsInput,
  RecordingInput,
  MonitoringInput,
  ClipboardInput,
  DebugInput,
  WaitInput,
} from './schemas';
