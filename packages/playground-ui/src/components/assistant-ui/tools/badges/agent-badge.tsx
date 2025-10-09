import { AgentIcon } from '@/ds/icons';
import { BadgeWrapper } from './badge-wrapper';
import { ToolFallback } from '../tool-fallback';

import React from 'react';

import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import Markdown from 'react-markdown';
import { MastraUIMessage } from '@mastra/react';

type TextMessage = {
  type: 'text';
  content: string;
};

type ToolMessage = {
  type: 'tool';
  toolName: string;
  toolOutput?: any;
  args?: any;
  toolCallId: string;
  result?: any;
};

export type AgentMessage = TextMessage | ToolMessage;

export interface AgentBadgeProps {
  agentId: string;
  messages: AgentMessage[];
  metadata?: MastraUIMessage['metadata'];
}

export const AgentBadge = ({ agentId, messages = [], metadata }: AgentBadgeProps) => {
  const selectionReason = metadata?.mode === 'network' ? metadata.selectionReason : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? metadata.agentInput : undefined;

  return (
    <BadgeWrapper
      icon={<AgentIcon className="text-accent1" />}
      title={agentId}
      initialCollapsed={false}
      extraInfo={
        metadata?.mode === 'network' && (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason ?? ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
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
              metadata={{
                mode: 'stream',
              }}
            />
          </React.Fragment>
        );
      })}
    </BadgeWrapper>
  );
};
