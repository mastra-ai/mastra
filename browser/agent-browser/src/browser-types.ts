/**
 * Minimal type definitions for agent-browser's BrowserManager.
 *
 * We define our own interfaces rather than importing from `agent-browser`
 * to avoid pulling in Playwright's massive type graph during type generation.
 * At runtime, the real BrowserManager is loaded via dynamic import.
 */

export interface ScreencastFrame {
  data: string;
  metadata: {
    offsetTop: number;
    pageScaleFactor: number;
    deviceWidth: number;
    deviceHeight: number;
    scrollOffsetX: number;
    scrollOffsetY: number;
    timestamp?: number;
  };
  sessionId: number;
}

export interface BrowserLocator {
  click(options?: { button?: string; timeout?: number; clickCount?: number }): Promise<void>;
  dblclick(options?: { button?: string; timeout?: number }): Promise<void>;
  fill(value: string, options?: { timeout?: number }): Promise<void>;
  focus(options?: { timeout?: number }): Promise<void>;
  hover(options?: { timeout?: number }): Promise<void>;
  check(options?: { timeout?: number }): Promise<void>;
  uncheck(options?: { timeout?: number }): Promise<void>;
  isChecked(options?: { timeout?: number }): Promise<boolean>;
  inputValue(options?: { timeout?: number }): Promise<string>;
  textContent(options?: { timeout?: number }): Promise<string | null>;
  innerText(options?: { timeout?: number }): Promise<string>;
  screenshot(options?: { type?: string; timeout?: number }): Promise<Buffer>;
  selectOption(
    values: { value?: string; label?: string; index?: number },
    options?: { timeout?: number },
  ): Promise<string[]>;
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
  evaluate<T>(fn: (el: any, ...args: any[]) => T, ...args: any[]): Promise<T>;
  scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void>;
  dragTo(target: BrowserLocator, options?: { timeout?: number }): Promise<void>;
  waitFor(options?: { state?: 'visible' | 'hidden' | 'attached' | 'detached'; timeout?: number }): Promise<void>;
  getAttribute(name: string): Promise<string | null>;
}

export interface BrowserCDPSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface BrowserKeyboard {
  press(key: string, options?: { delay?: number }): Promise<void>;
  type(text: string, options?: { delay?: number }): Promise<void>;
  down(key: string): Promise<void>;
  up(key: string): Promise<void>;
  insertText(text: string): Promise<void>;
}

export interface BrowserContext {
  cookies(urls?: string | string[]): Promise<BrowserCookie[]>;
  addCookies(cookies: BrowserCookie[]): Promise<void>;
  clearCookies(): Promise<void>;
}

export interface BrowserCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface BrowserPage {
  goto(url: string, options?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  goBack(options?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  goForward(options?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  reload(options?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  url(): string;
  title(): Promise<string>;
  content(): Promise<string>;
  screenshot(options?: { fullPage?: boolean; type?: string; quality?: number; timeout?: number }): Promise<Buffer>;
  evaluate<T>(expression: string | ((...args: any[]) => T), ...args: any[]): Promise<T>;
  viewportSize(): { width: number; height: number } | null;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  keyboard: BrowserKeyboard;
  context(): BrowserContext;
  waitForTimeout(timeout: number): Promise<void>;
}

export interface EnhancedSnapshot {
  tree: string;
}

export interface ScreencastOptions {
  format?: 'jpeg' | 'png';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  everyNthFrame?: number;
}

export interface LaunchOptions {
  id: string;
  action: 'launch';
  headless?: boolean;
}

export interface MouseEventParams {
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle' | 'none';
  clickCount?: number;
  deltaX?: number;
  deltaY?: number;
  modifiers?: number;
}

export interface KeyboardEventParams {
  type: 'keyDown' | 'keyUp' | 'char';
  key?: string;
  code?: string;
  text?: string;
  modifiers?: number;
}

/** Tab information */
export interface BrowserTab {
  index: number;
  url: string;
  title: string;
  active: boolean;
}

/** Recording result */
export interface RecordingResult {
  path: string;
  duration?: number;
  fileSize?: number;
}

/** Profiler result */
export interface ProfilerResult {
  path: string;
  fileSize?: number;
}

/**
 * Minimal interface matching agent-browser's BrowserManager.
 * Used for type-safe coding without importing the actual package types.
 */
export interface BrowserManagerLike {
  launch(options: LaunchOptions): Promise<void>;
  close(): Promise<void>;
  getPage(): BrowserPage;
  getLocatorFromRef(refArg: string): BrowserLocator | null;
  getCDPSession(): Promise<BrowserCDPSession>;
  getSnapshot(options?: {
    interactive?: boolean;
    compact?: boolean;
    maxDepth?: number;
    selector?: string;
  }): Promise<EnhancedSnapshot>;
  startScreencast(callback: (frame: ScreencastFrame) => void, options?: ScreencastOptions): Promise<void>;
  stopScreencast(): Promise<void>;
  injectMouseEvent(params: MouseEventParams): Promise<void>;
  injectKeyboardEvent(params: KeyboardEventParams): Promise<void>;

  // Frame management (optional)
  getFrame?(): BrowserFrame;
  switchToFrame?(options: { selector?: string; name?: string; url?: string }): Promise<void>;
  switchToMainFrame?(): void;

  // Dialog handling (optional)
  setDialogHandler?(action: 'accept' | 'dismiss', promptText?: string): void;
  clearDialogHandler?(): void;

  // Geolocation (optional)
  setGeolocation?(latitude: number, longitude: number, accuracy?: number): Promise<void>;

  // Network control (optional)
  setOffline?(offline: boolean): Promise<void>;
  setExtraHeaders?(headers: Record<string, string>): Promise<void>;
  setScopedHeaders?(origin: string, headers: Record<string, string>): Promise<void>;

  // Tab management (optional)
  listTabs?(): Promise<BrowserTab[]>;
  newTab?(url?: string): Promise<{ index: number; total: number }>;
  switchTo?(index: number): Promise<{ index: number; url: string; title: string }>;
  closeTab?(index?: number): Promise<{ closed: number; remaining: number }>;
  getActiveIndex?(): number;

  // Recording (optional)
  startRecording?(outputPath: string, url?: string): Promise<void>;
  stopRecording?(): Promise<{ path: string; frames?: number }>;

  // Tracing (optional)
  startTracing?(options: { screenshots?: boolean; snapshots?: boolean }): Promise<void>;
  stopTracing?(path: string): Promise<void>;

  // Network tracking (optional)
  startRequestTracking?(): void;
  getRequests?(filter?: string): NetworkRequest[];
  clearRequests?(): void;

  // Console tracking (optional)
  startConsoleTracking?(): void;
  getConsoleMessages?(): ConsoleMessage[];
  clearConsoleMessages?(): void;

  // Error tracking (optional)
  startErrorTracking?(): void;
  getPageErrors?(): PageError[];
  clearPageErrors?(): void;
}

/** Frame interface */
export interface BrowserFrame {
  url(): string;
}

/** Network request info */
export interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  timestamp: number;
}

/** Console message info */
export interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: number;
}

/** Page error info */
export interface PageError {
  message: string;
  timestamp: number;
}
