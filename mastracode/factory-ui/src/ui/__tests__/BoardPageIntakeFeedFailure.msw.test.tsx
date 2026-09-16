/**
 * A candidate feed that fails reads as an empty backlog unless the column says
 * otherwise: "Intake is clear" next to a dead GitHub is a lie the board must
 * not tell.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

const AUTO_TRIAGED = 'status: auto-triaged';

function githubIssue(number: number, title: string, labels: string[] = []) {
  return {
    number,
    title,
    url: `https://github.com/acme/app/issues/${number}`,
    author: 'alice',
    assignee: null,
    labels,
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

const issue = githubIssue(7, 'Fix login');

function stubBoardEndpoints(issuesResponse: (request: Request) => Response) {
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, ({ request }) => issuesResponse(request)),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
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

  it('reports a failing triage feed in the Triage column, not as nothing to triage', async () => {
    stubBoardEndpoints(request =>
      new URL(request.url).searchParams.get('label') === AUTO_TRIAGED
        ? HttpResponse.json({ error: 'GitHub rate limit exceeded' }, { status: 502 })
        : HttpResponse.json({ issues: [issue], nextPage: null }),
    );
    renderWorkBoard();

    const triage = await screen.findByTestId('board-column-triage');
    await waitFor(() => expect(within(triage).getByRole('alert')).toHaveTextContent('GitHub rate limit exceeded'));
    expect(within(triage).queryByText('Nothing to triage')).not.toBeInTheDocument();
    // The intake feed answered, so its own column keeps listing candidates.
    expect(within(screen.getByTestId('board-column-intake')).getByText('Fix login')).toBeInTheDocument();
  });

  it('retries the page that failed, not the pages already loaded', async () => {
    let secondPageHealthy = false;
    stubBoardEndpoints(request => {
      const params = new URL(request.url).searchParams;
      if (params.get('label') === AUTO_TRIAGED) return HttpResponse.json({ issues: [], nextPage: null });
      if (params.get('page') === '1') return HttpResponse.json({ issues: [issue], nextPage: 2 });
      return secondPageHealthy
        ? HttpResponse.json({ issues: [githubIssue(8, 'Fix signup')], nextPage: null })
        : HttpResponse.json({ error: 'GitHub is unavailable' }, { status: 502 });
    });
    const { client } = renderWorkBoard();

    const intake = await screen.findByTestId('board-column-intake');
    await waitFor(() => expect(within(intake).getByText('Fix login')).toBeInTheDocument());
    await userEvent.click(await within(intake).findByRole('button', { name: 'Load more candidates' }));
    await waitFor(() => expect(within(intake).getByRole('alert')).toBeInTheDocument());

    secondPageHealthy = true;
    await userEvent.click(within(intake).getByRole('button', { name: 'Retry' }));
    await waitForMutationsIdle(client);

    expect(within(intake).getByText('Fix signup')).toBeInTheDocument();
    expect(within(intake).getByText('Fix login')).toBeInTheDocument();
  });
});
