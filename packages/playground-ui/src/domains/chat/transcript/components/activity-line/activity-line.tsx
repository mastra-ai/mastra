import { useState } from 'react';

import { lineState, runActivity, spokenByStretch } from '../../services/run-activity';
import type { TimelineEntry } from '../../services/transcript';
import { RunLine } from './run-line';

export interface ActivityLineProps {
  entries: TimelineEntry[];
  lastEntryBeforeRun?: string;
  busy: boolean;
  /** Increments when a run starts, so a finished run's line stays hidden until the next one. */
  runsStarted: number;
  /** Memory is observing or reflecting and the run waits on it. */
  memoryBlocking?: boolean;
  stretchLive: boolean;
}

/**
 * The agent's state for the whole run: what it is doing while it works, a held prompt while it
 * waits on the user, then done or error for a beat before the line fades out. A run already over
 * when the line mounts, or whose exit has faded, draws nothing until another run starts.
 */
export function ActivityLine({
  entries,
  lastEntryBeforeRun,
  busy,
  runsStarted,
  memoryBlocking = false,
  stretchLive,
}: ActivityLineProps) {
  const activity = runActivity(entries, lastEntryBeforeRun);
  const live = busy || activity === 'waiting';
  const [settledRun, setSettledRun] = useState(live ? undefined : runsStarted);
  const state = lineState(activity, busy, memoryBlocking);
  if (state === 'writing' || (stretchLive && spokenByStretch(state))) return null;
  if (!live && settledRun === runsStarted) return null;
  return <RunLine state={state} live={live} onSettled={() => setSettledRun(runsStarted)} />;
}
