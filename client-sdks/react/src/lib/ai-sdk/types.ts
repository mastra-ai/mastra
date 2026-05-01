import type { UIMessage } from '@ai-sdk/react';
import type { CompleteAttachment } from '@assistant-ui/react';

/**
 * Tripwire metadata included when a processor triggers a tripwire
 */
export type TripwireMetadata = {
  /** Whether the agent should retry with feedback */
  retry?: boolean;
  /** Custom metadata from the processor */
  tripwirePayload?: unknown;
  /** ID of the processor that triggered the tripwire */
  processorId?: string;
};

export type MastraUIMessageMetadata = {
  status?: 'warning' | 'error' | 'tripwire';
  /** Tripwire-specific metadata when status is 'tripwire' */
  tripwire?: TripwireMetadata;
} & (
  | {
      mode: 'generate';
      completionResult?: {
        passed: boolean;
        suppressFeedback?: boolean;
      };
      runningBackgroundTasksCount?: number;
      requireApprovalMetadata?: {
        [toolName: string]: {
          toolCallId: string;
          toolName: string;
          args: Record<string, any>;
          runId?: string;
        };
      };
      suspendedTools?: {
        [toolName: string]: {
          toolCallId: string;
          toolName: string;
          args: Record<string, any>;
          suspendPayload: any;
          runId?: string;
        };
      };
      /**
       * Per-tool-call background-task metadata keyed by `toolCallId`. A single
       * assistant message can carry multiple concurrent background-dispatched
       * tool calls, so timing/ID is stored per call rather than as one value
       * on the message.
       */
      backgroundTasks?: Record<
        string,
        {
          startedAt?: Date;
          completedAt?: Date;
          taskId: string;
        }
      >;
    }
  | {
      mode: 'stream';
      completionResult?: {
        passed: boolean;
        suppressFeedback?: boolean;
      };
      runningBackgroundTasksCount?: number;
      requireApprovalMetadata?: {
        [toolName: string]: {
          toolCallId: string;
          toolName: string;
          args: Record<string, any>;
          runId?: string;
        };
      };
      suspendedTools?: {
        [toolName: string]: {
          toolCallId: string;
          toolName: string;
          args: Record<string, any>;
          suspendPayload: any;
          runId?: string;
        };
      };
      /**
       * Per-tool-call background-task metadata keyed by `toolCallId`. A single
       * assistant message can carry multiple concurrent background-dispatched
       * tool calls, so timing/ID is stored per call rather than as one value
       * on the message.
       */
      backgroundTasks?: Record<
        string,
        {
          startedAt?: Date;
          completedAt?: Date;
          taskId: string;
        }
      >;
    }
  | {
      mode: 'network';
      from?: 'AGENT' | 'WORKFLOW' | 'TOOL';
      selectionReason?: string;
      agentInput?: string | object | Array<object>;
      hasMoreMessages?: boolean;
      completionResult?: {
        passed: boolean;
        suppressFeedback?: boolean;
      };
      requireApprovalMetadata?: {
        [toolName: string]: {
          toolCallId: string;
          toolName: string;
          args: Record<string, any>;
          runId?: string;
        };
      };
      suspendedTools?: {
        [toolName: string]: {
          toolCallId: string;
          toolName: string;
          args: Record<string, any>;
          suspendPayload: any;
          runId?: string;
        };
      };
    }
);

/**
 * Mastra-extended text part with textId for tracking separate text streams.
 *
 * This follows the same pattern as the existing `state` property which is already
 * added to text parts in the codebase. Both `state` and `textId` are Mastra-specific
 * extensions to the standard AI SDK TextUIPart.
 */
export type MastraExtendedTextPart = {
  type: 'text';
  text: string;
  /** Unique identifier for this text stream (from chunk.payload.id) */
  textId?: string;
  /** Streaming state - already exists in codebase for text parts */
  state?: 'streaming' | 'done';
  /** Provider-specific metadata */
  providerMetadata?: any;
};

export type MastraUIMessage = UIMessage<MastraUIMessageMetadata, any, any>;

/**
 * Extended type for MastraUIMessage that may include additional properties
 * from different sources (generate, toUIMessage, toNetworkUIMessage)
 */
export type ExtendedMastraUIMessage = MastraUIMessage & {
  createdAt?: Date;
  metadata?: Record<string, unknown>;
  experimental_attachments?: readonly CompleteAttachment[];
};
