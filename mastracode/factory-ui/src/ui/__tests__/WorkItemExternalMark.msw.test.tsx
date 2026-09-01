/** The mark that tells people which cards never start a run on their own — the
 * same condition the server's execution-consent gate reads. */
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

function project(overrides: Record<string, unknown> = {}) {
  return { id: FACTORY_ID, name: 'Acme Factory', autoRunEnabled: false, ...overrides };
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

function stubBoard({ items, factory }: { items: unknown[]; factory: Record<string, unknown> }) {
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

describe('External authorship mark', () => {
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
        workItem({
          id: 'item-4',
          title: 'Legacy PR',
          metadata: { number: 10, state: 'open' },
        }),
      ],
      factory: project(),
    });
    renderBoard('review');

    const external = await screen.findByRole('article', { name: 'External contribution' });
    expect(within(external).getByText('External')).toBeVisible();

    // A card from before the trust stamp existed still asks for approval server-side,
    // but the board never calls an unanswered author external.
    for (const title of ['Maintainer PR', 'Factory PR', 'Legacy PR']) {
      const card = screen.getByRole('article', { name: title });
      expect(within(card).queryByText('External')).toBeNull();
    }
  });

  it('marks issues from reporters without write access as external', async () => {
    stubBoard({
      items: [
        workItem({
          id: 'item-5',
          title: 'External issue',
          externalSource: {
            integrationId: 'github',
            type: 'issue',
            externalId: 'github-issue:11',
            url: 'https://github.com/acme/app/issues/11',
          },
          metadata: { number: 11, authorTrusted: false },
        }),
        workItem({
          id: 'item-6',
          title: 'Trusted issue',
          externalSource: {
            integrationId: 'github',
            type: 'issue',
            externalId: 'github-issue:12',
            url: 'https://github.com/acme/app/issues/12',
          },
          metadata: { number: 12, authorTrusted: true },
        }),
      ],
      factory: project(),
    });
    renderBoard('work');

    const external = await screen.findByRole('article', { name: 'External issue' });
    expect(within(external).getByText('External')).toBeVisible();

    const trusted = screen.getByRole('article', { name: 'Trusted issue' });
    expect(within(trusted).queryByText('External')).toBeNull();
  });
});
