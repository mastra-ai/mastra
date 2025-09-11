import { AgentIcon, Icon } from '@/ds/icons';
import { BadgeWrapper } from './badge-wrapper';
import { ToolFallback } from '../tool-fallback';

import React, { useState } from 'react';

import { Share2 } from 'lucide-react';

import { TooltipIconButton } from '../../tooltip-icon-button';

import { NetworkChoiceMetadata } from './network-choice-metadata-dialog';

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
  selectionReason?: string;
  input?: string | Record<string, unknown>;
}

export const AgentBadge = ({ agentId, messages = [], selectionReason, input }: AgentBadgeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <BadgeWrapper
      icon={<AgentIcon className="text-accent1" />}
      title={agentId}
      initialCollapsed={false}
      extraInfo={
        <>
          <TooltipIconButton tooltip="Show selection reason" side="top" onClick={() => setIsOpen(s => !s)}>
            <Icon size="sm" className="text-icon3">
              <Share2 />
            </Icon>
          </TooltipIconButton>

          <NetworkChoiceMetadata
            selectionReason={selectionReason || ''}
            open={isOpen}
            onOpenChange={setIsOpen}
            input={input}
          />
        </>
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
