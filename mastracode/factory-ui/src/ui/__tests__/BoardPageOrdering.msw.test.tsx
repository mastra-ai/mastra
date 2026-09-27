import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

function workItem(id: string, title: string, createdAt: string, enteredAt: string) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    board: 'work',
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['triage'],
    stageHistory: [{ stage: 'triage', enteredAt, by: 'user-1' }],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

function stubWorkBoard() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          workItem('newer-card', 'Created later', '2026-08-02T00:00:00.000Z', '2026-08-03T00:00:00.000Z'),
          workItem('recent-card', 'Moved recently', '2026-07-01T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: false, sourceIds: null }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/incidentio/status`, () => HttpResponse.json({ enabled: false, configured: false })),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ permissions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/source-control/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
  );
}

describe('Factory board ordering', () => {
  it('groups filtering and sorting separately from board automation', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);

    const viewControls = await screen.findByRole('group', { name: 'Board view controls' });
    expect(within(viewControls).getByRole('group', { name: 'Board filters' })).toBeInTheDocument();
    expect(within(viewControls).getByRole('combobox', { name: 'Sort filed cards' })).toBeInTheDocument();
    expect(within(viewControls).queryByRole('switch', { name: 'Auto-start runs' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Auto-start runs' })).toBeInTheDocument();
  });

  it('renders the card most recently moved into a column before a newer-created card', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);

    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');
    const titles = within(triage)
      .getAllByTestId('work-item-card')
      .map(card => card.textContent);

    expect(titles[0]).toContain('Moved recently');
    expect(titles[1]).toContain('Created later');
  });

  it('updates the URL and rendered column order when the sort changes', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work?sort=created-oldest`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Sort filed cards' }));
    await user.click(await screen.findByRole('option', { name: 'Newest on board' }));

    await waitFor(() => {
      const titles = within(triage)
        .getAllByTestId('work-item-card')
        .map(card => card.textContent);
      expect(titles[0]).toContain('Created later');
      expect(titles[1]).toContain('Moved recently');
    });
    expect(router.state.location.search).toBe('?sort=created-newest');
    expect(screen.getByRole('combobox', { name: 'Sort filed cards' })).toHaveTextContent(
      'Filed cards: Newest on board',
    );
  });
});
