/**
 * Browser Tools — 17 Flat Tools
 *
 * Each tool has a single purpose with a flat schema (no discriminated unions).
 * This makes them easier for LLMs to understand and use correctly.
 *
 * Tools:
 * - Core (9): goto, snapshot, click, type, press, select, scroll, screenshot, close
 * - Extended (7): hover, back, upload, dialog, wait, tabs, drag
 * - Escape Hatch (1): evaluate
 */

// Re-export constants and configuration
export {
  BROWSER_TOOLS,
  type BrowserToolName,
  type BrowserToolConfig,
  type BrowserToolsConfig,
  resolveBrowserToolConfig,
} from './constants';

// Re-export individual tools
export { browserGotoTool } from './goto';
export { browserSnapshotTool } from './snapshot';
export { browserClickTool } from './click';
export { browserTypeTool } from './type';
export { browserPressTool } from './press';
export { browserSelectTool } from './select';
export { browserScrollTool } from './scroll';
export { browserScreenshotTool } from './screenshot';
export { browserCloseTool } from './close';
export { browserHoverTool } from './hover';
export { browserBackTool } from './back';
export { browserUploadTool } from './upload';
export { browserDialogTool } from './dialog';
export { browserWaitTool } from './wait';
export { browserTabsTool } from './tabs';
export { browserDragTool } from './drag';
export { browserEvaluateTool } from './evaluate';

// Import tools for ALL_BROWSER_TOOLS map
import { browserBackTool } from './back';
import { browserClickTool } from './click';
import { browserCloseTool } from './close';
import { BROWSER_TOOLS } from './constants';
import { browserDialogTool } from './dialog';
import { browserDragTool } from './drag';
import { browserEvaluateTool } from './evaluate';
import { browserGotoTool } from './goto';
import { browserHoverTool } from './hover';
import { browserPressTool } from './press';
import { browserScreenshotTool } from './screenshot';
import { browserScrollTool } from './scroll';
import { browserSelectTool } from './select';
import { browserSnapshotTool } from './snapshot';
import { browserTabsTool } from './tabs';
import { browserTypeTool } from './type';
import { browserUploadTool } from './upload';
import { browserWaitTool } from './wait';

/**
 * Map of all browser tools by their ID
 */
export const ALL_BROWSER_TOOLS = {
  [BROWSER_TOOLS.GOTO]: browserGotoTool,
  [BROWSER_TOOLS.SNAPSHOT]: browserSnapshotTool,
  [BROWSER_TOOLS.CLICK]: browserClickTool,
  [BROWSER_TOOLS.TYPE]: browserTypeTool,
  [BROWSER_TOOLS.PRESS]: browserPressTool,
  [BROWSER_TOOLS.SELECT]: browserSelectTool,
  [BROWSER_TOOLS.SCROLL]: browserScrollTool,
  [BROWSER_TOOLS.SCREENSHOT]: browserScreenshotTool,
  [BROWSER_TOOLS.CLOSE]: browserCloseTool,
  [BROWSER_TOOLS.HOVER]: browserHoverTool,
  [BROWSER_TOOLS.BACK]: browserBackTool,
  [BROWSER_TOOLS.UPLOAD]: browserUploadTool,
  [BROWSER_TOOLS.DIALOG]: browserDialogTool,
  [BROWSER_TOOLS.WAIT]: browserWaitTool,
  [BROWSER_TOOLS.TABS]: browserTabsTool,
  [BROWSER_TOOLS.DRAG]: browserDragTool,
  [BROWSER_TOOLS.EVALUATE]: browserEvaluateTool,
} as const;
