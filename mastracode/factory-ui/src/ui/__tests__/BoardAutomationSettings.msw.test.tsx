/**
 * The board's two automation switches: what each one PATCHes, and the mark
 * that tells people which pull requests will never start a run on their own.
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

function project(overrides: Record<string, unknown> = {}) {
  return { id: FACTORY_ID, name: 'Acme Factory', autoRunEnabled: false, planReviewEnabled: true, ...overrides };
}

function workItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: {
      integrationId: 'github',
      type: 'pull-request',
      externalId: 'github-pr:7',
      url: 'https://github.com/acme/app/pull/7',
    },
    parentWorkItemId: null,
    title: 'External contribution',
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: { number: 7, state: 'open', authorTrusted: false },
    revision: 1,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

let patchBodies: unknown[];

function stubBoard({ items, factory }: { items: unknown[]; factory: Record<string, unknown> }) {
  patchBodies = [];
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [factory] })),
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
      HttpResponse.json({ workItems: items }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/metrics`, () =>
      HttpResponse.json({ error: 'Metrics unavailable in this scenario' }, { status: 500 }),
    ),
    http.patch(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: {}, tools: {} }),
    ),
  );
}

function renderBoard(board: 'work' | 'review') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/${board}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board automation settings', () => {
  it('turns plan review off and on with its own switch', async () => {
    stubBoard({ items: [], factory: project() });
    const user = userEvent.setup();
    const { client } = renderBoard('review');

    const planReview = await screen.findByRole('switch', { name: 'Plan review' });
    expect(planReview).toBeChecked();
    await user.click(planReview);

    await waitForMutationsIdle(client);
    expect(patchBodies).toEqual([{ planReviewEnabled: false }]);
    expect(await screen.findByRole('switch', { name: 'Plan review' })).not.toBeChecked();
  });

  it('keeps auto-start runs and plan review as separate switches', async () => {
    stubBoard({ items: [], factory: project() });
    const user = userEvent.setup();
    const { client } = renderBoard('review');

    await user.click(await screen.findByRole('switch', { name: 'Auto-start runs' }));

    await waitForMutationsIdle(client);
    expect(patchBodies).toEqual([{ autoRunEnabled: true }]);
    expect(screen.getByRole('switch', { name: 'Plan review' })).toBeChecked();
  });

  it('marks pull requests from authors without write access as external', async () => {
    stubBoard({
      items: [
        workItem(),
        workItem({
          id: 'item-2',
          title: 'Maintainer PR',
          metadata: { number: 8, state: 'open', authorTrusted: true },
        }),
        workItem({
          id: 'item-3',
          title: 'Factory PR',
          metadata: { number: 9, state: 'open', authorTrusted: false, factoryAuthored: true },
        }),
      ],
      factory: project(),
    });
    renderBoard('review');

    const external = await screen.findByRole('article', { name: 'External contribution' });
    expect(within(external).getByText('External')).toBeVisible();

    for (const title of ['Maintainer PR', 'Factory PR']) {
      const card = screen.getByRole('article', { name: title });
      expect(within(card).queryByText('External')).toBeNull();
    }
  });
});
