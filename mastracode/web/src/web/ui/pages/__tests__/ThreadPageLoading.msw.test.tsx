/**
 * Regression coverage for the ThreadPage loading shell: while an uncached
 * user-session thread resolves, the app frame (sidebar + header) must stay
 * mounted with a centered spinner in the main slot only — clicking around the
 * sidebar must never blank the whole shell (the old early-return behavior).
 */
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/web-ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const userSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'user/my-feature',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Stubs the whole network surface of the user-session thread route, gating
 * only `/web/user-sessions/:sessionId` (the fetch that used to unmount the
 * shell while pending).
 */
function stubThreadRoute() {
  const sessionGate = deferred();

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
      HttpResponse.json({ sessions: [userSession] }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
    // The gated fetch: the user-session lookup that resolves the workspace.
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, async () => {
      await sessionGate.promise;
      return HttpResponse.json({ session: userSession });
    }),
    // Agent-controller session surface mounted once the session resolves.
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
    // Right workspace-files panel, which appears once workspacePath resolves.
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return { sessionGate };
}

function renderThreadRoute() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage loading shell', () => {
  it('keeps the sidebar mounted with a main-slot spinner while the session resolves, then shows the thread', async () => {
    const { sessionGate } = stubThreadRoute();
    renderThreadRoute();

    // Pending phase: the shell is up — sidebar navigation renders alongside
    // the loading spinner instead of a bare full-page placeholder.
    expect(await screen.findByLabelText('Loading session')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'User sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New user session' })).toBeInTheDocument();
    // The thread chrome itself is not mounted yet.
    expect(screen.queryByRole('region', { name: 'Thread composer' })).not.toBeInTheDocument();

    // Resolved phase: spinner swaps for the thread main content; the sidebar
    // never unmounted.
    sessionGate.resolve();
    expect(await screen.findByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Loading session')).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'User sessions' })).toBeInTheDocument();
  });
});
