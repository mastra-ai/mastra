import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const THREAD_ID = 'thread-1';
const PULL_REQUEST_NUMBER = 20338;
const PULL_REQUEST_URL = `https://github.com/mastra-ai/mastra/pull/${PULL_REQUEST_NUMBER}`;
const PULL_REQUEST_ACCESSIBLE_NAME = `Open open mastra-ai/mastra pull request ${PULL_REQUEST_NUMBER}`;
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

const workspaceSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/item-1',
  baseBranch: 'main',
  sandboxId: 'sb-1',
  sandboxWorkdir: '/local/mastra',
  materializedAt: '2026-07-29T00:00:00.000Z',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

const pullRequestSubscriptions = {
  subscriptions: [
    {
      id: 'subscription-1',
      repoFullName: 'mastra-ai/mastra',
      pullRequestNumber: PULL_REQUEST_NUMBER,
      status: 'open',
      url: PULL_REQUEST_URL,
    },
  ],
};

function createWireWorkItem(type: 'pull-request' | 'issue') {
  return {
    id: `work-item-${type}`,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: {
      integrationId: 'github',
      type,
      externalId: String(PULL_REQUEST_NUMBER),
      url: PULL_REQUEST_URL,
    },
    parentWorkItemId: null,
    title: type === 'pull-request' ? 'Move the pull request link' : 'Track the pull request link',
    stages: ['review'],
    stageHistory: [],
    sessions: {
      [SESSION_ID]: {
        sessionId: SESSION_ID,
        branch: 'factory/item-1',
        threadId: THREAD_ID,
        startedBy: 'user-1',
      },
    },
    metadata: {
      githubPullRequestNumber: PULL_REQUEST_NUMBER,
      number: PULL_REQUEST_NUMBER,
      state: 'open',
    },
    revision: 1,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
}

function stubThreadRoute(
  workItem: ReturnType<typeof createWireWorkItem>,
  subscriptions: typeof pullRequestSubscriptions,
) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Mastra Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            installationId: 'installation-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/local/mastra',
                repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
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
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () =>
      HttpResponse.json({
        resourceId: SESSION_ID,
        factoryProjectId: FACTORY_ID,
        projectRepositoryId: REPO_ID,
        sandboxId: 'sb-1',
        sandboxWorkdir: '/local/mastra',
      }),
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
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [workItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json(subscriptions)),
  );
}

function renderThreadRoute() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage pull request link placement', () => {
  describe('when the current Factory session reviews a pull request', () => {
    it('shows the pull request in the Factory session header and not in the composer', async () => {
      stubThreadRoute(createWireWorkItem('pull-request'), pullRequestSubscriptions);
      renderThreadRoute();

      const factorySession = await screen.findByRole('region', { name: 'Factory session' });
      const composer = await screen.findByRole('region', { name: 'Thread composer' });
      const link = await within(factorySession).findByRole('link', { name: PULL_REQUEST_ACCESSIBLE_NAME });

      expect(link).toHaveAttribute('href', PULL_REQUEST_URL);
      expect(within(composer).queryByRole('link', { name: PULL_REQUEST_ACCESSIBLE_NAME })).not.toBeInTheDocument();
    });

    it('shows one link to the reviewed pull request', async () => {
      stubThreadRoute(createWireWorkItem('pull-request'), pullRequestSubscriptions);
      renderThreadRoute();

      const factorySession = await screen.findByRole('region', { name: 'Factory session' });
      const pullRequestLinks = within(factorySession)
        .getAllByRole('link')
        .filter(link => link.getAttribute('href') === PULL_REQUEST_URL);

      expect(pullRequestLinks).toHaveLength(1);
    });
  });

  describe('when the current Factory session is ordinary work', () => {
    it('keeps the pull request in the composer and out of the Factory session header', async () => {
      stubThreadRoute(createWireWorkItem('issue'), pullRequestSubscriptions);
      renderThreadRoute();

      const factorySession = await screen.findByRole('region', { name: 'Factory session' });
      const composer = await screen.findByRole('region', { name: 'Thread composer' });
      const link = await within(composer).findByRole('link', { name: PULL_REQUEST_ACCESSIBLE_NAME });

      expect(link).toHaveAttribute('href', PULL_REQUEST_URL);
      expect(
        within(factorySession).queryByRole('link', { name: PULL_REQUEST_ACCESSIBLE_NAME }),
      ).not.toBeInTheDocument();
    });
  });
});
