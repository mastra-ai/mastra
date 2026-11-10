import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { storedWorkBoard } from '../domains/settings/components/__tests__/fixtures/work-board';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

function stubFactory({ admin }: { admin: boolean }) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Acme Factory',
            autoRunEnabled: false,
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    // The server says who may change boards: organization admins.
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards/work`, () =>
      HttpResponse.json(storedWorkBoard({}, admin)),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/skills`, () => HttpResponse.json({ skills: [], canEdit: admin })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/metrics`, () =>
      HttpResponse.json({ error: 'Metrics unavailable in this scenario' }, { status: 500 }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
    // Settings reads the Factory's session, which this Factory has not started.
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId`, () =>
      HttpResponse.json({ error: 'not_found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  );
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

const boardsNav = async () => within(await screen.findByRole('region', { name: 'Boards' }));

describe('Board entry points', () => {
  it('takes an admin from the sidebar to the new-board form', async () => {
    stubFactory({ admin: true });
    const user = userEvent.setup();
    const router = renderWorkBoard();

    await user.click(await (await boardsNav()).findByRole('link', { name: 'New board' }));

    expect(await screen.findByRole('region', { name: 'New board' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/settings/board`);
    expect(router.state.location.search).toBe('?new=1');
  });

  it("takes an admin from a board to that board's editor", async () => {
    stubFactory({ admin: true });
    const user = userEvent.setup();
    const router = renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Edit board' }));

    expect(await screen.findByRole('region', { name: 'Planning phase' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/settings/board`);
    expect(router.state.location.search).toBe('?board=work');
  });

  it('offers a member who is not an admin neither', async () => {
    stubFactory({ admin: false });
    renderWorkBoard();

    const nav = await boardsNav();
    expect(await nav.findByRole('link', { name: 'Work' })).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Automation settings' });
    expect(nav.queryByRole('link', { name: 'New board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit board' })).not.toBeInTheDocument();
  });
});
