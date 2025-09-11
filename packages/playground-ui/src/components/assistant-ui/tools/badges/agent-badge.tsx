import { AgentIcon } from '@/ds/icons';
import { BadgeWrapper } from './badge-wrapper';
import { ToolFallback } from '../tool-fallback';

import React from 'react';

import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';

type TextMessage = {
  type: 'text';
  content: string;
};

type ToolMessage = {
  type: 'tool';
  toolName: string;
  toolInput?: any;
  toolOutput?: any;
  args?: any;
  toolCallId: string;
  result?: any;
};

export type BadgeMessage = TextMessage | ToolMessage;

export interface AgentBadgeProps {
  agentId: string;
  messages: BadgeMessage[];
  networkMetadata?: {
    selectionReason?: string;
    input?: string | Record<string, unknown>;
  };
}

export const AgentBadge = ({ agentId, messages = [], networkMetadata }: AgentBadgeProps) => {
  return (
    <BadgeWrapper
      icon={<AgentIcon className="text-accent1" />}
      title={agentId}
      initialCollapsed={false}
      extraInfo={
        networkMetadata && (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={networkMetadata?.selectionReason || ''}
            input={networkMetadata?.input}
          />
        )
      }
    >
      {messages.map((message, index) => {
        if (message.type === 'text') {
          return <React.Fragment key={index}>{message.content}</React.Fragment>;
        }

        // for workflow runId
        const isWorkflow = message.toolOutput?.runId;

        return (
          <React.Fragment key={index}>
            <ToolFallback
              toolName={message.toolName}
              argsText={message.toolInput ? JSON.stringify(message.toolInput) : ''}
              result={isWorkflow ? message.toolOutput : message.toolOutput ? JSON.stringify(message.toolOutput) : ''}
              args={message.args}
              status={{ type: 'complete' }}
              type="tool-call"
              toolCallId={message.toolCallId}
              addResult={() => {}}
            />
          </React.Fragment>
        );
      })}
    </BadgeWrapper>
  );
};
