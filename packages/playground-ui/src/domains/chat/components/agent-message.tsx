import React from 'react';
import Markdown from 'react-markdown';
import { ToolCallMono } from '../../../ds/components/ai/tool-call';
import { CodeEditor } from '../../../ds/components/CodeEditor';
import { AgentIcon } from '../../../ds/icons/AgentIcon';
import type { MessageMetadata } from '../messages/message-metadata';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import type { BackgroundTaskDetails } from './background-task-metadata-dialog';
import type { ChatToolContext } from './chat-tool-context';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { SectionLabel } from './section-label';
import type { ToolApprovalControlsProps } from './tool-approval-controls';
import { ToolApprovalControls } from './tool-approval-controls';
import { ToolBadgeDisclosure as BadgeWrapper } from './tool-badge-disclosure';
import { ToolCard } from './tool-card';

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

export interface AgentMessageProps extends ToolApprovalControlsProps {
  toolCallId: string;
  approvalRequired?: boolean;
  isNetwork?: boolean;
  onToolOpen?: (id: string) => void;
  backgroundTaskDetails?: BackgroundTaskDetails;
  tools: ChatToolContext;
  agentId: string;
  messages: AgentMessage[];
  metadata?: MessageMetadata;
  suspendPayload?: any;
  toolCalled?: boolean;
  isComplete?: boolean;
  keepOpenForStreamingChildMessages?: boolean;
}

export const AgentMessageView = ({
  agentId,
  messages = [],
  metadata,
  toolCallId,
  approvalRequired,
  isRunning,
  status,
  onApprove,
  onDecline,
  onToolOpen,
  backgroundTaskDetails,
  tools,
  isNetwork,
  suspendPayload,
  toolCalled: toolCalledProp,
  isComplete = false,
  keepOpenForStreamingChildMessages = false,
}: AgentMessageProps) => {
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

  const shouldCollapseContent = isComplete && !approvalRequired && !keepOpenForStreamingChildMessages;

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <ToolCallMono copyText={suspendPayload} className="text-icon3">
        {suspendPayload}
      </ToolCallMono>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  return (
    <BadgeWrapper
      isRunning={isRunning}
      onToolOpen={onToolOpen}
      data-testid="agent-badge"
      toolCallId={toolCallId}
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
          <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} details={backgroundTaskDetails} />
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
              {...tools}
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
          <SectionLabel>Agent suspend payload</SectionLabel>
          {suspendPayloadSlot}
        </div>
      )}

      {approvalRequired && !toolCalled && (
        <ToolApprovalControls isRunning={isRunning} status={status} onApprove={onApprove} onDecline={onDecline} />
      )}
    </BadgeWrapper>
  );
};
