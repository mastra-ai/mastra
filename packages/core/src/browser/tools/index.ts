/**
 * Browser Tools
 *
 * 19 grouped browser tools that consolidate related actions.
 * Tools use requireBrowser(context) to get the browser provider.
 *
 * Following the workspace pattern:
 * - Tools are defined in core
 * - `createBrowserTools(browser)` factory creates tool instances
 * - Framework injects browser into context
 * - Tools use `requireBrowser(context)` to access the browser
 */

// Factory function (main export for framework integration)
export { createBrowserTools, resolveBrowserToolConfig, BROWSER_TOOLS } from './tools';
export type { BrowserToolName, BrowserToolConfig, BrowserToolsConfig } from './tools';

// Individual tool exports (for direct use or testing)
export { browserNavigateTool } from './navigate';
export { browserInteractTool } from './interact';
export { browserInputTool } from './input';
export { browserKeyboardTool } from './keyboard';
export { browserFormTool } from './form';
export { browserScrollTool } from './scroll';
export { browserExtractTool } from './extract';
export { browserElementStateTool } from './element-state';
export { browserStateTool } from './browser-state';
export { browserStorageTool } from './storage';
export { browserEmulationTool } from './emulation';
export { browserFramesTool } from './frames';
export { browserDialogsTool } from './dialogs';
export { browserTabsTool } from './tabs';
export { browserRecordingTool } from './recording';
export { browserMonitoringTool } from './monitoring';
export { browserClipboardTool } from './clipboard';
export { browserDebugTool } from './debug';
export { browserWaitTool } from './wait';

// Helper exports
export { requireBrowser, BrowserNotAvailableError } from './helpers';
export type { BrowserToolExecutionContext } from './helpers';

// All tools array (for convenience)
import { browserStateTool } from './browser-state';
import { browserClipboardTool } from './clipboard';
import { browserDebugTool } from './debug';
import { browserDialogsTool } from './dialogs';
import { browserElementStateTool } from './element-state';
import { browserEmulationTool } from './emulation';
import { browserExtractTool } from './extract';
import { browserFormTool } from './form';
import { browserFramesTool } from './frames';
import { browserInputTool } from './input';
import { browserInteractTool } from './interact';
import { browserKeyboardTool } from './keyboard';
import { browserMonitoringTool } from './monitoring';
import { browserNavigateTool } from './navigate';
import { browserRecordingTool } from './recording';
import { browserScrollTool } from './scroll';
import { browserStorageTool } from './storage';
import { browserTabsTool } from './tabs';
import { browserWaitTool } from './wait';

/**
 * All browser tools as an array for easy registration.
 * @deprecated Use `createBrowserTools(browser)` instead for proper framework integration.
 */
export const browserTools = [
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
];
