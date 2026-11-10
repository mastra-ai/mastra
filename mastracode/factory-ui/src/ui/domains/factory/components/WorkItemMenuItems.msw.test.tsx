import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { builtinBoardCatalog, releaseBoard, shipBoard } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../api/types';
import type { BoardCardOwner } from '../boardCardState';
import type { WorkItem } from '../services/workItems';
import type { WorkItemMenuProps } from './WorkItemMenuItems';
import { WorkItemMenuItems } from './WorkItemMenuItems';

const item: WorkItem = {
  id: 'release-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: 'fp-1',
  board: 'release',
  source: 'manual',
  sourceKey: null,
  parentWorkItemId: null,
  title: 'Rehearse release',
  url: null,
  stages: ['queued'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  triageType: null,
  acceptedAt: null,
  commentCount: 0,
  revision: 4,
  createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:00:00Z',
};

function renderMenu(
  stage: string,
  boards: BoardCatalogResponse['boards'] = [releaseBoard],
  props: Partial<WorkItemMenuProps> = {},
) {
  server.use(
    http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json({ boards } satisfies BoardCatalogResponse)),
  );
  const onMove = vi.fn();
  const rendered = renderWithProviders(
    <MemoryRouter>
      <DropdownMenu open>
        <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <WorkItemMenuItems
            item={{ ...item, stages: [stage] }}
            columnStage={stage}
            moves={[]}
            owner={{ kind: 'free' }}
            {...props}
            onMove={onMove}
            onRemove={vi.fn()}
            onApproveProposal={vi.fn()}
            onDismissProposal={vi.fn()}
          />
        </DropdownMenu.Content>
      </DropdownMenu>
    </MemoryRouter>,
  );
  return { ...rendered, onMove };
}

describe('custom-board card menu', () => {
  it('offers only declared destinations using phase titles', async () => {
    const { onMove } = renderMenu('queued');
    const move = await screen.findByRole('menuitem', { name: 'Move to Preparing' });
    expect(screen.queryByRole('menuitem', { name: 'Move to Shipping' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Move to Intake' })).toBeNull();
    fireEvent.click(move);
    expect(onMove).toHaveBeenCalledWith('preparing');
  });

  it("names the move into a board's completed phase a completion, on a board without a pull request loop", async () => {
    // The server names the completed phase for every board, loop or not.
    renderMenu('shipping', [{ ...releaseBoard, flow: { completed: 'shipped' } }]);
    expect(await screen.findByRole('menuitem', { name: 'Mark shipped' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Move to Shipped' })).toBeNull();
  });

  it.each(['shipped', 'unknown'])('offers no fabricated destinations for %s', async stage => {
    const { client } = renderMenu(stage);
    await waitForMutationsIdle(client);
    expect(screen.queryByRole('menuitem', { name: /Move to|Mark done/ })).toBeNull();
  });

  it('hides a proposal left behind by another board, but offers one the board declares', async () => {
    const proposal = { id: 'd-1', role: 'triage' } as NonNullable<WorkItemMenuProps['proposal']>;
    const stale = renderMenu('queued', [releaseBoard], { proposal });
    await stale.findByRole('menuitem', { name: 'Move to Preparing' });
    expect(screen.queryByRole('menuitem', { name: /suggested run/ })).toBeNull();
    stale.unmount();

    renderMenu('queued', [releaseBoard], {
      proposal: { ...proposal, role: 'release-preparer' },
      proposedRunLabel: 'Preparing',
    });
    await screen.findByRole('menuitem', { name: 'Start suggested run' });
    expect(screen.getByRole('menuitem', { name: 'Dismiss suggested run' })).toBeTruthy();
  });

  it('offers no built-in destinations when the board has been removed', async () => {
    const { client } = renderMenu('queued', []);
    await waitForMutationsIdle(client);
    expect(screen.queryByRole('menuitem', { name: /Move to|Mark done/ })).toBeNull();
  });
});

describe('a board running the pull request loop under its own phase names', () => {
  it("asks for the triage decision on a card triage left resting, naming the board's own phases", async () => {
    const held: WorkItem = {
      ...item,
      board: 'ship',
      source: 'github-issue',
      stages: ['inbox'],
      sessions: { triage: { sessionId: 's-triage', branch: 'b', threadId: 't', startedBy: 'user-1' } },
    };
    const { onMove } = renderMenu('inbox', [shipBoard], { item: held });
    const accept = await screen.findByRole('menuitem', { name: 'Accept and build' });
    expect(screen.getByRole('menuitem', { name: 'Close' })).toBeTruthy();
    // A card with no pull request never enters review, and Work's phases are nowhere.
    expect(screen.queryByRole('menuitem', { name: 'Move to Pr' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Planning|Intake/ })).toBeNull();
    fireEvent.click(accept);
    expect(onMove).toHaveBeenCalledWith('make');
  });
});

describe('held card menu', () => {
  const held: WorkItem = {
    ...item,
    board: 'work',
    stages: ['intake'],
    sessions: { triage: { sessionId: 's-triage', branch: 'b', threadId: 't', startedBy: 'user-1' } },
  };
  const proposal = { id: 'd-1', role: 'plan' } as NonNullable<WorkItemMenuProps['proposal']>;
  const choices = ['Accept and plan', 'Close', 'Dismiss suggested run', 'Remove'];

  it.each<[string, BoardCardOwner, boolean[]]>([
    ['a parked session', { kind: 'session', status: 'ready' }, [true, false, false, false]],
    ['an automatic retry', { kind: 'automation', progressLabel: 'Retrying…' }, [true, false, false, false]],
    ['your own move', { kind: 'you', progressLabel: 'Moving…' }, [true, true, true, true]],
  ])('keeps Close, Dismiss and Remove open unless your own request is in flight: %s', async (_, owner, disabled) => {
    const { client } = renderMenu('intake', builtinBoardCatalog.boards, { item: held, owner, proposal });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(
      choices.map(name => screen.getByRole('menuitem', { name }).getAttribute('aria-disabled') === 'true'),
    ).toEqual(disabled);
  });
});
