import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type { PullRequestSubscription } from '../../domains/factory/services/githubSubscriptions';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'glp-1';
const SESSION_ID = 'sess-1';
const THREAD_ID = 'thread-1';
const PROJECT_PATH = 'rhys-group1/factory-gitlab-primary';
const MERGE_REQUEST_IID = 7;
const MERGE_REQUEST_URL = `https://gitlab.com/${PROJECT_PATH}/-/merge_requests/${MERGE_REQUEST_IID}`;
const MERGE_REQUEST_ACCESSIBLE_NAME = `Open open ${PROJECT_PATH} merge request ${MERGE_REQUEST_IID}`;
const SUBSCRIBED_IID = 9;
const SUBSCRIBED_URL = `https://gitlab.com/${PROJECT_PATH}/-/merge_requests/${SUBSCRIBED_IID}`;
const SUBSCRIBED_ACCESSIBLE_NAME = `Open open ${PROJECT_PATH} merge request ${SUBSCRIBED_IID}`;
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
  sandboxWorkdir: '/local/app',
  materializedAt: '2026-09-20T00:00:00.000Z',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

const subscribedMergeRequest: PullRequestSubscription = {
  id: 'subscription-1',
  repoFullName: PROJECT_PATH,
  pullRequestNumber: SUBSCRIBED_IID,
  status: 'open',
  url: SUBSCRIBED_URL,
};

function createWireWorkItem(type: 'pull-request' | 'issue') {
  return {
    id: `work-item-${type}`,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: {
      integrationId: 'gitlab',
      type,
      externalId: type === 'pull-request' ? 'gitlab-pr:opaque' : 'gitlab-issue:opaque',
      url: type === 'pull-request' ? MERGE_REQUEST_URL : `https://gitlab.com/${PROJECT_PATH}/-/issues/3`,
    },
    parentWorkItemId: null,
    title: type === 'pull-request' ? 'Review the merge request link' : 'Track the merge request link',
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
    metadata:
      type === 'pull-request'
        ? {
            gitlabMergeRequestIid: MERGE_REQUEST_IID,
            gitlabProjectId: 86555418,
            gitlabHost: 'gitlab.com',
            state: 'open',
          }
        : { identifier: `${PROJECT_PATH}#3`, state: 'opened' },
    revision: 1,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };
}

function stubThreadRoute(workItem: ReturnType<typeof createWireWorkItem>, subscriptions: PullRequestSubscription[]) {
  const githubSubscriptionRequests = vi.fn<() => void>();
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'GitLab Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            integrationId: 'gitlab',
            installationId: 'installation-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/local/app',
                repository: { slug: PROJECT_PATH, defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/source-control/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
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
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [workItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/gitlab/subscriptions`, () => HttpResponse.json({ subscriptions })),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => {
      githubSubscriptionRequests();
      return HttpResponse.json({ subscriptions: [] });
    }),
  );
  return { githubSubscriptionRequests };
}

function renderThreadRoute() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage merge request link placement', () => {
  describe('when the current Factory session reviews a GitLab merge request', () => {
    it('shows the active review as an MR link in the header and asks GitLab, not GitHub, for subscriptions', async () => {
      const { githubSubscriptionRequests } = stubThreadRoute(createWireWorkItem('pull-request'), [
        subscribedMergeRequest,
      ]);
      renderThreadRoute();

      const factorySession = await screen.findByRole('region', { name: 'Factory session' });
      const composer = await screen.findByRole('region', { name: 'Thread composer' });
      const activeReviewLink = await within(factorySession).findByRole('link', {
        name: MERGE_REQUEST_ACCESSIBLE_NAME,
      });
      const subscribedLink = await within(factorySession).findByRole('link', { name: SUBSCRIBED_ACCESSIBLE_NAME });

      expect(activeReviewLink).toHaveAttribute('href', MERGE_REQUEST_URL);
      expect(activeReviewLink).toHaveTextContent(`MR !${MERGE_REQUEST_IID}`);
      expect(subscribedLink).toHaveAttribute('href', SUBSCRIBED_URL);
      expect(within(factorySession).queryAllByRole('link', { name: /pull request/ })).toHaveLength(0);
      expect(within(composer).queryByRole('link', { name: MERGE_REQUEST_ACCESSIBLE_NAME })).not.toBeInTheDocument();
      expect(githubSubscriptionRequests).not.toHaveBeenCalled();
    });

    it('shows the active review exactly once when GitLab already lists it', async () => {
      stubThreadRoute(createWireWorkItem('pull-request'), [
        { ...subscribedMergeRequest, pullRequestNumber: MERGE_REQUEST_IID, url: MERGE_REQUEST_URL },
      ]);
      renderThreadRoute();

      const factorySession = await screen.findByRole('region', { name: 'Factory session' });
      await within(factorySession).findByRole('link', { name: MERGE_REQUEST_ACCESSIBLE_NAME });
      const mergeRequestLinks = within(factorySession)
        .getAllByRole('link')
        .filter(link => link.getAttribute('href') === MERGE_REQUEST_URL);

      expect(mergeRequestLinks).toHaveLength(1);
    });
  });

  describe('when the current Factory session is ordinary GitLab work', () => {
    it('keeps the subscribed merge request in the composer status line', async () => {
      const { githubSubscriptionRequests } = stubThreadRoute(createWireWorkItem('issue'), [subscribedMergeRequest]);
      renderThreadRoute();

      const factorySession = await screen.findByRole('region', { name: 'Factory session' });
      const composer = await screen.findByRole('region', { name: 'Thread composer' });
      const link = await within(composer).findByRole('link', { name: SUBSCRIBED_ACCESSIBLE_NAME });

      expect(link).toHaveAttribute('href', SUBSCRIBED_URL);
      expect(link).toHaveTextContent(`MR !${SUBSCRIBED_IID}`);
      expect(within(factorySession).queryByRole('link', { name: SUBSCRIBED_ACCESSIBLE_NAME })).not.toBeInTheDocument();
      expect(githubSubscriptionRequests).not.toHaveBeenCalled();
    });
  });
});
