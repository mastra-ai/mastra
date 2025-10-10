import { UIMessage } from '@ai-sdk/react';

export type MastraUIMessageMetadata = {
  status?: 'warning' | 'error';
} & (
  | {
      mode: 'generate';
    }
  | {
      mode: 'stream';
      requireApprovalMetadata?: {
        toolCallId: string;
        toolName: string;
        args: any;
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
