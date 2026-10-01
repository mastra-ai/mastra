import { useEffect, useRef } from 'react';
import type { DataMessagePart } from '../tool-card';
import { parseToolArgs, toolDataParts, workspaceMetadata } from './workspace-data-parts';
import { WorkspaceLink } from './workspace-link';
import type { MessageMetadata } from '@/domains/chat';
import { BadgeWrapper } from '@/domains/chat/components/badge-wrapper';
import { awaitsToolApproval } from '@/domains/chat/tools/badges/awaits-tool-approval';
import type { ToolApprovalButtonsProps } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { ToolApprovalButtons } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { ActivityHeadline } from '@/ds/components/ai/activity';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { presentTool, ToolCallCommand, ToolCallMono } from '@/ds/components/ai/tool-call';
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

interface SandboxExit {
  exitCode?: number;
  success?: boolean;
  executionTimeMs?: number;
  killed?: boolean;
}

export interface SandboxExecutionBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: unknown;
  metadata?: MessageMetadata;
  toolCalled?: boolean;
  dataParts?: ReadonlyArray<DataMessagePart>;
  status?: ActivityStatus;
}

const ExitStatus = ({ exit }: { exit: SandboxExit }) => {
  if (exit.exitCode === undefined || exit.success) return null;
  return (
    <Txt as="span" variant="meta" className={exit.killed ? 'text-warning-foreground' : 'text-destructive-foreground'}>
      {exit.killed ? 'killed' : `exit ${exit.exitCode}`}
    </Txt>
  );
};

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
  const outputRef = useRef<HTMLPreElement>(null);
  const { icon: ToolIcon, label, detail, description, command } = presentTool(toolName, parseToolArgs(args));
  const startedCommand = toolDataParts(dataParts, 'sandbox-command', toolCallId)[0]?.data?.command;
  const originalCommand = typeof startedCommand === 'string' ? startedCommand : undefined;
  const shownCommand = command ?? originalCommand;

  const outputChunks = (dataParts ?? []).filter(
    part =>
      part.type === 'data' &&
      (part.name === 'sandbox-stdout' || part.name === 'sandbox-stderr') &&
      part.data?.toolCallId === toolCallId,
  );
  const output =
    outputChunks.map(part => part.data?.output ?? '').join('') || (typeof result === 'string' ? result : '');

  const exit: SandboxExit | undefined = toolDataParts(dataParts, 'sandbox-exit', toolCallId)[0]?.data;
  const workspace = workspaceMetadata(dataParts, toolCallId);
  const isRunning = status === 'running' && Boolean(workspace) && !exit;
  const toolCalled = toolCalledProp ?? (Boolean(workspace) || Boolean(exit) || typeof result === 'string');
  const elapsedTime = useElapsedTime(isRunning, outputChunks[0]?.data?.timestamp);

  const needsApproval = awaitsToolApproval({ toolApprovalMetadata, toolCalled });
  const hasBody = Boolean(shownCommand) || Boolean(output) || needsApproval;

  useEffect(() => {
    const outputBlock = outputRef.current;
    if (outputBlock) outputBlock.scrollTop = outputBlock.scrollHeight;
  }, [output]);

  return (
    <BadgeWrapper
      data-testid="sandbox-execution-badge"
      header={
        <ActivityHeadline
          icon={<ToolIcon aria-hidden />}
          label={label}
          detail={originalCommand ?? detail}
          description={description}
        />
      }
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
          {exit && <ExitStatus exit={exit} />}
          {(isRunning || exit?.executionTimeMs !== undefined) && (
            <Txt as="span" variant="meta" tone="muted" className="px-1 tabular-nums">
              {isRunning ? formatElapsed(elapsedTime) : formatDuration(exit?.executionTimeMs ?? 0)}
            </Txt>
          )}
        </>
      }
      initialCollapsed={!toolApprovalMetadata}
    >
      {hasBody && (
        <>
          {shownCommand && <ToolCallCommand command={shownCommand} />}
          {output && (
            <ToolCallMono ref={outputRef} copyText={output} className="text-muted-foreground">
              {output}
            </ToolCallMono>
          )}
          <ToolApprovalButtons
            toolCalled={toolCalled}
            toolCallId={toolCallId}
            toolApprovalMetadata={toolApprovalMetadata}
            toolName={toolName}
            isNetwork={isNetwork}
            isGenerateMode={metadata?.mode === 'generate'}
          />
        </>
      )}
    </BadgeWrapper>
  );
};
