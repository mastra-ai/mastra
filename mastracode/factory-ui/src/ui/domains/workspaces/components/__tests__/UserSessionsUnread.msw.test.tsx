/**
 * Unread attention belongs to whichever session the thread target names,
 * including User Sessions. The first unread-dot commit only wired Work /
 * Review rows; this suite pins the user list to the same receipt.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { attentionKindSummaries } from '../../../../../../e2e/ui/attention';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryAttentionItem } from '../../../factory/services/attention';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';

const waitingSession: FactoryUserSession = {
  id: 'row-waiting',
  sessionId: 'user-session-waiting',
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org',
  title: 'Draft chat',
  branch: 'user/draft-chat',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: '2026-07-20T00:00:00.000Z',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const otherSession: FactoryUserSession = {
  ...waitingSession,
  id: 'row-other',
  sessionId: 'user-session-other',
  title: 'Other chat',
  branch: 'user/other-chat',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
};

function waitingOn(sessionId: string, read: boolean): FactoryAttentionItem {
  return {
    kind: 'agent-waiting',
    key: `agent-waiting:${sessionId}`,
    occurrence: 1,
    workItemId: null,
    title: 'Waiting on you',
    detail: 'Agent is waiting for an answer',
    occurredAt: '2026-07-22T00:00:00.000Z',
    read,
    archived: false,
    target: { kind: 'thread', sessionId, threadId: sessionId, list: 'user' },
    sessionId,
    threadId: sessionId,
    role: 'user',
    toolName: 'ask_user',
  };
}

function stubSidebar(attention: FactoryAttentionItem[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: factoryId, name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-7',
            repositories: [
              {
                id: projectRepositoryId,
                branch: 'main',
                sandboxWorkdir: '/workspace/hello',
                repository: { slug: 'octo/hello', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [waitingSession, otherSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/attention`, () =>
      HttpResponse.json({ items: attention, kinds: attentionKindSummaries(attention), hasMore: false }),
    ),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('User sessions sidebar unread marker', () => {
  it('marks only the user session an unread notification came from', async () => {
    stubSidebar([waitingOn(waitingSession.sessionId, false)]);

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('img', { name: 'Unread attention in Draft chat' });
    expect(screen.queryByRole('img', { name: 'Unread attention in Other chat' })).toBeNull();
  });

  it('leaves every user session unmarked once the notification has been read', async () => {
    stubSidebar([waitingOn(waitingSession.sessionId, true)]);

    const { client } = renderSection();
    await waitForMutationsIdle(client);

    await screen.findByRole('button', { name: 'Draft chat' });
    expect(screen.queryByRole('img', { name: 'Unread attention in Draft chat' })).toBeNull();
  });
});
