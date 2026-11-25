import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ToolCallExit {
  exitCode: number;
  killed?: boolean;
  timedOut?: boolean;
  /** Why the process could not run or be observed; its `exitCode` is then a placeholder. */
  error?: string;
}

/** What the chip says; a process killed on purpose was stopped, so it warns rather than reads as a failure. */
function exitLabel(exit: ToolCallExit): { text: string; stopped: boolean } {
  if (exit.error !== undefined) return { text: 'error', stopped: false };
  if (exit.timedOut) return { text: 'timed out', stopped: false };
  if (exit.killed) return { text: 'killed', stopped: true };
  return { text: `exit ${exit.exitCode}`, stopped: false };
}

/** How a process ended, shown only when it did not exit cleanly. */
export function ToolCallExitStatus({ exit }: { exit: ToolCallExit }) {
  if (exit.exitCode === 0) return null;
  const { text, stopped } = exitLabel(exit);
  return (
    <Txt
      as="span"
      variant="meta"
      className={cn('px-1', stopped ? 'text-warning-foreground' : 'text-destructive-foreground')}
    >
      {text}
    </Txt>
  );
}
