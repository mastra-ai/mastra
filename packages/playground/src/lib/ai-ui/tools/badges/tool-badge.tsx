import {
  presentTool,
  stringifyToolValue,
  stripSerializedAnsi,
  ToolCallArguments,
  ToolCallOutput,
  ToolCallPresentedHeader,
} from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolCallStatus } from '@mastra/playground-ui/components/ai/tool-call';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import type { MessageMetadata } from '@mastra/playground-ui/domains/chat';
import { BadgeWrapper } from '@mastra/playground-ui/domains/chat/components/badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from '@mastra/playground-ui/domains/chat/components/network-choice-metadata-dialog';
import { SectionLabel } from '@mastra/playground-ui/domains/chat/components/section-label';
import type { ToolApprovalButtonsProps } from '@mastra/playground-ui/domains/chat/tools/badges/tool-approval-buttons';
import { ToolApprovalButtons } from '@mastra/playground-ui/domains/chat/tools/badges/tool-approval-buttons';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';

function formatArgs(args: Record<string, unknown> | string): { pretty: string; parsed?: Record<string, unknown> } {
  try {
    const { __mastraMetadata: _, _background, ...parsed } = typeof args === 'object' ? args : JSON.parse(args);
    return { pretty: stringifyToolValue(parsed), parsed };
  } catch {
    return { pretty: stringifyToolValue(args) };
  }
}

export interface ToolBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MessageMetadata;
  toolOutput: Array<{ toolId: string }>;
  suspendPayload?: any;
  toolCalled?: boolean;
  withoutArgs?: boolean;
  status?: ToolCallStatus;
}

export const ToolBadge = ({
  toolName,
  args,
  result,
  metadata,
  toolOutput,
  toolCallId,
  toolApprovalMetadata,
  suspendPayload,
  isNetwork,
  toolCalled: toolCalledProp,
  withoutArgs,
  status = 'idle',
}: ToolBadgeProps) => {
  const { pretty: argsPretty, parsed: argsObject } = formatArgs(args);
  const { icon, label, detail } = presentTool(toolName, argsObject);
  const resultPretty =
    result !== undefined && result !== null ? stripSerializedAnsi(stringifyToolValue(result)) : undefined;

  const routingDecision = metadata?.mode === 'network' ? metadata.routingDecision : undefined;
  const selectionReason =
    metadata?.mode === 'network' ? (routingDecision?.selectionReason ?? metadata.selectionReason) : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? (routingDecision ?? metadata.agentInput) : undefined;

  const toolCalled = toolCalledProp ?? (result || toolOutput.length > 0);

  const bgEntry =
    (metadata?.mode === 'stream' || metadata?.mode === 'generate') && metadata?.backgroundTasks
      ? metadata.backgroundTasks[toolCallId]
      : undefined;

  return (
    <BadgeWrapper
      data-testid="tool-badge"
      header={<ToolCallPresentedHeader icon={icon} label={label} detail={detail} />}
      status={status}
      extraInfo={
        metadata?.mode === 'network' ? (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason || ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
          />
        ) : bgEntry?.taskId && bgEntry?.startedAt ? (
          <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} />
        ) : null
      }
      initialCollapsed={!!!(toolApprovalMetadata ?? suspendPayload)}
    >
      <ToolCallArguments
        toolName={toolName}
        args={argsObject}
        argsText={argsPretty}
        hideArguments={withoutArgs}
        data-testid="tool-args"
      />

      {suspendPayload !== undefined && suspendPayload && (
        <div>
          <SectionLabel>Suspend payload</SectionLabel>
          {typeof suspendPayload === 'string' ? (
            <ToolCallOutput text={suspendPayload} />
          ) : (
            <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
          )}
        </div>
      )}

      {resultPretty && <ToolCallOutput text={resultPretty} error={status === 'error'} data-testid="tool-result" />}

      {toolOutput.length > 0 && (
        <div>
          <SectionLabel>Tool output</SectionLabel>
          <div className="h-40 overflow-y-auto">
            <CodeEditor data={toolOutput} data-testid="tool-output" />
          </div>
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
