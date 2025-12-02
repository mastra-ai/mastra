import { UIMessage } from '@ai-sdk/react';
import { CompleteAttachment } from '@assistant-ui/react';

export type MastraUIMessageMetadata = {
  status?: 'warning' | 'error';
} & (
  | {
      mode: 'generate';
    }
  | {
      mode: 'stream';
      requireApprovalMetadata?: {
        [toolCallId: string]: {
          toolCallId: string;
          toolName: string;
          args: Record<string, any>;
        };
      };
    }
  | {
      mode: 'network';
      from?: 'AGENT' | 'WORKFLOW';
      selectionReason?: string;
      agentInput?: string | object | Array<object>;
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
