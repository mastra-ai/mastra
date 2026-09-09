import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { releaseBoard } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../api/types';
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
  feedActivityAt: null,
  revision: 4,
  createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:00:00Z',
};

function renderMenu(
  stage: string,
  boards: BoardCatalogResponse['boards'] = [releaseBoard],
  proposal?: { proposal: WorkItemMenuProps['proposal']; proposedRunLabel?: string },
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
            {...proposal}
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
