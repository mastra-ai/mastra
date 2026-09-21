import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { PullRequestSubscription } from '../../../factory/services/githubSubscriptions';
import type { WorkItemSessionRef } from '../../../factory/services/workItems';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspacesSection } from '../WorkspacesSection';

const factoryProjectId = 'factory-project-1';
const projectRepositoryId = 'gitlab-project-1';
const resourceId = 'resource-1';
const PROJECT_PATH = 'rhys-group1/factory-gitlab-primary';
const MERGE_REQUEST_IID = 12;

const reviewSession: FactoryUserSession = {
  id: 'workspace-row-2',
  sessionId: 'review-session',
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org',
  title: 'Review loader',
  branch: 'factory/mr-12',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: '2026-09-21T00:00:00.000Z',
  createdAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
};

const reviewRef: WorkItemSessionRef = {
  sessionId: reviewSession.sessionId,
  branch: reviewSession.branch,
  threadId: 'review-thread',
  startedBy: 'user-1',
};

const reviewItem = {
  id: 'merge-request-12',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId,
  externalSource: {
    integrationId: 'gitlab',
    type: 'pull-request' as const,
    externalId: 'gitlab-pr:opaque',
    url: `https://gitlab.com/${PROJECT_PATH}/-/merge_requests/${MERGE_REQUEST_IID}`,
  },
  parentWorkItemId: null,
  title: 'Review loader',
  stages: ['review'],
  stageHistory: [],
  sessions: { review: reviewRef },
  metadata: { gitlabMergeRequestIid: MERGE_REQUEST_IID, state: 'open', merged: false },
  revision: 1,
  createdAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
};

function stubSidebar(status: PullRequestSubscription['status']) {
  const githubSubscriptionRequests = vi.fn<() => void>();
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/source-control/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [reviewSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, () =>
      HttpResponse.json({ workItems: [reviewItem] }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () => HttpResponse.json({ runs: [] })),
    http.get(`${TEST_BASE_URL}/web/gitlab/subscriptions`, ({ request }) => {
      const url = new URL(request.url);
      const subscription: PullRequestSubscription = {
        id: `subscription-${MERGE_REQUEST_IID}-${status}`,
        repoFullName: PROJECT_PATH,
        pullRequestNumber: MERGE_REQUEST_IID,
        status,
        url: `https://gitlab.com/${PROJECT_PATH}/-/merge_requests/${MERGE_REQUEST_IID}`,
      };
      const matches = url.searchParams.get('threadId') === 'review-thread';
      return HttpResponse.json({ subscriptions: matches ? [subscription] : [] });
    }),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => {
      githubSubscriptionRequests();
      return HttpResponse.json({ subscriptions: [] });
    }),
  );
  return { githubSubscriptionRequests };
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryProjectId}/workspaces/${reviewSession.sessionId}`]}>
      <ChatSessionContext.Provider
        value={{
          resourceId,
          sessionEnabled: true,
          resourceReady: true,
          sandboxReady: true,
          sandboxPreparing: false,
          resourceEnabled: true,
          factorySessionState: { factoryProjectId, projectRepositoryId },
          baseUrl: TEST_BASE_URL,
          kind: 'factory',
        }}
      >
        <Routes>
          <Route path="/factories/:factoryId/workspaces/:sessionId" element={<WorkspacesSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Workspace sidebar GitLab merge status', () => {
  it('marks a GitLab review session merged from its own subscriptions route', async () => {
    const { githubSubscriptionRequests } = stubSidebar('merged');
    renderSection();

    expect(await screen.findByRole('img', { name: 'Pull request merged for Review loader' })).toBeInTheDocument();
    expect(githubSubscriptionRequests).not.toHaveBeenCalled();
  });

  it('keeps an open GitLab merge request unmarked', async () => {
    stubSidebar('open');
    renderSection();

    await screen.findByText('Review loader');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByRole('img', { name: 'Pull request merged for Review loader' })).not.toBeInTheDocument();
  });
});
