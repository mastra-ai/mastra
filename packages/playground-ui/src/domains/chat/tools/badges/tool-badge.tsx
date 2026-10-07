import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import type { MessageMetadata } from '@/domains/chat';
import { NetworkChoiceMetadataDialogTrigger } from '@/domains/chat/components/network-choice-metadata-dialog';
import { SectionLabel } from '@/domains/chat/components/section-label';
import { awaitsToolApproval } from '@/domains/chat/tools/badges/awaits-tool-approval';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import { ToolApprovalBadge } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import {
  hasToolArguments,
  presentTool,
  stringifyToolValue,
  stripSerializedAnsi,
  ToolCallArguments,
  ToolCallOutput,
} from '@/ds/components/ai/tool-call';
import { CodeEditor } from '@/ds/components/CodeEditor';

function formatArgs(args: Record<string, unknown> | string): { pretty: string; parsed?: Record<string, unknown> } {
  try {
    const { __mastraMetadata: _, _background, ...parsed } = typeof args === 'object' ? args : JSON.parse(args);
    return { pretty: stringifyToolValue(parsed), parsed };
  } catch {
    return { pretty: stringifyToolValue(args) };
  }
}

export interface ToolBadgeProps extends Omit<ToolApprovalRequest, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MessageMetadata;
  toolOutput: Array<{ toolId: string }>;
  suspendPayload?: any;
  toolCalled?: boolean;
  withoutArgs?: boolean;
  status?: ActivityStatus;
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
  const { icon: ToolIcon, label, detail, description } = presentTool(toolName, argsObject);
  const resultPretty =
    result !== undefined && result !== null ? stripSerializedAnsi(stringifyToolValue(result)) : undefined;

  const routingDecision = metadata?.mode === 'network' ? metadata.routingDecision : undefined;
  const selectionReason =
    metadata?.mode === 'network' ? (routingDecision?.selectionReason ?? metadata.selectionReason) : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? (routingDecision ?? metadata.agentInput) : undefined;

  const toolCalled = toolCalledProp ?? (result || toolOutput.length > 0);
  const needsApproval = awaitsToolApproval({ toolApprovalMetadata, toolCalled });
  const hasBody =
    hasToolArguments({ toolName, args: argsObject, argsText: argsPretty, hideArguments: withoutArgs }) ||
    Boolean(suspendPayload) ||
    Boolean(resultPretty) ||
    toolOutput.length > 0 ||
    needsApproval;

  const bgEntry =
    (metadata?.mode === 'stream' || metadata?.mode === 'generate') && metadata?.backgroundTasks
      ? metadata.backgroundTasks[toolCallId]
      : undefined;

  return (
    <ToolApprovalBadge
      approval={{
        toolCalled,
        toolCallId,
        toolApprovalMetadata,
        toolName,
        isNetwork,
        isGenerateMode: metadata?.mode === 'generate',
      }}
      data-testid="tool-badge"
      icon={<ToolIcon aria-hidden />}
      title={label}
      detail={detail}
      description={description}
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
      initialCollapsed={!(toolApprovalMetadata ?? suspendPayload)}
    >
      {hasBody && (
        <>
          <ToolCallArguments
            toolName={toolName}
            args={argsObject}
            showFullContent={needsApproval}
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
        </>
      )}
    </ToolApprovalBadge>
  );
};
