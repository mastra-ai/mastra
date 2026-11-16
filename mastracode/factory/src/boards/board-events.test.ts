import { describe, expect, it } from 'vitest';

import { combineChanges, eventMovesCard, routeEventsProblem } from './board-events.js';

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
