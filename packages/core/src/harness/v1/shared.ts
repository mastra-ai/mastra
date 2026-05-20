import type { HarnessMode as LegacyHarnessMode } from '../types';

export type { ToolsInput as ToolsetInput } from '../../agent/types';
export type { Workspace, WorkspaceConfig } from '../../workspace';
export type { HarnessMessage, HarnessMessageContent, HarnessThread, ToolCategory } from '../types';

export type HarnessMode<TState = unknown> = LegacyHarnessMode<TState>;
