import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { releaseBoard } from '../../../e2e/ui/board-catalog';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders } from '../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../api/types';
import { createAppRoutes } from '../router';

function renderBoard(board = 'boards/release') {
  const intakeRequest = vi.fn(() => HttpResponse.json({ issues: [], pullRequests: [] }));
  server.use(
    http.get('*/api/agent-controller/code/sessions/:id/permissions', () => HttpResponse.json({ permissions: [] })),
    http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: [] })),
    http.get('*/auth/me', () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Factory' }] })),
    http.get('*/web/factory/projects/:id/boards', () =>
      HttpResponse.json({ boards: [releaseBoard] } satisfies BoardCatalogResponse),
    ),
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
    http.get('*/web/github/projects/:id/sessions', () => HttpResponse.json({ sessions: [] })),
    http.get('*/web/github/projects/:id/issues', intakeRequest),
    http.get('*/web/github/projects/:id/pull-requests', intakeRequest),
  );
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/fp-1/${board}`] });
  renderWithProviders(<RouterProvider router={router} />);
  return { intakeRequest };
}

describe('custom-only board routing', () => {
  it('renders declaration-ordered custom columns without built-in intake or automation', async () => {
    const { intakeRequest } = renderBoard();
    const columns = await screen.findByRole('group', { name: 'Board columns' });
    expect(
      within(columns)
        .getAllByRole('region')
        .map(region => region.getAttribute('aria-label')),
    ).toEqual(['Queued', 'Preparing', 'Shipping', 'Shipped']);
    expect(screen.getAllByLabelText('working phase')).toHaveLength(2);
    expect(screen.getByLabelText('terminal phase')).toBeTruthy();
    expect(screen.queryByText('Auto-approve plans')).toBeNull();
    expect(intakeRequest).not.toHaveBeenCalled();
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
