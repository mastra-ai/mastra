import { describe, expect, it } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import type { StoredIntakeDecisionRecord } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import { defineBoard } from './define-board.js';
import { dryRunIntake, intakeSample } from './intake-dry-run.js';
import type { IntakeSampleItem } from './intake-dry-run.js';
import { INTAKE_ORDER_SAMPLE } from './intake-routing.js';
import { boardRegistryOf } from './registry.js';

const simpleBoard = (id: string, name: string) =>
  defineBoard({
    id,
    name,
    initialPhase: 'inbox',
    phases: {
      inbox: { name: 'Inbox', kind: 'resting' },
      done: { name: 'Done', kind: 'terminal' },
    },
  });
const registry = boardRegistryOf([simpleBoard('work', 'Work'), simpleBoard('ship', 'Ship')]);

const has = (label: string): RuleGroup => ({
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: label }],
});
const rule = (id: string, boardKey: string, when: RuleGroup | null, enabled = true) => ({
  id,
  name: id,
  enabled,
  when,
  target: { boardKey, phaseKey: null },
  on: ['work_item.opened' as const],
});

const item = (key: string, labels: string[]): IntakeSampleItem => ({
  key,
  id: `id-${key}`,
  kind: 'card',
  title: key,
  url: null,
  at: new Date(0),
  facts: cardRuleFacts({
    title: key,
    metadata: { labels },
    externalSource: { integrationId: 'github', type: 'issue', externalId: key },
  }),
});

// Work's catch-all sits above Ship's label rule in intake order, so Ship loses its `ship` items.
const routes = [
  rule('work-bug', 'work', has('bug')),
  rule('work-all', 'work', null),
  rule('ship-ship', 'ship', has('ship')),
  rule('ship-off', 'ship', null, false),
];
const items = [item('a', ['ship']), item('b', ['bug']), item('c', ['ship', 'bug']), item('d', [])];

describe('dryRunIntake', () => {
  it('lists items no board takes, and shows boards and rules no item reached at zero', () => {
    const result = dryRunIntake({ routes: [rule('ship-ship', 'ship', has('ship'))], order: [], registry, items });
    expect(result.notRouted).toEqual(['b', 'd']);
    expect(result.boards.map(board => [board.boardKey, board.takes.length, board.rules.length])).toEqual([
      ['ship', 2, 1],
      ['work', 0, 0],
    ]);
    expect(dryRunIntake({ routes, order: [], registry, items: [] }).boards.flatMap(board => board.rules)).toHaveLength(
      4,
    );
  });
});

describe('intakeSample', () => {
  const card = (key: string, at: number, labels: string[] = []) =>
    ({
      id: `card-${key}`,
      title: key,
      metadata: { labels },
      createdAt: new Date(at),
      externalSource: { integrationId: 'github', type: 'issue', externalId: key, url: `https://x/${key}` },
    }) as unknown as Card;
  const notRouted = (key: string, at: number, labels: string[] = []) =>
    ({
      id: `decision-${key}`,
      title: key,
      url: null,
      sourceKey: key,
      decidedAt: new Date(at),
      arrival: {
        type: 'upsertLinkedWorkItem',
        source: 'github-issue',
        sourceKey: key,
        title: key,
        metadata: { labels },
      },
    }) as unknown as StoredIntakeDecisionRecord;
  const context = { factoryProjectId: 'p', registry, card: async () => null };

  it('merges cards from outside and Not routed items newest first, once per source, skipping manual cards', async () => {
    const manual = { ...card('m', 50), externalSource: null } as unknown as Card;
    const sample = await intakeSample({
      ...context,
      cards: [card('a', 10, ['bug']), card('b', 30), manual],
      notRouted: [notRouted('c', 20, ['ship']), notRouted('b', 5)],
    });
    expect(sample.map(entry => [entry.key, entry.kind, entry.id])).toEqual([
      ['b', 'card', 'card-b'],
      ['c', 'not_routed', 'decision-c'],
      ['a', 'card', 'card-a'],
    ]);
    expect(sample[1]!.facts['item.labels']).toEqual(['ship']);
    expect(sample[2]).toMatchObject({ url: 'https://x/a', facts: { 'item.labels': ['bug'] } });
  });

  it('keeps the newest items only', async () => {
    const cards = Array.from({ length: INTAKE_ORDER_SAMPLE + 5 }, (_, index) => card(`k${index}`, index));
    const sample = await intakeSample({ ...context, cards, notRouted: [] });
    expect(sample).toHaveLength(INTAKE_ORDER_SAMPLE);
    expect(sample[0]!.key).toBe(`k${INTAKE_ORDER_SAMPLE + 4}`);
  });
});
