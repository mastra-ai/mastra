import type { ProcessingRun } from '../contracts/processing.ts';

export function processingElapsedMs(run: ProcessingRun, now = Date.now()): number {
  if (run.clock)
    return run.clock.elapsedMs + (run.clock.startedAt ? Math.max(0, now - Date.parse(run.clock.startedAt)) : 0);
  // Older awaiting-review runs already have a persisted drafting completion time.
  // Their human wait must not consume the remaining automation allowance.
  const end = run.state === 'processing' ? now : Date.parse(run.updatedAt);
  return Math.max(0, end - Date.parse(run.createdAt));
}

export function processingClock(
  run: ProcessingRun,
  active: boolean,
  now = Date.now(),
): NonNullable<ProcessingRun['clock']> {
  return { elapsedMs: processingElapsedMs(run, now), startedAt: active ? new Date(now).toISOString() : null };
}
