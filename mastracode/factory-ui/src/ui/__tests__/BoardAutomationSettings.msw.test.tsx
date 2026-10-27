import { screen, waitFor } from '@testing-library/react';
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
  return { id: FACTORY_ID, name: 'Acme Factory', autoRunEnabled: false, autoApprovePlans: false, ...overrides };
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

function renderBoard(board: 'work' | 'review') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/${board}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Board automation settings', () => {
  it('edits auto-start in a dismissible popover without a project plan-approval override', async () => {
    stubBoard({ items: [], factory: project() });
    const user = userEvent.setup();
    const { client } = renderBoard('review');

    const settings = await screen.findByRole('button', { name: 'Automation settings' });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    await user.click(settings);
    expect(screen.queryByRole('switch', { name: 'Auto-approve plans' })).not.toBeInTheDocument();
    const autoApprove = await screen.findByRole('switch', { name: 'Auto-start runs' });
    expect(autoApprove).not.toBeChecked();
    await user.click(autoApprove);

    await waitForMutationsIdle(client);
    expect(patchBodies).toEqual([{ autoRunEnabled: true }]);
    expect(await screen.findByRole('switch', { name: 'Auto-start runs' })).toBeChecked();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Automation settings' })).not.toBeInTheDocument());
    expect(settings).toHaveFocus();
    await user.click(settings);
    expect(await screen.findByRole('switch', { name: 'Auto-start runs' })).toBeChecked();
  });

  it('turns review test checks on, defaulting to off for older projects', async () => {
    stubBoard({ items: [], factory: project() });
    const user = userEvent.setup();
    const { client } = renderBoard('review');

    await user.click(await screen.findByRole('button', { name: 'Automation settings' }));
    const testChecks = await screen.findByRole('switch', { name: 'Publish review test checks' });
    expect(testChecks).not.toBeChecked();
    await user.click(testChecks);

    await waitForMutationsIdle(client);
    expect(patchBodies).toEqual([{ reviewTestChecksEnabled: true }]);
    expect(await screen.findByRole('switch', { name: 'Publish review test checks' })).toBeChecked();
  });

  it('turns self-review on, defaulting to off for older projects', async () => {
    stubBoard({ items: [], factory: project() });
    const user = userEvent.setup();
    const { client } = renderBoard('work');

    await user.click(await screen.findByRole('button', { name: 'Automation settings' }));
    const selfReview = await screen.findByRole('switch', { name: 'Self-review before pull requests' });
    expect(selfReview).not.toBeChecked();
    await user.click(selfReview);

    await waitForMutationsIdle(client);
    expect(patchBodies).toEqual([{ selfReviewEnabled: true }]);
    expect(await screen.findByRole('switch', { name: 'Self-review before pull requests' })).toBeChecked();
  });

  it('keeps the automation switches separate', async () => {
    stubBoard({ items: [], factory: project() });
    const user = userEvent.setup();
    const { client } = renderBoard('review');

    await user.click(await screen.findByRole('button', { name: 'Automation settings' }));
    await user.click(await screen.findByRole('switch', { name: 'Auto-start runs' }));

    await waitForMutationsIdle(client);
    expect(patchBodies).toEqual([{ autoRunEnabled: true }]);
    expect(screen.getByRole('switch', { name: 'Self-review before pull requests' })).not.toBeChecked();
  });
});
