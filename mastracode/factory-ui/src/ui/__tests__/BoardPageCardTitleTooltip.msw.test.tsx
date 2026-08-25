/**
 * Board cards clip their title to one line, so long issue titles are
 * unreadable at rest. Hovering a card reveals the untruncated title in a
 * tooltip. The tooltip anchors to the whole card because a work-item card's
 * click target is a full-bleed overlay that paints over the title span — a
 * trigger on the title itself would never receive the pointer.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryDecisionSummary } from '../domains/factory/services/decisions';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

const LONG_ITEM_TITLE =
  'Login fails with a 500 when the session cookie is rotated mid-request on the staging environment';
const LONG_CANDIDATE_TITLE =
  'Crash on logout when the refresh token has already been revoked by another tab in the same browser';
const DECISION_ERROR = 'Project source-control connection not found for this organization and integration.';

const issueWorkItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'github-issue:7',
    url: 'https://github.com/acme/app/issues/7',
  },
  parentWorkItemId: null,
  title: LONG_ITEM_TITLE,
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: { number: 7 },
  revision: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const issueCandidate = {
  number: 9,
  title: LONG_CANDIDATE_TITLE,
  url: 'https://github.com/acme/app/issues/9',
  author: 'octocat',
  labels: [],
  comments: 0,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const failedDecision: FactoryDecisionSummary = {
  id: 'decision-1',
  evaluationId: 'evaluation-1',
  workItemId: issueWorkItem.id,
  type: 'invokeSkill',
  role: null,
  status: 'failed',
  attempts: 1,
  failureOccurrence: 1,
  failureCode: 'repository_clone_failed',
  canRetry: true,
  lastError: DECISION_ERROR,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:01:00.000Z',
  completedAt: '2026-07-18T00:01:00.000Z',
};

/** Stubs the board's data endpoints with one work item and one candidate. */
function stubBoardEndpoints(decisions: FactoryDecisionSummary[] = []) {
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
      HttpResponse.json({ workItems: [issueWorkItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () => HttpResponse.json({ decisions })),
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, ({ request }) =>
      HttpResponse.json({
        issues: new URL(request.url).searchParams.has('label') ? [] : [issueCandidate],
        nextPage: null,
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board card tooltips', () => {
  it('names what the failed rule effect was doing and keeps its raw error one hover away', async () => {
    stubBoardEndpoints([failedDecision]);
    const user = userEvent.setup();
    renderWorkBoard();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('Automated run could not start');
    expect(screen.queryByText(DECISION_ERROR)).not.toBeInTheDocument();

    await user.hover(failure);

    expect(await screen.findByText(DECISION_ERROR)).toBeVisible();
  });

  it('reveals the full work-item title on hover', async () => {
    stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(card);

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 3000 });
    expect(tooltip).toHaveTextContent(LONG_ITEM_TITLE);
  });

  it('reveals the full candidate title on hover', async () => {
    stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('candidate-card');
    await user.hover(card);

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 3000 });
    expect(tooltip).toHaveTextContent(LONG_CANDIDATE_TITLE);
  });

  it('hides the tooltip once the pointer leaves the card', async () => {
    stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    await user.hover(card);
    await screen.findByRole('tooltip', {}, { timeout: 3000 });

    await user.unhover(card);

    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });
});
