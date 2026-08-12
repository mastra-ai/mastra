/**
 * With automatic runs off, a run a rule wanted to start waits on its card as a
 * `proposed` decision. The card must offer it as work the user can release —
 * not silently swallow it — and pressing Run must approve that exact decision.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const ITEM_ID = 'item-1';
const DECISION_ID = 'decision-1';

const workItem = {
  id: ITEM_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: FACTORY_ID,
  source: 'github-issue',
  sourceKey: 'github-issue:1',
  parentWorkItemId: null,
  title: 'Fix login bug',
  url: null,
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: { githubIssueNumber: 1 },
  revision: 1,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
};

function proposedDecision(status: 'proposed' | 'pending') {
  return {
    id: DECISION_ID,
    evaluationId: 'evaluation-1',
    workItemId: ITEM_ID,
    type: 'invokeSkill',
    status,
    attempts: 0,
    lastError: null,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    completedAt: null,
  };
}

function stubBoardEndpoints() {
  const approvals: string[] = [];
  let status: 'proposed' | 'pending' = 'proposed';

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory', autoRunEnabled: false }] }),
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
      HttpResponse.json({ workItems: [workItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [proposedDecision(status)] }),
    ),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/${DECISION_ID}/approve`,
      async ({ params }) => {
        approvals.push(String(params.decisionId ?? DECISION_ID));
        status = 'pending';
        return HttpResponse.json({ decision: proposedDecision('pending') });
      },
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );

  return { approvals };
}

describe('Board card proposed run', () => {
  it('offers a proposed run on the card and approves it on Run', async () => {
    const { approvals } = stubBoardEndpoints();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByRole('article', { name: 'Fix login bug' })).toBeInTheDocument();
    expect(await screen.findByText('Run suggested')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(approvals).toEqual([DECISION_ID]));
  });
});
