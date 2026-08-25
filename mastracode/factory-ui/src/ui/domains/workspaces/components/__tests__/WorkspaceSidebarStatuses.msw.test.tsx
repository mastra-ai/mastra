import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { PullRequestSubscription } from '../../../factory/services/githubSubscriptions';
import type { WorkItemSessionRef } from '../../../factory/services/workItems';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspacesSection } from '../WorkspacesSection';

const factoryProjectId = 'factory-project-1';
const projectRepositoryId = 'github-project-1';
const resourceId = 'resource-1';

const workSession: FactoryUserSession = {
  id: 'workspace-row-1',
  sessionId: 'work-session',
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org' as const,
  title: 'Implement loader',
  branch: 'factory/issue-24',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: '2026-07-20T00:00:00.000Z',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const reviewSession: FactoryUserSession = {
  ...workSession,
  id: 'workspace-row-2',
  sessionId: 'review-session',
  title: 'Review loader',
  branch: 'factory/pr-202',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
};

function sessionRef(session: FactoryUserSession, threadId: string): WorkItemSessionRef {
  return {
    sessionId: session.sessionId,
    branch: session.branch,
    threadId,
    startedBy: 'user-1',
  };
}

interface WireWorkItemFixture {
  id: string;
  orgId: string;
  createdBy: string;
  factoryProjectId: string;
  externalSource: {
    integrationId: string;
    type: 'issue' | 'pull-request';
    externalId: string;
    url?: string;
  };
  parentWorkItemId: string | null;
  title: string;
  stages: string[];
  stageHistory: unknown[];
  sessions: Record<string, WorkItemSessionRef>;
  metadata: Record<string, unknown>;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

function wireWorkItem({
  id,
  sourceType,
  externalId,
  parentWorkItemId = null,
  title,
  sessions,
  metadata,
  updatedAt,
}: {
  id: string;
  sourceType: 'issue' | 'pull-request';
  externalId: string;
  parentWorkItemId?: string | null;
  title: string;
  sessions: Record<string, WorkItemSessionRef>;
  metadata: Record<string, unknown>;
  updatedAt: string;
}): WireWorkItemFixture {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId,
    externalSource: {
      integrationId: 'github',
      type: sourceType,
      externalId,
      url: sourceType === 'pull-request' ? `https://github.com/mastra-ai/mastra/pull/${externalId}` : undefined,
    },
    parentWorkItemId,
    title,
    stages: ['review'],
    stageHistory: [],
    sessions,
    metadata,
    revision: 1,
    createdAt: updatedAt,
    updatedAt,
  };
}

function pullRequestSubscription(
  pullRequestNumber: number,
  status: PullRequestSubscription['status'],
): PullRequestSubscription {
  return {
    id: `subscription-${pullRequestNumber}-${status}`,
    repoFullName: 'mastra-ai/mastra',
    pullRequestNumber,
    status,
    url: `https://github.com/mastra-ai/mastra/pull/${pullRequestNumber}`,
  };
}

function stubWorkspaceStatuses({
  items,
  activeSessionIds,
  subscriptionsBySession,
}: {
  items: WireWorkItemFixture[];
  activeSessionIds: string[];
  subscriptionsBySession: Record<string, PullRequestSubscription[]>;
}) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [workSession, reviewSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, () =>
      HttpResponse.json({ workItems: items }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
      HttpResponse.json({
        runs: activeSessionIds.map(sessionId => ({
          runId: `run-${sessionId}`,
          resourceId: sessionId,
          threadId: `${sessionId}-thread`,
        })),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, ({ request }) => {
      const url = new URL(request.url);
      const threadId = url.searchParams.get('threadId');
      const scope = url.searchParams.get('scope');
      const key = `${threadId ?? ''}:${scope ?? ''}`;
      return HttpResponse.json({
        subscriptions: subscriptionsBySession[key] ?? [],
      });
    }),
  );
}

function baseItems(knownMerged: boolean) {
  const workItem = wireWorkItem({
    id: 'issue-24',
    sourceType: 'issue',
    externalId: 'repository-node-id:issue-node-id',
    title: 'Implement loader',
    sessions: { work: sessionRef(workSession, 'work-thread') },
    metadata: { githubIssueNumber: 24 },
    updatedAt: '2026-07-20T00:00:00.000Z',
  });
  const reviewItem = wireWorkItem({
    id: 'pull-request-202',
    sourceType: 'pull-request',
    externalId: 'repository-node-id:pull-request-node-id',
    parentWorkItemId: workItem.id,
    title: 'Review loader',
    sessions: { review: sessionRef(reviewSession, 'review-thread') },
    metadata: { githubPullRequestNumber: 202, merged: knownMerged },
    updatedAt: '2026-07-21T00:00:00.000Z',
  });
  return [workItem, reviewItem];
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryProjectId}/workspaces/${workSession.sessionId}`]}>
      <ChatSessionContext.Provider
        value={{
          resourceId,
          sessionEnabled: true,
          resourceReady: true,
          sandboxReady: true,
          sandboxPreparing: false,
          sandboxProgress: undefined,
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

const terminalStatusCases: Array<{
  status: PullRequestSubscription['status'];
  knownMerged: boolean;
  expectedMerged: boolean;
}> = [
  { status: 'merged', knownMerged: false, expectedMerged: true },
  { status: 'open', knownMerged: true, expectedMerged: false },
  { status: 'closed', knownMerged: false, expectedMerged: false },
];

const newestPullRequestCases: Array<{
  newestStatus: PullRequestSubscription['status'];
  expectedMerged: boolean;
}> = [
  { newestStatus: 'merged', expectedMerged: true },
  { newestStatus: 'open', expectedMerged: false },
];

describe('Workspace sidebar statuses', () => {
  it('shows the running status dot instead of a merged icon while the agent is active', async () => {
    stubWorkspaceStatuses({
      items: baseItems(true),
      activeSessionIds: [workSession.sessionId],
      subscriptionsBySession: {
        'work-thread:work-session': [pullRequestSubscription(202, 'merged')],
        'review-thread:review-session': [pullRequestSubscription(202, 'merged')],
      },
    });

    renderSection();

    await screen.findByRole('status', { name: 'Agent working in Implement loader' });
    expect(screen.queryByRole('img', { name: 'Pull request merged for Implement loader' })).not.toBeInTheDocument();
  });

  it.each(terminalStatusCases)(
    'maps a matching $status subscription to merged=$expectedMerged',
    async ({ status, knownMerged, expectedMerged }) => {
      stubWorkspaceStatuses({
        items: baseItems(knownMerged),
        activeSessionIds: [],
        subscriptionsBySession: {
          'work-thread:work-session': [pullRequestSubscription(202, status)],
          'review-thread:review-session': [pullRequestSubscription(202, status)],
        },
      });

      const { client } = renderSection();
      await waitForMutationsIdle(client);

      const workMergedIcon = screen.queryByRole('img', { name: 'Pull request merged for Implement loader' });
      const reviewMergedIcon = screen.queryByRole('img', { name: 'Pull request merged for Review loader' });
      if (expectedMerged) {
        expect(workMergedIcon).toBeInTheDocument();
        expect(reviewMergedIcon).toBeInTheDocument();
      } else {
        expect(workMergedIcon).not.toBeInTheDocument();
        expect(reviewMergedIcon).not.toBeInTheDocument();
      }
    },
  );

  it.each(newestPullRequestCases)(
    'uses the newest related $newestStatus pull request instead of an older merged one',
    async ({ newestStatus, expectedMerged }) => {
      const workItem = baseItems(false)[0];
      if (!workItem) throw new Error('Expected work item fixture.');
      const olderReview = wireWorkItem({
        id: 'pull-request-201',
        sourceType: 'pull-request',
        externalId: 'repository-node-id:older-pull-request-node-id',
        parentWorkItemId: workItem.id,
        title: 'Older review',
        sessions: {},
        metadata: { githubPullRequestNumber: 201, merged: true },
        updatedAt: '2026-07-20T12:00:00.000Z',
      });
      const newerReview = wireWorkItem({
        id: 'pull-request-202',
        sourceType: 'pull-request',
        externalId: 'repository-node-id:newer-pull-request-node-id',
        parentWorkItemId: workItem.id,
        title: 'Newer review',
        sessions: { review: sessionRef(reviewSession, 'review-thread') },
        metadata: { githubPullRequestNumber: 202, merged: true },
        updatedAt: '2026-07-21T00:00:00.000Z',
      });
      const subscriptions = [pullRequestSubscription(201, 'merged'), pullRequestSubscription(202, newestStatus)];
      stubWorkspaceStatuses({
        items: [workItem, olderReview, newerReview],
        activeSessionIds: [],
        subscriptionsBySession: {
          'work-thread:work-session': subscriptions,
          'review-thread:review-session': subscriptions,
        },
      });

      const { client } = renderSection();
      await waitForMutationsIdle(client);

      const mergedIcon = screen.queryByRole('img', { name: 'Pull request merged for Implement loader' });
      if (expectedMerged) expect(mergedIcon).toBeInTheDocument();
      else expect(mergedIcon).not.toBeInTheDocument();
    },
  );
});
