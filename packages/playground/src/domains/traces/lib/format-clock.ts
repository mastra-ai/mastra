import { format } from 'date-fns';

import type { TimelineSpan } from './build-thread-timeline';

/** Wall clock of the step, printed under the message (`20:41:02`) so every step stays placed in real time. */
export function formatClock(startedAt: TimelineSpan['startedAt']): string | undefined {
  if (!startedAt) return undefined;
  const date = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  return format(date, 'HH:mm:ss');
}
