import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { attentionKindSummaries } from '../../../../../../e2e/ui/attention';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryAttentionItem } from '../../../factory/services/attention';
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

const otherSession: FactoryUserSession = {
  ...workSession,
  id: 'workspace-row-2',
  sessionId: 'review-session',
  title: 'Review loader',
  branch: 'factory/pr-202',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
};

function waitingOn(sessionId: string, read: boolean): FactoryAttentionItem {
  return {
    kind: 'agent-waiting',
    key: `agent-waiting:${sessionId}`,
    occurrence: 1,
    workItemId: 'issue-24',
    title: 'Waiting on you',
    detail: 'submit_plan',
    occurredAt: '2026-07-22T00:00:00.000Z',
    read,
    archived: false,
    target: { kind: 'thread', sessionId, threadId: `${sessionId}-thread` },
    sessionId,
    threadId: `${sessionId}-thread`,
    role: 'work',
    toolName: 'submit_plan',
  } as FactoryAttentionItem;
}

function stubSidebar({
  attention = [],
  activeSessionIds = [],
}: {
  attention?: FactoryAttentionItem[];
  activeSessionIds?: string[];
} = {}) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/attention`, () =>
      HttpResponse.json({ items: attention, kinds: attentionKindSummaries(attention), hasMore: false }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [workSession, otherSession] }),
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
  );
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

describe('Workspace sidebar unread marker', () => {
  it('marks only the session an unread notification came from', async () => {
    stubSidebar({ attention: [waitingOn(workSession.sessionId, false)] });

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('img', { name: 'Unread attention in Implement loader' });
    expect(screen.queryByRole('img', { name: 'Unread attention in Review loader' })).toBeNull();
  });

  it('leaves every row unmarked once the notification has been read', async () => {
    stubSidebar({ attention: [waitingOn(workSession.sessionId, true)] });

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('button', { name: 'Implement loader' });
    expect(screen.queryByRole('img', { name: 'Unread attention in Implement loader' })).toBeNull();
  });

  it('keeps the mark on a session that is still running, alongside its lifecycle belt', async () => {
    stubSidebar({
      attention: [waitingOn(workSession.sessionId, false)],
      activeSessionIds: [workSession.sessionId],
    });

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('status', { name: `Agent working in ${workSession.title}` });
    await screen.findByRole('img', { name: 'Unread attention in Implement loader' });
  });
});
