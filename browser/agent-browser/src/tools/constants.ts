/**
 * Browser Tool Constants
 */

export const BROWSER_TOOLS = {
  // Core
  GOTO: 'browser_goto',
  SNAPSHOT: 'browser_snapshot',
  CLICK: 'browser_click',
  TYPE: 'browser_type',
  PRESS: 'browser_press',
  SELECT: 'browser_select',
  SCROLL: 'browser_scroll',
  CLOSE: 'browser_close',
  // Extended
  HOVER: 'browser_hover',
  BACK: 'browser_back',
  DIALOG: 'browser_dialog',
  WAIT: 'browser_wait',
  TABS: 'browser_tabs',
  DRAG: 'browser_drag',
  // Utility
  SCREENSHOT: 'browser_screenshot',
  // Escape hatch
  EVALUATE: 'browser_evaluate',
} as const;

export type BrowserToolName = (typeof BROWSER_TOOLS)[keyof typeof BROWSER_TOOLS];
