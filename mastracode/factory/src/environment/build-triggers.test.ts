import { describe, expect, it } from 'vitest';

import {
  type BuildTriggerProject,
  pendingTrigger,
  pushPending,
  retryBackoffActive,
  scheduleDue,
} from './build-triggers.js';

const T0 = new Date('2026-10-07T12:00:00Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const hours = (n: number) => minutes(n * 60);

function project(overrides: Partial<BuildTriggerProject> = {}): BuildTriggerProject {
  return {
    buildScheduleEnabled: true,
    buildScheduleHours: 24,
    buildOnPushEnabled: true,
    buildPushDebounceMinutes: 10,
    lastBuildStatus: null,
    lastBuildAttemptedAt: null,
    buildRequestedAt: null,
    lastPushAt: null,
    buildFailureCount: 0,
    ...overrides,
  };
}

/**
 * Drives the row the way the worker does: a tick at `now` with a pending
 * trigger "builds" (stamps the attempt, bumps the cap window, clears the
 * request). Lets the tests count builds over a timeline of pushes and ticks.
 */
function simulate(initial: BuildTriggerProject, events: Array<{ at: Date; push?: true; tick?: true }>) {
  let row = { ...initial };
  const builds: Date[] = [];
  for (const event of events) {
    if (event.push) row = { ...row, lastPushAt: event.at };
    if (event.tick) {
      if (!pendingTrigger(row, event.at)) continue;
      builds.push(event.at);
      row = {
        ...row,
        lastBuildAttemptedAt: event.at,
        lastBuildStatus: 'ready',
        buildRequestedAt: null,
      };
    }
  }
  return { builds, row };
}

const ticksEvery = (stepMinutes: number, fromMinute: number, toMinute: number) =>
  Array.from({ length: Math.floor((toMinute - fromMinute) / stepMinutes) + 1 }, (_, i) => ({
    at: minutes(fromMinute + i * stepMinutes),
    tick: true as const,
  }));

describe('scheduleDue', () => {
  it('is due with no attempt yet, and once the interval has passed since the last attempt', () => {
    expect(scheduleDue(project(), T0)).toBe(true);
    expect(scheduleDue(project({ lastBuildAttemptedAt: T0 }), hours(23))).toBe(false);
    expect(scheduleDue(project({ lastBuildAttemptedAt: T0 }), hours(24))).toBe(true);
  });

  it('is never due when the schedule is off', () => {
    expect(scheduleDue(project({ buildScheduleEnabled: false }), hours(48))).toBe(false);
  });
});

describe('retryBackoffActive', () => {
  it('holds for 30 minutes after a failed build, then doubles per consecutive failure', () => {
    const failed = project({ lastBuildStatus: 'failed', lastBuildAttemptedAt: T0, buildFailureCount: 1 });
    expect(retryBackoffActive(failed, minutes(29))).toBe(true);
    expect(retryBackoffActive(failed, minutes(30))).toBe(false);
    const twice = { ...failed, buildFailureCount: 2 };
    expect(retryBackoffActive(twice, minutes(59))).toBe(true);
    expect(retryBackoffActive(twice, minutes(60))).toBe(false);
    const thrice = { ...failed, buildFailureCount: 3 };
    expect(retryBackoffActive(thrice, minutes(119))).toBe(true);
    expect(retryBackoffActive(thrice, minutes(120))).toBe(false);
  });

  it('never waits longer than the schedule interval', () => {
    const many = project({
      lastBuildStatus: 'failed',
      lastBuildAttemptedAt: T0,
      buildFailureCount: 10,
      buildScheduleHours: 2,
    });
    expect(retryBackoffActive(many, minutes(119))).toBe(true);
    expect(retryBackoffActive(many, hours(2))).toBe(false);
  });

  it('is inactive after a successful build', () => {
    expect(retryBackoffActive(project({ lastBuildStatus: 'ready', lastBuildAttemptedAt: T0 }), minutes(1))).toBe(false);
  });
});

describe('pushPending', () => {
  it('builds on the next tick after the first push', () => {
    expect(pushPending(project({ lastPushAt: T0 }), T0)).toBe(true);
  });

  it('holds a push inside the debounce window after an attempt, then serves it', () => {
    const pushed = project({ lastPushAt: minutes(2), lastBuildAttemptedAt: T0, lastBuildStatus: 'ready' });
    expect(pushPending(pushed, minutes(9))).toBe(false);
    expect(pushPending(pushed, minutes(10))).toBe(true);
  });

  it('serves every push on the next tick with a zero debounce', () => {
    const pushed = project({ lastPushAt: minutes(1), lastBuildAttemptedAt: T0, buildPushDebounceMinutes: 0 });
    expect(pushPending(pushed, minutes(1))).toBe(true);
  });

  it('is consumed by any attempt made after the push, failed or not', () => {
    const consumed = project({ lastPushAt: T0, lastBuildAttemptedAt: minutes(5), lastBuildStatus: 'failed' });
    expect(pushPending(consumed, minutes(30))).toBe(false);
  });

  it('is off when push triggers are disabled', () => {
    expect(pushPending(project({ lastPushAt: T0, buildOnPushEnabled: false }), hours(1))).toBe(false);
  });
});

describe('pendingTrigger over a timeline', () => {
  const scheduledOff = project({ buildScheduleEnabled: false });

  it('builds on the first push, then collapses pushes inside the window into one build after it', () => {
    const { builds } = simulate(scheduledOff, [
      { at: minutes(0), push: true },
      { at: minutes(3), push: true },
      { at: minutes(6), push: true },
      ...ticksEvery(1, 0, 30),
    ]);
    expect(builds).toEqual([minutes(0), minutes(10)]);
  });

  it('a lone push builds once and nothing follows', () => {
    const { builds } = simulate(scheduledOff, [{ at: minutes(0), push: true }, ...ticksEvery(1, 0, 60)]);
    expect(builds).toEqual([minutes(0)]);
  });

  it('a push during a build yields exactly one more build once the window passes', () => {
    // The tick at minute 0 claims and builds; the attempt is stamped with the
    // claim time, so a push at minute 2 while the build runs stays newer than
    // it and is served at minute 10, the debounce measured from the attempt.
    const { builds } = simulate(scheduledOff, [
      { at: minutes(0), push: true },
      { at: minutes(0), tick: true },
      { at: minutes(2), push: true },
      ...ticksEvery(1, 3, 60),
    ]);
    expect(builds).toEqual([minutes(0), minutes(10)]);
  });

  it('a repository pushed to more often than the debounce still rebuilds every window', () => {
    const events = [];
    for (let i = 0; i < 30; i++) events.push({ at: minutes(i * 2), push: true as const });
    events.push(...ticksEvery(1, 0, 60));
    events.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.push ? -1 : 1));
    const { builds } = simulate(scheduledOff, events);
    expect(builds).toEqual([0, 10, 20, 30, 40, 50, 60].map(minutes));
  });

  it('a failed push build is not retried on the next tick; a new push builds once', () => {
    const failed = project({
      buildScheduleEnabled: false,
      lastPushAt: minutes(0),
      lastBuildAttemptedAt: minutes(10),
      lastBuildStatus: 'failed',
      buildFailureCount: 1,
    });
    expect(pendingTrigger(failed, minutes(11))).toBeNull();
    expect(pendingTrigger(failed, minutes(60))).toBeNull();
    const { builds } = simulate(failed, [{ at: minutes(12), push: true }, ...ticksEvery(1, 12, 40)]);
    expect(builds).toEqual([minutes(20)]);
  });

  it('an explicit request bypasses the backoff', () => {
    const failed = project({ lastBuildStatus: 'failed', lastBuildAttemptedAt: T0, buildFailureCount: 1 });
    expect(pendingTrigger(failed, minutes(5))).toBeNull();
    expect(pendingTrigger({ ...failed, buildRequestedAt: minutes(5) }, minutes(5))).toBe('requested');
  });

  it('the schedule respects the backoff and fires once it clears', () => {
    const failed = project({
      lastBuildStatus: 'failed',
      lastBuildAttemptedAt: T0,
      buildFailureCount: 1,
      buildScheduleHours: 1,
    });
    expect(pendingTrigger(failed, minutes(29))).toBeNull();
    expect(pendingTrigger(failed, minutes(60))).toBe('schedule');
  });
});
