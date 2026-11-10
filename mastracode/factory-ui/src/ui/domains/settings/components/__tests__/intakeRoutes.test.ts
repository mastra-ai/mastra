import { DEFAULT_INTAKE_ROUTES } from '@mastra/factory/boards/work-routes';
import { describe, expect, it } from 'vitest';

import { shipBoard, workBoardInfo } from '../../../../../../e2e/ui/board-catalog';
import type { IntakeRouteInfo } from '../../../../../api/types';
import { sendNewCardsTo } from '../intakeRoutes';

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
    allowWorkingPhase: route.allowWorkingPhase ?? false,
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
