import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const FACTORY_ID = 'factory-draft-handoff';
const REPOSITORY_ID = 'repository-draft-handoff';
const DRAFT_SESSION_ID = '30000000-0000-4000-8000-000000000001';
const AGENT_CONTROLLER_API = `${TEST_BASE_URL}/api/agent-controller/code`;

const createdSession = {
  id: 'row-draft',
  sessionId: DRAFT_SESSION_ID,
  projectRepositoryId: REPOSITORY_ID,
  orgId: 'org-1',
  userId: 'user-1',
  title: 'fix the login bug',
  branch: `user/session-${DRAFT_SESSION_ID}`,
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-08-07T09:00:00.000Z',
  updatedAt: '2026-08-07T09:00:00.000Z',
};

interface DraftRoute {
  createBodies: unknown[];
  posted: string[];
  finishWorkspace: () => void;
}

function readSentMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) return '';
  return typeof body.message === 'string' ? body.message : '';
}

/** The controller resolves the session before accepting a message, and resolving it is what prepares the workspace. */
function stubDraftRoute(): DraftRoute {
  let releaseWorkspace = () => {};
  const workspaceReady = new Promise<void>(resolve => {
    releaseWorkspace = resolve;
  });
  const route: DraftRoute = { createBodies: [], posted: [], finishWorkspace: () => releaseWorkspace() };

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
            id: 'connection-1',
            installationId: 'installation-1',
            repositories: [
              {
                id: REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/acme',
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, async ({ request }) => {
      route.createBodies.push(await request.json());
      return HttpResponse.json({ session: createdSession });
    }),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${DRAFT_SESSION_ID}`, () =>
      HttpResponse.json({ session: createdSession }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/ensure`, () =>
      HttpResponse.json({ resourceId: DRAFT_SESSION_ID, sandboxId: null, sandboxWorkdir: '/workspace/acme' }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions`, async () => {
      await workspaceReady;
      return HttpResponse.json({ controllerId: 'code', resourceId: DRAFT_SESSION_ID, threadId: DRAFT_SESSION_ID });
    }),
    http.get(`${AGENT_CONTROLLER_API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${AGENT_CONTROLLER_API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: DRAFT_SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AGENT_CONTROLLER_API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads/:threadId/messages`, () =>
      HttpResponse.json({ messages: [] }),
    ),
    http.get(
      `${AGENT_CONTROLLER_API}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/messages`, async ({ request }) => {
      route.posted.push(readSentMessage(await request.json()));
      await workspaceReady;
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({
        workspacePath: `/workspace/${DRAFT_SESSION_ID}`,
        root: '.artifacts',
        rootPath: '',
        entries: [],
      }),
    ),
  );

  return route;
}

describe('a user session draft on the real thread route', () => {
  it('creates the session on the first prompt and posts it while the workspace still prepares', async () => {
    const route = stubDraftRoute();
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(route.createBodies).toEqual([{ sessionId: DRAFT_SESSION_ID, title: 'fix the login bug' }]),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`),
    );
    // ThreadPage gates its content on the session fetch, not on materialization —
    // the handoff must reach the controller before the workspace is up.
    await waitFor(() => expect(route.posted).toEqual(['fix the login bug']));

    route.finishWorkspace();
    expect(route.posted).toEqual(['fix the login bug']);
  });
});
