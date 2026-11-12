import { PROCESS_OUTPUT_TAIL, useProcessOutputTail } from './use-process-output-tail';
import { stripAnsi, ToolCallOutput } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';

/** The last lines a running process wrote, read only while its row is open. */
export function BackgroundProcessOutput({
  workspaceId,
  threadId,
  pid,
}: {
  workspaceId: string;
  threadId: string;
  pid: string;
}) {
  const { data, error, isPending } = useProcessOutputTail({ workspaceId, threadId, pid });

  if (isPending) {
    return (
      <Txt variant="caption" tone="muted">
        Reading output…
      </Txt>
    );
  }
  if (error) {
    return (
      <Txt variant="caption" tone="muted">
        {error.message}
      </Txt>
    );
  }
  const stdout = stripAnsi(data.stdout).trimEnd();
  const stderr = stripAnsi(data.stderr).trimEnd();
  if (!stdout && !stderr) {
    return (
      <Txt variant="caption" tone="muted">
        No output yet
      </Txt>
    );
  }
  return (
    <>
      <Txt variant="caption" tone="muted">
        Last {PROCESS_OUTPUT_TAIL} lines
      </Txt>
      {stdout && <ToolCallOutput text={stdout} />}
      {stderr && <ToolCallOutput text={stderr} error />}
    </>
  );
}
