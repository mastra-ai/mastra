/**
 * A candidate feed that fails reads as an empty backlog unless the column says
 * otherwise: "Intake is clear" next to a dead GitHub is a lie the board must
 * not tell.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

const issue = {
  number: 7,
  title: 'Fix login',
  url: 'https://github.com/acme/app/issues/7',
  author: 'alice',
  assignee: null,
  labels: [],
  createdAt: '2026-08-01T00:00:00.000Z',
};

function stubBoardEndpoints(issuesResponse: () => Response) {
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
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: true, sourceIds: ['acme/app'] },
          linear: { enabled: false, sourceIds: null },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () => issuesResponse()),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Intake column when the candidate feed fails', () => {
  it('names the failure instead of claiming the backlog is clear, and recovers on retry', async () => {
    let healthy = false;
    stubBoardEndpoints(() =>
      healthy
        ? HttpResponse.json({ issues: [issue], nextPage: null })
        : HttpResponse.json({ error: 'GitHub is unavailable' }, { status: 502 }),
    );
    const { client } = renderWorkBoard();

    const intake = await screen.findByTestId('board-column-intake');
    const alert = await within(intake).findByRole('alert');
    expect(alert).toHaveTextContent('GitHub is unavailable');
    expect(within(intake).queryByText('Intake is clear')).not.toBeInTheDocument();

    healthy = true;
    await userEvent.click(within(intake).getByRole('button', { name: 'Retry' }));
    await waitForMutationsIdle(client);

    expect(within(intake).getByText('Fix login')).toBeInTheDocument();
    expect(within(intake).queryByRole('alert')).not.toBeInTheDocument();
  });
});
