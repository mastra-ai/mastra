import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../../../../services/audit';
import type { BoardSnapshot, WorkItem } from '../../../../services/workItems';
import { runBars } from './runBars';
import { runEvents } from './runTrail';
import type { RunTrail } from './runTrail';

const NOW = Date.parse('2026-10-19T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function runEvent(
  side: 'started' | 'ended',
  kickoffId: string,
  minutes: number,
  { role = 'work', sessionId = `session-${kickoffId}`, reason = 'complete' } = {},
): AuditEvent {
  const ended = side === 'ended';
  return {
    id: `${kickoffId}-${side}`,
    actorId: ended ? `agent:thread-${kickoffId}` : 'user-1',
    actorType: ended ? 'agent' : 'human',
    action: `factory.run.${side}`,
    targets: [{ type: 'work_item', id: 'card-1', name: 'Fix reconnect' }],
    metadata: { kickoffId, role, sessionId, threadId: `thread-${kickoffId}`, ...(ended ? { reason } : {}) },
    occurredAt: minutesAgo(minutes),
  };
}

function card(sessions: WorkItem['sessions']): WorkItem {
  return {
    id: 'card-2',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'project-1',
    parentWorkItemId: null,
    source: 'github-issue',
    sourceKey: null,
    title: 'Ship the docs',
    url: null,
    stages: ['execute'],
    stageHistory: [],
    sessions,
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: minutesAgo(600),
    updatedAt: minutesAgo(1),
  };
}

function board({
  workItems = [],
  running = [],
  parked = [],
}: { workItems?: WorkItem[]; running?: string[]; parked?: string[] } = {}): BoardSnapshot {
  return { workItems, runningSessionIds: running, parkedSessionIds: parked };
}

function trail(events: AuditEvent[], historyComplete = false): RunTrail {
  return { events: runEvents(events), historyComplete };
}

const roleSession = (sessionId: string) => ({ sessionId, branch: 'b', threadId: 't', startedBy: 'user-1' });

describe('runBars', () => {
  it.each([
    ['complete', 'complete'],
    ['error', 'failed'],
    ['aborted', 'stopped'],
  ])('joins a human-started run to its agent-recorded end (%s → %s)', (reason, status) => {
    const events = [runEvent('ended', 'k1', 10, { reason }), runEvent('started', 'k1', 40)];

    expect(runBars(trail(events), board())).toEqual([
      {
        id: 'k1',
        role: 'work',
        workItemId: 'card-1',
        title: 'Fix reconnect',
        startedAt: NOW - 40 * 60_000,
        endedAt: NOW - 10 * 60_000,
        status,
      },
    ]);
  });

  it('hands each run the board card it ran on, and none when the card has left the board', () => {
    const onBoard = { ...card({}), id: 'card-1' };
    const events = [runEvent('started', 'k1', 10)];

    expect(runBars(trail(events), board({ workItems: [onBoard] })).map(run => run.card)).toEqual([onBoard]);
    expect(runBars(trail(events), board()).map(run => run.card)).toEqual([undefined]);
  });

  it('calls an open run running or waiting only while the board says so, and admits it otherwise', () => {
    const events = [
      runEvent('started', 'running', 30),
      runEvent('started', 'parked', 20),
      runEvent('started', 'lost', 10),
    ];
    const live = board({ running: ['session-running'], parked: ['session-parked'] });

    expect(runBars(trail(events), live).map(run => [run.id, run.status, run.endedAt])).toEqual([
      ['running', 'running', undefined],
      ['parked', 'needs-you', undefined],
      ['lost', 'unaccounted', undefined],
    ]);
  });

  it('keeps only the newest open run of a session live — the older one lost its end', () => {
    const shared = { sessionId: 'session-shared' };
    const events = [runEvent('started', 'older', 50, shared), runEvent('started', 'newer', 5, shared)];

    expect(runBars(trail(events), board({ running: ['session-shared'] })).map(run => [run.id, run.status])).toEqual([
      ['older', 'unaccounted'],
      ['newer', 'running'],
    ]);
  });

  it('does not revive a run that lost its end when a later run on its session finished and the session wakes again', () => {
    const shared = { sessionId: 'session-shared' };
    const events = [
      runEvent('ended', 'finished', 10, shared),
      runEvent('started', 'finished', 20, shared),
      runEvent('started', 'lost', 50, shared),
    ];

    expect(runBars(trail(events), board({ running: ['session-shared'] })).map(run => [run.id, run.status])).toEqual([
      ['finished', 'complete'],
      ['lost', 'unaccounted'],
    ]);
  });

  it('shows a live role session with no run in the trail as one that began before it', () => {
    const liveCard = card({ plan: roleSession('session-old'), chat: roleSession('session-chat') });
    const live = board({ workItems: [liveCard], running: ['session-old', 'session-chat'] });

    expect(runBars(trail([]), live)).toEqual([
      {
        id: 'session:session-old',
        role: 'plan',
        workItemId: 'card-2',
        card: liveCard,
        title: 'Ship the docs',
        startedAt: undefined,
        endedAt: undefined,
        status: 'running',
      },
    ]);
  });

  it('starts a live role session with no recorded start where its card last entered that role’s stage', () => {
    const inReview = {
      ...card({ review: roleSession('session-review') }),
      stageHistory: [
        { stage: 'review', enteredAt: minutesAgo(200), exitedAt: minutesAgo(100), by: 'user-1' },
        { stage: 'execute', enteredAt: minutesAgo(100), exitedAt: minutesAgo(30), by: 'user-1' },
        { stage: 'review', enteredAt: minutesAgo(30), by: 'user-1' },
      ],
    };
    const live = board({ workItems: [inReview], running: ['session-review'] });

    expect(runBars(trail([]), live).map(run => run.startedAt)).toEqual([Date.parse(minutesAgo(30))]);
  });

  it('invents no earlier run once the trail reaches the first run ever recorded', () => {
    const live = board({ workItems: [card({ work: roleSession('session-human') })], running: ['session-human'] });

    expect(runBars(trail([], true), live)).toEqual([]);
  });

  it('leaves a live session alone once the trail already accounts for it', () => {
    const busy = { sessionId: 'session-busy' };
    const events = [runEvent('ended', 'k1', 10, busy), runEvent('started', 'k1', 20, busy)];
    const live = board({ workItems: [card({ work: roleSession('session-busy') })], running: ['session-busy'] });

    expect(runBars(trail(events), live).map(run => run.id)).toEqual(['k1']);
  });
});
