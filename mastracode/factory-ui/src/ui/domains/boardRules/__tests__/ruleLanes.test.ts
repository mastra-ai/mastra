import { describe, expect, it } from 'vitest';

import { rule } from './fixtures/rulesServer';
import { intakePosition, newItemRules, ordinal } from '../ruleLanes';

const order = [
  { boardKey: 'ship', name: 'Ship' },
  { boardKey: 'work', name: 'Work' },
  { boardKey: 'docs', name: 'Docs' },
];

describe('intakePosition', () => {
  it.each([
    [order, 'work', 'Checked after Ship, before Docs'],
    [order, 'ship', 'Checked first, before Work'],
    [order, 'docs', 'Checked last, after Work'],
    [order.slice(0, 1), 'ship', 'The only board intake checks'],
    [order, 'release', 'Not in the intake order yet'],
  ])('%#: %s reads "%s"', (boards, boardKey, text) => expect(intakePosition(boards, boardKey)).toBe(text));
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [112, '112th'],
  ])('%i is %s', (n, text) => expect(ordinal(n)).toBe(text));
});

describe('newItemRules', () => {
  const legacy = { ...rule({ id: 'legacy', name: 'Old intake' }), on: ['work_item.created'] };
  const issues = rule({
    id: 'issues',
    name: 'Bugs',
    when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
  });
  const allIssues = rule({ id: 'all-issues', name: 'All issues' });
  const prs = rule({ id: 'prs', name: 'All pull requests', on: ['pull_request.opened'] });
  const off = rule({ id: 'off', name: 'Off', on: ['pull_request.opened'], enabled: false });
  const closed = rule({ id: 'closed', name: 'Closed', on: ['work_item.closed'] });
  const prKind = rule({
    id: 'pr-kind',
    name: 'Pull requests go to Review',
    on: ['pull_request.opened'],
    when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
  });
  const issueKindOnPrs = {
    ...prKind,
    id: 'issue-kind',
    when: {
      operator: 'AND' as const,
      conditions: [{ field: 'source.kind', operator: 'equals' as const, value: 'issue' }],
    },
  };

  it.each([
    ['both lanes end in a catch-all; legacy counts once', [issues, prs, legacy, off], { count: 3, catchesAll: true }],
    ['a legacy catch-all shadows the pull request lane', [legacy, prs], { count: 1, catchesAll: true }],
    ['only the pull request lane ends in a catch-all', [issues, prs], { count: 2, catchesAll: false }],
    ['rules after an issue catch-all are never reached', [allIssues, issues], { count: 1, catchesAll: false }],
    [
      'a rule testing only the pull request kind takes every pull request',
      [allIssues, prKind, prs],
      { count: 2, catchesAll: true },
    ],
    [
      'a rule testing another kind takes nothing whole',
      [allIssues, issueKindOnPrs, prs],
      { count: 3, catchesAll: true },
    ],
    ['card moves and rules that are off are not for new items', [closed, off], { count: 0, catchesAll: false }],
  ])('%s', (_case, rules, expected) => expect(newItemRules(rules)).toEqual(expected));
});
