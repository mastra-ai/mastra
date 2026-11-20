import { describe, expect, it } from 'vitest';

import { rule } from './fixtures/rulesServer';
import { describeRule } from '../../settings/components/conditionFields';
import { arrivalFallback, nameRepeats, newItemRules } from '../ruleLanes';

const order = [
  { boardKey: 'ship', name: 'Ship' },
  { boardKey: 'work', name: 'Work' },
  { boardKey: 'docs', name: 'Docs' },
];

describe('nameRepeats', () => {
  const security = {
    operator: 'OR' as const,
    conditions: [
      { field: 'item.labels', value: 'security', operator: 'equals' as const },
      { field: 'source.repository', value: ['SEC'], operator: 'in' as const },
    ],
  };
  const outsider = {
    operator: 'AND' as const,
    conditions: [
      { field: 'source.repository', value: ['mastra-ai/mastra'], operator: 'in' as const },
      { field: 'item.trusted', value: false, operator: 'equals' as const },
    ],
  };

  it.each([
    ['When labels has security or project is SEC', `Pull request opened ${describeRule(security)} PR review`, true],
    ['All work items on the board', `Issue closed ${describeRule(null)} Done`, true],
    ['When labels has security, move to Backlog', `Issue opened ${describeRule(security)} Backlog`, true],
    [
      'When an outside author opens it in an open source project',
      `Issue opened ${describeRule(outsider)} Intake`,
      false,
    ],
    ['Closed issues go to Done', `Issue closed ${describeRule(null)} Done`, true],
    ['Duplicates go to Canceled', `Issue closed ${describeRule(null)} Canceled`, false],
    ['緊急対応', `Issue closed ${describeRule(null)} Done`, false],
    ['Sécurité urgente', `Issue opened ${describeRule(security)} Backlog`, false],
  ])('%#: "%s" over "%s" repeats: %s', (name, shown, repeats) => expect(nameRepeats(name, shown)).toBe(repeats));
});

describe('arrivalFallback', () => {
  it.each([
    [order, 'ship', 'Otherwise: Work is asked next'],
    [order, 'work', 'Otherwise: Docs is asked next'],
    [order, 'docs', 'Otherwise: Not routed'],
    [undefined, 'work', 'Otherwise: the next board is asked'],
  ])('%#: %s reads "%s"', (boards, boardKey, text) => expect(arrivalFallback(boards, boardKey)).toBe(text));
});

describe('newItemRules', () => {
  const legacy = rule({ id: 'legacy', name: 'Old intake', on: ['work_item.created'] });
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
    [
      'a rule joining a pull request to its issue’s card files nothing new',
      [allIssues, { ...prs, target: { ...prs.target, joinClosedIssue: true } }],
      { count: 1, catchesAll: false },
    ],
    ['card moves and rules that are off are not for new items', [closed, off], { count: 0, catchesAll: false }],
    [
      'a 0.28 rule on pull request opened only moves cards, so it files no pull request',
      [
        allIssues,
        { ...prs, id: 'moves-only', pullRequestOpenedMovesOnly: true as const },
        rule({ id: 'pr-bugs', name: 'Bug fixes', on: ['pull_request.opened'], when: issues.when }),
        prKind,
      ],
      { count: 3, catchesAll: true },
    ],
    [
      'a board whose only pull request rule is from 0.28 takes no pull requests',
      [allIssues, { ...prs, id: 'moves-only', pullRequestOpenedMovesOnly: true as const }],
      { count: 1, catchesAll: false },
    ],
  ])('%s', (_case, rules, expected) => expect(newItemRules(rules)).toEqual(expected));
});
