/**
 * BDD coverage for the sidebar's session order: a session whose pull request is
 * merged sinks below the ones still open, and the rest hold their place by
 * creation. Before this, rows were ordered by card activity — merging a pull
 * request bumped `updatedAt`, so the finished session jumped to the top and
 * every poll could reshuffle the list under the reader.
 */
import type { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspacesSection } from '../WorkspacesSection';

const factoryProjectId = 'fp-1';
const projectRepositoryId = 'ghp-1';

function reviewSession(pullRequestNumber: number, createdAt: string): FactoryUserSession {
  return {
    id: `row-${pullRequestNumber}`,
    sessionId: `sess-${pullRequestNumber}`,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org' as const,
    branch: `factory/pr-${pullRequestNumber}`,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

/** A review card for a session; `mergedAt` both merges it and stamps the write that merged it. */
function reviewCard(session: FactoryUserSession, pullRequestNumber: number, mergedAt?: string) {
  const merged = mergedAt !== undefined;
  return {
    id: `item-${pullRequestNumber}`,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId,
    externalSource: {
      integrationId: 'github',
      type: 'pull-request',
      externalId: `pr-${pullRequestNumber}`,
    },
    parentWorkItemId: null,
    title: `Review #${pullRequestNumber}`,
    stages: ['review'],
    stageHistory: [],
    sessions: {
      review: {
        sessionId: session.sessionId,
        branch: session.branch,
        threadId: `${session.sessionId}-thread`,
        startedBy: 'user-1',
      },
    },
    metadata: { githubPullRequestNumber: pullRequestNumber, state: merged ? 'closed' : 'open', merged },
    revision: 1,
    createdAt: session.createdAt,
    updatedAt: mergedAt ?? session.createdAt,
  };
}

function stubSidebar(
  sessions: FactoryUserSession[],
  workItems: ReturnType<typeof reviewCard>[],
  runningSessionIds: string[] = [],
) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, () =>
      HttpResponse.json({ workItems }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
      HttpResponse.json({
        runs: runningSessionIds.map(sessionId => ({
          runId: `run-${sessionId}`,
          resourceId: sessionId,
          threadId: `${sessionId}-thread`,
        })),
      }),
    ),
  );
}

function renderSection(openSessionId?: string) {
  return renderWithProviders(
    <MemoryRouter
      initialEntries={[
        openSessionId ? `/factories/${factoryProjectId}/workspaces/${openSessionId}` : `/factories/${factoryProjectId}`,
      ]}
    >
      <ChatSessionContext.Provider
        value={{
          resourceId: 'resource-1',
          sessionEnabled: false,
          resourceReady: false,
          sandboxReady: false,
          sandboxPreparing: false,
          resourceEnabled: false,
          factorySessionState: { factoryProjectId, projectRepositoryId },
          baseUrl: TEST_BASE_URL,
          kind: 'factory',
        }}
      >
        <Routes>
          <Route path="/factories/:factoryId" element={<WorkspacesSection />} />
          <Route path="/factories/:factoryId/workspaces/:sessionId" element={<WorkspacesSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

/** Rows only hold their final order once the sessions and work-items queries have both landed. */
async function reviewRowLabels(client: QueryClient): Promise<(string | null)[]> {
  await waitForMutationsIdle(client);
  const group = await screen.findByRole('region', { name: 'Review Sessions' });
  const rows = await within(group).findAllByRole('button', { name: /^factory\/pr-\d+$/ });
  return rows.map(row => row.getAttribute('aria-label'));
}

describe('Workspaces sidebar order', () => {
  it('sinks a merged session below the open ones and keeps the rest newest-first', async () => {
    const oldestOpen = reviewSession(101, '2026-07-23T09:00:00.000Z');
    const newestOpen = reviewSession(102, '2026-07-23T11:00:00.000Z');
    const mergedSession = reviewSession(103, '2026-07-23T10:00:00.000Z');

    stubSidebar(
      [oldestOpen, newestOpen, mergedSession],
      [
        reviewCard(oldestOpen, 101),
        reviewCard(newestOpen, 102),
        reviewCard(mergedSession, 103, '2026-07-23T23:00:00.000Z'),
      ],
    );

    const { client } = renderSection();

    expect(await reviewRowLabels(client)).toEqual(['factory/pr-102', 'factory/pr-101', 'factory/pr-103']);
  });

  it('keeps a merged session up top while its agent is still running', async () => {
    const openSession = reviewSession(301, '2026-07-23T11:00:00.000Z');
    const mergedButRunning = reviewSession(302, '2026-07-23T09:00:00.000Z');

    stubSidebar(
      [openSession, mergedButRunning],
      [reviewCard(openSession, 301), reviewCard(mergedButRunning, 302, '2026-07-23T23:00:00.000Z')],
      [mergedButRunning.sessionId],
    );

    const { client } = renderSection();

    expect(await reviewRowLabels(client)).toEqual(['factory/pr-302', 'factory/pr-301']);
  });

  it('leaves the open session where creation order put it', async () => {
    const oldest = reviewSession(401, '2026-07-23T09:00:00.000Z');
    const middle = reviewSession(402, '2026-07-23T10:00:00.000Z');
    const newest = reviewSession(403, '2026-07-23T11:00:00.000Z');
    const cards = [reviewCard(oldest, 401), reviewCard(middle, 402), reviewCard(newest, 403)];

    stubSidebar([oldest, middle, newest], cards);
    const { client } = renderSection(oldest.sessionId);

    expect(await reviewRowLabels(client)).toEqual(['factory/pr-403', 'factory/pr-402', 'factory/pr-401']);
  });

  it('keeps the open session visible when creation order puts it past the collapsed rows', async () => {
    const sessions = [501, 502, 503, 504, 505, 506, 507].map((pr, i) =>
      reviewSession(pr, `2026-07-23T0${i}:00:00.000Z`),
    );
    const [oldest] = sessions;

    stubSidebar(
      sessions,
      sessions.map((session, i) => reviewCard(session, 501 + i)),
    );
    const { client } = renderSection(oldest.sessionId);

    // Five newest, then the open one; the row it displaced stays behind "Show more".
    expect(await reviewRowLabels(client)).toEqual([
      'factory/pr-507',
      'factory/pr-506',
      'factory/pr-505',
      'factory/pr-504',
      'factory/pr-503',
      'factory/pr-501',
    ]);
  });

  it('holds one order for sessions created at the same instant, whichever way the endpoint returns them', async () => {
    const first = reviewSession(201, '2026-07-23T09:00:00.000Z');
    const second = reviewSession(202, '2026-07-23T09:00:00.000Z');
    const cards = [reviewCard(first, 201), reviewCard(second, 202)];

    stubSidebar([first, second], cards);
    const rendered = renderSection();
    const forward = await reviewRowLabels(rendered.client);
    rendered.unmount();

    // The sessions endpoint sorts nothing, so the same rows can come back either way round.
    stubSidebar([second, first], cards);
    const reversed = renderSection();

    expect(await reviewRowLabels(reversed.client)).toEqual(forward);
    expect(forward).toHaveLength(2);
  });
});
