import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, shipBoard } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

function project(overrides: Record<string, unknown> = {}) {
  return { id: FACTORY_ID, name: 'Acme Factory', ...overrides };
}

let patchBodies: unknown[];

function stubBoard({ items, factory }: { items: unknown[]; factory: Record<string, unknown> }) {
  patchBodies = [];
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            ...factory,
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: items }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/metrics`, () =>
      HttpResponse.json({ error: 'Metrics unavailable in this scenario' }, { status: 500 }),
    ),
    http.patch(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, async ({ request }) => {
      const body: unknown = await request.json();
      patchBodies.push(body);
      Object.assign(factory, body);
      return HttpResponse.json({ project: factory });
    }),
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
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  );
}

function renderBoard(board: 'work' | 'review' | 'ship') {
  const path = board === 'ship' ? `boards/${board}` : board;
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/${path}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board automation settings', () => {
  it('offers no project switches, ignoring the retired ones an older project still stores', async () => {
    // Every switch the board's phases and the review skill replaced, still on in the stored project.
    stubBoard({
      items: [],
      factory: project({
        autoRunEnabled: true,
        selfReviewEnabled: true,
        autoApprovePlans: true,
        reviewTestChecksEnabled: true,
      }),
    });
    // A board with a self-review phase, where the old self-review switch used to appear.
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () =>
        HttpResponse.json({ boards: [...builtinBoardCatalog.boards, shipBoard] }),
      ),
    );
    const user = userEvent.setup();
    renderBoard('ship');

    const settings = await screen.findByRole('button', { name: 'Automation settings' });
    await user.click(settings);
    expect(await screen.findByRole('link', { name: 'Edit the Work board' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Automation settings' })).not.toBeInTheDocument());
    expect(settings).toHaveFocus();
    expect(patchBodies).toEqual([]);
  });

  it('sends people to the board editor to choose which runs start on their own', async () => {
    stubBoard({ items: [], factory: project() });
    const user = userEvent.setup();
    renderBoard('work');

    await user.click(await screen.findByRole('button', { name: 'Automation settings' }));
    await user.click(await screen.findByRole('link', { name: 'Edit the Work board' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Work board' })).toBeInTheDocument();
  });
});
