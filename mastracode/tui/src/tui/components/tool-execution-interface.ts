/**
 * Common interface and shared types for tool execution components
 */

import type { ChatSpacingKind } from './chat-spacing.js';

export type QuietToolDisplayMode = 'normal' | 'quiet';
export type CompactToolLabelColor = 'toolTitle' | 'error';

export interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}

/** The sandbox's exit record for a shell call (`data-sandbox-exit`). */
export interface CommandExitRecord {
  exitCode: number;
  success: boolean;
  executionTimeMs?: number;
}

export interface IToolExecutionComponent {
  updateArgs(args: unknown, rebuild?: boolean): void;
  setArgsStreaming?(streaming: boolean): void;
  stopLiveUpdates?(): void;
  refresh?(): void;
  updateResult(result: ToolResult, isPartial?: boolean): void;
  setCommandExit?(exit: CommandExitRecord): void;
  setBackgroundTaskId?(taskId: string): void;
  getBackgroundTaskId?(): string | undefined;
  cancelBackground?(): void;
  setExpanded(expanded: boolean): void;
  setQuietModeDisplay?(mode: QuietToolDisplayMode): void;
  setQuietPreviewLineLimit?(limit: number): void;
  setCompactToolModeColor?(color: string | undefined): void;
  getChatSpacingKind?(): ChatSpacingKind | undefined;
  getCompactToolGroupKey?(): string | undefined;
  getCompactToolGroupSummary?(): string | undefined;
  hasQuietStreamingPreview?(): boolean;
  getOwnCompactToolLabelColor?(): CompactToolLabelColor | undefined;
  setCompactToolGroupLabelColor?(color: CompactToolLabelColor | undefined): void;
  setCompactToolContinuation?(continuation: boolean, previousSummary?: string): void;
  setCompactToolHasFollowingContinuation?(hasFollowingContinuation: boolean): void;
  isComplete?(): boolean;
  /** Append streaming output for shell commands */
  appendStreamingOutput?(output: string): void;
}
