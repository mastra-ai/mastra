import { MastraUIMessage } from '@mastra/react';
import { WORKSPACE_TOOLS } from '@/domains/workspace/constants';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuiState } from '@assistant-ui/react';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronUpIcon, CopyIcon, TerminalSquare } from 'lucide-react';
import { IconButton } from '@/ds/components/IconButton';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';

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

export interface SandboxExecutionBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MastraUIMessage['metadata'];
  toolCalled?: boolean;
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
    <div className="rounded-md border border-border1 overflow-hidden">
      {/* Terminal header with command */}
      {command && (
        <div className="px-3 py-2 bg-surface3 border-b border-border1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-neutral6 text-xs shrink-0">$</span>
            <code className="text-xs text-neutral-300 font-mono truncate">{command}</code>
          </div>
          {onCopy && (
            <IconButton variant="light" size="sm" tooltip="Copy output" onClick={onCopy} className="shrink-0">
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
            </IconButton>
          )}
        </div>
      )}
      {/* Terminal content */}
      <pre
        ref={contentRef}
        style={{ maxHeight }}
        className="overflow-x-auto overflow-y-auto p-3 text-sm text-neutral-300 font-mono whitespace-pre-wrap bg-black"
      >
        {content || <span className="text-neutral6 italic">No output</span>}
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
}: SandboxExecutionBadgeProps) => {
  // Get sandbox streaming data parts from the message
  const message = useAuiState(s => s.message);
  const dataParts = useMemo(() => {
    const content = message.content as ReadonlyArray<{ type: string; name?: string; data?: any }>;
    return content.filter(part => part.type === 'data');
  }, [message.content]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard();
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

  // While running, show live streaming output.
  // Once the tool completes, show the final result — it's what the LLM saw.
  const outputContent = typeof result === 'string' ? result : streamingContent;

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
      <div className="flex items-center gap-2 justify-between">
        <button onClick={() => setIsCollapsed(s => !s)} className="flex items-center gap-2 min-w-0" type="button">
          <Icon>
            <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
          </Icon>
          <Badge icon={<TerminalSquare className="text-accent6" size={16} />}>{displayName}</Badge>
          {execMeta?.sandbox && (
            <Link
              href={execMeta.id ? `/workspaces/${execMeta.id}` : '/workspaces'}
              className="flex items-center gap-1.5 text-xs text-neutral6 px-1.5 py-0.5 rounded bg-surface3 border border-border1 hover:bg-surface4 hover:border-border2 transition-colors"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', getStatusColor(execMeta.sandbox.status))} />
              <span>{execMeta.sandbox.name || execMeta.sandbox.provider}</span>
            </Link>
          )}
        </button>

        {/* Status area */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-accent6">
                <span className="w-1.5 h-1.5 bg-accent6 rounded-full animate-pulse" />
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
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400">
                    killed
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
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
