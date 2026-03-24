/**
 * Browser Tools Factory
 *
 * Creates browser tools bound to a specific MastraBrowser instance.
 */

import type { Tool } from '../../tools';
import type { MastraBrowser } from '../browser';
import { ALL_BROWSER_TOOLS, BROWSER_TOOLS } from './tools';

/**
 * Creates a set of browser tools bound to a specific browser instance.
 *
 * The returned tools have the browser injected into their execution context,
 * so they can be used directly by agents without additional configuration.
 *
 * @param browser - The MastraBrowser instance to bind to the tools
 * @returns An object mapping tool names to tool definitions
 */
export function createBrowserTools(browser: MastraBrowser): Record<string, Tool<any, any>> {
  const tools: Record<string, Tool<any, any>> = {};

  for (const [toolId, tool] of Object.entries(ALL_BROWSER_TOOLS)) {
    const originalTool = tool as Tool<any, any>;

    // Create a wrapped tool that injects the browser into the context
    // We need to preserve all tool properties while wrapping execute
    const wrappedTool = Object.create(originalTool) as Tool<any, any>;

    // Override execute to inject browser
    const originalExecute = originalTool.execute;
    if (originalExecute) {
      (wrappedTool as any).execute = async (input: any, context: any) => {
        const contextWithBrowser = { ...context, browser };
        return originalExecute.call(originalTool, input, contextWithBrowser);
      };
    }

    tools[toolId] = wrappedTool;
  }

  return tools;
}

/**
 * Get the list of all browser tool names.
 */
export function getBrowserToolNames(): string[] {
  return Object.values(BROWSER_TOOLS);
}
