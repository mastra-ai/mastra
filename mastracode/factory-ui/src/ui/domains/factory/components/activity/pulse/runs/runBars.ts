import { FACTORY_ROLE_STAGES, isFactoryRole } from '@mastra/factory/rules/types';
import type { FactoryRole } from '@mastra/factory/rules/types';

import type { BoardSnapshot, WorkItem } from '../../../../services/workItems';
import type { RunEvent, RunTrail } from './runTrail';

export type RunStatus = 'running' | 'needs-you' | 'complete' | 'failed' | 'stopped' | 'unaccounted';

export interface RunBar {
  id: string;
  role: string;
  workItemId: string | undefined;
  card: WorkItem | undefined;
  title: string;
  startedAt: number | undefined;
  endedAt: number | undefined;
  status: RunStatus;
}

interface RunLiveness {
  runningSessionIds: ReadonlySet<string>;
  parkedSessionIds: ReadonlySet<string>;
}

interface PairedRun {
  id: string;
  role: string;
  sessionId: string | undefined;
  workItemId: string | undefined;
  targetName: string | undefined;
  startedAt: number | undefined;
  endedAt: number | undefined;
  endReason: string | undefined;
}

const END_REASON_STATUSES: Partial<Record<string, RunStatus>> = {
  complete: 'complete',
  error: 'failed',
  aborted: 'stopped',
};

/** The start names the human who asked and the end names the agent, so only `kickoffId` ties the two halves. */
function pairRuns(events: RunEvent[]): PairedRun[] {
  const runsByKickoff = new Map<string, PairedRun>();
  for (const event of events) {
    const run = runsByKickoff.get(event.kickoffId) ?? {
      id: event.kickoffId,
      role: event.role,
      sessionId: event.sessionId,
      workItemId: event.workItemId,
      targetName: event.targetName,
      startedAt: undefined,
      endedAt: undefined,
      endReason: undefined,
    };
    if (event.side === 'start') run.startedAt ??= event.atMs;
    else {
      run.endedAt ??= event.atMs;
      run.endReason ??= event.reason;
    }
    runsByKickoff.set(event.kickoffId, run);
  }
  return [...runsByKickoff.values()];
}

function liveStatus(sessionId: string, liveness: RunLiveness): RunStatus | undefined {
  if (liveness.parkedSessionIds.has(sessionId)) return 'needs-you';
  if (liveness.runningSessionIds.has(sessionId)) return 'running';
  return undefined;
}

/** A session runs one thing at a time, so only its newest run can be live; an older open run lost its end. */
function newestRunPerSession(runs: PairedRun[]): Map<string, PairedRun> {
  const newest = new Map<string, PairedRun>();
  for (const run of runs) {
    if (run.sessionId === undefined) continue;
    const current = newest.get(run.sessionId);
    if (current === undefined || runOrderMs(run) > runOrderMs(current)) newest.set(run.sessionId, run);
  }
  return newest;
}

function runOrderMs(run: PairedRun): number {
  return run.startedAt ?? run.endedAt ?? 0;
}

function pairedRunStatus(run: PairedRun, newest: Map<string, PairedRun>, liveness: RunLiveness): RunStatus {
  if (run.endedAt !== undefined) return END_REASON_STATUSES[run.endReason ?? ''] ?? 'stopped';
  const sessionId = run.sessionId;
  if (sessionId === undefined || newest.get(sessionId) !== run) return 'unaccounted';
  return liveStatus(sessionId, liveness) ?? 'unaccounted';
}

/** The role's kickoff fires as the card enters its stage, so that entry is the earliest its live run can have begun. */
function enteredRoleStageAt(item: WorkItem, role: FactoryRole): number | undefined {
  const stage = FACTORY_ROLE_STAGES[role];
  const openEntry = item.stageHistory.findLast(entry => entry.stage === stage && entry.exitedAt === undefined);
  return openEntry === undefined ? undefined : Date.parse(openEntry.enteredAt);
}

function liveRoleSessionsOlderThanTrail(
  items: WorkItem[],
  sessionsInTrail: ReadonlySet<string>,
  liveness: RunLiveness,
): RunBar[] {
  const seen = new Set(sessionsInTrail);
  return items.flatMap(item =>
    Object.entries(item.sessions).flatMap(([role, session]) => {
      if (!isFactoryRole(role)) return [];
      const status = liveStatus(session.sessionId, liveness);
      if (status === undefined || seen.has(session.sessionId)) return [];
      seen.add(session.sessionId);
      return [
        {
          id: `session:${session.sessionId}`,
          role,
          workItemId: item.id,
          card: item,
          title: item.title,
          startedAt: enteredRoleStageAt(item, role),
          endedAt: undefined,
          status,
        },
      ];
    }),
  );
}

export function runBars(trail: RunTrail, board: BoardSnapshot): RunBar[] {
  const liveness: RunLiveness = {
    runningSessionIds: new Set(board.runningSessionIds),
    parkedSessionIds: new Set(board.parkedSessionIds),
  };
  const cards = new Map(board.workItems.map(item => [item.id, item]));
  const runs = pairRuns(trail.events);
  const newest = newestRunPerSession(runs);
  const sessionsInTrail = new Set(runs.flatMap(run => (run.sessionId === undefined ? [] : [run.sessionId])));

  const trailBars = runs.map(run => {
    const card = run.workItemId === undefined ? undefined : cards.get(run.workItemId);
    return {
      id: run.id,
      role: run.role,
      workItemId: run.workItemId,
      card,
      title: run.targetName ?? card?.title ?? 'Untitled card',
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      status: pairedRunStatus(run, newest, liveness),
    };
  });
  if (trail.historyComplete) return trailBars;
  return [...trailBars, ...liveRoleSessionsOlderThanTrail(board.workItems, sessionsInTrail, liveness)];
}
