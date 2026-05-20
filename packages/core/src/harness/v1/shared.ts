import type { ToolsInput } from '../../agent/types';

export type { ToolsInput as ToolsetInput } from '../../agent/types';
export type { Workspace, WorkspaceConfig } from '../../workspace';
export type { HarnessMessage, HarnessMessageContent, HarnessThread, ToolCategory } from '../types';

export interface HarnessMode<TState = unknown> {
  id: string;
  agentId: string;
  description?: string;
  instructions?: string;
  tools?: ToolsInput;
  additionalTools?: ToolsInput;
  transitionsTo?: string;
  metadata?: Record<string, unknown>;
  /**
   * Reserved for callers that carry mode-specific UI/runtime state.
   * The registry does not read it.
   */
  state?: TState;
}
