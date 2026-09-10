import { useEffect, useState } from 'react';
import { CodeBlock } from '../../../ds/components/CodeBlock';
import { CodeEditor } from '../../../ds/components/CodeEditor';
import { ToolCoinIcon } from '../../../ds/icons/ToolCoinIcon';
import { formatTypeScript } from '../../../utils/formatting';
import { SectionLabel } from './section-label';
import { ToolApprovalControls } from './tool-approval-controls';
import type { ToolApprovalControlsProps } from './tool-approval-controls';
import { ToolBadgeDisclosure } from './tool-badge-disclosure';

export interface CodeModeResult {
  success: boolean;
  result?: unknown;
  logs?: string[];
  error?: { message: string; name?: string; line?: number };
}

export interface CodeModeMessageProps extends ToolApprovalControlsProps {
  toolCallId: string;
  approvalRequired?: boolean;
  onToolOpen?: (toolCallId: string) => void;
  toolName: string;
  code: string;
  result?: CodeModeResult;
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

export const CodeModeMessage = ({
  toolName,
  code,
  result,
  toolCallId,
  approvalRequired,
  isRunning,
  status,
  onApprove,
  onDecline,
  onToolOpen,
  toolCalled: toolCalledProp,
}: CodeModeMessageProps) => {
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
    <ToolBadgeDisclosure
      isRunning={isRunning}
      onToolOpen={onToolOpen}
      data-testid="code-mode-badge"
      toolCallId={toolCallId}
      icon={<ToolCoinIcon className="text-accent6" />}
      title={toolName}
      initialCollapsed={!approvalRequired}
    >
      <div className="space-y-4">
        <div>
          <SectionLabel>Program</SectionLabel>
          <div data-testid="code-mode-program">
            <CodeBlock code={formattedCode} lang="typescript" />
          </div>
        </div>

        {error && (
          <div>
            <SectionLabel>Error</SectionLabel>
            <pre
              data-testid="code-mode-error"
              className="bg-surface4 text-error rounded-md px-3 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap"
            >
              {error.name ? `${error.name}: ` : ''}
              {error.message}
              {typeof error.line === 'number' ? ` (line ${error.line})` : ''}
            </pre>
          </div>
        )}

        {hasResultValue && result && (
          <div>
            <SectionLabel>Result</SectionLabel>
            {typeof result.result === 'string' ? (
              <pre
                className="bg-surface4 max-h-60 overflow-auto rounded-md px-3 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap"
                data-testid="code-mode-result"
              >
                {result.result as string}
              </pre>
            ) : (
              <CodeEditor data={result.result as Record<string, unknown>} data-testid="code-mode-result" />
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div>
            <SectionLabel>Logs</SectionLabel>
            <pre
              data-testid="code-mode-logs"
              className="max-h-60 overflow-auto rounded-md bg-black px-3 py-2 font-mono text-xs leading-normal break-words whitespace-pre-wrap text-neutral-300"
            >
              {logs.join('\n')}
            </pre>
          </div>
        )}

        {approvalRequired && !toolCalled && (
          <ToolApprovalControls isRunning={isRunning} status={status} onApprove={onApprove} onDecline={onDecline} />
        )}
      </div>
    </ToolBadgeDisclosure>
  );
};
