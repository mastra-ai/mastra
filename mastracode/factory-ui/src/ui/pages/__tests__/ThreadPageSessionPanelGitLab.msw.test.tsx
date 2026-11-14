import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listedRepository } from '../../../../e2e/ui/factory-projects';
import { server } from '../../../../e2e/ui/msw-server';
import { findPageHeader, renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type { PullRequestSubscription } from '../../domains/factory/services/githubSubscriptions';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'glp-1';
const SESSION_ID = 'sess-1';
const THREAD_ID = 'thread-1';
const PROJECT_PATH = 'rhys-group1/factory-gitlab-primary';
const MERGE_REQUEST_IID = 7;
const MERGE_REQUEST_URL = `https://gitlab.com/${PROJECT_PATH}/-/merge_requests/${MERGE_REQUEST_IID}`;
const SUBSCRIBED_IID = 9;
const SUBSCRIBED_URL = `https://gitlab.com/${PROJECT_PATH}/-/merge_requests/${SUBSCRIBED_IID}`;
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
    stages: [type === 'pull-request' ? 'pr-review' : 'execute'],
    stageHistory: [],
    sessions: {
      [type === 'pull-request' ? 'review' : 'work']: {
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

function stubThreadRoute(workItem: unknown, subscriptions: PullRequestSubscription[]) {
  const githubSubscriptionRequests = vi.fn<() => void>();
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'GitLab Factory',
            repositories: [
              listedRepository(REPO_ID, PROJECT_PATH, {
                integrationId: 'gitlab',
                branch: 'main',
                sandboxWorkdir: '/local/app',
              }),
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({ project: { id: FACTORY_ID, name: 'GitLab Factory', defaultModelId: 'openai/gpt-4o-mini' } }),
    ),
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: {} })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: THREAD_ID }),
    ),
    http.get(`${AC}/sessions/:sessionId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: THREAD_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AC}/sessions/:sessionId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:sessionId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AC}/sessions/:sessionId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:sessionId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${AC}/sessions/:sessionId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/workspace/changes`, () =>
      HttpResponse.json({ workspacePath: SESSION_ID, available: true, changes: [] }),
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

/** The docked session panel, once the card summary has drawn. */
async function findSessionPanel() {
  const panel = await screen.findByTestId('workspace-files-card');
  await within(panel).findByRole('region', { name: 'Card' });
  return panel;
}

const linksTo = (container: HTMLElement, url: string) =>
  within(container)
    .queryAllByRole('link')
    .filter(link => link.getAttribute('href') === url);

describe('ThreadPage session panel on GitLab', () => {
  // Wide enough to dock the panel beside the conversation.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 1200, 800));
  });
  afterEach(() => vi.restoreAllMocks());

  describe('when the session reviews a GitLab merge request', () => {
    it('lists the reviewed and subscribed merge requests as MRs, asking GitLab, not GitHub, for subscriptions', async () => {
      const { githubSubscriptionRequests } = stubThreadRoute(createWireWorkItem('pull-request'), [
        subscribedMergeRequest,
      ]);
      renderThreadRoute();

      const panel = await findSessionPanel();
      expect(within(panel).getByRole('link', { name: `Open MR !${MERGE_REQUEST_IID}` })).toHaveAttribute(
        'href',
        MERGE_REQUEST_URL,
      );
      expect(await within(panel).findByRole('link', { name: `Open MR !${SUBSCRIBED_IID}` })).toHaveAttribute(
        'href',
        SUBSCRIBED_URL,
      );
      expect(within(panel).queryAllByRole('link', { name: /PR #/ })).toHaveLength(0);
      expect(linksTo(await findPageHeader(), MERGE_REQUEST_URL)).toHaveLength(0);
      expect(githubSubscriptionRequests).not.toHaveBeenCalled();
    });

    it('lists the reviewed merge request once when GitLab already lists it', async () => {
      stubThreadRoute(createWireWorkItem('pull-request'), [
        { ...subscribedMergeRequest, pullRequestNumber: MERGE_REQUEST_IID, url: MERGE_REQUEST_URL },
      ]);
      renderThreadRoute();

      const panel = await findSessionPanel();
      await within(panel).findByRole('link', { name: `Open MR !${MERGE_REQUEST_IID}` });
      expect(linksTo(panel, MERGE_REQUEST_URL)).toHaveLength(1);
    });
  });

  describe('when the session works a GitLab issue', () => {
    it('links the issue by its number, without the project path the session already works in', async () => {
      const { githubSubscriptionRequests } = stubThreadRoute(createWireWorkItem('issue'), [subscribedMergeRequest]);
      renderThreadRoute();

      const panel = await findSessionPanel();
      expect(within(panel).getByRole('link', { name: 'Open Issue #3' })).toHaveAttribute(
        'href',
        `https://gitlab.com/${PROJECT_PATH}/-/issues/3`,
      );
      expect(within(panel).queryByText(PROJECT_PATH, { exact: false })).not.toBeInTheDocument();
      const mergeRequest = await within(panel).findByRole('link', { name: `Open MR !${SUBSCRIBED_IID}` });
      expect(mergeRequest).toHaveAttribute('href', SUBSCRIBED_URL);
      expect(linksTo(await screen.findByRole('region', { name: 'Thread composer' }), SUBSCRIBED_URL)).toHaveLength(0);
      expect(githubSubscriptionRequests).not.toHaveBeenCalled();
    });

    it('names the issue by its GitLab number when the card carries no project reference', async () => {
      stubThreadRoute({ ...createWireWorkItem('issue'), metadata: { gitlabIssueIid: 3, state: 'opened' } }, []);
      renderThreadRoute();

      const panel = await findSessionPanel();
      expect(within(panel).getByRole('link', { name: 'Open Issue #3' })).toHaveAttribute(
        'href',
        `https://gitlab.com/${PROJECT_PATH}/-/issues/3`,
      );
    });
  });
});
