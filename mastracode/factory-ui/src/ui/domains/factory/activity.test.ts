import { describe, expect, it, vi } from 'vitest';

import {
  activityBlocks,
  collapseRuns,
  dayHeading,
  factoryActivity,
  factoryDeeds,
  groupByDay,
  startOfLocalDay,
} from './activity';
import type { ActivityCard, ActivityEntry } from './activity';
import type { AuditEvent } from './services/audit';
import type { WorkItem, WorkItemStageEntry } from './services/workItems';

const NOW = Date.parse('2026-07-17T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

let nextId = 0;
function makeItem(stageHistory: WorkItemStageEntry[], overrides: Partial<WorkItem> = {}): WorkItem {
  nextId += 1;
  return {
    id: `item-${nextId}`,
    orgId: 'org1',
    createdBy: 'u1',
    githubProjectId: 'proj1',
    parentWorkItemId: null,
    source: 'github-issue',
    sourceKey: null,
    title: `Item ${nextId}`,
    url: null,
    stages: ['execute'],
    stageHistory,
    sessions: { work: { sessionId: `session-${nextId}`, branch: 'b', threadId: 't', startedBy: 'u1' } },
    metadata: {},
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: hoursAgo(40),
    updatedAt: hoursAgo(1),
    ...overrides,
  };
}

describe('factoryActivity', () => {
  it('flattens every card into one stream, newest first', () => {
    const older = makeItem([{ stage: 'triage', enteredAt: hoursAgo(30), by: 'u1' }]);
    const newer = makeItem([
      { stage: 'execute', enteredAt: hoursAgo(20), by: 'agent:builder' },
      { stage: 'review', enteredAt: hoursAgo(2), by: 'factory-rule-dispatcher' },
    ]);

    expect(factoryActivity([older, newer]).map(move => move.stage)).toEqual(['review', 'execute', 'triage']);
  });

  it('drops cards the Factory never ran — synced upstream traffic is not our stream', () => {
    const synced = makeItem([{ stage: 'triage', enteredAt: hoursAgo(3), by: 'github:someone' }], { sessions: {} });

    expect(factoryActivity([synced])).toHaveLength(0);
  });

  it('keeps the actor on the move, so the stream can name who did it', () => {
    const item = makeItem([{ stage: 'done', enteredAt: hoursAgo(1), by: 'agent:builder' }]);

    expect(factoryActivity([item])[0]?.by).toBe('agent:builder');
  });

  it('skips entries with an unparseable timestamp instead of sorting them to the top', () => {
    const item = makeItem([
      { stage: 'triage', enteredAt: 'not-a-date', by: 'u1' },
      { stage: 'review', enteredAt: hoursAgo(1), by: 'u1' },
    ]);

    expect(factoryActivity([item]).map(move => move.stage)).toEqual(['review']);
  });
});

describe('groupByDay', () => {
  it('cuts the stream where the local day changes', () => {
    const moves = factoryActivity([
      makeItem([
        { stage: 'review', enteredAt: hoursAgo(1), by: 'u1' },
        { stage: 'execute', enteredAt: hoursAgo(3), by: 'u1' },
        { stage: 'triage', enteredAt: hoursAgo(40), by: 'u1' },
      ]),
    ]);

    expect(groupByDay(moves).map(day => day.items.length)).toEqual([2, 1]);
  });
});

describe('collapseRuns', () => {
  it('folds one actor walking a card through several stages into a single chain', () => {
    const moves = factoryActivity([
      makeItem([
        { stage: 'triage', enteredAt: hoursAgo(4), by: 'agent:builder' },
        { stage: 'execute', enteredAt: hoursAgo(3), by: 'agent:builder' },
        { stage: 'done', enteredAt: hoursAgo(2), by: 'agent:builder' },
      ]),
    ]);

    const runs = collapseRuns(moves);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.stages).toEqual(['triage', 'execute', 'done']);
    expect(runs[0]?.at).toBe(Date.parse(hoursAgo(2)));
  });

  it('starts a new entry when the card changes hands', () => {
    const moves = factoryActivity([
      makeItem([
        { stage: 'execute', enteredAt: hoursAgo(4), by: 'agent:builder' },
        { stage: 'review', enteredAt: hoursAgo(3), by: 'u1' },
      ]),
    ]);

    expect(collapseRuns(moves).map(run => run.by)).toEqual(['u1', 'agent:builder']);
  });

  it('keeps two cards apart even when the same actor alternates between them', () => {
    const moves = factoryActivity([
      makeItem([{ stage: 'execute', enteredAt: hoursAgo(2), by: 'u1' }]),
      makeItem([{ stage: 'review', enteredAt: hoursAgo(1), by: 'u1' }]),
    ]);

    expect(collapseRuns(moves)).toHaveLength(2);
  });
});

function makeEvent(action: string, hours: number, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: `event-${action}-${hours}`,
    actorId: 'u1',
    actorType: 'human',
    action,
    targets: [{ type: 'work_item', id: 'item-1', name: 'A card' }],
    metadata: {},
    occurredAt: hoursAgo(hours),
    ...overrides,
  };
}

describe('factoryDeeds', () => {
  it('leaves stage moves to the board — the audit trail holds a fraction of them', () => {
    const events = [makeEvent('factory.work_item.stage_moved', 1), makeEvent('factory.run.started', 2)];

    expect(factoryDeeds(events, new Map()).map(deed => deed.action)).toEqual(['factory.run.started']);
  });

  it('links a card the board still holds, and leaves the rest unlinked', () => {
    const events = [makeEvent('factory.run.started', 1), makeEvent('factory.git.push', 2)];
    const cards = new Map<string, ActivityCard>([['item-1', { title: 'A card', board: 'work' }]]);

    const onBoard = factoryDeeds([events[0]!], cards)[0];
    const offBoard = factoryDeeds([events[1]!], new Map())[0];

    expect(onBoard?.item).toEqual({ id: 'item-1', board: 'work' });
    expect(offBoard?.item).toBeUndefined();
  });

  it('names an event the board can name, and falls back to its branch when nothing else can', () => {
    const run = makeEvent('factory.run.started', 1, { targets: [{ type: 'work_item', id: 'item-1' }] });
    const push = makeEvent('factory.agent.push', 2, { targets: [], metadata: { branch: 'fix/thing' } });
    const cards = new Map<string, ActivityCard>([['item-1', { title: 'A card', board: 'work' }]]);

    expect(factoryDeeds([run], cards)[0]?.title).toBe('A card');
    expect(factoryDeeds([push], cards)[0]?.title).toBe('fix/thing');
  });

  it('skips an unparseable timestamp instead of sorting it to the top', () => {
    const events = [
      makeEvent('factory.run.started', 1, { occurredAt: 'not-a-date' }),
      makeEvent('factory.git.push', 2),
    ];

    expect(factoryDeeds(events, new Map())).toHaveLength(1);
  });
});

describe('activityBlocks', () => {
  it('never mixes a stage move with an audit event under one label', () => {
    const move = collapseRuns(factoryActivity([makeItem([{ stage: 'done', enteredAt: hoursAgo(1), by: 'u1' }])]));
    const deed = factoryDeeds([makeEvent('factory.run.started', 2)], new Map());

    expect(activityBlocks([...move, ...deed])).toHaveLength(2);
  });

  it('gathers neighbours that say the same thing about a different card', () => {
    const runs = collapseRuns(
      factoryActivity([
        makeItem([{ stage: 'review', enteredAt: hoursAgo(1), by: 'u1' }]),
        makeItem([{ stage: 'review', enteredAt: hoursAgo(2), by: 'u1' }]),
      ]),
    );

    expect(activityBlocks(runs)).toHaveLength(1);
    expect(activityBlocks(runs)[0]?.entries).toHaveLength(2);
  });

  it('keeps the same actor apart when the chain differs', () => {
    const runs = collapseRuns(
      factoryActivity([
        makeItem([{ stage: 'review', enteredAt: hoursAgo(1), by: 'u1' }]),
        makeItem([
          { stage: 'intake', enteredAt: hoursAgo(3), by: 'u1' },
          { stage: 'review', enteredAt: hoursAgo(2), by: 'u1' },
        ]),
      ]),
    );

    expect(activityBlocks(runs).map(block => block.key)).toEqual(['move:u1:review', 'move:u1:intake,review']);
  });

  it('reads every agent as one hand — the binding id is per-run, not per-agent', () => {
    const runs = collapseRuns(
      factoryActivity([
        makeItem([{ stage: 'done', enteredAt: hoursAgo(1), by: 'agent:binding-a' }]),
        makeItem([{ stage: 'done', enteredAt: hoursAgo(2), by: 'agent:binding-b' }]),
      ]),
    );

    expect(activityBlocks(runs)).toHaveLength(1);
  });

  it('keeps a rule and a person apart even on the same stage', () => {
    const runs = collapseRuns(
      factoryActivity([
        makeItem([{ stage: 'done', enteredAt: hoursAgo(1), by: 'agent:a' }]),
        makeItem([{ stage: 'done', enteredAt: hoursAgo(2), by: 'u1' }]),
      ]),
    );

    expect(activityBlocks(runs)).toHaveLength(2);
  });
});

describe('dayHeading', () => {
  it('names today and yesterday, and dates everything older', () => {
    const today = new Date(NOW);
    today.setHours(0, 0, 0, 0);

    expect(dayHeading(today.getTime(), NOW)).toBe('Today');
    expect(dayHeading(today.getTime() - 86_400_000, NOW)).toBe('Yesterday');
    expect(dayHeading(today.getTime() - 5 * 86_400_000, NOW)).not.toBe('Yesterday');
  });

  it('still names yesterday when the clocks went back overnight', () => {
    vi.stubEnv('TZ', 'America/New_York');
    try {
      const now = new Date(2026, 10, 2, 12).getTime();
      const yesterday = startOfLocalDay(new Date(2026, 10, 1, 12).getTime());

      expect(dayHeading(yesterday, now)).toBe('Yesterday');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
