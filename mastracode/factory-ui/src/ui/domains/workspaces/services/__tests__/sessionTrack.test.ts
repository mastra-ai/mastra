import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../../../factory/services/audit';
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

function layout(overrides: Partial<Parameters<typeof layoutSessionTrack>[0]>) {
  return layoutSessionTrack({
    startedAt: sessionStart,
    now: sessionStart + 10 * HOUR,
    stageHistory: [],
    runs: [],
    ownerChanges: [],
    ...overrides,
  });
}

describe('layoutSessionTrack', () => {
  it('draws and times only the part of each stage the session lived through, ending an open entry where the next begins', () => {
    const { stages } = layout({
      stageHistory: [
        { stage: 'triage', enteredAt: iso(-5), exitedAt: iso(2), by: 'user-ada' },
        { stage: 'planning', enteredAt: iso(2), by: 'factory-rule-dispatcher' },
        { stage: 'execute', enteredAt: iso(6), by: 'factory-rule-dispatcher' },
      ],
    });

    expect(stages).toEqual([
      { stage: 'triage', left: 0, width: 20, from: sessionStart, to: sessionStart + 2 * HOUR },
      { stage: 'planning', left: 20, width: 40, from: sessionStart + 2 * HOUR, to: sessionStart + 6 * HOUR },
      { stage: 'execute', left: 60, width: 40, from: sessionStart + 6 * HOUR, to: sessionStart + 10 * HOUR },
    ]);
  });

  it('pins the people who moved the item, never the agent, the rules, or whoever filed it', () => {
    const { pins } = layout({
      stageHistory: [
        { stage: 'intake', enteredAt: iso(1), by: 'user-ada' },
        { stage: 'triage', enteredAt: iso(2), by: 'factory-rule-dispatcher' },
        { stage: 'planning', enteredAt: iso(3), by: 'agent:thread-1' },
        { stage: 'review', enteredAt: iso(5), by: 'user-grace' },
      ],
      ownerChanges: [{ at: sessionStart + 8 * HOUR, fromOwnerId: 'user-ada', toOwnerId: 'user-grace' }],
    });

    expect(pins).toEqual([
      { left: 50, at: sessionStart + 5 * HOUR, personId: 'user-grace', stage: 'review' },
      { left: 80, at: sessionStart + 8 * HOUR, personId: 'user-grace' },
    ]);
  });

  it('keeps a run that started before the window to the part inside it', () => {
    const { runs } = layout({
      startedAt: sessionStart + 2 * HOUR,
      runs: [
        { startedAt: sessionStart + HOUR, endedAt: sessionStart + 4 * HOUR },
        { startedAt: sessionStart, endedAt: sessionStart + HOUR },
      ],
    });

    expect(runs).toEqual([{ left: 0, width: 25, from: sessionStart + 2 * HOUR, to: sessionStart + 4 * HOUR }]);
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
