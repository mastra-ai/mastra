import { describe, expect, it } from 'vitest';

import { defineBoard } from '../boards/index.js';
import { createTriageWorkRegistry } from '../boards/test-utils.js';
import { testCard } from './test-utils.js';
import { workItemActivity } from './work-item-activity.js';

const shipBoard = defineBoard({
  id: 'ship',
  name: 'Ship',
  initialPhase: 'inbox',
  phases: {
    inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['shipped', 'dropped'] },
    shipped: { name: 'Shipped', kind: 'terminal' },
    dropped: { name: 'Dropped', kind: 'terminal' },
  },
});
const boards = createTriageWorkRegistry(shipBoard);
const SINCE = Date.parse('2026-10-20T00:00:00.000Z');
const BEFORE = '2026-10-19T23:59:59.999Z';
const AT = '2026-10-20T00:00:00.000Z';
const AFTER = '2026-10-22T08:00:00.000Z';

function done(id: string, ...enteredAt: string[]) {
  return testCard(id, {
    stages: ['done'],
    createdAt: new Date(BEFORE),
    stageHistory: enteredAt.map(at => ({ stage: 'done', enteredAt: at, by: 'u1' })),
  });
}

describe('workItemActivity', () => {
  it('lists when cards were created from the instant on, and counts every card', () => {
    const activity = workItemActivity(
      [
        testCard('old', { createdAt: new Date(BEFORE) }),
        testCard('edge', { createdAt: new Date(AT) }),
        testCard('new', { createdAt: new Date(AFTER) }),
      ],
      boards,
      SINCE,
    );

    expect(activity).toEqual({ total: 3, createdAt: [AT, AFTER], doneAt: [] });
  });

  it('lists when a completed card last entered its board’s completed phase', () => {
    const activity = workItemActivity(
      [done('shipped-before', BEFORE), done('shipped', AFTER), done('reshipped', BEFORE, AFTER)],
      boards,
      SINCE,
    );

    expect(activity.doneAt).toEqual([AFTER, AFTER]);
  });

  it('reads the completed phase from the card’s own board, whatever the board names it', () => {
    const onShip = (id: string, stage: string) =>
      testCard(id, {
        board: 'ship',
        stages: [stage],
        createdAt: new Date(BEFORE),
        stageHistory: [{ stage, enteredAt: AFTER, by: 'u1' }],
      });

    const activity = workItemActivity([onShip('shipped', 'shipped'), onShip('dropped', 'dropped')], boards, SINCE);

    expect(activity.doneAt).toEqual([AFTER]);
  });

  it('leaves out a card that was completed and then reopened, or canceled', () => {
    const activity = workItemActivity(
      [
        { ...done('reopened', AFTER), stages: ['execute'] },
        testCard('canceled', {
          stages: ['canceled'],
          createdAt: new Date(BEFORE),
          stageHistory: [{ stage: 'canceled', enteredAt: AFTER, by: 'u1' }],
        }),
      ],
      boards,
      SINCE,
    );

    expect(activity.doneAt).toEqual([]);
  });

  it('leaves out a card on a board the project no longer has', () => {
    expect(workItemActivity([{ ...done('orphan', AFTER), board: 'retired' }], boards, SINCE).doneAt).toEqual([]);
  });
});
