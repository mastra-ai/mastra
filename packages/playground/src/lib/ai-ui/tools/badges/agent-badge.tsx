import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import React from 'react';
import Markdown from 'react-markdown';
import { ToolCard } from '../tool-card';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

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
  metadata?: MessageMetadata;
  suspendPayload?: any;
  toolCalled?: boolean;
  isComplete?: boolean;
  keepOpenForStreamingChildMessages?: boolean;
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
  keepOpenForStreamingChildMessages = false,
}: AgentBadgeProps) => {
  const routingDecision = metadata?.mode === 'network' ? metadata.routingDecision : undefined;
  const selectionReason =
    metadata?.mode === 'network' ? (routingDecision?.selectionReason ?? metadata.selectionReason) : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? (routingDecision ?? metadata.agentInput) : undefined;

  const parentRequireApprovalMetadata =
    metadata?.mode === 'stream' || metadata?.mode === 'network' || metadata?.mode === 'generate'
      ? metadata?.requireApprovalMetadata
      : undefined;
  const parentSuspendedTools =
    metadata?.mode === 'stream' || metadata?.mode === 'network' || metadata?.mode === 'generate'
      ? metadata?.suspendedTools
      : undefined;

  const bgEntry =
    (metadata?.mode === 'stream' || metadata?.mode === 'generate') && metadata?.backgroundTasks
      ? metadata.backgroundTasks[toolCallId]
      : undefined;

  const allChildToolsComplete =
    messages.length > 0 &&
    messages.every(message => {
      if (message.type === 'text') {
        return true;
      }
      return message.toolOutput !== undefined;
    });

  let toolCalled = allChildToolsComplete;

  if (isNetwork) {
    toolCalled = toolCalledProp ?? allChildToolsComplete;
  }

  const shouldCollapseContent = isComplete && !toolApprovalMetadata && !keepOpenForStreamingChildMessages;

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre">{suspendPayload}</pre>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  return (
    <BadgeWrapper
      data-testid="agent-badge"
      icon={<AgentIcon className="text-accent1" />}
      title={agentId}
      initialCollapsed={shouldCollapseContent}
      extraInfo={
        metadata?.mode === 'network' ? (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason ?? ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
          />
        ) : bgEntry?.taskId && bgEntry?.startedAt ? (
          <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} />
        ) : null
      }
    >
      {messages.map((message, index) => {
        if (message.type === 'text') {
          return <Markdown key={index}>{message.content}</Markdown>;
        }

        let result;

        try {
          result = typeof message.toolOutput === 'string' ? JSON.parse(message.toolOutput) : message.toolOutput;
        } catch {
          result = message.toolOutput;
        }

        return (
          <React.Fragment key={index}>
            <ToolCard
              toolName={message.toolName}
              input={message.args}
              output={result}
              state="output-available"
              toolCallId={message.toolCallId}
              metadata={{
                mode: 'stream',
                requireApprovalMetadata: parentRequireApprovalMetadata,
                suspendedTools: parentSuspendedTools,
              }}
            />
          </React.Fragment>
        );
      })}

      {suspendPayloadSlot !== undefined && suspendPayload && (
        <div>
          <p className="pb-2 font-medium">Agent suspend payload</p>
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
