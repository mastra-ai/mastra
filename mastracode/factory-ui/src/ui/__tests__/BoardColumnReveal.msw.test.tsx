/**
 * A column renders one page of cards at a time: a board that has run for a
 * while holds hundreds of items per lane, and every card mounts a run spec, an
 * activity read and a status pass on each list poll. A card linked to by
 * `?item=` renders however deep it sits, because the board scrolls to it by
 * finding it in the DOM.
 */
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const REVEAL_STEP = 30;
const ITEM_COUNT = 45;

const workItems = Array.from({ length: ITEM_COUNT }, (_, index) => ({
  id: `item-${index}`,
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: null,
  parentWorkItemId: null,
  title: `Task ${index}`,
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  revision: 1,
  createdAt: `2026-07-18T00:${String(index).padStart(2, '0')}:00.000Z`,
  updatedAt: `2026-07-18T00:${String(index).padStart(2, '0')}:00.000Z`,
}));

/** The board lists newest first, so the oldest card is the one past the page. */
const OLDEST_TITLE = 'Task 0';

function stubBoardEndpoints() {
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );
}

function renderBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/work${search}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board column reveal', () => {
  it('renders one page of a long column, keeping the rest out of the tree', async () => {
    stubBoardEndpoints();
    renderBoard();

    await screen.findByLabelText(`Task ${ITEM_COUNT - 1}`);
    await waitFor(() => expect(screen.getAllByTestId('work-item-card')).toHaveLength(REVEAL_STEP));
    expect(screen.queryByLabelText(OLDEST_TITLE)).not.toBeInTheDocument();
  });

  it('renders a linked card even when it sits past the first page', async () => {
    stubBoardEndpoints();
    renderBoard('?item=item-0');

    expect(await screen.findByLabelText(OLDEST_TITLE)).toBeInTheDocument();
  });
});
