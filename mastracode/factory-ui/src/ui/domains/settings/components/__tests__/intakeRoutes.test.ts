import { DEFAULT_INTAKE_ROUTES } from '@mastra/factory/boards/work-routes';
import { describe, expect, it } from 'vitest';

import { shipBoard, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import type { IntakeRouteInfo } from '../../../../../api/types';
import { describeConditions, describeRule } from '../conditionFields';
import { phaseOptions, reorderWithin, sendNewCardsTo, triggerLabel } from '../intakeRoutes';

/** The routes a new project is seeded with, as the route API lists them. */
function seededRoutes(): IntakeRouteInfo[] {
  return DEFAULT_INTAKE_ROUTES.map(({ key, route }, position) => ({
    id: key,
    name: route.name,
    enabled: route.enabled ?? true,
    position,
    when: route.when ?? null,
    target: {
      boardKey: route.target.boardKey,
      phaseKey: route.target.phaseKey ?? null,
      joinClosedIssue: route.target.joinClosedIssue ?? false,
    },
    on: [...(route.on ?? ['work_item.created'])],
    revision: 1,
    createdBy: 'factory',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedBy: 'factory',
    updatedAt: '2026-11-01T00:00:00.000Z',
    problems: [],
  }));
}

describe('sendNewCardsTo', () => {
  it('repoints the first route that takes every new card, the one that places them, not a catch-all after it', () => {
    const seeded = seededRoutes();
    const catchAll = seeded.at(-1)!;
    const mine: IntakeRouteInfo = {
      ...catchAll,
      id: 'mine',
      name: 'All new cards, mine',
      position: catchAll.position,
      revision: 3,
      createdBy: 'admin',
    };
    const routes = [...seeded.slice(0, -1), mine, { ...catchAll, position: catchAll.position + 1 }];

    const writes = sendNewCardsTo(routes, [workBoardInfo, shipBoard], 'ship');

    const updates = writes.filter(write => write.kind === 'update');
    expect(updates).toEqual([
      {
        kind: 'update',
        id: 'mine',
        patch: {
          name: 'Everything else goes to Ship › Inbox',
          target: { boardKey: 'ship', phaseKey: 'inbox' },
          expectedRevision: 3,
        },
      },
    ]);
    expect(writes.filter(write => write.kind === 'create').length).toBeGreaterThan(0);
  });
});

describe('describeRule on routes', () => {
  const route = (key: string) => seededRoutes().find(candidate => candidate.id === key)!;

  it('names each default route condition in words, with the editor fact names and readable values', () => {
    const lines = Object.fromEntries(
      seededRoutes().map(candidate => [candidate.id, describeRule(candidate.when, phaseOptions(workBoardInfo))]),
    );

    expect(lines['outside-authors']).toBe('Integration is GitHub or GitLab and author is not trusted');
    expect(lines['pull-requests']).toBe('Source kind is pull request');
    expect(lines['closed-canceled']).toBe('Close reason is not planned');
    expect(lines['closes-issue']).toBe(
      'Source kind is pull request and author is trusted and pull request closes an issue and closed issue phase is Intake and closed issue has no pull request',
    );
    expect(Object.values(lines).join(' ')).not.toMatch(/[a-z]+\.[a-zA-Z]+|_/);
    expect(describeRule(route('everything-else').when)).toBe('Every card');
  });

  it('reads a repository condition as typed, since repository keys are names', () => {
    expect(
      describeRule({
        operator: 'OR',
        conditions: [
          { field: 'source.repository', operator: 'equals', value: 'acme/app' },
          { field: 'item.labels', operator: 'contains', value: 'bug' },
        ],
      }),
    ).toBe('Repository, team or project is acme/app or labels contains bug');
  });
});

describe('route rows', () => {
  const route = (key: string) => seededRoutes().find(candidate => candidate.id === key)!;

  it('splits a route condition into one chip per check, keeping how they combine', () => {
    expect(describeConditions(route('outside-authors').when, phaseOptions(workBoardInfo))).toEqual({
      join: 'and',
      parts: ['Integration is GitHub or GitLab', 'Author is not trusted'],
    });
    expect(describeConditions(route('everything-else').when)).toBeNull();
  });

  it('names the event a card move listens for, so a move with no condition never reads as every card', () => {
    expect(triggerLabel(route('reopened').on)).toBe('A card is reopened');
    expect(triggerLabel(route('pull-request-merged').on)).toBe('A pull request is merged');
  });
});

describe('reorderWithin', () => {
  it('moves a shown route to a slot among the shown ones, leaving hidden routes where they were', () => {
    const routes = ['a', 'hidden', 'b', 'c'].map(id => ({ id }));
    expect(reorderWithin(routes, ['a', 'b', 'c'], 2, 0)).toEqual(['c', 'hidden', 'a', 'b']);
    expect(reorderWithin(routes, ['a', 'b', 'c'], 0, 1)).toEqual(['b', 'hidden', 'a', 'c']);
  });
});
