import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { releaseBoard } from '../../../e2e/ui/board-catalog';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../api/types';
import { createAppRoutes } from '../router';
import { saveKanbanView, stageToggle } from './boardLayoutQueries';

function renderBoard(board = 'boards/release', workItems: unknown[] = [], boards = [releaseBoard]) {
  const intakeRequest = vi.fn(() => HttpResponse.json({ issues: [], pullRequests: [] }));
  server.use(
    http.get('*/api/agent-controller/code/sessions/:id/permissions', () => HttpResponse.json({ permissions: [] })),
    http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: [] })),
    http.get('*/auth/me', () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Factory' }] })),
    http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json({ boards } satisfies BoardCatalogResponse)),
    http.get('*/web/factory/projects/:id/source-control-connections', () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: 'repo-1',
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get('*/web/intake/config', () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get('*/web/linear/status', () => HttpResponse.json({ enabled: false, connected: false, workspace: null })),
    http.get('*/web/factory/projects/:factoryId/sessions', () => HttpResponse.json({ sessions: [] })),
    http.get('*/web/github/projects/:id/issues', intakeRequest),
    http.get('*/web/github/projects/:id/prs', intakeRequest),
    http.get('*/web/factory/projects/:id/work-items', () =>
      HttpResponse.json({ workItems, runningSessionIds: [], parkedSessionIds: [] }),
    ),
  );
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/fp-1/${board}`] });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  return { intakeRequest, client, router };
}

describe('custom-only board routing', () => {
  it.each(['list', 'board'])('offers intake setup in a custom initial phase in the %s layout', async layout => {
    const { client } = renderBoard();
    const user = userEvent.setup();
    if (layout === 'board') await saveKanbanView(user);
    await waitForMutationsIdle(client);

    const queued = await screen.findByTestId('board-column-queued');
    expect(within(queued).getByText(/No intake sources/)).toBeVisible();
    expect(within(queued).getByRole('link', { name: 'Connect issue source' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/intake',
    );
    expect(screen.getAllByRole('link', { name: 'Connect issue source' })).toHaveLength(1);

    await user.click(within(queued).getByRole('button', { name: 'Create card' }));
    expect(await screen.findByRole('textbox', { name: 'Work item title' })).toHaveFocus();
  });

  it('renders declaration-ordered custom groups without built-in intake or automation', async () => {
    const { intakeRequest, client } = renderBoard();
    const columns = await screen.findByLabelText('Board stages');
    expect(
      within(columns)
        .getAllByRole('region')
        .map(region => region.getAttribute('aria-label')),
    ).toEqual(['Queued', 'Preparing', 'Shipping', 'Shipped']);
    for (const label of ['Preparing', 'Shipping', 'Shipped']) {
      expect(stageToggle(label, columns)).toHaveAttribute('aria-expanded', 'true');
    }
    expect(screen.queryByText('Auto-approve plans')).toBeNull();
    // Columns render before every query settles, so only judge the feeds once idle.
    await waitForMutationsIdle(client);
    expect(intakeRequest).not.toHaveBeenCalled();
  });

  it('labels each custom phase kind on a Kanban view', async () => {
    renderBoard();
    await saveKanbanView(userEvent.setup());
    expect(screen.getAllByLabelText('working phase')).toHaveLength(2);
    expect(screen.getByLabelText('terminal phase')).toBeTruthy();
  });

  it('opens another board with every group expanded even when it shares phase ids', async () => {
    const user = userEvent.setup();
    const hotfixBoard = { ...releaseBoard, id: 'hotfix', title: 'Hotfix' };
    const { router } = renderBoard('boards/release', [], [releaseBoard, hotfixBoard]);
    await user.click(stageToggle('Shipped', await screen.findByLabelText('Board stages')));
    expect(stageToggle('Shipped', screen.getByLabelText('Board stages'))).toHaveAttribute('aria-expanded', 'false');

    await act(() => router.navigate('/factories/fp-1/boards/hotfix'));

    await waitFor(() =>
      expect(stageToggle('Shipped', screen.getByLabelText('Board stages'))).toHaveAttribute('aria-expanded', 'true'),
    );
  });

  it.each([
    ['github pull request', { integrationId: 'github', type: 'pull-request', externalId: 'github:1', url: null }],
    ['gitlab merge request', { integrationId: 'gitlab', type: 'pull-request', externalId: 'gitlab:1', url: null }],
    ['slack thread', { integrationId: 'slack', type: 'slack-thread', externalId: 'slack:1', url: null }],
    ['manual', null],
  ])('renders a %s card in the initial phase', async (_label, externalSource) => {
    const now = '2026-09-01T12:00:00.000Z';
    renderBoard('boards/release', [
      {
        id: 'card-1',
        orgId: 'org-1',
        createdBy: 'user-1',
        factoryProjectId: 'fp-1',
        board: 'release',
        externalSource,
        parentWorkItemId: null,
        title: 'Release card',
        stages: ['queued'],
        stageHistory: [{ stage: 'queued', enteredAt: now, by: 'user-1' }],
        sessions: {},
        metadata: {},
        triageType: null,
        acceptedAt: null,
        commentCount: 0,
        feedActivityAt: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const queued = await screen.findByRole('region', { name: 'Queued' });
    expect(await within(queued).findByText('Release card')).toBeTruthy();
  });
  it.each(['boards/missing', 'work', 'review'])(
    'shows unavailable for %s rather than substituting another board',
    async route => {
      renderBoard(route);
      expect(await screen.findByText('Board unavailable: this board is not installed.')).toBeTruthy();
      expect(screen.queryByRole('group', { name: 'Board columns' })).toBeNull();
    },
  );
});
