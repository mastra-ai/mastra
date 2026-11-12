import { ToolCallExitStatus } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';

/** A background process's exit code, shown even when it is 0: its end came long after the call. */
export function ExitCode({ exitCode }: { exitCode: number }) {
  if (exitCode !== 0) return <ToolCallExitStatus exit={{ exitCode }} />;
  return (
    <Txt as="span" variant="meta" tone="muted" className="px-1 tabular-nums">
      exit 0
    </Txt>
  );
}
