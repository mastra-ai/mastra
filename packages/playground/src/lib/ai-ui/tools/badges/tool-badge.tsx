import {
  presentTool,
  stringifyToolValue,
  ToolCallMono,
  ToolCallPresentedHeader,
} from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolCallStatus } from '@mastra/playground-ui/components/ai/tool-call';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { SectionLabel } from './section-label';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

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
  const resultPretty = result !== undefined && result !== null ? stringifyToolValue(result) : undefined;

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
      {!withoutArgs && (
        <ToolCallMono copyText={argsPretty} data-testid="tool-args" className="text-icon5">
          {argsPretty}
        </ToolCallMono>
      )}

      {suspendPayload !== undefined && suspendPayload && (
        <div>
          <SectionLabel>Suspend payload</SectionLabel>
          {typeof suspendPayload === 'string' ? (
            <ToolCallMono copyText={suspendPayload} className="text-icon3">
              {suspendPayload}
            </ToolCallMono>
          ) : (
            <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
          )}
        </div>
      )}

      {resultPretty && (
        <ToolCallMono
          copyText={resultPretty}
          data-testid="tool-result"
          className={status === 'error' ? 'text-error/90' : 'text-icon3'}
        >
          {resultPretty}
        </ToolCallMono>
      )}

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
