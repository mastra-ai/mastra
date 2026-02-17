import { MastraUIMessage } from '@mastra/react';
import { WORKSPACE_TOOLS } from '@/domains/workspace/constants';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronUpIcon, CopyIcon, TerminalSquare } from 'lucide-react';
import { IconButton } from '@/ds/components/IconButton';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';

interface SandboxInfo {
  id?: string;
  name?: string;
  provider?: string;
  status?: string;
}

interface WorkspaceInfo {
  id?: string;
  name?: string;
}

interface ExecutionMetadata {
  workspace?: WorkspaceInfo;
  sandbox?: SandboxInfo;
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
  toolOutput?: Array<{
    type: string;
    data?: string;
    timestamp?: number;
    metadata?: ExecutionMetadata;
    exitCode?: number;
    success?: boolean;
    executionTimeMs?: number;
  }>;
  suspendPayload?: any;
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
            <span className="text-icon6 text-xs shrink-0">$</span>
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
        {content || <span className="text-icon6 italic">No output</span>}
      </pre>
    </div>
  );
};

// Extract error message from various possible locations
// Priority: error.message > error (string) > message > stderr (for failed commands)
const extractErrorMessage = (result: any): string | null => {
  if (!result || Array.isArray(result)) return null;

  // Direct error property
  if (result.error?.message) return result.error.message;
  if (typeof result.error === 'string') return result.error;
  // Only treat result.message as an error when there's an explicit failure signal
  if (result.message && (result.success === false || (typeof result.exitCode === 'number' && result.exitCode !== 0))) {
    return result.message;
  }

  // If command failed (non-zero exit, success=false) and has stderr but no stdout
  if (result.success === false && result.stderr && !result.stdout) {
    return result.stderr;
  }

  // If exitCode is non-zero/negative and no other output, indicate failure
  if (typeof result.exitCode === 'number' && result.exitCode !== 0 && !result.stdout && !result.stderr) {
    return `Command failed with exit code ${result.exitCode}`;
  }

  return null;
};

export const SandboxExecutionBadge = ({
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
}: SandboxExecutionBadgeProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const { Link } = useLinkComponent();

  // Parse args to get command info
  let commandDisplay = '';
  try {
    const parsedArgs = typeof args === 'object' ? args : JSON.parse(args);
    if (toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) {
      const cmd = parsedArgs.command || '';
      const cmdArgs = parsedArgs.args?.join(' ') || '';
      commandDisplay = `${cmd} ${cmdArgs}`.trim();
    }
  } catch {
    commandDisplay = toolName;
  }

  // Filter toolOutput for sandbox stdout/stderr chunks
  const sandboxChunks =
    toolOutput?.filter(chunk => chunk.type === 'sandbox-stdout' || chunk.type === 'sandbox-stderr') || [];

  // Extract execution metadata from the most recent chunk (to handle state changes during execution)
  const chunksWithMetadata = toolOutput?.filter(
    chunk =>
      (chunk.type === 'sandbox-stdout' || chunk.type === 'sandbox-stderr' || chunk.type === 'sandbox-exit') &&
      chunk.metadata,
  ) as Array<{ type: string; metadata?: ExecutionMetadata }> | undefined;
  const execMeta = chunksWithMetadata?.length ? chunksWithMetadata[chunksWithMetadata.length - 1]?.metadata : undefined;

  // Check for sandbox-exit chunk which indicates streaming is complete
  const exitChunk = toolOutput?.find(chunk => chunk.type === 'sandbox-exit') as
    | { type: 'sandbox-exit'; exitCode: number; success: boolean; executionTimeMs: number }
    | undefined;

  // Check if result is a string (new raw-text format) vs object (old format)
  const isStringResult = typeof result === 'string';

  // Check if result is the final execution result (object with exitCode) vs streaming array
  const hasFinalResult = !isStringResult && result && !Array.isArray(result) && typeof result.exitCode === 'number';
  const finalResult = hasFinalResult ? result : null;

  const errorMessage = isStringResult ? null : extractErrorMessage(result);
  const hasError = isStringResult ? (result as string).includes('Exit code:') : !!errorMessage;

  // Streaming is complete if we have exit chunk, final result, string result, or error
  const isStreamingComplete = !!exitChunk || hasFinalResult || isStringResult || !!errorMessage;

  const hasStreamingOutput = sandboxChunks.length > 0;
  const isRunning = hasStreamingOutput && !isStreamingComplete;
  const toolCalled = toolCalledProp ?? (isStreamingComplete || hasStreamingOutput);

  // Combine streaming output into a single string
  const streamingContent = sandboxChunks.map(chunk => chunk.data || '').join('');

  // Get output content for display
  // Priority: error > string result > final result > streaming output
  let outputContent = '';
  if (isStringResult) {
    outputContent = result as string;
  } else if (errorMessage) {
    const extra = [finalResult?.stdout, finalResult?.stderr].filter(Boolean).join('\n');
    outputContent = `Error: ${errorMessage}${extra ? '\n\n' + extra : ''}`;
  } else if (finalResult) {
    outputContent = [finalResult.stdout, finalResult.stderr].filter(Boolean).join('\n');
  } else if (hasStreamingOutput) {
    outputContent = streamingContent;
  }

  // Get exit info - treat errors as failures
  const exitCode = exitChunk?.exitCode ?? finalResult?.exitCode ?? (hasError ? 1 : undefined);
  const exitSuccess = isStringResult ? !hasError : (hasError ? false : (exitChunk?.success ?? finalResult?.success));
  const executionTime = exitChunk?.executionTimeMs ?? finalResult?.executionTimeMs;

  const displayName = toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND ? 'Execute Command' : toolName;

  // Get start time from first streaming chunk for live timer
  const firstChunkTime = sandboxChunks[0]?.timestamp;
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
          {execMeta?.sandbox?.name && (
            <Link
              href={execMeta.workspace?.id ? `/workspaces/${execMeta.workspace.id}` : '/workspaces'}
              className="flex items-center gap-1.5 text-xs text-icon6 px-1.5 py-0.5 rounded bg-surface3 border border-border1 hover:bg-surface4 hover:border-border2 transition-colors"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', getStatusColor(execMeta.sandbox.status))} />
              <span>{execMeta.sandbox.name}</span>
              {execMeta.sandbox.id && (
                <span className="text-icon4 text-[10px]">({execMeta.sandbox.id.slice(0, 8)})</span>
              )}
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
              <span className="text-icon6 text-xs tabular-nums">{elapsedTime}ms</span>
            </>
          ) : (
            <>
              {exitCode !== undefined &&
                (exitSuccess ? (
                  <CheckIcon className="text-green-400" size={14} />
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
                    exit {exitCode}
                  </span>
                ))}
              {executionTime !== undefined && <span className="text-icon6 text-xs">{executionTime}ms</span>}
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
