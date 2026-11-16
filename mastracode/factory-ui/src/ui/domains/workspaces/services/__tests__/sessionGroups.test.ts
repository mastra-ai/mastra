import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { customGroupOrder, orderGroupHeadings, sessionGroupHeadings } from '../sessionGroups';
import type { SessionGroupContext } from '../sessionGroups';

const [workBoard] = builtinBoardCatalog.boards;

const context = (overrides: Partial<SessionGroupContext>): SessionGroupContext => ({
  catalog: builtinBoardCatalog.boards,
  boardIds: [],
  owners: [],
  viewerUserId: 'viewer',
  ...overrides,
});

const labels = (headings: readonly { label: string }[]) => headings.map(heading => heading.label);

describe('board headings', () => {
  it('orders Work, custom boards, then User and Slack, whatever the catalog order', () => {
    const headings = sessionGroupHeadings('board', context({ catalog: [releaseBoard, workBoard] }));

    expect(labels(headings)).toEqual(['Work', 'Release Preview', 'User', 'Slack']);
  });

  it('names a board some session sits on but the catalog lacks after its id, before User', () => {
    const headings = sessionGroupHeadings(
      'board',
      context({ catalog: [workBoard, releaseBoard], boardIds: ['release', 'ops'] }),
    );

    expect(labels(headings)).toEqual(['Work', 'Release Preview', 'Ops', 'User', 'Slack']);
  });

  it('keys each heading as the server keys its group', () => {
    const headings = sessionGroupHeadings('board', context({ boardIds: ['ops'] }));

    expect(headings.map(heading => heading.key)).toEqual(['board:work', 'board:ops', 'user', 'slack']);
  });

  it('puts stored groups first in stored order, appends unseen groups in default order, and skips stale keys', () => {
    const defaults = sessionGroupHeadings('board', context({ catalog: [...builtinBoardCatalog.boards, releaseBoard] }));

    const ordered = orderGroupHeadings(defaults, ['user', 'board:gone', 'board:review']);

    expect(labels(ordered)).toEqual(['User', 'Work', 'Release Preview', 'Slack']);
  });
});

describe('customGroupOrder', () => {
  const defaults = sessionGroupHeadings('status', context({}));
  const defaultKeys = defaults.map(heading => heading.key);

  it('keeps an order that differs from the default', () => {
    const moved = [defaultKeys[1] ?? '', defaultKeys[0] ?? '', ...defaultKeys.slice(2)];

    expect(customGroupOrder(moved, defaults)).toEqual(moved);
  });

  it('forgets an order that matches the default', () => {
    expect(customGroupOrder(defaultKeys, defaults)).toEqual([]);
  });
});

describe('status headings', () => {
  it('lists every status even with no sessions, so a group can be hidden before it has any', () => {
    expect(labels(sessionGroupHeadings('status', context({})))).toEqual([
      'Waiting on you',
      'Working',
      'Initializing',
      'Idle',
      'Done',
    ]);
  });
});

describe('owner headings', () => {
  it('puts the viewer first, then other owners in the order given', () => {
    const owners = [
      { userId: 'ada', name: 'Ada' },
      { userId: 'viewer', name: 'Viewer' },
      { userId: 'zoe', name: 'Zoe' },
    ];

    const headings = sessionGroupHeadings('owner', context({ owners }));

    expect(headings).toEqual([
      { key: 'owner:viewer', label: 'Viewer', icon: 'owner' },
      { key: 'owner:ada', label: 'Ada', icon: 'owner' },
      { key: 'owner:zoe', label: 'Zoe', icon: 'owner' },
    ]);
  });
});
