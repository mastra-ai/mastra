/**
 * Browser Tool Helpers
 *
 * Runtime assertions for extracting browser resources from tool execution context.
 */

import type { ToolExecutionContext } from '../../tools/types';
import type { MastraBrowser } from '../browser';

/**
 * Error thrown when browser is not available in tool execution context.
 */
export class BrowserNotAvailableError extends Error {
  constructor() {
    super('Browser is not available. Ensure a browser provider is configured.');
    this.name = 'BrowserNotAvailableError';
  }
}

/**
 * Extended context type with browser property.
 * This mirrors how workspace is added to ToolExecutionContext.
 */
export interface BrowserToolExecutionContext extends ToolExecutionContext {
  browser?: MastraBrowser;
}

/**
 * Extract browser from tool execution context.
 * Throws if browser is not available.
 *
 * Usage in tools:
 * ```ts
 * execute: async (input, context) => {
 *   const browser = await requireBrowser(context);
 *   return browser.navigate(input);
 * }
 * ```
 */
export function requireBrowser(context: ToolExecutionContext): MastraBrowser {
  const browser = (context as BrowserToolExecutionContext).browser;
  if (!browser) {
    throw new BrowserNotAvailableError();
  }
  return browser;
}

/**
 * Extract browser from context and ensure it's ready (launched).
 * This lazily launches the browser on first tool use.
 *
 * Usage in tools:
 * ```ts
 * execute: async (input, context) => {
 *   const browser = await ensureBrowserReady(context);
 *   return browser.goto(input);
 * }
 * ```
 */
export async function ensureBrowserReady(context: ToolExecutionContext): Promise<MastraBrowser> {
  const browser = requireBrowser(context);
  await browser.ensureReady();
  return browser;
}
