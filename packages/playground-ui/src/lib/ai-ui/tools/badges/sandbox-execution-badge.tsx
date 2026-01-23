import { MastraUIMessage } from '@mastra/react';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronUpIcon, CopyIcon, TerminalSquare } from 'lucide-react';
import { TooltipIconButton } from '../../tooltip-icon-button';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons';

export interface SandboxExecutionBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MastraUIMessage['metadata'];
  toolOutput?: Array<{ type: string; data?: string; timestamp?: number }>;
  suspendPayload?: any;
  toolCalled?: boolean;
}

const useCopyToClipboard = ({ copiedDuration = 1500 }: { copiedDuration?: number } = {}) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

// Hook for live elapsed time while running
const useElapsedTime = (isRunning: boolean, startTime?: number) => {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
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
            <TooltipIconButton tooltip="Copy output" onClick={onCopy} className="shrink-0">
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
            </TooltipIconButton>
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

  // Parse args to get command info
  let commandDisplay = '';
  try {
    const parsedArgs = typeof args === 'object' ? args : JSON.parse(args);
    if (toolName === 'workspace_execute_command') {
      const cmd = parsedArgs.command || '';
      const cmdArgs = parsedArgs.args?.join(' ') || '';
      commandDisplay = `${cmd} ${cmdArgs}`.trim();
    } else if (toolName === 'workspace_execute_code') {
      const runtime = parsedArgs.runtime || 'node';
      const codePreview = parsedArgs.code?.slice(0, 50) + (parsedArgs.code?.length > 50 ? '...' : '');
      commandDisplay = `${runtime}: ${codePreview}`;
    }
  } catch {
    commandDisplay = toolName;
  }

  // Filter toolOutput for sandbox stdout/stderr chunks
  const sandboxChunks =
    toolOutput?.filter(chunk => chunk.type === 'sandbox-stdout' || chunk.type === 'sandbox-stderr') || [];

  // Check for sandbox-exit chunk which indicates streaming is complete
  const exitChunk = toolOutput?.find(chunk => chunk.type === 'sandbox-exit') as
    | { type: 'sandbox-exit'; exitCode: number; success: boolean; executionTimeMs: number }
    | undefined;

  // Check if result is the final execution result (object with exitCode) vs streaming array
  const hasFinalResult = result && !Array.isArray(result) && typeof result.exitCode === 'number';
  const finalResult = hasFinalResult ? result : null;

  // Streaming is complete if we have exit chunk or final result
  const isStreamingComplete = !!exitChunk || hasFinalResult;

  const hasStreamingOutput = sandboxChunks.length > 0;
  const isRunning = hasStreamingOutput && !isStreamingComplete;
  const toolCalled = toolCalledProp ?? (isStreamingComplete || hasStreamingOutput);

  // Combine streaming output into a single string
  const streamingContent = sandboxChunks.map(chunk => chunk.data || '').join('');

  // Get output content for display
  const outputContent = hasStreamingOutput
    ? streamingContent
    : finalResult
      ? [finalResult.stdout, finalResult.stderr].filter(Boolean).join('\n')
      : '';

  // Get exit info
  const exitCode = exitChunk?.exitCode ?? finalResult?.exitCode;
  const exitSuccess = exitChunk?.success ?? finalResult?.success;
  const executionTime = exitChunk?.executionTimeMs ?? finalResult?.executionTimeMs;

  const displayName = toolName === 'workspace_execute_command' ? 'Execute Command' : 'Execute Code';

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
