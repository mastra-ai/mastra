import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { findPageHeader, renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import type { FactoryUserSession } from '../../domains/workspaces/services/user-sessions';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;
const SIDEBAR_STATE_KEY = 'mastracode-web:sidebar:state';

const workspaceSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org' as const,
  branch: 'factory/issue-42',
  baseBranch: 'main',
  sandboxId: 'sb-1',
  sandboxWorkdir: '/local/acme/app',
  materializedAt: '2026-07-29T00:00:00.000Z',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

const workItem = {
  id: 'wi-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: '42',
    url: 'https://github.com/acme/app/issues/42',
  },
  parentWorkItemId: null,
  title: 'Fix the flaky login test',
  stages: ['execute'],
  stageHistory: [],
  sessions: {
    [SESSION_ID]: { sessionId: SESSION_ID, branch: 'factory/issue-42', threadId: SESSION_ID, startedBy: 'user-1' },
  },
  metadata: { number: 42 },
  revision: 1,
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const USER_SESSION_ID = 'sess-2';

const userSession: FactoryUserSession = {
  ...workspaceSession,
  id: 'row-2',
  sessionId: USER_SESSION_ID,
  branch: `user/session-${USER_SESSION_ID}`,
  visibility: 'private',
  title: 'salut ca va ?',
};

function stubThreadRoute({
  gateSession = false,
  userSessionTitle = userSession.title,
  threads = [],
  sessionOverrides = {},
}: {
  gateSession?: boolean;
  userSessionTitle?: string;
  threads?: Array<{ id: string; title: string }>;
  sessionOverrides?: Partial<FactoryUserSession>;
} = {}) {
  const sessionGate = deferred();
  const storedUserSession = { ...userSession, title: userSessionTitle, ...sessionOverrides };

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({ project: { id: FACTORY_ID, name: 'Acme Factory', defaultModelId: 'openai/gpt-4o-mini' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json({ modelId: 'openai/gpt-4o-mini' })),
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
                sandboxWorkdir: '/local/acme/app',
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession, storedUserSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, async () => {
      if (gateSession) await sessionGate.promise;
      return HttpResponse.json({ session: workspaceSession });
    }),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${USER_SESSION_ID}`, () =>
      HttpResponse.json({ session: storedUserSession }),
    ),
    http.put(`${TEST_BASE_URL}/web/user-sessions/${USER_SESSION_ID}/visibility`, async ({ request }) => {
      const body = await request.json();
      if (
        body &&
        typeof body === 'object' &&
        'visibility' in body &&
        (body.visibility === 'org' || body.visibility === 'private')
      ) {
        storedUserSession.visibility = body.visibility;
      }
      return HttpResponse.json({ session: storedUserSession });
    }),
    http.post(`${AC}/sessions`, async ({ request }) => {
      const body = await request.json();
      const threadId =
        body && typeof body === 'object' && 'threadId' in body && typeof body.threadId === 'string'
          ? body.threadId
          : SESSION_ID;
      return HttpResponse.json({ controllerId: 'code', resourceId: threadId, threadId });
    }),
    http.get(`${AC}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: params.resourceId,
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
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return { sessionGate };
}

function renderRoute(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}

afterEach(() => {
  window.localStorage.removeItem(SIDEBAR_STATE_KEY);
});

describe('ThreadPage header', () => {
  it('keeps the sidebar toggle and the session breadcrumb in a single header', async () => {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, 'collapsed');
    stubThreadRoute();
    renderRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`);

    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    const header = breadcrumb.closest('header');
    expect(header).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle sidebar' }).closest('header')).toBe(header);
    expect(screen.queryByLabelText('Open navigation menu')).not.toBeInTheDocument();
    expect(within(header!).getByText('Issue #42: Fix the flaky login test')).toBeInTheDocument();
    expect(within(header!).getByRole('link', { name: 'Work' })).toBeInTheDocument();
  });

  it('shows the user session title in the breadcrumb', async () => {
    stubThreadRoute();
    renderRoute(`/factories/${FACTORY_ID}/user/threads/${USER_SESSION_ID}`);

    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    const header = breadcrumb.closest('header');
    expect(header).not.toBeNull();
    expect(within(breadcrumb).getByText('User sessions')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('salut ca va ?')).toBeInTheDocument();
    expect(within(breadcrumb).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace files' }).closest('header')).toBe(header);
  });

  it('shares from the header and restores privacy from the sidebar menu', async () => {
    stubThreadRoute();
    const user = userEvent.setup();
    const { client } = renderRoute(`/factories/${FACTORY_ID}/user/threads/${USER_SESSION_ID}`);
    await waitForMutationsIdle(client);

    const header = await findPageHeader();
    const share = await within(header).findByRole('button', { name: 'Share session' });
    await user.click(share);
    expect(await screen.findByRole('heading', { name: 'This session is private' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Share with organization' }));
    await waitFor(() =>
      expect(within(header).queryByRole('button', { name: 'Share session' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: `Private session: ${userSession.title}` })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Session actions for ${userSession.title}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Make private' }));
    expect(await within(header).findByRole('button', { name: 'Share session' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: `Private session: ${userSession.title}` })).toBeInTheDocument();
  });

  it.each(['user-1', 'user-2'])('does not show a sharing control for a shared session owned by %s', async userId => {
    stubThreadRoute({ sessionOverrides: { visibility: 'org', userId } });
    const { client } = renderRoute(`/factories/${FACTORY_ID}/user/threads/${USER_SESSION_ID}`);
    await waitForMutationsIdle(client);

    const header = await findPageHeader();
    await within(header).findByText('salut ca va ?');
    expect(within(header).queryByRole('button', { name: 'Share session' })).not.toBeInTheDocument();
  });

  it('keeps source-managed private Slack sessions read-only in the header', async () => {
    stubThreadRoute({ sessionOverrides: { branch: 'slack/1700000000-000100' } });
    const user = userEvent.setup();
    const { client } = renderRoute(`/factories/${FACTORY_ID}/user/threads/${USER_SESSION_ID}`);
    await waitForMutationsIdle(client);

    const header = await findPageHeader();
    await user.click(await within(header).findByRole('button', { name: `Private session: ${userSession.title}` }));
    expect(await screen.findByRole('heading', { name: 'This session is private' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share with organization' })).not.toBeInTheDocument();
  });

  it('picks up the generated title once the thread is named', async () => {
    stubThreadRoute({
      sessionOverrides: { title: undefined },
      threads: [{ id: USER_SESSION_ID, title: 'salut ca va ?' }],
    });
    renderRoute(`/factories/${FACTORY_ID}/user/threads/${USER_SESSION_ID}`);

    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await within(breadcrumb).findByText('salut ca va ?');
    expect(within(breadcrumb).queryByText('New session')).not.toBeInTheDocument();
  });

  it('shows the draft breadcrumb on the new session page', async () => {
    stubThreadRoute();
    renderRoute(`/factories/${FACTORY_ID}/user/new/draft-1`);

    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb.closest('header')).not.toBeNull();
    expect(within(breadcrumb).getByText('User sessions')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('New session')).toBeInTheDocument();
  });

  it('carries the sidebar toggle while the session resolves', async () => {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, 'collapsed');
    const { sessionGate } = stubThreadRoute({ gateSession: true });
    renderRoute(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`);

    expect(await screen.findByLabelText('Loading session')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();

    sessionGate.resolve();
    await waitFor(() => expect(screen.queryByLabelText('Loading session')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();
  });
});
