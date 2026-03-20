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
  getSnapshot(options?: { interactive?: boolean; compact?: boolean }): Promise<EnhancedSnapshot>;
  startScreencast(callback: (frame: ScreencastFrame) => void, options?: ScreencastOptions): Promise<void>;
  stopScreencast(): Promise<void>;
  injectMouseEvent(params: MouseEventParams): Promise<void>;
  injectKeyboardEvent(params: KeyboardEventParams): Promise<void>;
}
