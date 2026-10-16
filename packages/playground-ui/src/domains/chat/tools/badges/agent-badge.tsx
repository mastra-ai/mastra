import React from 'react';
import Markdown from 'react-markdown';
import { ToolCard } from '../tool-card';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import type { MessageMetadata } from '@/domains/chat';
import { SectionLabel } from '@/domains/chat/components/section-label';
import { awaitsToolApproval } from '@/domains/chat/tools/badges/awaits-tool-approval';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import { ToolApprovalBadge } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { ToolCallMono } from '@/ds/components/ai/tool-call';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { AgentIcon } from '@/ds/icons/AgentIcon';

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

export interface AgentBadgeProps extends Omit<ToolApprovalRequest, 'toolCalled'> {
  agentId: string;
  messages: AgentMessage[];
  metadata?: MessageMetadata;
  suspendPayload?: any;
  toolCalled?: boolean;
  isComplete?: boolean;
  keepOpenForStreamingChildMessages?: boolean;
  status?: ActivityStatus;
  errorText?: string;
  onLoadPrevious?: () => void;
  isLoadingPrevious?: boolean;
}

export const AgentBadge = ({
  agentId,
  messages = [],
  metadata,
  toolCallId,
  toolApprovalMetadata,
  toolName,
  suspendPayload,
  toolCalled: toolCalledProp,
  isComplete = false,
  keepOpenForStreamingChildMessages = false,
  status = 'idle',
  errorText,
  onLoadPrevious,
  isLoadingPrevious = false,
}: AgentBadgeProps) => {
  const parentSuspendedTools =
    metadata?.mode === 'stream' || metadata?.mode === 'generate' ? metadata?.suspendedTools : undefined;

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

  let toolCalled = isComplete && allChildToolsComplete;

  const isError = status === 'error';
  const shouldCollapseContent = isComplete && !isError && !toolApprovalMetadata && !keepOpenForStreamingChildMessages;
  const shownError = isError ? errorText : undefined;
  const hasBody =
    Boolean(onLoadPrevious) ||
    messages.length > 0 ||
    Boolean(shownError) ||
    Boolean(suspendPayload) ||
    awaitsToolApproval({ toolApprovalMetadata, toolCalled });

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <ToolCallMono copyText={suspendPayload} className="text-muted-foreground">
        {suspendPayload}
      </ToolCallMono>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  return (
    <ToolApprovalBadge
      approval={{
        toolCalled,
        toolCallId,
        toolApprovalMetadata,
        toolName,
        isGenerateMode: metadata?.mode === 'generate',
      }}
      data-testid="agent-badge"
      icon={<AgentIcon className="text-span-agent" />}
      title={agentId}
      status={status}
      initialCollapsed={shouldCollapseContent}
      extraInfo={
        bgEntry?.taskId && bgEntry?.startedAt ? <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} /> : null
      }
    >
      {hasBody && (
        <>
          {onLoadPrevious && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadPrevious}
              disabled={isLoadingPrevious}
              data-testid="agent-badge-load-previous"
            >
              {isLoadingPrevious ? 'Loading earlier messages…' : 'Load earlier messages'}
            </Button>
          )}

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
                    suspendedTools: parentSuspendedTools,
                  }}
                />
              </React.Fragment>
            );
          })}

          {shownError && (
            <ToolCallMono copyText={shownError} data-testid="agent-error" className="text-destructive-foreground">
              {shownError}
            </ToolCallMono>
          )}

          {suspendPayloadSlot !== undefined && suspendPayload && (
            <div>
              <SectionLabel>Agent suspend payload</SectionLabel>
              {suspendPayloadSlot}
            </div>
          )}
        </>
      )}
    </ToolApprovalBadge>
  );
};
