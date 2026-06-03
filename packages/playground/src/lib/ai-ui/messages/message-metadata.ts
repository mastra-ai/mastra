/**
 * Playground-local shape for the freeform metadata stored on
 * `MastraDBMessage.content.metadata`.
 *
 * The runtime provider stamps this metadata onto each assistant-ui
 * `ThreadMessageLike.metadata` and onto every content part's `metadata` so
 * downstream renderers (tool badges, error-aware text) can branch on `mode`,
 * `status`, `tripwire`, background tasks, and network routing details without
 * reaching back into the raw DB message.
 *
 * Fields are intentionally optional and additive — components that don't
 * recognise a key should ignore it.
 */
import type { TripwireMetadata } from '@mastra/react';

export type MessageMode = 'generate' | 'stream' | 'network';

export interface BackgroundTaskEntry {
  taskId: string;
  startedAt: Date;
  completedAt?: Date;
  suspendedAt?: Date;
}

export interface ToolApprovalMetadata {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  runId?: string;
}

export interface SuspendedToolMetadata {
  suspendPayload?: unknown;
  runId?: string;
  [key: string]: unknown;
}

export interface MessageMetadata {
  mode?: MessageMode;
  status?: 'warning' | 'error' | 'tripwire';
  tripwire?: TripwireMetadata;
  selectionReason?: string;
  agentInput?: unknown;
  hasMoreMessages?: boolean;
  from?: string;
  routingDecision?: {
    isNetwork?: boolean;
    agentId?: string;
    selectionReason?: string;
    [key: string]: unknown;
  };
  routingDecisionText?: string;
  backgroundTasks?: Record<string, BackgroundTaskEntry>;
  completionResult?: {
    passed?: boolean;
    suppressFeedback?: boolean;
    [key: string]: unknown;
  };
  isTaskCompleteResult?: {
    passed?: boolean;
    suppressFeedback?: boolean;
    [key: string]: unknown;
  };
  pendingToolApprovals?: Record<string, ToolApprovalMetadata>;
  requireApprovalMetadata?: Record<string, ToolApprovalMetadata>;
  suspendedTools?: Record<string, SuspendedToolMetadata>;
  runId?: string;
  [key: string]: unknown;
}
