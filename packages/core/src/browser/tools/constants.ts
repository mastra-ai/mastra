/**
 * Browser Tool Constants and Configuration
 */

// =============================================================================
// Tool Names
// =============================================================================

export const BROWSER_TOOLS = {
  // Core
  GOTO: 'browser_goto',
  SNAPSHOT: 'browser_snapshot',
  CLICK: 'browser_click',
  TYPE: 'browser_type',
  PRESS: 'browser_press',
  SELECT: 'browser_select',
  SCROLL: 'browser_scroll',
  SCREENSHOT: 'browser_screenshot',
  CLOSE: 'browser_close',
  // Extended
  HOVER: 'browser_hover',
  BACK: 'browser_back',
  UPLOAD: 'browser_upload',
  DIALOG: 'browser_dialog',
  WAIT: 'browser_wait',
  TABS: 'browser_tabs',
  DRAG: 'browser_drag',
  // Escape hatch
  EVALUATE: 'browser_evaluate',
} as const;

export type BrowserToolName = (typeof BROWSER_TOOLS)[keyof typeof BROWSER_TOOLS];

// =============================================================================
// Configuration Types
// =============================================================================

export interface BrowserToolConfig {
  enabled?: boolean;
  requireApproval?: boolean;
  name?: string;
}

export interface BrowserToolsConfig {
  enabled?: boolean;
  requireApproval?: boolean;
  [toolName: string]: BrowserToolConfig | boolean | undefined;
}

export function resolveBrowserToolConfig(
  toolsConfig: BrowserToolsConfig | undefined,
  toolName: BrowserToolName,
): { enabled: boolean; requireApproval: boolean; name?: string } {
  let enabled = true;
  let requireApproval = false;
  let name: string | undefined;

  if (toolsConfig) {
    if (toolsConfig.enabled !== undefined && typeof toolsConfig.enabled === 'boolean') {
      enabled = toolsConfig.enabled;
    }
    if (toolsConfig.requireApproval !== undefined && typeof toolsConfig.requireApproval === 'boolean') {
      requireApproval = toolsConfig.requireApproval;
    }

    const perToolConfig = toolsConfig[toolName];
    if (perToolConfig && typeof perToolConfig === 'object') {
      if (perToolConfig.enabled !== undefined) enabled = perToolConfig.enabled;
      if (perToolConfig.requireApproval !== undefined) requireApproval = perToolConfig.requireApproval;
      if (perToolConfig.name !== undefined) name = perToolConfig.name;
    }
  }

  return { enabled, requireApproval, name };
}
