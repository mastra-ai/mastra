import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../../../factory/services/audit';
import type { WorkItemStageEntry } from '../../../factory/services/workItems';
import { auditOwnerChanges, auditRunIntervals, layoutSessionTrack } from '../sessionTrack';

const HOUR = 3_600_000;
const sessionStart = Date.parse('2026-10-20T08:00:00.000Z');
const iso = (hoursAfterStart: number) => new Date(sessionStart + hoursAfterStart * HOUR).toISOString();

function auditEvent(overrides: Partial<AuditEvent> & Pick<AuditEvent, 'action'>): AuditEvent {
  return {
    id: `event-${overrides.action}-${overrides.occurredAt}`,
    actorId: 'user-ada',
    actorType: 'human',
    targets: [],
    metadata: {},
    occurredAt: iso(0),
    ...overrides,
  };
}

function filedCard(stageHistory: WorkItemStageEntry[], filedAt = stageHistory[0]?.enteredAt ?? iso(-5)) {
  return { stageHistory, createdAt: filedAt };
}

function layout(overrides: Partial<Parameters<typeof layoutSessionTrack>[0]>) {
  return layoutSessionTrack({
    startedAt: sessionStart,
    now: sessionStart + 10 * HOUR,
    card: undefined,
    runs: [],
    ownerChanges: [],
    ...overrides,
  });
}

describe('layoutSessionTrack', () => {
  it('draws only the part of each stage the session lived through, and times each stage as long as it lasted', () => {
    const { stages } = layout({
      card: filedCard([
        { stage: 'triage', enteredAt: iso(-5), exitedAt: iso(2), by: 'user-ada' },
        { stage: 'planning', enteredAt: iso(2), exitedAt: iso(6), by: 'factory-rule-dispatcher' },
        { stage: 'execute', enteredAt: iso(6), by: 'factory-rule-dispatcher' },
      ]),
    });

    expect(stages).toEqual([
      { stage: 'triage', left: 0, width: 20, from: sessionStart - 5 * HOUR, to: sessionStart + 2 * HOUR },
      { stage: 'planning', left: 20, width: 40, from: sessionStart + 2 * HOUR, to: sessionStart + 6 * HOUR },
      { stage: 'execute', left: 60, width: 40, from: sessionStart + 6 * HOUR, to: sessionStart + 10 * HOUR },
    ]);
  });

  it('leaves out a stage the item left as the session started, and keeps one entered since the clock last ticked', () => {
    const now = sessionStart + 10 * HOUR;
    const { stages } = layout({
      now,
      card: filedCard([
        { stage: 'triage', enteredAt: iso(-5), exitedAt: iso(0), by: 'user-ada' },
        { stage: 'planning', enteredAt: iso(0), exitedAt: new Date(now + 20_000).toISOString(), by: 'user-ada' },
        { stage: 'execute', enteredAt: new Date(now + 20_000).toISOString(), by: 'user-ada' },
      ]),
    });

    expect(stages.map(({ stage, width }) => ({ stage, width }))).toEqual([
      { stage: 'planning', width: 100 },
      { stage: 'execute', width: 0 },
    ]);
  });

  it('keeps every stage an item sat in at once, each with its own recorded length', () => {
    const { stages } = layout({
      card: filedCard([
        { stage: 'planning', enteredAt: iso(2), exitedAt: iso(8), by: 'user-ada' },
        { stage: 'execute', enteredAt: iso(6), by: 'user-ada' },
        { stage: 'review', enteredAt: iso(6), by: 'user-ada' },
      ]),
    });

    expect(stages.map(({ stage, from, to }) => ({ stage, from, to }))).toEqual([
      { stage: 'planning', from: sessionStart + 2 * HOUR, to: sessionStart + 8 * HOUR },
      { stage: 'execute', from: sessionStart + 6 * HOUR, to: sessionStart + 10 * HOUR },
      { stage: 'review', from: sessionStart + 6 * HOUR, to: sessionStart + 10 * HOUR },
    ]);
  });

  it('pins the people who moved the item, never the agent, the rules, or whoever filed it', () => {
    const { pins } = layout({
      card: filedCard([
        { stage: 'intake', enteredAt: iso(1), by: 'user-ada' },
        { stage: 'triage', enteredAt: iso(2), by: 'factory-rule-dispatcher' },
        { stage: 'planning', enteredAt: iso(3), by: 'agent:thread-1' },
        { stage: 'review', enteredAt: iso(5), by: 'user-grace' },
      ]),
      ownerChanges: [{ at: sessionStart + 8 * HOUR, fromOwnerId: 'user-ada', toOwnerId: 'user-grace' }],
    });

    expect(pins).toEqual([
      { left: 50, at: sessionStart + 5 * HOUR, personId: 'user-grace', stage: 'review' },
      { left: 80, at: sessionStart + 8 * HOUR, personId: 'user-grace' },
    ]);
  });

  it('pins no move for a card filed into several phases at once', () => {
    const { pins } = layout({
      card: filedCard([
        { stage: 'planning', enteredAt: iso(1), by: 'user-ada' },
        { stage: 'execute', enteredAt: iso(1), by: 'user-ada' },
      ]),
    });

    expect(pins).toEqual([]);
  });

  it("draws a run that started before the session from the track's start, keeping the run's own times", () => {
    const { runs } = layout({
      startedAt: sessionStart + 2 * HOUR,
      runs: [
        { startedAt: sessionStart + HOUR, endedAt: sessionStart + 4 * HOUR },
        { startedAt: sessionStart, endedAt: sessionStart + HOUR },
      ],
    });

    expect(runs).toEqual([{ left: 0, width: 25, from: sessionStart + HOUR, to: sessionStart + 4 * HOUR }]);
  });
});

describe('auditRunIntervals', () => {
  it('spans each run from its kickoff to its end, and skips ends recorded before kickoffs were stamped', () => {
    const intervals = auditRunIntervals([
      auditEvent({ action: 'factory.run.ended', occurredAt: iso(3), metadata: { startedAt: sessionStart + HOUR } }),
      auditEvent({ action: 'factory.run.ended', occurredAt: iso(5), metadata: { reason: 'complete' } }),
    ]);

    expect(intervals).toEqual([{ startedAt: sessionStart + HOUR, endedAt: sessionStart + 3 * HOUR }]);
  });
});

describe('auditOwnerChanges', () => {
  it("reads only this session's transfers, oldest first", () => {
    const transfer = (rowId: string, hours: number, toOwnerId: string) =>
      auditEvent({
        action: 'factory.session.owner_transferred',
        occurredAt: iso(hours),
        targets: [{ type: 'session', id: rowId }],
        metadata: { fromOwnerId: 'user-ada', toOwnerId },
      });

    const changes = auditOwnerChanges(
      [transfer('row-1', 6, 'user-grace'), transfer('row-2', 5, 'user-linus'), transfer('row-1', 4, 'user-ada')],
      'row-1',
    );

    expect(changes.map(change => change.toOwnerId)).toEqual(['user-ada', 'user-grace']);
  });
});
