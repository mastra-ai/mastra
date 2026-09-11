import { CodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import type { MessageMetadata } from '@mastra/playground-ui/domains/chat';
import { BadgeWrapper } from '@mastra/playground-ui/domains/chat/components/badge-wrapper';
import { SectionLabel } from '@mastra/playground-ui/domains/chat/components/section-label';
import type { CodeModeResult } from '@mastra/playground-ui/domains/chat/tools/code-mode';
import { ToolCoinIcon } from '@mastra/playground-ui/icons/ToolCoinIcon';
import { formatTypeScript } from '@mastra/playground-ui/utils/formatting';
import { useEffect, useState } from 'react';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';

export interface CodeModeBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  code: string;
  result?: CodeModeResult;
  metadata?: MessageMetadata;
  toolCalled?: boolean;
}

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
              className="bg-surface4 text-error rounded-md px-3 py-2 font-mono text-ui-sm break-words whitespace-pre-wrap"
            >
              {error.name ? `${error.name}: ` : ''}
              {error.message}
              {typeof error.line === 'number' ? ` (line ${error.line})` : ''}
            </pre>
          </div>
        )}

        {hasResultValue && (
          <div>
            <SectionLabel>Result</SectionLabel>
            {typeof result!.result === 'string' ? (
              <pre
                className="bg-surface4 max-h-60 overflow-auto rounded-md px-3 py-2 font-mono text-ui-sm break-words whitespace-pre-wrap"
                data-testid="code-mode-result"
              >
                {result!.result as string}
              </pre>
            ) : (
              <CodeEditor data={result!.result as Record<string, unknown>} data-testid="code-mode-result" />
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div>
            <SectionLabel>Logs</SectionLabel>
            <pre
              data-testid="code-mode-logs"
              className="max-h-60 overflow-auto rounded-md bg-black px-3 py-2 font-mono text-ui-sm break-words whitespace-pre-wrap text-neutral-300"
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
