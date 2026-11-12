import { BackgroundTag } from '../../background/background-tag';
import type { McpInputRequestPayload } from '../mcp-input-request';
import { isDeferredCall, stoppedBackgroundLabel } from '../tool-card-kind';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import { BackgroundMcpTaskChip, McpTaskChip } from './mcp-task-chip';
import { useMcpTaskProgress } from './use-mcp-task-progress';
import type { MessageMetadata } from '@/domains/chat';
import { NetworkChoiceMetadataDialogTrigger } from '@/domains/chat/components/network-choice-metadata-dialog';
import { SectionLabel } from '@/domains/chat/components/section-label';
import { awaitsToolApproval } from '@/domains/chat/tools/badges/awaits-tool-approval';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import { ToolApprovalBadge } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import {
  presentTool,
  stringifyToolValue,
  ToolCallBody,
  toolCallHasBody,
  ToolCallOutput,
} from '@/ds/components/ai/tool-call';
import type { ToolCallView } from '@/ds/components/ai/tool-call';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';

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
  /** The Mastra background task running the call, when it was deferred. */
  backgroundTaskId?: string;
  /**
   * `running` while the part holds a deferred call's placeholder; `completed`/`failed` once it holds the result;
   * `cancelled`/`timed_out` when the task was stopped and the placeholder stays.
   */
  backgroundTaskStatus?: string;
  /** The MCP task question the call is waiting on, if it is. */
  mcpInputRequest?: McpInputRequestPayload;
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
  backgroundTaskId,
  backgroundTaskStatus,
  mcpInputRequest,
}: ToolBadgeProps) => {
  const { pretty: argsPretty, parsed: argsObject } = formatArgs(args);
  const { icon: ToolIcon, label, detail, description } = presentTool(toolName, argsObject);
  const view: ToolCallView = {
    toolName,
    args: argsObject,
    argsText: argsPretty,
    hideArguments: withoutArgs,
    status,
    result,
  };

  const routingDecision = metadata?.mode === 'network' ? metadata.routingDecision : undefined;
  const selectionReason =
    metadata?.mode === 'network' ? (routingDecision?.selectionReason ?? metadata.selectionReason) : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? (routingDecision ?? metadata.agentInput) : undefined;

  const toolCalled = toolCalledProp ?? (result || toolOutput.length > 0);
  const needsApproval = awaitsToolApproval({ toolApprovalMetadata, toolCalled });
  const hasBody = toolCallHasBody(view) || Boolean(suspendPayload) || toolOutput.length > 0 || needsApproval;

  const deferred = isDeferredCall(backgroundTaskId, backgroundTaskStatus);
  const stoppedLabel = stoppedBackgroundLabel(backgroundTaskId, backgroundTaskStatus);
  // A stopped call never gets its result, so how its MCP task ended comes from the background task too.
  const mcpTask = useMcpTaskProgress(result, status, {
    deferred: deferred || stoppedLabel !== undefined,
    request: mcpInputRequest,
  });

  const bgEntry =
    (metadata?.mode === 'stream' || metadata?.mode === 'generate') && metadata?.backgroundTasks
      ? metadata.backgroundTasks[toolCallId]
      : undefined;
  const bgStarted = Boolean(bgEntry?.taskId && bgEntry?.startedAt);

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
      badges={deferred ? <BackgroundTag /> : undefined}
      extraInfo={
        metadata?.mode === 'network' ? (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason || ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
          />
        ) : mcpTask || bgStarted || stoppedLabel ? (
          <>
            {stoppedLabel && (
              <Txt as="span" variant="meta" className="px-1 text-warning-foreground">
                {stoppedLabel}
              </Txt>
            )}
            {mcpTask &&
              (backgroundTaskId ? (
                <BackgroundMcpTaskChip task={mcpTask} backgroundTaskId={backgroundTaskId} />
              ) : (
                <McpTaskChip task={mcpTask} />
              ))}
            {bgEntry?.taskId && bgEntry?.startedAt && <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} />}
          </>
        ) : null
      }
      initialCollapsed={!(toolApprovalMetadata ?? suspendPayload)}
    >
      {hasBody && (
        <>
          <ToolCallBody {...view} showFullArguments={needsApproval} />

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
