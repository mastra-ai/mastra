import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { workBoardCatalog } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import { sessionCardsWhileBoardLoads } from '../../../../../e2e/ui/session-cards';
import type { WorkItemRow } from '@mastra/factory/storage/domains/work-items/work-item-schema';

import type { BoardCatalogResponse } from '../../../../api/types';
import { WorkspaceFilesProvider } from '../../workspace-viewer/context/WorkspaceFilesProvider';
import { FactorySessionPage } from '../components/RelatedFactorySessions';

const FACTORY_ID = 'factory-1';
const REPOSITORY_ID = 'repository-1';
const SESSION_ID = 'session-1';
const THREAD_ID = 'thread-1';

const workspaceSession = {
  id: 'workspace-row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPOSITORY_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/issue-7',
  baseBranch: 'main',
  sandboxId: 'sandbox-1',
  sandboxWorkdir: '/workspaces/acme/app',
  materializedAt: '2026-07-29T00:00:00.000Z',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

function workItem(url: string | undefined) {
  return {
    id: 'work-item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId: 'github-issue:7',
      ...(url ? { url } : {}),
    },
    parentWorkItemId: null,
    title: 'Fix sandbox setup',
    stages: ['execute'],
    stageHistory: [],
    sessions: {
      execute: {
        sessionId: SESSION_ID,
        branch: 'factory/issue-7',
        threadId: THREAD_ID,
        startedBy: 'user-1',
      },
    },
    metadata: { number: 7 },
    revision: 1,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
}

function linearWorkItem(url: string) {
  return {
    ...workItem(url),
    externalSource: {
      integrationId: 'linear',
      type: 'issue',
      externalId: 'linear-issue:ENG-123',
      url,
    },
    metadata: { identifier: 'ENG-123' },
  };
}

function stubHeader(item: ReturnType<typeof workItem> | ReturnType<typeof linearWorkItem>) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [item] }),
    ),
  );
}

function renderHeader() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`]}>
      <SidebarProvider storageKey="related-factory-sessions-test">
        <Routes>
          <Route
            path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
            element={
              <WorkspaceFilesProvider>
                <FactorySessionPage>{null}</FactorySessionPage>
              </WorkspaceFilesProvider>
            }
          />
        </Routes>
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe('FactorySessionPage', () => {
  describe('when a related work item has a session', () => {
    it.each([true, false])('links to the session when live=%s, or its board otherwise', async live => {
      const currentItem = workItem(undefined);
      const relatedSession = {
        ...workspaceSession,
        id: 'related-row',
        sessionId: 'related-session',
        branch: 'factory/issue-8',
      };
      const relatedItem = {
        ...workItem(undefined),
        id: 'related-item',
        parentWorkItemId: currentItem.id,
        title: 'Follow-up work',
        metadata: { number: 8 },
        sessions: {
          execute: {
            sessionId: relatedSession.sessionId,
            branch: relatedSession.branch,
            threadId: 'related-thread',
            startedBy: 'user-1',
          },
        },
      };
      stubHeader(currentItem);
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
          HttpResponse.json({ workItems: [currentItem, relatedItem] }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
          HttpResponse.json({ sessions: live ? [workspaceSession, relatedSession] : [workspaceSession] }),
        ),
      );
      renderHeader();

      const link = await screen.findByRole('link', { name: /Open .*Follow-up work/ });
      expect(link).toHaveAttribute(
        'href',
        live
          ? `/factories/${FACTORY_ID}/workspaces/related-session/threads/related-thread`
          : `/factories/${FACTORY_ID}/work`,
      );
    });
  });

  describe('while the board is still loading', () => {
    it("names the session's card and links its related work", async () => {
      const currentItem = workItem(undefined);
      const relatedItem = {
        ...workItem(undefined),
        id: 'related-item',
        parentWorkItemId: currentItem.id,
        title: 'Follow-up work',
        metadata: { number: 8 },
        sessions: {},
      };
      stubHeader(currentItem);
      server.use(sessionCardsWhileBoardLoads(FACTORY_ID, SESSION_ID, [currentItem, relatedItem]));
      renderHeader();

      expect(await screen.findByText('Issue #7: Fix sandbox setup')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open .*Follow-up work/ })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/work`,
      );
    });
  });

  describe("the breadcrumb leads to the card's own board", () => {
    it('names and links Work for a card on Work', async () => {
      stubHeader(workItem(undefined));
      renderHeader();

      expect(await screen.findByRole('link', { name: 'Work' })).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/work`,
      );
    });

    it('names and links an installed board for a card on it', async () => {
      stubHeader({ ...workItem(undefined), board: 'release' } as ReturnType<typeof workItem>);
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () =>
          HttpResponse.json({
            boards: [
              {
                id: 'release',
                name: 'Release train',
                title: 'Release train',
                initialPhase: 'queued',
                phases: [
                  { id: 'queued', name: 'Queued', title: 'Queued', kind: 'resting', nextPhases: [], transitions: [] },
                ],
              },
            ],
          }),
        ),
      );
      renderHeader();

      const crumb = await screen.findByRole('link', { name: 'Release train' });
      expect(crumb).toHaveAttribute('href', `/factories/${FACTORY_ID}/boards/release`);
      expect(screen.queryByRole('link', { name: 'Work' })).not.toBeInTheDocument();
    });
  });

  describe('when the active work item has an external issue URL', () => {
    it('renders an issue pill that opens the external issue in a new tab', async () => {
      const issueUrl = 'https://github.com/acme/app/issues/7';
      stubHeader(workItem(issueUrl));
      renderHeader();

      const link = await screen.findByRole('link', { name: 'Open Issue #7' });

      expect(link).toHaveAttribute('href', issueUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link.querySelector('[data-source="github-issue"]')).toBeInTheDocument();
    });
  });

  describe('when the active work item is backed by a Linear issue', () => {
    it('renders a pill that opens the Linear issue in a new tab', async () => {
      const issueUrl = 'https://linear.app/acme/issue/ENG-123/fix-sandbox-setup';
      stubHeader(linearWorkItem(issueUrl));
      renderHeader();

      const link = await screen.findByRole('link', { name: 'Open ENG-123' });

      expect(link).toHaveAttribute('href', issueUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link.querySelector('[data-source="linear-issue"]')).toBeInTheDocument();
    });
  });

  describe('when the active work item has no external URL', () => {
    it('does not render an external issue pill', async () => {
      stubHeader(workItem(undefined));
      renderHeader();

      expect(await screen.findByText('Issue #7: Fix sandbox setup')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Open Issue #7' })).not.toBeInTheDocument();
    });
  });

  describe('when the card holds sessions in several contexts', () => {
    const triageRef = {
      sessionId: 'triage-session',
      branch: 'factory/issue-7-triage',
      threadId: 'triage-thread',
      startedBy: 'user-1',
    };
    const workRef = { sessionId: SESSION_ID, branch: 'factory/issue-7', threadId: THREAD_ID, startedBy: 'user-1' };

    const currentCrumb = () => document.querySelector('[aria-current="page"]');

    const reviewRef = {
      sessionId: 'review-session',
      branch: 'factory/issue-7',
      threadId: 'review-thread',
      startedBy: 'user-1',
    };

    function renderContextHeader(
      sessionId: string,
      threadId: string,
      stage = 'execute',
      sessions: Record<string, typeof workRef> = { triage: triageRef, work: workRef, review: reviewRef },
      runningSessionIds: string[] = [],
    ) {
      const item = { ...workItem(undefined), stages: [stage], sessions };
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
          HttpResponse.json({ sessions: [workspaceSession] }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
          HttpResponse.json({ workItems: [item] }),
        ),
        http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) =>
          HttpResponse.json({ session: { ...workspaceSession, sessionId: String(params.sessionId) } }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () =>
          HttpResponse.json(workBoardCatalog satisfies BoardCatalogResponse),
        ),
        http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
          HttpResponse.json({
            runs: runningSessionIds.map(id => ({ runId: `run-${id}`, resourceId: id, threadId: `${id}-thread` })),
          }),
        ),
      );
      return renderWithProviders(
        <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/workspaces/${sessionId}/threads/${threadId}`]}>
          <SidebarProvider storageKey="related-factory-sessions-test">
            <Routes>
              <Route
                path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
                element={
                  <WorkspaceFilesProvider>
                    <FactorySessionPage>{null}</FactorySessionPage>
                  </WorkspaceFilesProvider>
                }
              />
            </Routes>
          </SidebarProvider>
        </MemoryRouter>,
      );
    }

    it("names the session's context and the phase the card moved on to", async () => {
      renderContextHeader('triage-session', 'triage-thread');

      const cardPhase = await screen.findByRole('link', { name: 'card is now in Building' });
      expect(cardPhase).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`,
      );
      expect(currentCrumb()).toHaveTextContent(/^Triage$/);
      expect(screen.getByText('Issue #7: Fix sandbox setup')).toBeInTheDocument();
    });

    it("switches to another of the card's sessions from the context crumb", async () => {
      const user = userEvent.setup();
      renderContextHeader('triage-session', 'triage-thread', 'execute', undefined, ['review-session']);

      await waitFor(() => expect(currentCrumb()).toHaveTextContent(/^Triage$/));
      await user.click(screen.getByRole('button', { name: 'Switch session' }));
      const menu = await screen.findByRole('menu');
      await waitFor(() =>
        expect(
          within(menu)
            .getAllByRole('menuitem')
            .map(item => item.getAttribute('aria-label')),
        ).toEqual(['Work, current phase', 'Triage, open', 'Review, running']),
      );

      await user.click(within(menu).getByRole('menuitem', { name: 'Work, current phase' }));
      await waitFor(() => expect(currentCrumb()).toHaveTextContent(/^Work$/));
      expect(screen.queryByText(/card is now in/)).not.toBeInTheDocument();
    });

    it('keeps the context a plain crumb when the card holds one session', async () => {
      renderContextHeader(SESSION_ID, THREAD_ID, 'execute', { work: workRef });

      await waitFor(() => expect(currentCrumb()).toHaveTextContent(/^Work$/));
      expect(screen.queryByRole('button', { name: 'Switch session' })).not.toBeInTheDocument();
    });

    it('names only the context when the card still works in it', async () => {
      renderContextHeader(SESSION_ID, THREAD_ID);

      await screen.findByText('Issue #7: Fix sandbox setup');
      await waitFor(() => expect(currentCrumb()).toHaveTextContent(/^Work$/));
      expect(screen.queryByText(/card is now in/)).not.toBeInTheDocument();
    });

    it("names only the context of self-review's session, which no phase runs in", async () => {
      renderContextHeader('review-session', 'review-thread', 'review');

      await screen.findByText('Issue #7: Fix sandbox setup');
      await waitFor(() => expect(currentCrumb()).toHaveTextContent(/^Review$/));
      expect(screen.queryByText(/card is now in/)).not.toBeInTheDocument();
    });
  });
  describe('when the card carries pull requests', () => {
    const ISSUE_URL = 'https://github.com/acme/app/issues/7';

    function pullRequestSource(number: number, state: 'open' | 'merged'): NonNullable<WorkItemRow['sources']>[number] {
      return {
        id: `source-pr-${number}`,
        workItemId: 'work-item-1',
        provider: 'github',
        integrationId: 'github',
        sourceType: 'pull-request',
        workspaceId: null,
        externalId: `pull-request:github-pr:${number}`,
        sourceKey: `github:pull-request:github-pr:${number}`,
        key: `acme/app#${number}`,
        url: `https://github.com/acme/app/pull/${number}`,
        state: state === 'merged' ? 'closed' : 'open',
        labels: [],
        author: 'factory-bot',
        metadata: { number, state, merged: state === 'merged', factoryAuthored: true },
        revision: 1,
        syncedAt: null,
        createdAt: new Date('2026-07-29T00:00:00.000Z'),
        updatedAt: new Date('2026-07-29T00:00:00.000Z'),
      };
    }

    function cardWithSources(sources: NonNullable<WorkItemRow['sources']>) {
      const item = workItem(ISSUE_URL);
      return {
        ...item,
        workItem: {
          provider: 'github' as const,
          key: 'acme/app#7',
          url: ISSUE_URL,
          title: item.title,
          state: 'open',
          labels: [],
          author: 'octocat',
          metadata: {},
          sources,
        },
      };
    }

    it('links each pull request next to the issue, the open one first and a merged one marked', async () => {
      stubHeader(cardWithSources([pullRequestSource(4, 'merged'), pullRequestSource(5, 'open')]));
      renderHeader();

      expect(await screen.findByRole('link', { name: 'Open Issue #7' })).toHaveAttribute('href', ISSUE_URL);
      const open = await screen.findByRole('link', { name: 'Open PR #5' });
      const merged = screen.getByRole('link', { name: 'Open PR #4 merged' });
      expect(open).toHaveAttribute('href', 'https://github.com/acme/app/pull/5');
      expect(open.compareDocumentPosition(merged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("leaves a pull request that has its own Review card to that card's link", async () => {
      const card = cardWithSources([pullRequestSource(5, 'open')]);
      const reviewCard = {
        ...workItem('https://github.com/acme/app/pull/5'),
        id: 'review-card-5',
        parentWorkItemId: card.id,
        title: 'Review the fix',
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:5',
          url: 'https://github.com/acme/app/pull/5',
        },
        sessions: {},
        metadata: { number: 5 },
      };
      server.use(
        http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
          HttpResponse.json({ session: workspaceSession }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
          HttpResponse.json({ sessions: [workspaceSession] }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
          HttpResponse.json({ workItems: [card, reviewCard] }),
        ),
      );
      renderHeader();

      await screen.findByRole('link', { name: 'Open Review: PR #5: Review the fix' });
      expect(screen.queryByRole('link', { name: 'Open PR #5' })).not.toBeInTheDocument();
    });

    it('shows only the issue when the card has no pull request', async () => {
      stubHeader(cardWithSources([]));
      renderHeader();

      await screen.findByRole('link', { name: 'Open Issue #7' });
      expect(screen.queryByRole('link', { name: /^Open (PR|MR) / })).not.toBeInTheDocument();
    });
  });
});
