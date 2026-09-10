import {
  presentTool,
  stringifyToolValue,
  stripSerializedAnsi,
  ToolCallEdit,
  ToolCallMono,
  ToolCallPresentedHeader,
  toolEdit,
} from '../../../ds/components/ai/tool-call';
import type { ToolCallStatus } from '../../../ds/components/ai/tool-call';
import { CodeEditor } from '../../../ds/components/CodeEditor';
import type { MessageMetadata } from '../messages/message-metadata';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import type { BackgroundTaskDetails } from './background-task-metadata-dialog';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { SectionLabel } from './section-label';
import { ToolApprovalControls } from './tool-approval-controls';
import type { ToolApprovalControlsProps } from './tool-approval-controls';
import { ToolBadgeDisclosure } from './tool-badge-disclosure';

function formatArgs(args: Record<string, unknown> | string): { pretty: string; parsed?: Record<string, unknown> } {
  try {
    const { __mastraMetadata: _, _background, ...parsed } = typeof args === 'object' ? args : JSON.parse(args);
    return { pretty: stringifyToolValue(parsed), parsed };
  } catch {
    return { pretty: stringifyToolValue(args) };
  }
}

export interface ToolMessageProps extends ToolApprovalControlsProps {
  toolCallId: string;
  approvalRequired?: boolean;
  onToolOpen?: (toolCallId: string) => void;
  backgroundTaskDetails?: BackgroundTaskDetails;
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MessageMetadata;
  toolOutput: Array<{ toolId: string }>;
  suspendPayload?: any;
  toolCalled?: boolean;
  withoutArgs?: boolean;
  toolStatus?: ToolCallStatus;
}

export const ToolMessage = ({
  toolName,
  args,
  result,
  metadata,
  toolOutput,
  toolCallId,
  approvalRequired,
  suspendPayload,
  isRunning,
  onApprove,
  onDecline,
  status,
  onToolOpen,
  backgroundTaskDetails,
  toolCalled: toolCalledProp,
  withoutArgs,
  toolStatus = 'idle',
}: ToolMessageProps) => {
  const { pretty: argsPretty, parsed: argsObject } = formatArgs(args);
  const { icon, label, detail } = presentTool(toolName, argsObject);
  const edit = toolEdit(toolName, argsObject);
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
    <ToolBadgeDisclosure
      data-testid="tool-badge"
      toolCallId={toolCallId}
      header={<ToolCallPresentedHeader icon={icon} label={label} detail={detail} />}
      status={toolStatus}
      isRunning={isRunning}
      onToolOpen={onToolOpen}
      extraInfo={
        metadata?.mode === 'network' ? (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason || ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
          />
        ) : bgEntry?.taskId && bgEntry?.startedAt ? (
          <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} details={backgroundTaskDetails} />
        ) : null
      }
      initialCollapsed={!!!(approvalRequired || suspendPayload)}
    >
      {edit && <ToolCallEdit edit={edit} />}
      {!withoutArgs && !edit && (
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
          className={toolStatus === 'error' ? 'text-error/90' : 'text-icon3'}
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

      {approvalRequired && !toolCalled && (
        <ToolApprovalControls isRunning={isRunning} status={status} onApprove={onApprove} onDecline={onDecline} />
      )}
    </ToolBadgeDisclosure>
  );
};
