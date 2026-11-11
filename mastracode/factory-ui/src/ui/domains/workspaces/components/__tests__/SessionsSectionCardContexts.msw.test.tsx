import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { workBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../../api/types';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { WorkItem, WorkItemSessionRef } from '../../../factory/services/workItems';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import { closeSessionProperties, openSessionProperties } from './fixtures/sessionProperties';
import { LIVE_SESSION, stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';

type WireWorkItem = Omit<WorkItem, 'githubProjectId' | 'source' | 'sourceKey' | 'url'> & {
  factoryProjectId: string;
  externalSource: null;
};

function session(sessionId: string, title: string, branch: string): FactoryUserSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title,
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: '2026-09-04T10:00:00.000Z',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  };
}

const triageSession = session('triage-session', 'Triage fix login', 'factory/issue-1-triage');
const workSession = session('work-session', 'Build fix login', 'factory/issue-1');
const reviewSession = session('review-session', 'Review fix login', 'factory/issue-1-review');
const docsSession = session('docs-session', 'Write docs', 'factory/issue-2');
const userSession = session('user-session', 'Scratch notes', 'user/scratch');

const ref = (value: FactoryUserSession): WorkItemSessionRef => ({
  sessionId: value.sessionId,
  branch: value.branch,
  threadId: `${value.sessionId}-thread`,
  startedBy: 'user-1',
});

function card(id: string, title: string, sessions: WorkItem['sessions']): WireWorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: factoryId,
    board: 'work',
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['execute'],
    stageHistory: [],
    sessions,
    metadata: {},
    triageType: null,
    acceptedAt: null,
    description: null,
    revision: 1,
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  };
}

beforeEach(() => {
  localStorage.removeItem('mastracode.pinnedSessions');
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, () =>
      HttpResponse.json(workBoardCatalog satisfies BoardCatalogResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [triageSession, workSession, reviewSession, docsSession, userSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          card('fix-login', 'Fix login', {
            triage: ref(triageSession),
            work: ref(workSession),
            review: ref(reviewSession),
          }),
          card('write-docs', 'Write docs card', { work: ref(docsSession) }),
        ],
      }),
    ),
  );
});

function runningSessions(sessionIds: string[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
      HttpResponse.json({
        runs: sessionIds.map(sessionId => ({
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
    <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
      <ChatSessionContext.Provider value={testChatSession(factoryId, projectRepositoryId, LIVE_SESSION)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Sessions sidebar lists one row per card', () => {
  it("lists only the session of the card's current phase, as a flat row named by the session", async () => {
    renderSection();

    const row = await screen.findByRole('link', { name: 'Build fix login' });
    expect(row).toHaveTextContent('Build fix login');
    expect(screen.queryByRole('list', { name: 'Fix login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Triage fix login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review fix login' })).not.toBeInTheDocument();
  });

  it("shows the card's row running while a session in another context runs", async () => {
    runningSessions([reviewSession.sessionId]);
    renderSection();

    await screen.findByRole('status', { name: 'Agent working in Build fix login' });
    expect(screen.queryByRole('status', { name: 'Agent working in Write docs' })).not.toBeInTheDocument();
  });

  it("unpins the card's row when the pin was on another of the card's sessions", async () => {
    localStorage.setItem('mastracode.pinnedSessions', JSON.stringify([triageSession.sessionId]));
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByLabelText('Build fix login pinned')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Session actions for Build fix login' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));

    expect(screen.queryByLabelText('Build fix login pinned')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('mastracode.pinnedSessions') ?? '[]')).toEqual([]);
  });

  it('renders a card row the same way as a plain user session', async () => {
    renderSection();

    const cardRow = await screen.findByRole('link', { name: 'Write docs' });
    const userRow = screen.getByRole('link', { name: 'Scratch notes' });
    expect(cardRow).toHaveTextContent('Write docs');
    expect(screen.queryByRole('list', { name: 'Write docs card' })).not.toBeInTheDocument();
    expect(cardRow.closest('ul')).toBe(userRow.closest('ul'));
  });

  it('keeps a plain user session as a flat row', async () => {
    renderSection();

    const row = await screen.findByRole('link', { name: 'Scratch notes' });
    expect(row).toHaveTextContent('Scratch notes');
    expect(screen.queryByRole('list', { name: 'Scratch notes' })).not.toBeInTheDocument();
  });
});

async function toggleSessionView(user: ReturnType<typeof userEvent.setup>, option: string) {
  await openSessionProperties(user);
  await user.click(await screen.findByRole('menuitemcheckbox', { name: option }));
  await closeSessionProperties(user);
}

describe('Sessions sidebar view options', () => {
  it("lists a card's other sessions under its row, named by phase, and keeps that after a reload", async () => {
    const user = userEvent.setup();
    const first = renderSection();
    await screen.findByRole('link', { name: 'Build fix login' });

    await toggleSessionView(user, 'Reveal child sessions');

    const triage = await screen.findByRole('link', { name: /^Triage.*: Triage fix login$/ });
    const review = screen.getByRole('link', { name: /^Review.*: Review fix login$/ });
    expect(triage).not.toHaveTextContent('Triage fix login');
    expect(review).not.toHaveTextContent('Review fix login');
    expect(screen.queryByRole('link', { name: /: Write docs$/ })).not.toBeInTheDocument();
    // Nested in the card's list item, so screen readers hear them as one level down.
    const cardItem = screen.getByRole('link', { name: 'Build fix login' }).closest('li');
    if (!cardItem) throw new Error('The card row is not a list item');
    expect(within(cardItem).getByRole('list')).toContainElement(review);
    first.unmount();
    renderSection();
    expect(await screen.findByRole('link', { name: /^Review.*: Review fix login$/ })).toBeInTheDocument();
  });

  it('shows when a session last moved under its name once compact view is off', async () => {
    const user = userEvent.setup();
    renderSection();
    const row = await screen.findByRole('link', { name: 'Build fix login' });
    expect(row.querySelector('time')).toBeNull();

    await toggleSessionView(user, 'Compact view');

    const time = within(screen.getByRole('link', { name: 'Build fix login' })).getByText('Sep 4');
    expect(time).toHaveAttribute('dateTime', '2026-09-04T10:00:00.000Z');
  });
});
