import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { ToolCoinIcon } from '@mastra/playground-ui/icons/ToolCoinIcon';
import { formatTypeScript } from '@mastra/playground-ui/utils/formatting';
import { useEffect, useState } from 'react';
import { BadgeWrapper } from './badge-wrapper';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export interface CodeModeResult {
  success: boolean;
  result?: unknown;
  logs?: string[];
  error?: { message: string; name?: string; line?: number };
}

export interface CodeModeBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  code: string;
  result?: CodeModeResult;
  metadata?: MessageMetadata;
  toolCalled?: boolean;
}

/**
 * Detects whether a tool call is a Code Mode (`execute_typescript`) call by its
 * shape rather than its id, since the id is configurable via `createCodeMode({ id })`.
 *
 * A Code Mode call has a single string `code` argument, and — once it has run —
 * a result matching `CodeModeResult` (`success: boolean` plus `result`/`logs`/`error`).
 */
// eslint-disable-next-line react-refresh/only-export-components
export const getCodeModeCall = (
  args: Record<string, unknown> | string,
  result: unknown,
): { code: string; result?: CodeModeResult } | null => {
  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = typeof args === 'object' ? args : JSON.parse(args);
  } catch {
    return null;
  }

  const code = parsedArgs?.code;
  if (typeof code !== 'string') return null;

  // Before the program runs, there is no result yet — still render as Code Mode.
  if (result === undefined || result === null) {
    return { code };
  }

  if (
    typeof result === 'object' &&
    typeof (result as CodeModeResult).success === 'boolean' &&
    ('result' in result || 'logs' in result || 'error' in result)
  ) {
    return { code, result: result as CodeModeResult };
  }

  return null;
};

export const CodeModeBadge = ({
  toolName,
  code,
  result,
  metadata,
  toolCallId,
  toolApprovalMetadata,
  isNetwork,
  toolCalled: toolCalledProp,
}: CodeModeBadgeProps) => {
  const logs = result?.logs ?? [];
  const error = result?.error;
  const hasResultValue = result !== undefined && result.result !== undefined;

  const toolCalled = toolCalledProp ?? result !== undefined;

  // The model usually emits the program as a single line; pretty-print it so the
  // highlighted block is readable. Falls back to the raw code if formatting fails
  // (e.g. the program is still streaming and not yet syntactically valid).
  const [formattedCode, setFormattedCode] = useState(code);
  useEffect(() => {
    let cancelled = false;
    formatTypeScript(code)
      .then(pretty => {
        if (!cancelled) setFormattedCode(pretty);
      })
      .catch(() => {
        if (!cancelled) setFormattedCode(code);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <BadgeWrapper
      data-testid="code-mode-badge"
      icon={<ToolCoinIcon className="text-accent6" />}
      title={toolName}
      initialCollapsed={!toolApprovalMetadata}
    >
      <div className="space-y-4">
        <div>
          <p className="pb-2 font-medium">Program</p>
          <div data-testid="code-mode-program">
            <CodeBlock code={formattedCode} lang="typescript" />
          </div>
        </div>

        {error && (
          <div>
            <p className="pb-2 font-medium">Error</p>
            <pre
              data-testid="code-mode-error"
              className="bg-surface4 text-error rounded-md p-4 font-mono text-sm break-words whitespace-pre-wrap"
            >
              {error.name ? `${error.name}: ` : ''}
              {error.message}
              {typeof error.line === 'number' ? ` (line ${error.line})` : ''}
            </pre>
          </div>
        )}

        {hasResultValue && (
          <div>
            <p className="pb-2 font-medium">Result</p>
            {typeof result!.result === 'string' ? (
              <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre" data-testid="code-mode-result">
                {result!.result as string}
              </pre>
            ) : (
              <CodeEditor data={result!.result as Record<string, unknown>} data-testid="code-mode-result" />
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div>
            <p className="pb-2 font-medium">Logs</p>
            <pre
              data-testid="code-mode-logs"
              className="overflow-x-auto rounded-md bg-black p-3 font-mono text-sm break-words whitespace-pre-wrap text-neutral-300"
            >
              {logs.join('\n')}
            </pre>
          </div>
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
