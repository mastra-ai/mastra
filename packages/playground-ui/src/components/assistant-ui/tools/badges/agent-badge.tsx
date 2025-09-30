import { AgentIcon } from '@/ds/icons';
import { BadgeWrapper } from './badge-wrapper';
import { ToolFallback } from '../tool-fallback';

import React from 'react';

import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import Markdown from 'react-markdown';

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
          return <Markdown key={index}>{message.content}</Markdown>;
        }

        const result = typeof message.toolOutput === 'string' ? JSON.parse(message.toolOutput) : message.toolOutput;

        return (
          <React.Fragment key={index}>
            <ToolFallback
              toolName={message.toolName}
              argsText={typeof message.args === 'string' ? message.args : JSON.stringify(message.args)}
              result={result}
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
