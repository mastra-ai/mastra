import type { Component, TUI } from '@earendil-works/pi-tui';
import { SlackToolExecutionComponent, isSlackReadTool } from './slack-tool-execution.js';
import { ToolExecutionComponentEnhanced } from './tool-execution-enhanced.js';
import type { IToolExecutionComponent } from './tool-execution-interface.js';

export type CreateToolExecutionComponentOptions = {
  showImages?: boolean;
  collapsedByDefault?: boolean;
};

export function createToolExecutionComponent(
  toolName: string,
  args: unknown,
  options: CreateToolExecutionComponentOptions,
  ui: TUI,
): IToolExecutionComponent & Component {
  if (isSlackReadTool(toolName)) return new SlackToolExecutionComponent(toolName, args, ui);
  return new ToolExecutionComponentEnhanced(toolName, args, options, ui);
}
