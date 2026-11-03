import { useEffect, useRef } from 'react';
import { ToolCallArguments } from './tool-call-arguments';
import { ToolCallCommand, ToolCallMono } from './tool-call-mono';
import { ToolCallOutput } from './tool-call-output';
import { toolCallResultText } from './tool-call-view';
import type { ToolCallView } from './tool-call-view';

export interface ToolCallBodyProps extends ToolCallView {
  showFullArguments?: boolean;
}

function commandOutput(view: ToolCallView, result: string | undefined): string | undefined {
  // Only the result carries a command's exit code and any error.
  if (view.status === 'error' && result) return result;
  return view.output || result;
}

function CommandBody({ command, output }: { command: string; output?: string }) {
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const block = outputRef.current;
    if (block) block.scrollTop = block.scrollHeight;
  }, [output]);

  return (
    <>
      <ToolCallCommand command={command} />
      {output && (
        <ToolCallMono ref={outputRef} copyText={output} className="text-muted-foreground">
          {output}
        </ToolCallMono>
      )}
    </>
  );
}

/** What an expanded tool call shows, drawn the same in every chat. */
export function ToolCallBody({ showFullArguments, ...view }: ToolCallBodyProps) {
  const result = toolCallResultText(view);
  if (view.command) return <CommandBody command={view.command} output={commandOutput(view, result)} />;

  return (
    <>
      <ToolCallArguments
        toolName={view.toolName}
        args={view.args}
        argsText={view.argsText}
        hideArguments={view.hideArguments}
        showFullContent={showFullArguments}
        data-testid="tool-args"
      />
      {view.output && <ToolCallOutput text={view.output} />}
      {result !== undefined && (
        <ToolCallOutput text={result} error={view.status === 'error'} data-testid="tool-result" />
      )}
    </>
  );
}
