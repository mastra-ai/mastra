import { UIMessage } from '@ai-sdk/react';

export type MastraUIMessageMetadata = {
  status?: 'warning';
} & (
  | {
      mode: 'generate';
    }
  | {
      mode: 'stream';
    }
  | {
      mode: 'network';
      from?: 'AGENT' | 'WORKFLOW';
      selectionReason?: string;
      agentInput?: string | object | Array<object>;
    }
);

export type MastraUIMessage = UIMessage<MastraUIMessageMetadata, any, any>;
