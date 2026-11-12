import { MutedMeta } from './muted-meta';
import { useElapsedTime } from '@/hooks/use-elapsed-time';
import { formatDuration } from '@/utils/duration';

/** How long background work has been running, counting from when it started on the server. */
export function RunningFor({ startedAt }: { startedAt: number }) {
  const elapsed = useElapsedTime(true, startedAt);
  return <MutedMeta>{formatDuration(Math.max(0, elapsed))}</MutedMeta>;
}
