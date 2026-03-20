import type { ToolsInput } from '../agent/types';

// ============================================================================
// Error handling
// ============================================================================

export { createError } from './errors';
export type { ErrorCode, BrowserToolError } from './errors';

// ============================================================================
// Tool schemas & types
// ============================================================================

export {
  // Core tools
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
  selectInputSchema,
  selectOutputSchema,
  screenshotInputSchema,
  screenshotOutputSchema,
  closeInputSchema,
  closeOutputSchema,
  // Interaction tools
  hoverInputSchema,
  hoverOutputSchema,
  focusInputSchema,
  focusOutputSchema,
  doubleClickInputSchema,
  doubleClickOutputSchema,
  checkInputSchema,
  checkOutputSchema,
  pressInputSchema,
  pressOutputSchema,
  fillInputSchema,
  fillOutputSchema,
  dragInputSchema,
  dragOutputSchema,
  // Keyboard tools
  keyboardTypeInputSchema,
  keyboardTypeOutputSchema,
  keyboardInsertTextInputSchema,
  keyboardInsertTextOutputSchema,
  keyDownInputSchema,
  keyDownOutputSchema,
  keyUpInputSchema,
  keyUpOutputSchema,
  // Data extraction tools
  getTextInputSchema,
  getTextOutputSchema,
  getHtmlInputSchema,
  getHtmlOutputSchema,
  getValueInputSchema,
  getValueOutputSchema,
  getAttributeInputSchema,
  getAttributeOutputSchema,
  evaluateInputSchema,
  evaluateOutputSchema,
  // Scroll/viewport tools
  scrollIntoViewInputSchema,
  scrollIntoViewOutputSchema,
  setViewportInputSchema,
  setViewportOutputSchema,
  // Cookie tools
  getCookiesInputSchema,
  getCookiesOutputSchema,
  setCookieInputSchema,
  setCookieOutputSchema,
  clearCookiesInputSchema,
  clearCookiesOutputSchema,
  // Wait tool
  waitInputSchema,
  waitOutputSchema,
  // Navigation history tools
  goBackInputSchema,
  goBackOutputSchema,
  goForwardInputSchema,
  goForwardOutputSchema,
  reloadInputSchema,
  reloadOutputSchema,
  // Tab management tools
  getTabsInputSchema,
  getTabsOutputSchema,
  switchTabInputSchema,
  switchTabOutputSchema,
  newTabInputSchema,
  newTabOutputSchema,
  closeTabInputSchema,
  closeTabOutputSchema,
  // Device emulation tools
  setDeviceInputSchema,
  setDeviceOutputSchema,
  setMediaInputSchema,
  setMediaOutputSchema,
  // Debugging tools
  highlightInputSchema,
  highlightOutputSchema,
  inspectInputSchema,
  inspectOutputSchema,
  // Batch command tool
  batchInputSchema,
  batchOutputSchema,
  // Uncheck tool
  uncheckInputSchema,
  uncheckOutputSchema,
  // Page info tools
  getTitleInputSchema,
  getTitleOutputSchema,
  getUrlInputSchema,
  getUrlOutputSchema,
  // Element info tools
  getCountInputSchema,
  getCountOutputSchema,
  getBoundingBoxInputSchema,
  getBoundingBoxOutputSchema,
  // State check tools
  isVisibleInputSchema,
  isVisibleOutputSchema,
  isEnabledInputSchema,
  isEnabledOutputSchema,
  isCheckedInputSchema,
  isCheckedOutputSchema,
  // Frame tools
  frameSwitchInputSchema,
  frameSwitchOutputSchema,
  frameMainInputSchema,
  frameMainOutputSchema,
  // Dialog tools
  dialogHandleInputSchema,
  dialogHandleOutputSchema,
  dialogClearInputSchema,
  dialogClearOutputSchema,
  // Geolocation tool
  setGeolocationInputSchema,
  setGeolocationOutputSchema,
  // Offline tool
  setOfflineInputSchema,
  setOfflineOutputSchema,
  // Headers tool
  setHeadersInputSchema,
  setHeadersOutputSchema,
  // LocalStorage tools
  storageGetInputSchema,
  storageGetOutputSchema,
  storageSetInputSchema,
  storageSetOutputSchema,
  storageClearInputSchema,
  storageClearOutputSchema,
  // Tab tools
  tabsListInputSchema,
  tabsListOutputSchema,
  tabNewInputSchema,
  tabNewOutputSchema,
  tabSwitchInputSchema,
  tabSwitchOutputSchema,
  tabCloseInputSchema,
  tabCloseOutputSchema,
  // Recording tools
  recordStartInputSchema,
  recordStartOutputSchema,
  recordStopInputSchema,
  recordStopOutputSchema,
  // Tracing tools
  traceStartInputSchema,
  traceStartOutputSchema,
  traceStopInputSchema,
  traceStopOutputSchema,
  // Network tracking tools
  networkStartInputSchema,
  networkStartOutputSchema,
  networkGetInputSchema,
  networkGetOutputSchema,
  networkClearInputSchema,
  networkClearOutputSchema,
  // Console tracking tools
  consoleStartInputSchema,
  consoleStartOutputSchema,
  consoleGetInputSchema,
  consoleGetOutputSchema,
  consoleClearInputSchema,
  consoleClearOutputSchema,
  // Error tracking tools
  errorsStartInputSchema,
  errorsStartOutputSchema,
  errorsGetInputSchema,
  errorsGetOutputSchema,
  errorsClearInputSchema,
  errorsClearOutputSchema,
} from './schemas';

export type {
  // Core types
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
  SelectInput,
  SelectOutput,
  ScreenshotInput,
  ScreenshotOutput,
  CloseInput,
  CloseOutput,
  BaseBrowserConfig,
  // Interaction types
  HoverInput,
  HoverOutput,
  FocusInput,
  FocusOutput,
  DoubleClickInput,
  DoubleClickOutput,
  CheckInput,
  CheckOutput,
  PressInput,
  PressOutput,
  FillInput,
  FillOutput,
  DragInput,
  DragOutput,
  // Keyboard types
  KeyboardTypeInput,
  KeyboardTypeOutput,
  KeyboardInsertTextInput,
  KeyboardInsertTextOutput,
  KeyDownInput,
  KeyDownOutput,
  KeyUpInput,
  KeyUpOutput,
  // Data extraction types
  GetTextInput,
  GetTextOutput,
  GetHtmlInput,
  GetHtmlOutput,
  GetValueInput,
  GetValueOutput,
  GetAttributeInput,
  GetAttributeOutput,
  EvaluateInput,
  EvaluateOutput,
  // Scroll/viewport types
  ScrollIntoViewInput,
  ScrollIntoViewOutput,
  SetViewportInput,
  SetViewportOutput,
  // Cookie types
  GetCookiesInput,
  GetCookiesOutput,
  SetCookieInput,
  SetCookieOutput,
  ClearCookiesInput,
  ClearCookiesOutput,
  // Wait type
  WaitInput,
  WaitOutput,
  // Navigation history types
  GoBackInput,
  GoBackOutput,
  GoForwardInput,
  GoForwardOutput,
  ReloadInput,
  ReloadOutput,
  // Tab management types
  GetTabsInput,
  GetTabsOutput,
  SwitchTabInput,
  SwitchTabOutput,
  NewTabInput,
  NewTabOutput,
  CloseTabInput,
  CloseTabOutput,
  // Device emulation types
  SetDeviceInput,
  SetDeviceOutput,
  SetMediaInput,
  SetMediaOutput,
  // Debugging types
  HighlightInput,
  HighlightOutput,
  InspectInput,
  InspectOutput,
  // Batch command types
  BatchInput,
  BatchOutput,
  // Uncheck type
  UncheckInput,
  UncheckOutput,
  // Page info types
  GetTitleInput,
  GetTitleOutput,
  GetUrlInput,
  GetUrlOutput,
  // Element info types
  GetCountInput,
  GetCountOutput,
  GetBoundingBoxInput,
  GetBoundingBoxOutput,
  // State check types
  IsVisibleInput,
  IsVisibleOutput,
  IsEnabledInput,
  IsEnabledOutput,
  IsCheckedInput,
  IsCheckedOutput,
  // Frame types
  FrameSwitchInput,
  FrameSwitchOutput,
  FrameMainInput,
  FrameMainOutput,
  // Dialog types
  DialogHandleInput,
  DialogHandleOutput,
  DialogClearInput,
  DialogClearOutput,
  // Geolocation type
  SetGeolocationInput,
  SetGeolocationOutput,
  // Offline type
  SetOfflineInput,
  SetOfflineOutput,
  // Headers type
  SetHeadersInput,
  SetHeadersOutput,
  // LocalStorage types
  StorageGetInput,
  StorageGetOutput,
  StorageSetInput,
  StorageSetOutput,
  StorageClearInput,
  StorageClearOutput,
  // Tab types
  TabsListInput,
  TabsListOutput,
  TabNewInput,
  TabNewOutput,
  TabSwitchInput,
  TabSwitchOutput,
  TabCloseInput,
  TabCloseOutput,
  // Recording types
  RecordStartInput,
  RecordStartOutput,
  RecordStopInput,
  RecordStopOutput,
  // Tracing types
  TraceStartInput,
  TraceStartOutput,
  TraceStopInput,
  TraceStopOutput,
  // Network tracking types
  NetworkStartInput,
  NetworkStartOutput,
  NetworkGetInput,
  NetworkGetOutput,
  NetworkClearInput,
  NetworkClearOutput,
  // Console tracking types
  ConsoleStartInput,
  ConsoleStartOutput,
  ConsoleGetInput,
  ConsoleGetOutput,
  ConsoleClearInput,
  ConsoleClearOutput,
  // Error tracking types
  ErrorsStartInput,
  ErrorsStartOutput,
  ErrorsGetInput,
  ErrorsGetOutput,
  ErrorsClearInput,
  ErrorsClearOutput,
} from './schemas';

// ============================================================================
// Structural interfaces (for Agent.browser integration)
// ============================================================================

/** Options for screencast streaming */
export interface ScreencastOptionsLike {
  format?: 'jpeg' | 'png';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  everyNthFrame?: number;
}

/** Screencast stream with event-emitter interface */
export interface ScreencastStreamLike {
  on(event: 'frame', handler: (frame: { data: string; viewport: { width: number; height: number } }) => void): void;
  on(event: 'stop', handler: (reason: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  stop(): Promise<void>;
}

/**
 * Structural interface for browser toolsets compatible with Agent.browser.
 *
 * Any object satisfying this shape can be used as an agent's browser — no need
 * to extend a base class.  This keeps `@mastra/core` free of runtime browser
 * dependencies while still giving first-class typing.
 */
export interface BrowserToolsetLike {
  /** Browser automation tools to be merged into agent tools */
  readonly tools: ToolsInput;

  /**
   * Check if the browser is currently running.
   * Does NOT launch the browser — just checks current state.
   */
  isBrowserRunning(): boolean;

  /**
   * Register a callback to be invoked when the browser launches.
   * If browser is already running, callback is invoked immediately.
   * @returns Cleanup function to unregister the callback
   */
  onBrowserReady(callback: () => void): () => void;

  /**
   * Start screencast streaming for live browser view.
   * Launches browser if not already running.
   */
  startScreencast(options?: ScreencastOptionsLike): Promise<ScreencastStreamLike>;

  /**
   * Start screencast only if browser is already running.
   * Does NOT launch the browser — returns null if not running.
   */
  startScreencastIfBrowserActive(options?: ScreencastOptionsLike): Promise<ScreencastStreamLike | null>;

  /**
   * Get the current page URL without launching the browser.
   * @returns The current URL string, or null if browser is not running
   */
  getCurrentUrl(): string | null;

  /** Close browser and release resources */
  close(): Promise<void>;

  /**
   * Inject a mouse event into the browser via CDP.
   * Used by server to forward user mouse interactions from live view.
   */
  injectMouseEvent(event: {
    type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
    x: number;
    y: number;
    button?: 'left' | 'right' | 'middle' | 'none';
    clickCount?: number;
    deltaX?: number;
    deltaY?: number;
    modifiers?: number;
  }): Promise<void>;

  /**
   * Inject a keyboard event into the browser via CDP.
   * Used by server to forward user keyboard interactions from live view.
   */
  injectKeyboardEvent(event: {
    type: 'keyDown' | 'keyUp' | 'char';
    key?: string;
    code?: string;
    text?: string;
    modifiers?: number;
  }): Promise<void>;
}
