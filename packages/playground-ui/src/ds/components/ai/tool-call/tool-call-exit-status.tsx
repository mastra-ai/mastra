import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ToolCallExit {
  exitCode: number;
  killed?: boolean;
}

/** How a process ended, shown only when it did not exit cleanly. */
export function ToolCallExitStatus({ exit }: { exit: ToolCallExit | undefined }) {
  if (!exit || exit.exitCode === 0) return null;
  return (
    <Txt
      as="span"
      variant="meta"
      className={cn('px-1', exit.killed ? 'text-warning-foreground' : 'text-destructive-foreground')}
    >
      {exit.killed ? 'killed' : `exit ${exit.exitCode}`}
    </Txt>
  );
}
