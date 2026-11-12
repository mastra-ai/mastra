/**
 * A candidate list that fails reads as an empty backlog unless the column says
 * otherwise: "Intake is clear" next to a list that never loaded is a lie the
 * board must not tell.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { IntakeCandidateListResponse } from '../../api/types';
import { createAppRoutes } from '../router';
import { githubIssueRecord } from './fixtures/intakeCandidates';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

const issue = githubIssueRecord(7, { title: 'Fix login' });

function page(answer: Partial<IntakeCandidateListResponse>) {
  return HttpResponse.json({ candidates: [], passes: [], ...answer });
}

const unavailable = () => HttpResponse.json({ error: 'Candidates are unavailable' }, { status: 502 });

function stubBoardEndpoints(candidatesResponse: (request: Request) => Response) {
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
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/intake/candidates`, ({ request }) =>
      candidatesResponse(request),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
  );
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Intake column when the candidate list fails', () => {
  it('names the failure instead of claiming the backlog is clear, and recovers on retry', async () => {
    let healthy = false;
    stubBoardEndpoints(() => (healthy ? page({ candidates: [issue] }) : unavailable()));
    const { client } = renderWorkBoard();

    const intake = await screen.findByTestId('board-column-intake');
    const alert = await within(intake).findByRole('alert');
    expect(alert).toHaveTextContent('Candidates are unavailable');
    expect(within(intake).queryByText('Intake is clear')).not.toBeInTheDocument();

    healthy = true;
    await userEvent.click(within(intake).getByRole('button', { name: 'Retry' }));
    await waitForMutationsIdle(client);

    expect(within(intake).getByText('Fix login')).toBeInTheDocument();
    expect(within(intake).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports the failure in the Triage column too, not as nothing to triage', async () => {
    stubBoardEndpoints(unavailable);
    renderWorkBoard();

    const triage = await screen.findByTestId('board-column-triage');
    await waitFor(() => expect(within(triage).getByRole('alert')).toHaveTextContent('Candidates are unavailable'));
    expect(within(triage).queryByText('Nothing to triage')).not.toBeInTheDocument();
  });

  it('keeps what the server last listed and says so when it could not read GitHub', async () => {
    stubBoardEndpoints(() =>
      page({
        candidates: [issue],
        passes: [{ integrationId: 'github', kind: 'issue', completeAt: '2026-08-01T00:00:00.000Z', failed: true }],
      }),
    );
    const { client } = renderWorkBoard();
    await waitForMutationsIdle(client);

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix login')).toBeInTheDocument();
    expect(within(intake).getByText('GitHub could not be read. This list may be out of date.')).toBeInTheDocument();
    // The server reads GitHub again on its own, so there is nothing here to retry.
    expect(within(intake).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('retries the page that failed, not the pages already loaded', async () => {
    let secondPageHealthy = false;
    const requested: string[] = [];
    stubBoardEndpoints(request => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      requested.push(cursor ?? 'first');
      if (!cursor) return page({ candidates: [issue], nextCursor: 'second' });
      return secondPageHealthy ? page({ candidates: [githubIssueRecord(8, { title: 'Fix signup' })] }) : unavailable();
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
    expect(requested).toEqual(['first', 'second', 'second']);
  });
});
