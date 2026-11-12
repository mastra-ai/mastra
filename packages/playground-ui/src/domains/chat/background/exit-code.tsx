import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/** A background process's exit code, shown even when it is 0: its end came long after the call. */
export function ExitCode({ exitCode }: { exitCode: number }) {
  return (
    <Txt
      as="span"
      variant="meta"
      tone={exitCode === 0 ? 'muted' : undefined}
      className={cn('px-1 tabular-nums', exitCode !== 0 && 'text-destructive-foreground')}
    >
      exit {exitCode}
    </Txt>
  );
}
