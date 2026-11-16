import { describe, expect, it } from 'vitest';

import { rule } from './fixtures/rulesServer';
import { intakePosition, laneText, newItemRules, ordinal, placesArrival } from '../ruleLanes';

describe('intakePosition', () => {
  const order = [
    { boardKey: 'ship', name: 'Ship' },
    { boardKey: 'work', name: 'Work' },
    { boardKey: 'docs', name: 'Docs' },
  ];

  it('names the boards either side', () => {
    expect(intakePosition(order, 'work')).toBe('Checked after Ship, before Docs');
    expect(intakePosition(order, 'ship')).toBe('Checked first, before Work');
    expect(intakePosition(order, 'docs')).toBe('Checked last, after Work');
    expect(intakePosition(order.slice(0, 1), 'ship')).toBe('The only board intake checks');
  });
});

describe('laneText', () => {
  it('names an event the UI has no words for from its id', () => {
    expect(laneText('pull_request.labeled').label).toBe('Pull request labeled');
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [21, '21st'],
  ])('%i is %s', (n, text) => expect(ordinal(n)).toBe(text));
});

describe('arrival events', () => {
  it('treats an issue, a pull request with no issue card and the legacy event as new items', () => {
    expect(placesArrival(['work_item.opened'])).toBe(true);
    expect(placesArrival(['pull_request.opened'])).toBe(true);
    expect(placesArrival(['work_item.created'])).toBe(true);
    expect(placesArrival(['work_item.closed', 'pull_request.merged'])).toBe(false);
  });

  it('counts each rule for new items once, and ends in a catch-all only when both arrival lanes do', () => {
    const legacy = { ...rule({ id: 'legacy', name: 'Old intake' }), on: ['work_item.created' as never] };
    const issues = rule({
      id: 'issues',
      name: 'Bugs',
      when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
    });
    const prs = rule({ id: 'prs', name: 'All pull requests', on: ['pull_request.opened'] });
    const off = rule({ id: 'off', name: 'Off', on: ['pull_request.opened'], enabled: false });

    expect(newItemRules([issues, prs, legacy, off])).toEqual({ count: 3, catchesAll: true });
    // A legacy rule above the pull request lane's rules takes every pull request, so they are never reached.
    expect(newItemRules([legacy, prs])).toEqual({ count: 1, catchesAll: true });
    expect(newItemRules([issues, prs])).toEqual({ count: 2, catchesAll: false });
  });
});
