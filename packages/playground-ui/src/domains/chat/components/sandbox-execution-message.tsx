import { CheckIcon, ChevronUpIcon, CopyIcon, TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { Icon } from '../../../ds/icons/Icon';
import { useCopyToClipboard } from '../../../hooks/use-copy-to-clipboard';
import { cn } from '../../../utils/cn';
import type { ToolApprovalControlsProps } from './tool-approval-controls';
import { ToolApprovalControls } from './tool-approval-controls';
import type { DataMessagePart } from './tool-data';
import { WORKSPACE_TOOLS } from './workspace-tools';

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
      return 'bg-green-500';
    case 'starting':
    case 'initializing':
      return 'bg-yellow-500';
    case 'stopped':
    case 'paused':
      return 'bg-gray-500';
    case 'error':
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-accent6';
  }
};

export interface SandboxExecutionMessageProps extends ToolApprovalControlsProps {
  toolName: string;
  args: Record<string, unknown> | string;
  result: unknown;
  toolCallId: string;
  onNavigate?: (href: string) => void;
  approvalRequired?: boolean;
  toolCalled?: boolean;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

// Hook for live elapsed time while running
const useElapsedTime = (isRunning: boolean, startTime?: number) => {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      setElapsed(0);
      startRef.current = startTime || Date.now();
      const interval = setInterval(() => {
        if (startRef.current) {
          setElapsed(Date.now() - startRef.current);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      startRef.current = null;
    }
  }, [isRunning, startTime]);

  return elapsed;
};

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
    <div className="border-border1 overflow-hidden rounded-md border">
      {/* Terminal header with command */}
      {command && (
        <div className="border-border1 bg-surface3 flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-neutral6 shrink-0 text-xs">$</span>
            <code className="text-neutral5 truncate font-mono text-xs">{command}</code>
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
        className="overflow-auto bg-black p-3 font-mono text-sm whitespace-pre-wrap text-neutral-300"
      >
        {content || <span className="text-neutral6 italic">No output</span>}
      </pre>
    </div>
  );
};

export const SandboxExecutionMessage = ({
  toolName,
  args,
  result,
  toolCallId,
  approvalRequired,
  isRunning: approvalRunning,
  status,
  onApprove,
  onDecline,
  onNavigate,
  toolCalled: toolCalledProp,
  dataParts: dataPartsProp,
}: SandboxExecutionMessageProps) => {
  // Get sandbox streaming data parts from the message
  const dataParts = useMemo(() => {
    return (dataPartsProp ?? []).filter(part => part.type === 'data');
  }, [dataPartsProp]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copiedDuration: 1500, showToast: false });

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
    | { name: string; data: { exitCode: number; success: boolean; executionTimeMs?: number; killed?: boolean } }
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
          <Badge icon={<TerminalSquare className="text-accent6" size={16} />}>{displayName}</Badge>
          {execMeta?.sandbox && onNavigate && (
            <a
              href={execMeta.id ? `/workspaces/${execMeta.id}` : '/workspaces'}
              className="border-border1 bg-surface3 text-neutral6 hover:border-border2 hover:bg-surface4 flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs transition-colors"
              onClick={event => {
                event.stopPropagation();
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                onNavigate(execMeta.id ? `/workspaces/${execMeta.id}` : '/workspaces');
              }}
            >
              <span className={cn('size-1.5 rounded-full', getStatusColor(execMeta.sandbox.status))} />
              <span>{execMeta.sandbox.name || execMeta.sandbox.provider}</span>
            </a>
          )}
        </button>

        {/* Status area */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <span className="text-accent6 flex items-center gap-1.5 text-xs">
                <span className="bg-accent6 size-1.5 animate-pulse rounded-full" />
                <span className="animate-pulse">running</span>
              </span>
              <span className="text-neutral6 text-xs tabular-nums">{elapsedTime}ms</span>
            </>
          ) : (
            <>
              {exitCode !== undefined &&
                (exitSuccess ? (
                  <CheckIcon className="text-green-400" size={14} />
                ) : wasKilled ? (
                  <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                    killed
                  </span>
                ) : (
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                    exit {exitCode}
                  </span>
                ))}
              {executionTime !== undefined && <span className="text-neutral6 text-xs">{executionTime}ms</span>}
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

          {approvalRequired && !toolCalled && (
            <ToolApprovalControls
              isRunning={approvalRunning}
              status={status}
              onApprove={onApprove}
              onDecline={onDecline}
            />
          )}
        </div>
      )}
    </div>
  );
};
