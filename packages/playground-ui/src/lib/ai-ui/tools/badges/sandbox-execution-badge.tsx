import { BadgeWrapper } from './badge-wrapper';
import { MastraUIMessage } from '@mastra/react';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon, CopyIcon, TerminalSquare } from 'lucide-react';
import { TooltipIconButton } from '../../tooltip-icon-button';

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

interface TerminalBlockProps {
  title: string;
  content: string;
  isStreaming?: boolean;
}

const TerminalBlock = ({ title, content, isStreaming }: TerminalBlockProps) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const contentRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  const onCopy = () => {
    if (!content || isCopied) return;
    copyToClipboard(content);
  };

  return (
    <div>
      {/* Header - matches CodeHeader styling */}
      <div
        style={{
          background: 'hsl(0 0% 100% / 0.06)',
          borderTopRightRadius: '0.5rem',
          borderTopLeftRadius: '0.5rem',
          marginTop: '0.5rem',
          border: '1px solid hsl(0 0% 20.4%)',
          borderBottom: 'none',
        }}
        className="flex items-center justify-between gap-4 px-4 py-2 text-sm font-semibold text-white"
      >
        <span className="lowercase flex items-center gap-2">
          {title}
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs font-normal text-accent6">
              <span className="w-1.5 h-1.5 bg-accent6 rounded-full animate-pulse" />
              running
            </span>
          )}
        </span>
        <TooltipIconButton tooltip="Copy" onClick={onCopy}>
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
      </div>
      {/* Content - matches pre styling */}
      <pre
        ref={contentRef}
        style={{
          borderBottomRightRadius: '0.5rem',
          borderBottomLeftRadius: '0.5rem',
          background: 'black',
          fontSize: '0.875rem',
          marginBottom: '0.5rem',
          border: '1px solid hsl(0 0% 20.4%)',
          borderTop: 'none',
        }}
        className="overflow-x-auto overflow-y-auto max-h-80 p-4 text-white font-mono whitespace-pre-wrap"
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
      // Show truncated code preview
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

  // Never collapse by default - always show the terminal output
  const shouldCollapse = false;

  // Combine streaming output into a single string
  const streamingContent = sandboxChunks.map(chunk => chunk.data || '').join('');

  // Format display name
  const displayName = toolName === 'workspace_execute_command' ? 'Execute Command' : 'Execute Code';

  return (
    <BadgeWrapper
      data-testid="sandbox-execution-badge"
      icon={<TerminalSquare className="text-accent6" size={16} />}
      title={
        <span className="flex items-center gap-2">
          {displayName}
          {commandDisplay && (
            <span className="text-icon6 text-xs font-normal max-w-[300px] truncate">{commandDisplay}</span>
          )}
        </span>
      }
      initialCollapsed={shouldCollapse}
    >
      <div className="space-y-2">
        {/* Show streaming output - either while running or after completion via exit chunk */}
        {hasStreamingOutput && (
          <>
            {/* Show exit status from exit chunk when available */}
            {exitChunk && (
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    exitChunk.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400',
                  )}
                >
                  exit {exitChunk.exitCode}
                </span>
                <span className="text-icon6 text-xs">{exitChunk.executionTimeMs}ms</span>
              </div>
            )}
            <TerminalBlock title="output" content={streamingContent} isStreaming={isRunning} />
          </>
        )}

        {/* Final result from stored messages (no streaming chunks) */}
        {finalResult && !hasStreamingOutput && (
          <>
            {/* Exit status */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  finalResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400',
                )}
              >
                exit {finalResult.exitCode}
              </span>
              <span className="text-icon6 text-xs">{finalResult.executionTimeMs}ms</span>
            </div>

            {/* stdout - show if we have it */}
            {finalResult.stdout && <TerminalBlock title="stdout" content={finalResult.stdout} />}

            {/* stderr - always show if present */}
            {finalResult.stderr && <TerminalBlock title="stderr" content={finalResult.stderr} />}
          </>
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
    </BadgeWrapper>
  );
};
