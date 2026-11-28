import { describe, expect, it } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import { combineChanges, eventMovesCard, matchesOutsiderPullRequests, routeEventsProblem } from './board-events.js';

const when = (field: string, operator = 'contains', value: unknown = 'ship') =>
  ({ operator: 'AND', conditions: [{ field, operator, value }] }) as never;

describe('which filters a route may use for the events it handles', () => {
  it.each([
    { on: ['work_item.updated'], when: when('event.labels.added'), problem: null },
    { on: ['pull_request.updated'], when: when('event.assignees.removed', 'exists', undefined), problem: null },
    { on: ['work_item.closed'], when: when('event.labels.added'), problem: /updated/ },
    { on: ['work_item.updated'], when: when('card.phase', 'equals', 'triage'), problem: null },
    { on: ['work_item.opened'], when: when('card.phase', 'equals', 'triage'), problem: /card/ },
    { on: ['work_item.created'], when: when('card.phase', 'equals', 'triage'), problem: /card.phase/ },
    // A pull request opening also moves its issue's card, so its route may read the card.
    { on: ['pull_request.opened'], when: when('card.phase', 'equals', 'triage'), problem: null },
    { on: ['work_item.created', 'work_item.opened'], when: null, problem: null },
    // The messages name every event a route may use, the legacy arrival event included.
    { on: ['work_item.created'], when: when('event.reason', 'equals', 'completed'), problem: /work_item\.created\.$/ },
    { on: ['work_item.filed'], when: null, problem: /use one of .*work_item\.created\.$/ },
  ])('$on with $when.conditions.0.field', ({ on, when: filter, problem }) => {
    const found = routeEventsProblem(on as never, filter);
    if (problem === null) expect(found).toBeNull();
    else expect(found).toMatch(problem);
  });
});

it.each(['work_item.updated', 'pull_request.updated', 'pull_request.reopened'] as const)(
  'moves a card on %s from a finished phase too',
  type => expect(eventMovesCard(type, true)).toBe(true),
);

describe('whether a rule also matches outside authors’ pull requests', () => {
  const trusted = { field: 'pullRequest.trusted', operator: 'equals', value: true } as const;
  const notUntrusted = { field: 'pullRequest.trusted', operator: 'not_equals', value: false } as const;
  const untrusted = { field: 'pullRequest.trusted', operator: 'equals', value: false } as const;
  const docs = { field: 'item.labels', operator: 'contains', value: 'docs' } as const;
  const repo = { field: 'source.repository', operator: 'equals', value: 'acme/repo' } as const;
  const AND = (...conditions: RuleGroup['conditions']): RuleGroup => ({ operator: 'AND', conditions });
  const OR = (...conditions: RuleGroup['conditions']): RuleGroup => ({ operator: 'OR', conditions });

  it.each<{ case: string; on: string[]; when: RuleGroup | null; matches: boolean }>([
    { case: 'no conditions at all', on: ['pull_request.synchronized'], when: null, matches: true },
    { case: 'a condition that never asks', on: ['pull_request.opened'], when: AND(repo), matches: true },
    { case: 'trust demanded outright', on: ['pull_request.synchronized'], when: AND(trusted), matches: false },
    { case: 'trust demanded as not-untrusted', on: ['pull_request.opened'], when: AND(notUntrusted), matches: false },
    {
      case: 'trust demanded beside another condition',
      on: ['pull_request.opened'],
      when: AND(repo, trusted),
      matches: false,
    },
    { case: 'a rule meant for outsiders', on: ['pull_request.opened'], when: AND(untrusted), matches: true },
    // Presence is not enough: an OR naming trust in one branch still matches an outsider through the other.
    { case: 'trust in one OR branch only', on: ['pull_request.opened'], when: OR(trusted, docs), matches: true },
    { case: 'trust in every OR branch', on: ['pull_request.opened'], when: OR(trusted, notUntrusted), matches: false },
    {
      case: 'trust in every nested OR branch',
      on: ['pull_request.opened'],
      when: OR(AND(trusted, repo), AND(trusted, docs)),
      matches: false,
    },
    {
      case: 'a leaky OR inside an AND',
      on: ['pull_request.opened'],
      when: AND(repo, OR(trusted, docs)),
      matches: true,
    },
    { case: 'a settling event', on: ['pull_request.merged'], when: null, matches: false },
    { case: 'a closed pull request', on: ['pull_request.closed'], when: null, matches: false },
    { case: 'no pull request event', on: ['work_item.opened', 'work_item.closed'], when: null, matches: false },
    {
      case: 'one pull request event among issue events',
      on: ['work_item.updated', 'pull_request.updated'],
      when: null,
      matches: true,
    },
  ])('$case', ({ on, when: filter, matches }) => expect(matchesOutsiderPullRequests(on, filter)).toBe(matches));
});

describe('combineChanges', () => {
  it.each([
    {
      case: 'folds updates in order into one net change',
      changes: [
        { added: ['bug'], removed: [] },
        { added: ['ship', 'p1'], removed: ['needs-triage'] },
        { added: [], removed: ['p1'] },
        { added: ['needs-triage'], removed: [] },
      ],
      net: { added: ['bug', 'ship'], removed: [] },
    },
    {
      case: 'carries the net change across a run, not the newest delta',
      changes: [
        { added: ['ship'], removed: [] },
        { added: ['bug'], removed: [] },
        { added: [], removed: ['bug'] },
      ],
      net: { added: ['ship'], removed: [] },
    },
    { case: 'keeps a lone removal', changes: [{ added: [], removed: ['wip'] }], net: { added: [], removed: ['wip'] } },
    {
      case: 'nets names case-insensitively',
      changes: [
        { added: ['ship'], removed: [] },
        { added: [], removed: ['Ship'] },
      ],
      net: { added: [], removed: [] },
    },
    {
      case: 'keeps the newest spelling',
      changes: [
        { added: ['ship'], removed: [] },
        { added: ['Ship'], removed: [] },
      ],
      net: { added: ['Ship'], removed: [] },
    },
  ])('$case', ({ changes, net }) => {
    expect(combineChanges(changes)).toEqual(net);
  });
});
