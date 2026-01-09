import { UIMessage } from '@ai-sdk/react';
import { CompleteAttachment } from '@assistant-ui/react';

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
    }
  | {
      mode: 'stream';
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
        };
      };
    }
  | {
      mode: 'network';
      from?: 'AGENT' | 'WORKFLOW' | 'TOOL';
      selectionReason?: string;
      agentInput?: string | object | Array<object>;
      hasMoreMessages?: boolean;
      completionResult?: {
        passed: boolean;
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
        };
      };
    }
);

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
