/**
 * With automatic runs off, the run a rule wanted to start waits on its card.
 * Clicking the card must release that exact proposal — not start a rival run
 * beside it — and the card menu must let someone turn it down instead.
 */
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
const ITEM_ID = 'item-1';
const DECISION_ID = 'decision-1';

// Wire shape as served by /web/factory/*/work-items: the client derives
// `source`/`url` from `externalSource` (see fromWireWorkItem).
const workItem = {
  id: ITEM_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'github-issue:1',
    url: 'https://github.com/acme/app/issues/1',
  },
  parentWorkItemId: null,
  title: 'Fix login bug',
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: { number: 1 },
  revision: 1,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
};

function decision(status: 'proposed' | 'pending' | 'dismissed') {
  return {
    id: DECISION_ID,
    evaluationId: 'evaluation-1',
    workItemId: ITEM_ID,
    type: 'invokeSkill',
    role: 'plan',
    status,
    attempts: 0,
    lastError: null,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    completedAt: null,
  };
}

function stubBoardEndpoints() {
  const settled: string[] = [];
  const startRequests: unknown[] = [];
  let status: 'proposed' | 'pending' | 'dismissed' = 'proposed';

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
      HttpResponse.json({ decisions: [decision(status)] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/${DECISION_ID}/approve`, () => {
      settled.push('approve');
      status = 'pending';
      return HttpResponse.json({ decision: decision('pending') });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions/${DECISION_ID}/dismiss`, () => {
      settled.push('dismiss');
      status = 'dismissed';
      return HttpResponse.json({ decision: decision('dismissed') });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      startRequests.push(await request.json());
      return HttpResponse.json({});
    }),
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

  return { settled, startRequests };
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  renderWithProviders(<RouterProvider router={router} />);
}

describe('Board card with a proposed run', () => {
  it('releases the proposal instead of starting a second run when the card is clicked', async () => {
    const { settled, startRequests } = stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    await user.click(within(card).getByRole('button', { name: 'Investigate Fix login bug' }));

    await waitFor(() => expect(settled).toEqual(['approve']));
    expect(startRequests).toHaveLength(0);
  });

  it('turns the proposal down from the card menu', async () => {
    const { settled, startRequests } = stubBoardEndpoints();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    await user.click(within(card).getByRole('button', { name: 'Actions for Fix login bug' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dismiss suggested run' }));

    await waitFor(() => expect(settled).toEqual(['dismiss']));
    expect(startRequests).toHaveLength(0);
  });
});
