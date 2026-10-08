/**
 * When an environment should rebuild. Pure functions over the project row:
 * every piece of state they read (`lastBuildAttemptedAt`, `lastPushAt`,
 * `buildWindow*`, `buildFailureCount`, `buildRequestedAt`) lives on
 * `factory_projects`, so a restart or another replica reaches the same answer.
 */

import type { FactoryProject } from '../storage/domains/projects/base.js';

export const RETRY_BACKOFF_BASE_MS = 30 * 60_000;
export const CAP_WINDOW_MS = 60 * 60_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type BuildTriggerProject = Pick<
  FactoryProject,
  | 'buildScheduleEnabled'
  | 'buildScheduleHours'
  | 'buildOnPushEnabled'
  | 'buildPushDebounceMinutes'
  | 'buildPushMaxPerHour'
  | 'lastBuildStatus'
  | 'lastBuildAttemptedAt'
  | 'buildRequestedAt'
  | 'lastPushAt'
  | 'buildWindowStartedAt'
  | 'buildWindowCount'
  | 'buildFailureCount'
>;

/** The schedule wants a head check: enabled, and the last attempt is older than the interval (or there was none). */
export function scheduleDue(project: BuildTriggerProject, now: Date): boolean {
  if (!project.buildScheduleEnabled) return false;
  if (!project.lastBuildAttemptedAt) return true;
  return now.getTime() - project.lastBuildAttemptedAt.getTime() >= project.buildScheduleHours * HOUR_MS;
}

/**
 * After a failed build, automatic triggers wait: 30 minutes after the attempt,
 * doubling with each consecutive failure, never longer than the schedule
 * interval. An explicit request, or a push newer than the failed attempt,
 * is not subject to it (see `pushPending`).
 */
export function retryBackoffActive(project: BuildTriggerProject, now: Date): boolean {
  if (project.lastBuildStatus !== 'failed' || !project.lastBuildAttemptedAt) return false;
  const exponent = Math.max(0, project.buildFailureCount - 1);
  const backoff = Math.min(RETRY_BACKOFF_BASE_MS * 2 ** exponent, project.buildScheduleHours * HOUR_MS);
  return now.getTime() - project.lastBuildAttemptedAt.getTime() < backoff;
}

/**
 * A push to a base branch is waiting on a build: push triggers are on, the
 * push is newer than the last attempt (an attempt consumes every push before
 * it, failed or not), and the debounce window since the push has elapsed.
 */
export function pushPending(project: BuildTriggerProject, now: Date): boolean {
  if (!project.buildOnPushEnabled || !project.lastPushAt) return false;
  if (project.lastBuildAttemptedAt && project.lastPushAt.getTime() <= project.lastBuildAttemptedAt.getTime()) {
    return false;
  }
  return now.getTime() - project.lastPushAt.getTime() >= project.buildPushDebounceMinutes * MINUTE_MS;
}

/** The trailing-hour window as it stands at `now`: reset when it is an hour old or was never opened. */
export function capWindow(project: BuildTriggerProject, now: Date): { startedAt: Date; count: number } {
  const started = project.buildWindowStartedAt;
  if (!started || now.getTime() - started.getTime() >= CAP_WINDOW_MS) return { startedAt: now, count: 0 };
  return { startedAt: started, count: project.buildWindowCount };
}

/** Push-triggered builds in the current window are under the cap (0 = unlimited). */
export function capAllows(project: BuildTriggerProject, now: Date): boolean {
  if (project.buildPushMaxPerHour <= 0) return true;
  return capWindow(project, now).count < project.buildPushMaxPerHour;
}

export type BuildTriggerReason = 'requested' | 'push' | 'schedule';

/**
 * Which trigger, if any, wants a build at `now`, before the head check. A
 * `schedule` answer still needs `headsChanged` to confirm; the other two build
 * regardless. Null when nothing is due.
 */
export function pendingTrigger(project: BuildTriggerProject, now: Date): BuildTriggerReason | null {
  if (project.buildRequestedAt) return 'requested';
  if (pushPending(project, now) && capAllows(project, now)) return 'push';
  if (scheduleDue(project, now) && !retryBackoffActive(project, now)) return 'schedule';
  return null;
}
