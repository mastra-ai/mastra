import { describe, expect, it } from 'vitest';

import type { QueueHealthConfig } from '../../../storage/domains/queue-health/base';
import type { WorkItemRow } from '../../../storage/domains/work-items/base';
import { computeQueueHealth } from './queue-health';

const NOW = new Date('2026-07-17T12:00:00.000Z');
const DEFAULT: QueueHealthConfig = { thresholdsSeconds: [14400, 86400, 259200] }; // 4h / 24h / 72h

const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

let nextId = 0;
function makeItem(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  nextId += 1;
  return {
    id: `item-${nextId}`,
    orgId: 'org1',
    createdBy: 'u1',
    githubProjectId: 'proj1',
    source: 'github-issue',
    sourceKey: null,
    title: `Item ${nextId}`,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    createdAt: new Date(NOW.getTime() - 1000),
    updatedAt: NOW,
    ...overrides,
  };
}

/** Item in one stage, entered `ageSeconds` ago (open history entry). */
function inStage(stage: string, ageSeconds: number, overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return makeItem({
    stages: [stage],
    stageHistory: [{ stage, enteredAt: secondsAgo(ageSeconds), by: 'u1' }],
    ...overrides,
  });
}

describe('computeQueueHealth', () => {
  it('returns an empty chart (all board stages, zeroed) for empty input', () => {
    const health = computeQueueHealth([], new Set(), DEFAULT, NOW);
    expect(health.stages.map(s => s.stage)).toEqual(['intake', 'triage', 'planning', 'execute', 'review']);
    for (const s of health.stages) {
      expect(s.total).toBe(0);
      expect(s.activeCount).toBe(0);
    }
    expect(health.entries).toEqual([]);
  });

  it('buckets an item by age with the >= boundary rule (exact boundary moves up)', () => {
    // 4h/24h/72h boundaries: [14400, 86400, 259200]
    const items = [
      inStage('intake', 14399), // green (<14400)
      inStage('intake', 14400), // amber (exact boundary → up)
      inStage('intake', 86399), // amber
      inStage('intake', 86400), // orange (exact boundary → up)
      inStage('intake', 259199), // orange
      inStage('intake', 259200), // red (exact boundary → up)
    ];
    const health = computeQueueHealth(items, new Set(), DEFAULT, NOW);
    const intake = health.stages.find(s => s.stage === 'intake')!;
    expect(intake.buckets).toEqual({ green: 1, amber: 2, orange: 2, red: 1 });
    expect(intake.total).toBe(6);
  });

  it('ages a multi-stage item independently per held stage', () => {
    const item = makeItem({
      stages: ['execute', 'review'],
      stageHistory: [
        { stage: 'execute', enteredAt: secondsAgo(3600), by: 'u1' }, // 1h → green
        { stage: 'review', enteredAt: secondsAgo(259200), by: 'u1' }, // 72h → red
      ],
    });
    const health = computeQueueHealth([item], new Set(), DEFAULT, NOW);
    expect(health.stages.find(s => s.stage === 'execute')!.buckets.green).toBe(1);
    expect(health.stages.find(s => s.stage === 'review')!.buckets.red).toBe(1);
    // One item → two (item, stage) entries.
    expect(health.entries).toHaveLength(2);
    expect(health.entries.find(e => e.stage === 'execute')!.ageSeconds).toBe(3600);
    expect(health.entries.find(e => e.stage === 'review')!.ageSeconds).toBe(259200);
  });

  it('counts an entry active when the item has a session whose projectPath is active', () => {
    const active = inStage('execute', 100, {
      sessions: { work: { projectPath: '/wt/a', branch: 'b', threadId: 't', startedBy: 'u1' } },
    });
    const idle = inStage('execute', 100, {
      sessions: { work: { projectPath: '/wt/b', branch: 'b', threadId: 't', startedBy: 'u1' } },
    });
    const health = computeQueueHealth([active, idle], new Set(['/wt/a']), DEFAULT, NOW);
    const execute = health.stages.find(s => s.stage === 'execute')!;
    expect(execute.total).toBe(2);
    expect(execute.activeCount).toBe(1);
    expect(health.entries.find(e => e.itemId === active.id)!.active).toBe(true);
    expect(health.entries.find(e => e.itemId === idle.id)!.active).toBe(false);
  });

  it('excludes done-only items entirely', () => {
    const done = makeItem({
      stages: ['done'],
      stageHistory: [{ stage: 'done', enteredAt: secondsAgo(10), by: 'u1' }],
    });
    const health = computeQueueHealth([done], new Set(), DEFAULT, NOW);
    expect(health.stages.every(s => s.total === 0)).toBe(true);
    expect(health.entries).toEqual([]);
  });

  it('falls back to createdAt when a held stage has no open history entry', () => {
    const item = makeItem({
      stages: ['execute'],
      stageHistory: [], // no open entry — should age from createdAt
      createdAt: new Date(NOW.getTime() - 20000 * 1000), // 20000s → amber
    });
    const health = computeQueueHealth([item], new Set(), DEFAULT, NOW);
    const execute = health.stages.find(s => s.stage === 'execute')!;
    expect(execute.buckets.amber).toBe(1);
    expect(health.entries[0]!.ageSeconds).toBe(20000);
  });

  it('honors overridden thresholdsSeconds (custom config changes bucket assignment)', () => {
    const custom: QueueHealthConfig = { thresholdsSeconds: [60, 300, 3600] }; // fast project
    const item = inStage('execute', 3600); // 1h → red under custom, green under default
    const health = computeQueueHealth([item], new Set(), custom, NOW);
    expect(health.stages.find(s => s.stage === 'execute')!.buckets.red).toBe(1);
  });

  it('exposes a flat entries index with itemId/title/url/stage/age/bucket/active', () => {
    const item = inStage('review', 100, { title: 'Fix login', url: 'https://github.com/acme/app/issues/1' });
    const health = computeQueueHealth([item], new Set(), DEFAULT, NOW);
    expect(health.entries[0]).toEqual({
      itemId: item.id,
      title: 'Fix login',
      url: 'https://github.com/acme/app/issues/1',
      stage: 'review',
      ageSeconds: 100,
      bucket: 'green',
      active: false,
    });
  });
});
