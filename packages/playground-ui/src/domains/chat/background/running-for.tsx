import { Txt } from '@/ds/components/Txt';
import { useElapsedTime } from '@/hooks/use-elapsed-time';
import { formatDuration } from '@/utils/duration';

/** How long background work has been running, counting from when it started on the server. */
export function RunningFor({ startedAt }: { startedAt: number }) {
  const elapsed = useElapsedTime(true, startedAt);
  return (
    <Txt as="span" variant="meta" tone="muted" className="px-1 tabular-nums">
      {formatDuration(Math.max(0, elapsed))}
    </Txt>
  );
}
