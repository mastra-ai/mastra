import { useEffect, useState } from 'react';
import { BadgeWrapper } from '../../components/badge-wrapper';
import { SectionLabel } from '../../components/section-label';
import type { MessageMetadata } from '../../messages/message-metadata';
import type { CodeModeResult } from '../code-mode';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';
import { CodeBlock } from '@/ds/components/CodeBlock';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';
import { formatTypeScript } from '@/utils/formatting';

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
  const resultValue = result?.result;
  const hasResultValue = resultValue !== undefined;

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
      icon={<ToolCoinIcon className="text-span-tool" />}
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
            <Txt
              as="pre"
              variant="caption"
              data-testid="code-mode-error"
              className="rounded-md bg-muted px-3 py-2 break-words whitespace-pre-wrap text-destructive-foreground"
            >
              {error.name ? `${error.name}: ` : ''}
              {error.message}
              {typeof error.line === 'number' ? ` (line ${error.line})` : ''}
            </Txt>
          </div>
        )}

        {hasResultValue && (
          <div>
            <SectionLabel>Result</SectionLabel>
            {typeof resultValue === 'string' ? (
              <Txt
                as="pre"
                variant="caption"
                className="max-h-60 overflow-auto rounded-md bg-muted px-3 py-2 break-words whitespace-pre-wrap"
                data-testid="code-mode-result"
              >
                {resultValue}
              </Txt>
            ) : (
              <CodeEditor data={resultValue as Record<string, unknown>} data-testid="code-mode-result" />
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div>
            <SectionLabel>Logs</SectionLabel>
            <Txt
              as="pre"
              variant="caption"
              data-testid="code-mode-logs"
              className="max-h-60 overflow-auto rounded-md bg-muted px-3 py-2 break-words whitespace-pre-wrap"
            >
              {logs.join('\n')}
            </Txt>
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
