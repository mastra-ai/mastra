/**
 * The chat shell is the router layout for every factory route, so the sandbox
 * `/ensure` call it owns used to fire on the board, metrics and settings pages —
 * provisioning a VM and cloning the repo before the user did anything. Ensure
 * must only run when the caller actually enters a session.
 */
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const SESSION_ID = 'sess-1';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const userSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/pr-1',
  baseBranch: 'main',
  sandboxId: 'sb-1',
  sandboxWorkdir: '/repo',
  materializedAt: null,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

/** Stubs every factory route's network surface and records `/ensure` calls. */
function stubFactoryRoutes() {
  const ensureCalls: string[] = [];

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
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [userSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () => HttpResponse.json({ session: userSession })),
    http.post(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/ensure`, ({ params }) => {
      ensureCalls.push(String(params.projectRepositoryId));
      return HttpResponse.json({
        resourceId: FACTORY_ID,
        factoryProjectId: FACTORY_ID,
        projectRepositoryId: REPO_ID,
        sandboxId: 'sb-1',
        sandboxWorkdir: '/repo',
      });
    }),
    http.post(`${AC}/sessions`, async ({ request }) => {
      const { resourceId } = (await request.json()) as { resourceId: string };
      return HttpResponse.json({ controllerId: 'code', resourceId, threadId: SESSION_ID });
    }),
    http.get(`${AC}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({
        categories: { read: 'ask', edit: 'ask', execute: 'ask', mcp: 'ask', other: 'ask' },
        tools: {},
      }),
    ),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.post(`${AC}/sessions/:resourceId/thread`, () => HttpResponse.json({ ok: true })),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
  );

  return ensureCalls;
}

function renderRoute(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('sandbox ensure gating', () => {
  it('does not materialize a sandbox for the work board', async () => {
    const ensureCalls = stubFactoryRoutes();
    renderRoute(`/factories/${FACTORY_ID}/work`);

    await screen.findByTestId('board-column-planning');
    await waitFor(() => expect(screen.getByTestId('board-column-planning')).toHaveAccessibleName('Planning, empty'));
    expect(ensureCalls).toEqual([]);
  });

  it('keeps factory-level settings working without materializing a sandbox', async () => {
    const ensureCalls = stubFactoryRoutes();
    renderRoute(`/factories/${FACTORY_ID}/settings/behavior`);

    // The behavior toggles only render enabled once the factory-level session
    // settings load, which proves the resource address resolved without /ensure.
    const yolo = await screen.findByRole('switch', { name: 'Auto-approve tools' });
    await waitFor(() => expect(yolo).toBeEnabled());
    expect(ensureCalls).toEqual([]);
  });

  it('materializes the sandbox when entering a workspace thread', async () => {
    const ensureCalls = stubFactoryRoutes();
    renderRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`);

    await waitFor(() => expect(ensureCalls).toEqual([REPO_ID]));
  });
});
