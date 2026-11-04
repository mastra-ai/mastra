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

/**
 * How a failed command ended, from the close of its result: the exit code, after any note on why it
 * stopped. When it could not run, the error is in that closing paragraph, and its message can hold
 * blank lines of its own, so the paragraph is found from where the error starts.
 */
function commandEnding(result: string, exit: ToolCallExit | undefined): string {
  const settled = result.trimEnd();
  const errorStart = exit?.error === undefined ? -1 : settled.lastIndexOf(`Error: ${stripAnsi(exit.error)}`);
  const endingStart = settled.lastIndexOf('\n\n', errorStart === -1 ? settled.length : errorStart);
  return endingStart === -1 ? settled : settled.slice(endingStart + 2);
}

function commandOutput(view: ToolCallView, result: string | undefined): string | undefined {
  if (view.status !== 'error' || !result || !view.output) return view.output || result;
  // The result is cut to what the model saw, so it only adds how the command ended to what it streamed.
  return `${view.output.trimEnd()}\n\n${commandEnding(result, view.exit)}`;
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
