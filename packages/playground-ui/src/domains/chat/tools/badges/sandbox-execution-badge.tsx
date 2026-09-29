import { CheckIcon, ChevronUpIcon, CopyIcon, TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataMessagePart } from '../tool-card';
import type { MessageMetadata } from '@/domains/chat';
import type { ToolApprovalButtonsProps } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { ToolApprovalButtons } from '@/domains/chat/tools/badges/tool-approval-buttons';
import { WORKSPACE_TOOLS } from '@/domains/chat/tools/workspace-tool-constants';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useElapsedTime } from '@/hooks/use-elapsed-time';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/utils/cn';
import { formatDuration, formatElapsed } from '@/utils/duration';

// Matches the shape returned by workspace.getInfo() — flat, not nested under "workspace"
interface WorkspaceMetadata {
  toolName?: string;
  id?: string;
  name?: string;
  status?: string;
  sandbox?: {
    id?: string;
    name?: string;
    provider?: string;
    status?: string;
  };
  filesystem?: {
    id?: string;
    name?: string;
    provider?: string;
    status?: string;
  };
}

// Get status dot color based on sandbox status
const getStatusColor = (status?: string) => {
  switch (status) {
    case 'running':
      return 'bg-success-indicator';
    case 'starting':
    case 'initializing':
      return 'bg-warning-indicator';
    case 'stopped':
    case 'paused':
      return 'bg-muted-foreground';
    case 'error':
    case 'failed':
      return 'bg-destructive-indicator';
    default:
      return 'bg-warning-indicator';
  }
};

export interface SandboxExecutionBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MessageMetadata;
  toolCalled?: boolean;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

interface TerminalBlockProps {
  command?: string;
  content: string;
  maxHeight?: string;
  onCopy?: () => void;
  isCopied?: boolean;
}

const TerminalBlock = ({ command, content, maxHeight = '20rem', onCopy, isCopied }: TerminalBlockProps) => {
  const contentRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* Terminal header with command */}
      {command && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Txt as="span" variant="caption" tone="ink" className="shrink-0">
              $
            </Txt>
            <Txt as="span" variant="caption" tone="ink" font="mono" className="truncate">
              {command}
            </Txt>
          </div>
          {onCopy && (
            <Button variant="default" size="icon-sm" tooltip="Copy output" onClick={onCopy} className="shrink-0">
              <span className="grid">
                <span
                  style={{ gridArea: '1/1' }}
                  className={cn('transition-transform', isCopied ? 'scale-100' : 'scale-0')}
                >
                  <CheckIcon size={14} />
                </span>
                <span
                  style={{ gridArea: '1/1' }}
                  className={cn('transition-transform', isCopied ? 'scale-0' : 'scale-100')}
                >
                  <CopyIcon size={14} />
                </span>
              </span>
            </Button>
          )}
        </div>
      )}
      {/* Terminal content */}
      <pre
        ref={contentRef}
        style={{ maxHeight }}
        className="overflow-auto bg-muted p-3 text-body whitespace-pre-wrap text-foreground"
      >
        {content || <span className="text-muted-foreground italic">No output</span>}
      </pre>
    </div>
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
  dataParts: dataPartsProp,
}: SandboxExecutionBadgeProps) => {
  // Get sandbox streaming data parts from the message
  const dataParts = useMemo(() => {
    return (dataPartsProp ?? []).filter(part => part.type === 'data');
  }, [dataPartsProp]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });
  const { Link } = useLinkComponent();

  // Command info emitted by get_process_output (so we can show the original command)
  const commandChunk = dataParts.find(
    chunk => chunk.name === 'sandbox-command' && chunk.data?.toolCallId === toolCallId,
  );

  // Parse args to get command info
  let commandDisplay = '';
  try {
    const parsedArgs = typeof args === 'object' ? args : JSON.parse(args);
    if (toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) {
      commandDisplay = parsedArgs.command || '';
    } else if (
      toolName === WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT ||
      toolName === WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS
    ) {
      // Prefer the original command from streaming data, fall back to PID
      const cmd = commandChunk?.data?.command as string | undefined;
      commandDisplay = cmd || `PID ${parsedArgs.pid}`;
    }
  } catch {
    commandDisplay = toolName;
  }

  // Sandbox stdout/stderr chunks scoped to this tool call
  const sandboxChunks = dataParts.filter(
    chunk =>
      (chunk.name === 'sandbox-stdout' || chunk.name === 'sandbox-stderr') && chunk.data?.toolCallId === toolCallId,
  );

  // Workspace metadata emitted first — scoped to this tool call
  const workspaceMetaPart = dataParts.find(
    chunk => chunk.name === 'workspace-metadata' && chunk.data?.toolCallId === toolCallId,
  );
  const execMeta = workspaceMetaPart?.data as WorkspaceMetadata | undefined;

  // Exit chunk scoped to this tool call
  const exitChunk = dataParts.find(chunk => chunk.name === 'sandbox-exit' && chunk.data?.toolCallId === toolCallId) as
    | {
        name: string;
        data: {
          exitCode: number;
          success: boolean;
          executionTimeMs?: number;
          killed?: boolean;
          timedOut?: boolean;
        };
      }
    | undefined;

  // Streaming is complete if we have exit chunk or a final result
  const isStreamingComplete = !!exitChunk || typeof result === 'string';

  const hasStarted = !!workspaceMetaPart; // metadata is emitted at tool start
  const isRunning = hasStarted && !isStreamingComplete;
  const toolCalled = toolCalledProp ?? (isStreamingComplete || hasStarted);

  // Get exit info from data chunks
  const exitCode = exitChunk?.data?.exitCode;
  const exitSuccess = exitChunk?.data?.success;
  const executionTime = exitChunk?.data?.executionTimeMs;
  const wasKilled = exitChunk?.data?.killed;

  // Combine streaming output into a single string
  const streamingContent = sandboxChunks.map(chunk => chunk.data?.output || '').join('');

  // During a live session, prefer the full streaming output the user watched build up.
  // After hydration from storage (no streaming chunks available), fall back to the
  // truncated tool result. With transient stdout/stderr chunks, streaming data won't
  // survive a page refresh, so the result is the only option on reload.
  const outputContent = streamingContent || (typeof result === 'string' ? result : '');

  const displayName =
    toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND
      ? 'Execute Command'
      : toolName === WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT
        ? 'Get Process Output'
        : toolName === WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS
          ? 'Kill Process'
          : toolName;

  // Get start time from first streaming chunk for live timer
  const firstChunkTime = sandboxChunks[0]?.data?.timestamp as number | undefined;
  const elapsedTime = useElapsedTime(isRunning, firstChunkTime);

  const onCopy = () => {
    if (!outputContent || isCopied) return;
    copyToClipboard(outputContent);
  };

  return (
    <div className="mb-4" data-testid="sandbox-execution-badge">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setIsCollapsed(s => !s)} className="flex min-w-0 items-center gap-2" type="button">
          <Icon>
            <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
          </Icon>
          <Badge icon={<TerminalSquare className="text-span-workspace" size={16} />}>{displayName}</Badge>
          {execMeta?.sandbox && (
            <Link
              href={execMeta.id ? `/workspaces/${execMeta.id}` : '/workspaces'}
              className="state-layer flex items-center gap-1.5 rounded border border-border bg-card px-1.5 py-0.5 text-caption text-foreground hover:border-border-strong"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <span className={cn('size-1.5 rounded-full', getStatusColor(execMeta.sandbox.status))} />
              <span>{execMeta.sandbox.name || execMeta.sandbox.provider}</span>
            </Link>
          )}
        </button>

        {/* Status area */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Txt as="span" variant="caption" className="flex items-center gap-1.5 text-warning-indicator">
                <span className="size-1.5 animate-pulse rounded-full bg-warning-indicator" />
                <span className="animate-pulse">running</span>
              </Txt>
              <Txt as="span" variant="caption" tone="ink" className="tabular-nums">
                {formatElapsed(elapsedTime)}
              </Txt>
            </>
          ) : (
            <>
              {exitCode !== undefined &&
                (exitSuccess ? (
                  <CheckIcon className="text-success-indicator" size={14} />
                ) : wasKilled ? (
                  <Txt
                    as="span"
                    variant="meta"
                    className="rounded bg-badge-orange-strong px-1.5 py-0.5 text-badge-orange-foreground"
                  >
                    killed
                  </Txt>
                ) : (
                  <Txt
                    as="span"
                    variant="meta"
                    className="rounded bg-destructive-subtle px-1.5 py-0.5 text-destructive-subtle-foreground"
                  >
                    exit {exitCode}
                  </Txt>
                ))}
              {executionTime !== undefined && (
                <Txt as="span" variant="caption" tone="ink">
                  {formatDuration(executionTime)}
                </Txt>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div className="pt-2">
          {(outputContent || commandDisplay) && (
            <TerminalBlock
              command={commandDisplay}
              content={outputContent}
              onCopy={outputContent ? onCopy : undefined}
              isCopied={isCopied}
            />
          )}

          <ToolApprovalButtons
            toolCalled={toolCalled}
            toolCallId={toolCallId}
            toolApprovalMetadata={toolApprovalMetadata}
            toolName={toolName}
            isNetwork={isNetwork}
            isGenerateMode={metadata?.mode === 'generate'}
          />
        </div>
      )}
    </div>
  );
};
