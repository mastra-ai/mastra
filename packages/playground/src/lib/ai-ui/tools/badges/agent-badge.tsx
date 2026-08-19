import {
  Tool,
  ToolCallListItem,
  ToolContent,
  ToolHeader,
  ToolIcon,
} from '@mastra/playground-ui/components/ai/tool-call';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Type } from 'lucide-react';
import Markdown from 'react-markdown';
import { ToolCard } from '../tool-card';
import { isInlineToolCallHidden } from '../tool-card-visibility';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { isToolApprovalPending } from './tool-action-state';
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

  const displayMessages = messages.filter(message =>
    message.type === 'text' ? message.content.trim().length > 0 : !isInlineToolCallHidden(message.toolName),
  );

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre">{suspendPayload}</pre>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  return (
    <Tool
      data-testid="agent-badge"
      status={isComplete ? 'success' : 'running'}
      defaultOpen={isToolApprovalPending(toolApprovalMetadata, toolCalled) || Boolean(suspendPayload)}
      aria-label={`Tool: ${toolName}`}
    >
      <ToolHeader
        actions={
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
        <ToolIcon tooltip="Sub-agent">
          <AgentIcon className="text-accent1" />
        </ToolIcon>
        {agentId}
      </ToolHeader>

      <ToolContent>
        <div className="pl-6">
          {displayMessages.map((message, index) => {
            const continued = index < displayMessages.length - 1;

            if (message.type === 'text') {
              return (
                <ToolCallListItem key={index} continued={continued}>
                  <div
                    data-testid="agent-text-message"
                    className="text-neutral3 text-ui-sm leading-ui-md flex min-w-0 items-start gap-2 px-1.5 py-1"
                  >
                    <Type data-testid="agent-text-icon" aria-hidden className="text-icon3 mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Markdown>{message.content}</Markdown>
                    </div>
                  </div>
                </ToolCallListItem>
              );
            }

            let result;

            try {
              result = typeof message.toolOutput === 'string' ? JSON.parse(message.toolOutput) : message.toolOutput;
            } catch {
              result = message.toolOutput;
            }

            return (
              <ToolCallListItem key={index} continued={continued}>
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
              </ToolCallListItem>
            );
          })}
        </div>

        {suspendPayloadSlot !== undefined && suspendPayload && (
          <div>
            <p className="text-ui-xs text-neutral3 mb-1.5">Agent suspend payload</p>
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
      </ToolContent>
    </Tool>
  );
};
