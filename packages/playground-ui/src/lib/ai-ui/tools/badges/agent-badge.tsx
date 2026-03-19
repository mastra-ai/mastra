import { AgentIcon } from '@/ds/icons';
import { BadgeWrapper } from './badge-wrapper';
import { ToolFallback } from '../tool-fallback';

import React from 'react';

import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import Markdown from 'react-markdown';
import { MastraUIMessage } from '@mastra/react';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { CodeEditor } from '@/ds/components/CodeEditor';

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

export interface AgentBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  agentId: string;
  messages: AgentMessage[];
  metadata?: MastraUIMessage['metadata'];
  suspendPayload?: any;
  toolCalled?: boolean;
  isComplete?: boolean;
}

export const AgentBadge = ({
  agentId,
  messages = [],
  metadata,
  toolCallId,
  toolApprovalMetadata,
  toolName,
  isNetwork,
  suspendPayload,
  toolCalled: toolCalledProp,
  isComplete = false,
}: AgentBadgeProps) => {
  const selectionReason = metadata?.mode === 'network' ? metadata.selectionReason : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? metadata.agentInput : undefined;

  let toolCalled = messages.length > 0;

  if (isNetwork) {
    toolCalled =
      toolCalledProp ??
      messages.every(message => {
        if (message.type === 'text') {
          return true;
        }

        return !!message.toolOutput;
      });
  }

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{suspendPayload}</pre>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  return (
    <BadgeWrapper
      data-testid="agent-badge"
      icon={<AgentIcon className="text-accent1" />}
      title={agentId}
      initialCollapsed={isComplete}
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

        let result;

        try {
          result = typeof message.toolOutput === 'string' ? JSON.parse(message.toolOutput) : message.toolOutput;
        } catch (error) {
          result = message.toolOutput;
        }

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
              resume={() => {}}
              metadata={{
                mode: 'stream',
              }}
            />
          </React.Fragment>
        );
      })}

      {suspendPayloadSlot !== undefined && suspendPayload && (
        <div>
          <p className="font-medium pb-2">Agent suspend payload</p>
          {suspendPayloadSlot}
        </div>
      )}

      <ToolApprovalButtons
        toolCalled={toolCalled}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        toolName={toolName}
        isNetwork={isNetwork}
        isGenerateMode={metadata?.mode === 'generate'}
      />
    </BadgeWrapper>
  );
};
