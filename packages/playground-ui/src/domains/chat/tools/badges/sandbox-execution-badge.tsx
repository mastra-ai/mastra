import type { DataMessagePart } from '../tool-card';
import { parseToolArgs, sandboxExit, toolDataParts, workspaceMetadata } from './workspace-data-parts';
import { WorkspaceLink } from './workspace-link';
import type { MessageMetadata } from '@/domains/chat';
import { awaitsToolApproval } from '@/domains/chat/tools/badges/awaits-tool-approval';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import { ToolApprovalBadge } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { presentTool, ToolCallBody, ToolCallExitStatus, toolCallHasBody } from '@/ds/components/ai/tool-call';
import type { ToolCallView } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';
import { useElapsedTime } from '@/hooks/use-elapsed-time';
import { cn } from '@/utils/cn';
import { formatDuration, formatElapsed } from '@/utils/duration';

const SANDBOX_STATUS_DOT: Record<string, string> = {
  running: 'bg-success-indicator',
  starting: 'bg-warning-indicator',
  initializing: 'bg-warning-indicator',
  stopped: 'bg-muted-foreground',
  paused: 'bg-muted-foreground',
  error: 'bg-destructive-indicator',
  failed: 'bg-destructive-indicator',
};

export interface SandboxExecutionBadgeProps extends Omit<ToolApprovalRequest, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: unknown;
  metadata?: MessageMetadata;
  toolCalled?: boolean;
  dataParts?: ReadonlyArray<DataMessagePart>;
  status?: ActivityStatus;
}

export const SandboxExecutionBadge = ({
  toolName,
  args,
  result,
  metadata,
  toolCallId,
  toolApprovalMetadata,
  isNetwork,
  toolCalled: toolCalledProp,
  dataParts,
  status = 'idle',
}: SandboxExecutionBadgeProps) => {
  const parsedArgs = parseToolArgs(args);
  const { icon: ToolIcon, label, detail, description, command } = presentTool(toolName, parsedArgs);
  const startedCommand = toolDataParts(dataParts, 'sandbox-command', toolCallId)[0]?.data?.command;
  const originalCommand = typeof startedCommand === 'string' ? startedCommand : undefined;

  const outputChunks = (dataParts ?? []).filter(
    part =>
      part.type === 'data' &&
      (part.name === 'sandbox-stdout' || part.name === 'sandbox-stderr') &&
      part.data?.toolCallId === toolCallId,
  );
  const exit = sandboxExit(dataParts, toolCallId);
  const view: ToolCallView = {
    toolName,
    args: parsedArgs,
    status,
    command: command ?? originalCommand,
    output: outputChunks.map(part => part.data?.output ?? '').join(''),
    result,
    exit,
  };
  const workspace = workspaceMetadata(dataParts, toolCallId);
  const isRunning = status === 'running' && Boolean(workspace) && !exit;
  const toolCalled = toolCalledProp ?? (Boolean(workspace) || Boolean(exit) || typeof result === 'string');
  const elapsedTime = useElapsedTime(isRunning, outputChunks[0]?.data?.timestamp);

  const needsApproval = awaitsToolApproval({ toolApprovalMetadata, toolCalled });
  const hasBody = toolCallHasBody(view) || needsApproval;

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
      data-testid="sandbox-execution-badge"
      icon={<ToolIcon aria-hidden />}
      title={label}
      detail={originalCommand ?? detail}
      description={description}
      status={status}
      extraInfo={
        <>
          {workspace?.sandbox && (
            <WorkspaceLink
              href={workspace.id ? `/workspaces/${workspace.id}` : '/workspaces'}
              icon={
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    SANDBOX_STATUS_DOT[workspace.sandbox.status ?? ''] ?? 'bg-warning-indicator',
                  )}
                />
              }
            >
              {workspace.sandbox.name || workspace.sandbox.provider}
            </WorkspaceLink>
          )}
          {exit && <ToolCallExitStatus exit={exit} />}
          {(isRunning || exit?.executionTimeMs !== undefined) && (
            <Txt as="span" variant="meta" tone="muted" className="px-1 tabular-nums">
              {isRunning ? formatElapsed(elapsedTime) : formatDuration(exit?.executionTimeMs ?? 0)}
            </Txt>
          )}
        </>
      }
      initialCollapsed={!toolApprovalMetadata}
    >
      {hasBody && <ToolCallBody {...view} showFullArguments={needsApproval} />}
    </ToolApprovalBadge>
  );
};
