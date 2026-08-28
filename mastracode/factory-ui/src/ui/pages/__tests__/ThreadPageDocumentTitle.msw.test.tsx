/**
 * `document.title` follows the current thread so browser tabs read at a
 * glance. Two shapes:
 *   - PR-backed factory sessions → `#<number> | Mastra Factory`
 *   - User sessions (and any non-PR thread) → `<thread title> | Mastra Factory`
 * Everything else — loading, no linked work item, no title yet — leaves the
 * default `Mastra Factory` in place.
 */
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const THREAD_ID = SESSION_ID;
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const workspaceSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/pr-1567',
  baseBranch: 'main',
  sandboxId: 'sb-1',
  sandboxWorkdir: '/local/acme/app',
  materializedAt: '2026-07-29T00:00:00.000Z',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

function stubBase({ workItems, threads }: { workItems: unknown[]; threads: unknown[] }) {
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
                sandboxWorkdir: '/local/acme/app',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: THREAD_ID }),
    ),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: THREAD_ID,
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
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );
}

async function renderRoute(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  const rendered = renderWithProviders(<RouterProvider router={router} />);
  await waitForMutationsIdle(rendered.client);
  return rendered;
}

afterEach(() => {
  document.title = 'Mastra Factory';
});

describe('ThreadPage document title', () => {
  it('shows the PR number for review sessions', async () => {
    stubBase({
      workItems: [
        {
          id: 'wi-1',
          orgId: 'org-1',
          createdBy: 'user-1',
          factoryProjectId: FACTORY_ID,
          externalSource: {
            integrationId: 'github',
            type: 'pull-request',
            externalId: '1567',
            url: 'https://github.com/acme/app/pull/1567',
          },
          parentWorkItemId: null,
          title: 'Fix the auth refresh race',
          stages: ['review'],
          stageHistory: [],
          sessions: {
            [SESSION_ID]: {
              sessionId: SESSION_ID,
              branch: 'factory/pr-1567',
              threadId: THREAD_ID,
              startedBy: 'user-1',
            },
          },
          metadata: { number: 1567 },
          revision: 1,
          createdAt: '2026-07-29T00:00:00.000Z',
          updatedAt: '2026-07-29T00:00:00.000Z',
        },
      ],
      threads: [{ id: THREAD_ID, title: 'A different title that must lose to the PR number' }],
    });
    await renderRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`);

    await waitFor(() => expect(document.title).toBe('#1567 | Mastra Factory'));
  });

  it('shows the thread title for user sessions', async () => {
    stubBase({
      workItems: [],
      threads: [{ id: THREAD_ID, title: 'Investigate Pricing Bug' }],
    });
    await renderRoute(`/factories/${FACTORY_ID}/user/threads/${THREAD_ID}`);

    await waitFor(() => expect(document.title).toBe('Investigate Pricing Bug | Mastra Factory'));
  });

  it('uses the thread title in the work-session sidebar while the document title shows the issue number', async () => {
    stubBase({
      workItems: [
        {
          id: 'wi-2',
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
          title: 'Flaky login test',
          stages: ['execute'],
          stageHistory: [],
          sessions: {
            [SESSION_ID]: {
              sessionId: SESSION_ID,
              branch: 'factory/pr-1567',
              threadId: THREAD_ID,
              startedBy: 'user-1',
            },
          },
          metadata: { number: 42 },
          revision: 1,
          createdAt: '2026-07-29T00:00:00.000Z',
          updatedAt: '2026-07-29T00:00:00.000Z',
        },
      ],
      threads: [{ id: THREAD_ID, title: 'Fix flaky login' }],
    });
    await renderRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`);

    await waitFor(() => expect(document.title).toBe('#42 | Mastra Factory'));
    expect(await screen.findByRole('button', { name: 'Fix flaky login' })).toBeInTheDocument();
  });

  it('shows the team key for Linear issue-backed work sessions', async () => {
    stubBase({
      workItems: [
        {
          id: 'wi-3',
          orgId: 'org-1',
          createdBy: 'user-1',
          factoryProjectId: FACTORY_ID,
          externalSource: {
            integrationId: 'linear',
            type: 'issue',
            externalId: 'COR-210',
            url: 'https://linear.app/acme/issue/COR-210',
          },
          parentWorkItemId: null,
          title: 'Ship pricing v2',
          stages: ['execute'],
          stageHistory: [],
          sessions: {
            [SESSION_ID]: {
              sessionId: SESSION_ID,
              branch: 'factory/pr-1567',
              threadId: THREAD_ID,
              startedBy: 'user-1',
            },
          },
          metadata: { identifier: 'COR-210' },
          revision: 1,
          createdAt: '2026-07-29T00:00:00.000Z',
          updatedAt: '2026-07-29T00:00:00.000Z',
        },
      ],
      threads: [{ id: THREAD_ID, title: 'A thread title Linear should win over' }],
    });
    await renderRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`);

    await waitFor(() => expect(document.title).toBe('COR-210 | Mastra Factory'));
  });

  it('keeps the branch label when a work-session thread has no title yet', async () => {
    stubBase({
      workItems: [],
      threads: [{ id: THREAD_ID }],
    });
    await renderRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`);

    // Give the session boundary a chance to resolve so we know we've reached
    // the branch that mounts <PageTitle/>; without a title/PR number the hook
    // must leave the default in place and preserve the sidebar branch fallback.
    await waitFor(() => expect(document.title).toBe('Mastra Factory'), { timeout: 2000 });
    expect(await screen.findByRole('button', { name: 'factory/pr-1567' })).toBeInTheDocument();
  });
});
