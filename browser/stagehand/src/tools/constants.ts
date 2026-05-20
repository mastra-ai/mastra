/**
 * Stagehand Tool Constants
 */

export const STAGEHAND_TOOLS = {
  // Core AI
  ACT: 'stagehand_act',
  EXTRACT: 'stagehand_extract',
  OBSERVE: 'stagehand_observe',
  // Navigation & State
  NAVIGATE: 'stagehand_navigate',
  TABS: 'stagehand_tabs',
  CLOSE: 'stagehand_close',
  // Utility
  SCREENSHOT: 'stagehand_screenshot',
} as const;

export type StagehandToolName = (typeof STAGEHAND_TOOLS)[keyof typeof STAGEHAND_TOOLS];
