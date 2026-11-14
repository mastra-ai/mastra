import { describe, expect, it } from 'vitest';

import { intakeRouteInputSchema } from '../routes/contracts.js';
import {
  canonicalStatusEvent,
  combineChanges,
  eventMovesCard,
  INTAKE_ROUTE_RULE_FIELDS,
  isStatusEventName,
  LEGACY_RULE_FIELDS,
  PICKER_RULE_FIELDS,
  routeEventsProblem,
  STATUS_EVENTS,
} from './board-events.js';

const when = (field: string, operator = 'contains', value: unknown = 'ship') =>
  ({ operator: 'AND', conditions: [{ field, operator, value }] }) as never;

describe('board event names', () => {
  it('lists the eleven events, with work_item.created renamed to work_item.opened', () => {
    expect(STATUS_EVENTS).toEqual([
      'work_item.opened',
      'work_item.reopened',
      'work_item.updated',
      'work_item.closed',
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.updated',
      'pull_request.synchronized',
      'pull_request.review_requested',
      'pull_request.merged',
      'pull_request.closed',
    ]);
  });

  it('reads the old name as the new one', () => {
    expect(canonicalStatusEvent('work_item.created')).toBe('work_item.opened');
    expect(canonicalStatusEvent('work_item.closed')).toBe('work_item.closed');
    expect(isStatusEventName('work_item.created')).toBe(true);
  });

  it('accepts both names in the API for one release and stores the new one', () => {
    const parsed = intakeRouteInputSchema.parse({
      name: 'Old',
      target: { boardKey: 'work' },
      on: ['work_item.created'],
    });
    expect(parsed.on).toEqual(['work_item.opened']);
    expect(() =>
      intakeRouteInputSchema.parse({
        name: 'Twice',
        target: { boardKey: 'work' },
        on: ['work_item.created', 'work_item.opened'],
      }),
    ).toThrow(/only once/);
  });

  it('moves a card on updates and pull request reopens whatever its phase', () => {
    for (const type of ['work_item.updated', 'pull_request.updated', 'pull_request.reopened'] as const) {
      expect(eventMovesCard(type, true)).toBe(true);
      expect(eventMovesCard(type, false)).toBe(true);
    }
  });
});

describe('route filters', () => {
  it('lets update routes test what changed', () => {
    expect(routeEventsProblem(['work_item.updated'], when('event.labels.added'))).toBeNull();
    expect(
      routeEventsProblem(['pull_request.updated'], when('event.assignees.removed', 'exists', undefined)),
    ).toBeNull();
  });

  it('refuses change facts on a route that handles no update', () => {
    expect(routeEventsProblem(['work_item.closed'], when('event.labels.added'))).toMatch(/updated/);
  });

  it('refuses card.phase on a route that only places new cards', () => {
    expect(routeEventsProblem(['work_item.opened'], when('card.phase', 'equals', 'triage'))).toMatch(/card/);
    expect(routeEventsProblem(['work_item.updated'], when('card.phase', 'equals', 'triage'))).toBeNull();
  });

  it('shows one filter set in the picker and keeps the rest as legacy filters that still evaluate', () => {
    expect(PICKER_RULE_FIELDS).toEqual(
      expect.arrayContaining([
        'source.provider',
        'source.repository',
        'source.kind',
        'item.author',
        'item.assignees',
        'item.labels',
        'item.hasPullRequest',
        'item.hasIssue',
        'card.phase',
        'event.reason',
        'event.labels.added',
        'event.labels.removed',
        'event.assignees.added',
        'event.assignees.removed',
      ]),
    );
    for (const field of ['item.key', 'item.title', 'item.state', 'source.integration', 'item.pullRequest']) {
      expect(LEGACY_RULE_FIELDS).toContain(field);
      expect(PICKER_RULE_FIELDS).not.toContain(field);
    }
    expect([...PICKER_RULE_FIELDS, ...LEGACY_RULE_FIELDS].toSorted()).toEqual([...INTAKE_ROUTE_RULE_FIELDS].toSorted());
  });
});

describe('combineChanges', () => {
  it('folds updates in order into one net change', () => {
    expect(
      combineChanges([
        { added: ['bug'], removed: [] },
        { added: ['ship', 'p1'], removed: ['needs-triage'] },
        { added: [], removed: ['p1'] },
        { added: ['needs-triage'], removed: [] },
      ]),
    ).toEqual({ added: ['bug', 'ship'], removed: [] });
  });

  it('carries the net change across a run, not the newest delta', () => {
    expect(
      combineChanges([
        { added: ['ship'], removed: [] },
        { added: ['bug'], removed: [] },
        { added: [], removed: ['bug'] },
      ]),
    ).toEqual({ added: ['ship'], removed: [] });
  });

  it('nets a removal of a label that was there before', () => {
    expect(combineChanges([{ added: [], removed: ['wip'] }])).toEqual({ added: [], removed: ['wip'] });
  });
});
