import { describe, expect, it } from 'vitest';

import { deriveIntakeOrder, reconcileIntakeOrder } from './intake-order.js';

const placing = (boardKey: string, when: null | 'labelled' = 'labelled', enabled = true) => ({
  enabled,
  on: ['work_item.created' as const],
  target: { boardKey, phaseKey: null, joinClosedIssue: false },
  when:
    when === null
      ? null
      : { operator: 'AND' as const, conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'x' }] },
});

describe('deriveIntakeOrder', () => {
  it('orders boards by their first enabled placing route, then the rest in sidebar order', () => {
    const routes = [
      placing('ship'),
      placing('ops', 'labelled', false),
      { ...placing('docs'), on: ['work_item.closed' as const] },
      { ...placing('ops'), target: { boardKey: 'ops', phaseKey: null, joinClosedIssue: true } },
      placing('work'),
      placing('ship', null),
      placing('gone'),
    ];
    expect(deriveIntakeOrder(routes, ['work', 'docs', 'ship', 'ops'])).toEqual(['ship', 'work', 'docs', 'ops']);
  });
});

describe('reconcileIntakeOrder', () => {
  it('drops deleted boards and puts a new one above the first board ending in a catch-all', () => {
    const routes = [placing('ship'), placing('work', null)];
    expect(reconcileIntakeOrder(['ship', 'gone', 'work'], ['work', 'ship', 'docs'], routes)).toEqual([
      'ship',
      'docs',
      'work',
    ]);
  });

  it('puts a new board last when no board ends in a catch-all', () => {
    expect(reconcileIntakeOrder(['work'], ['work', 'docs'], [placing('work', null, false)])).toEqual(['work', 'docs']);
  });
});
