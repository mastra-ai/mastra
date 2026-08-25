import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
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
  bindings: string[];
  bindingsBeforePrompt: string[];
  finishWorkspace: () => void;
}

interface DraftRouteOptions {
  factoryProjectGate?: Promise<void>;
  failModeSwitch?: boolean;
}

function readSentMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) return '';
  return typeof body.message === 'string' ? body.message : '';
}

function stubDraftRoute({ factoryProjectGate, failModeSwitch = false }: DraftRouteOptions = {}): DraftRoute {
  let releaseWorkspace = () => {};
  const workspaceReady = new Promise<void>(resolve => {
    releaseWorkspace = resolve;
  });
  let threadCreated = false;
  const route: DraftRoute = {
    createBodies: [],
    posted: [],
    bindings: [],
    bindingsBeforePrompt: [],
    finishWorkspace: () => releaseWorkspace(),
  };

  function readBody(body: unknown, key: string): string {
    return typeof body === 'object' && body !== null && key in body ? String(Reflect.get(body, key)) : '';
  }

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, async () => {
      await factoryProjectGate;
      return HttpResponse.json({
        project: { id: FACTORY_ID, name: 'Acme Factory', defaultModelId: 'openai/gpt-4o-mini' },
      });
    }),
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
    http.post(`${AGENT_CONTROLLER_API}/sessions`, async () => {
      await workspaceReady;
      threadCreated = true;
      return HttpResponse.json({ controllerId: 'code', resourceId: DRAFT_SESSION_ID, threadId: DRAFT_SESSION_ID });
    }),
    http.get(`${AGENT_CONTROLLER_API}/modes`, () =>
      HttpResponse.json({
        modes: [
          { id: 'build', name: 'Build' },
          { id: 'plan', name: 'Plan' },
        ],
      }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/mode`, async ({ request }) => {
      route.bindings.push(`mode:${readBody(await request.json(), 'modeId')}`);
      return failModeSwitch
        ? HttpResponse.json({ message: 'Mode unavailable' }, { status: 500 })
        : HttpResponse.json({ ok: true });
    }),
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
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads/:threadId/messages`, ({ params }) =>
      threadCreated
        ? HttpResponse.json({ messages: [] })
        : HttpResponse.json({ error: `Thread not found: ${String(params.threadId)}` }, { status: 500 }),
    ),
    http.get(
      `${AGENT_CONTROLLER_API}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/model`, async ({ request }) => {
      route.bindings.push(`model:${readBody(await request.json(), 'modelId')}`);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${AGENT_CONTROLLER_API}/sessions/:resourceId/messages`, async ({ request }) => {
      route.bindingsBeforePrompt = [...route.bindings];
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
    const { client } = renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.click(await screen.findByLabelText('Session mode'));
    await user.click(await screen.findByRole('option', { name: 'Plan' }));
    await user.type(message, 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(route.createBodies).toEqual([{ sessionId: DRAFT_SESSION_ID, title: 'fix the login bug' }]),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`),
    );
    await waitFor(() => expect(route.posted).toEqual(['fix the login bug']));
    expect(route.bindingsBeforePrompt).toEqual(['mode:plan', 'model:openai/gpt-4o-mini']);
    const thread = within(screen.getByRole('main'));
    await waitFor(() => expect(thread.getByText('fix the login bug')).toBeInTheDocument());
    expect(thread.queryByText(/Failed to load messages/)).not.toBeInTheDocument();

    route.finishWorkspace();
    await waitForMutationsIdle(client);
    expect(route.posted).toEqual(['fix the login bug']);
  });

  it('keeps typing free while the draft model resolves, but holds the send', async () => {
    let releaseFactoryProject = () => {};
    const factoryProjectGate = new Promise<void>(resolve => {
      releaseFactoryProject = resolve;
    });
    const route = stubDraftRoute({ factoryProjectGate });
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    expect(await screen.findByLabelText('Loading model')).toBeInTheDocument();
    expect(message).toBeEnabled();

    await user.type(message, 'fix the login bug');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(message).toHaveValue('fix the login bug');
    expect(route.createBodies).toEqual([]);

    releaseFactoryProject();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    expect(message).toHaveValue('fix the login bug');
  });

  it('does not lose the prompt when the mode bind fails', async () => {
    const route = stubDraftRoute({ failModeSwitch: true });
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    const { client } = renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`),
    );
    await waitFor(() => expect(route.bindings).toContain('mode:build'));
    await waitFor(() => expect(route.posted).toEqual(['fix the login bug']));
    expect(
      await screen.findByText(/Mode unavailable|Could not start in/, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    // the handoff state is dropped up front so a reload can never resend the prompt
    expect(router.state.location.state).toBeNull();

    route.finishWorkspace();
    await waitForMutationsIdle(client);
    expect(route.posted).toEqual(['fix the login bug']);
  });
});
