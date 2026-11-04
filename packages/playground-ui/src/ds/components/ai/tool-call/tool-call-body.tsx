import { stripAnsi } from './ansi';
import { ToolCallArguments } from './tool-call-arguments';
import type { ToolCallExit } from './tool-call-exit-status';
import { ToolCallCommand, ToolCallMono } from './tool-call-mono';
import { ToolCallOutput } from './tool-call-output';
import { toolCallResultText } from './tool-call-view';
import type { ToolCallView } from './tool-call-view';

const FOLLOW_TAIL = 'flex flex-col-reverse';

export interface ToolCallBodyProps extends ToolCallView {
  showFullArguments?: boolean;
}

function lastParagraph(text: string): string {
  const settled = text.trimEnd();
  const start = settled.lastIndexOf('\n\n');
  return start === -1 ? settled : settled.slice(start + 2);
}

function exitText({ exitCode, error }: ToolCallExit, result: string | undefined): string {
  if (error !== undefined) return `Error: ${stripAnsi(error)}\nExit code: ${exitCode}`;
  // An exit saved before core sent `error` left why the command could not run only in its result.
  if (exitCode === -1 && result) return lastParagraph(result);
  return `Exit code: ${exitCode}`;
}

function commandOutput(view: ToolCallView, result: string | undefined): string | undefined {
  if (view.status !== 'error' || !view.output) return view.output || result;
  // The result is a truncated copy of the stream, so only how the command ended is new.
  const ending = view.exit ? exitText(view.exit, result) : result;
  return ending ? `${view.output.trimEnd()}\n\n${ending}` : view.output;
}

function CommandBody({ command, output }: { command: string; output?: string }) {
  return (
    <>
      <ToolCallCommand command={command} />
      {output && (
        <ToolCallMono copyText={output} className={`${FOLLOW_TAIL} text-muted-foreground`}>
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
