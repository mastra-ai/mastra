/**
 * Browser Tools — Factory
 *
 * Creates the browser tools for agents. Individual tools are
 * defined in their own files; this module assembles them into
 * a tool record that can be injected into agents.
 *
 * Following the same pattern as workspace tools:
 * - Tools are defined in core
 * - Provider is injected via context
 * - Tools use `requireBrowser(context)` to get the provider
 */

import type { MastraBrowser } from '../browser';

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

// ---------------------------------------------------------------------------
// Tool Names (constants for configuration)
// ---------------------------------------------------------------------------

export const BROWSER_TOOLS = {
  NAVIGATE: 'browser_navigate',
  INTERACT: 'browser_interact',
  INPUT: 'browser_input',
  KEYBOARD: 'browser_keyboard',
  FORM: 'browser_form',
  SCROLL: 'browser_scroll',
  EXTRACT: 'browser_extract',
  ELEMENT_STATE: 'browser_element_state',
  STATE: 'browser_state',
  STORAGE: 'browser_storage',
  EMULATION: 'browser_emulation',
  FRAMES: 'browser_frames',
  DIALOGS: 'browser_dialogs',
  TABS: 'browser_tabs',
  RECORDING: 'browser_recording',
  MONITORING: 'browser_monitoring',
  CLIPBOARD: 'browser_clipboard',
  DEBUG: 'browser_debug',
  WAIT: 'browser_wait',
} as const;

export type BrowserToolName = (typeof BROWSER_TOOLS)[keyof typeof BROWSER_TOOLS];

// ---------------------------------------------------------------------------
// Configuration Types
// ---------------------------------------------------------------------------

/**
 * Configuration for an individual browser tool.
 */
export interface BrowserToolConfig {
  /** Whether this tool is enabled. @default true */
  enabled?: boolean;
  /** Whether this tool requires user approval before execution. @default false */
  requireApproval?: boolean;
  /** Custom name for the tool (overrides default). */
  name?: string;
}

/**
 * Configuration for browser tools.
 * Allows enabling/disabling tools and setting approval requirements.
 */
export interface BrowserToolsConfig {
  /** Default enabled state for all tools. @default true */
  enabled?: boolean;
  /** Default require approval state for all tools. @default false */
  requireApproval?: boolean;
  /** Per-tool configuration. */
  [toolName: string]: BrowserToolConfig | boolean | undefined;
}

// ---------------------------------------------------------------------------
// Tool Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the effective configuration for a specific tool.
 *
 * Resolution order (later overrides earlier):
 * 1. Built-in defaults (enabled: true, requireApproval: false)
 * 2. Top-level config (config.enabled, config.requireApproval)
 * 3. Per-tool config (config[toolName].enabled, config[toolName].requireApproval)
 */
export function resolveBrowserToolConfig(
  toolsConfig: BrowserToolsConfig | undefined,
  toolName: BrowserToolName,
): {
  enabled: boolean;
  requireApproval: boolean;
  name?: string;
} {
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
      if (perToolConfig.enabled !== undefined) {
        enabled = perToolConfig.enabled;
      }
      if (perToolConfig.requireApproval !== undefined) {
        requireApproval = perToolConfig.requireApproval;
      }
      if (perToolConfig.name !== undefined) {
        name = perToolConfig.name;
      }
    }
  }

  return { enabled, requireApproval, name };
}

// ---------------------------------------------------------------------------
// All Tools Map
// ---------------------------------------------------------------------------

/**
 * Map of tool name to tool definition.
 */
const ALL_BROWSER_TOOLS = {
  [BROWSER_TOOLS.NAVIGATE]: browserNavigateTool,
  [BROWSER_TOOLS.INTERACT]: browserInteractTool,
  [BROWSER_TOOLS.INPUT]: browserInputTool,
  [BROWSER_TOOLS.KEYBOARD]: browserKeyboardTool,
  [BROWSER_TOOLS.FORM]: browserFormTool,
  [BROWSER_TOOLS.SCROLL]: browserScrollTool,
  [BROWSER_TOOLS.EXTRACT]: browserExtractTool,
  [BROWSER_TOOLS.ELEMENT_STATE]: browserElementStateTool,
  [BROWSER_TOOLS.STATE]: browserStateTool,
  [BROWSER_TOOLS.STORAGE]: browserStorageTool,
  [BROWSER_TOOLS.EMULATION]: browserEmulationTool,
  [BROWSER_TOOLS.FRAMES]: browserFramesTool,
  [BROWSER_TOOLS.DIALOGS]: browserDialogsTool,
  [BROWSER_TOOLS.TABS]: browserTabsTool,
  [BROWSER_TOOLS.RECORDING]: browserRecordingTool,
  [BROWSER_TOOLS.MONITORING]: browserMonitoringTool,
  [BROWSER_TOOLS.CLIPBOARD]: browserClipboardTool,
  [BROWSER_TOOLS.DEBUG]: browserDebugTool,
  [BROWSER_TOOLS.WAIT]: browserWaitTool,
} as const;

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Creates browser tools that will be auto-injected into agents.
 *
 * Similar to `createWorkspaceTools`, this factory creates tools
 * configured for use with a browser provider. The browser is
 * injected into the tool execution context by the framework.
 *
 * @param browser - The browser instance (used for configuration, not passed to tools)
 * @param config - Optional tool configuration
 * @returns Record of browser tools
 *
 * @example
 * ```typescript
 * const browser = new AgentBrowser({ headless: true });
 * const tools = createBrowserTools(browser);
 * // Framework injects browser into context when tools execute
 * ```
 */
export function createBrowserTools(_browser: MastraBrowser, config?: BrowserToolsConfig): Record<string, any> {
  const tools: Record<string, any> = {};

  // Helper: add a tool with config-driven filtering
  const addTool = (name: BrowserToolName, tool: any) => {
    const toolConfig = resolveBrowserToolConfig(config, name);
    if (!toolConfig.enabled) return;

    const wrapped = { ...tool, requireApproval: toolConfig.requireApproval };

    // Use custom name if provided, otherwise use the default constant name
    const exposedName = toolConfig.name ?? name;
    if (tools[exposedName]) {
      throw new Error(
        `Duplicate browser tool name "${exposedName}": tool "${name}" conflicts with an already-registered tool. ` +
          `Check your tools config for duplicate "name" values.`,
      );
    }

    // When the tool is renamed, update its id to match
    if (exposedName !== name && 'id' in wrapped) {
      wrapped.id = exposedName;
    }

    tools[exposedName] = wrapped;
  };

  // Add all browser tools
  for (const [name, tool] of Object.entries(ALL_BROWSER_TOOLS)) {
    addTool(name as BrowserToolName, tool);
  }

  return tools;
}
