/**
 * Regression coverage for workspace-preparation failures on the factory
 * thread route: when the sandbox `/ensure` call fails (e.g. a stale workdir
 * from a previous sandbox provider makes the clone die), the page must show
 * the real error with a Retry action — not an eternal loading skeleton with
 * a silently disabled composer.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const workspaceSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/issue-1',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

/** Stubs the thread route's network surface with a controllable `/ensure`. */
function stubThreadRoute() {
  let ensureCalls = 0;
  let ensureFailures = 1;

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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    // The materialization call under test: fails first, succeeds on retry.
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => {
      ensureCalls += 1;
      if (ensureCalls <= ensureFailures) {
        return HttpResponse.json(
          { error: 'clone-failed', message: "git clone failed: could not create '/workspace/acme/app'" },
          { status: 502 },
        );
      }
      return HttpResponse.json({
        resourceId: SESSION_ID,
        factoryProjectId: FACTORY_ID,
        projectRepositoryId: REPO_ID,
        sandboxId: 'sb-1',
        sandboxWorkdir: '/local/acme/app',
      });
    }),
    // Agent-controller surface mounted once the workspace is prepared.
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID }),
    ),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
  );
}

function renderThreadRoute() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage workspace preparation failure', () => {
  it('surfaces the ensure error with a Retry action instead of an eternal loading state', async () => {
    stubThreadRoute();
    renderThreadRoute();

    // The materialization failure is shown to the user, verbatim.
    expect(
      await screen.findByText(
        "Failed to prepare the workspace: git clone failed: could not create '/workspace/acme/app'",
      ),
    ).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry' });

    // The warm-up failure is a banner, not a wall: the composer stays mounted
    // and usable while the error is visible, because the run path can still
    // materialize the sandbox lazily.
    const composer = await screen.findByRole('region', { name: 'Thread composer' });
    expect(composer).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toBeEnabled();
    await userEvent.type(input, 'still usable');
    expect(input).toHaveValue('still usable');

    // Retry re-runs preparation; on success the error clears and the thread mounts.
    await userEvent.click(retry);
    expect(await screen.findByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
    expect(
      screen.queryByText("Failed to prepare the workspace: git clone failed: could not create '/workspace/acme/app'"),
    ).not.toBeInTheDocument();
  });
});
