import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { workBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
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

const OWNER = 'user-owner';
const planSession = { ...session('plan-session', 'Plan fix login', 'factory/issue-1'), userId: OWNER };
const docsSession = { ...session('docs-session', 'Write docs', 'factory/issue-2'), userId: OWNER };
// The viewer asked for "Fix login" from this session, so it follows that card.
const requesterSession = {
  ...session('requester-session', 'Ask for a login fix', 'user/session-requester'),
  followedWorkItemIds: ['fix-login'],
};
// A teammate asked for the docs from their own shared session. The viewer follows nothing there.
const teammateSession = {
  ...session('teammate-session', 'Teammate asks for docs', 'user/session-teammate'),
  userId: 'user-teammate',
  followedWorkItemIds: ['write-docs'],
};
const scratchSession = {
  ...session('scratch-session', 'Scratch notes', 'user/session-scratch'),
  followedWorkItemIds: [],
};

const ref = (value: FactoryUserSession): WorkItemSessionRef => ({
  sessionId: value.sessionId,
  branch: value.branch,
  threadId: `${value.sessionId}-thread`,
  startedBy: OWNER,
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

let parkedSessionIds: string[];
let phaseSessionOwner: string;
let answers: Array<{ sessionId: string; body: unknown }>;

beforeEach(() => {
  localStorage.removeItem('mastracode.pinnedSessions');
  parkedSessionIds = [];
  phaseSessionOwner = OWNER;
  answers = [];
  // The viewer is signed in as `user-1`, so sessions of other people read as teammates'.
  window.__MASTRACODE_CONFIG__ = { authEnabled: true };
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authEnabled: true,
        authenticated: true,
        user: { userId: 'user-1', name: 'Romain', email: 'romain@example.com' },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, () =>
      HttpResponse.json(workBoardCatalog satisfies BoardCatalogResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () =>
      HttpResponse.json({
        sessions: [
          { ...planSession, userId: phaseSessionOwner },
          docsSession,
          requesterSession,
          teammateSession,
          scratchSession,
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          card('fix-login', 'Fix login', { work: ref(planSession) }),
          card('write-docs', 'Write docs card', { work: ref(docsSession) }),
        ],
        parkedSessionIds,
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/parked-approval`, async ({ request, params }) => {
      answers.push({ sessionId: String(params.sessionId), body: await request.json() });
      parkedSessionIds = [];
      return HttpResponse.json({ answered: 'approve', sessionId: params.sessionId, toolCallId: 'call_release' });
    }),
  );
});

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

function renderSection() {
  return renderWithProviders(
    <Sidebar.Provider defaultState="default" collapsedWidth={0} storageKey="followed-cards-test">
      <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
        <ChatSessionContext.Provider value={testChatSession(factoryId, projectRepositoryId, LIVE_SESSION)}>
          <Routes>
            <Route path="/factories/:factoryId" element={<SessionsSection />} />
          </Routes>
        </ChatSessionContext.Provider>
      </MemoryRouter>
    </Sidebar.Provider>,
  );
}

function listItem(link: HTMLElement) {
  const item = link.closest('li');
  if (!item) throw new Error('The row is not a list item');
  return item;
}

describe("Sessions sidebar links a card's phase sessions to the session that asked for the work", () => {
  it("lists the followed card's phase session under the asking session once child sessions are revealed", async () => {
    const user = userEvent.setup();
    renderSection();
    const requester = await screen.findByRole('link', { name: 'Ask for a login fix' });
    expect(within(listItem(requester)).queryByRole('list')).not.toBeInTheDocument();

    await openSessionProperties(user);
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Reveal child sessions' }));
    await closeSessionProperties(user);

    const linked = await within(listItem(requester)).findByRole('link', { name: 'Plan fix login' });
    // A link to the card's session, which still has its own row: the session is not moved.
    expect(linked).toHaveAttribute('href', expect.stringContaining('plan-session'));
    expect(screen.getAllByRole('link', { name: 'Plan fix login' })).toHaveLength(2);
    // Cards this session does not follow stay out of it, and sessions following nothing list nothing.
    expect(within(listItem(requester)).queryByRole('link', { name: 'Write docs' })).not.toBeInTheDocument();
    const scratch = screen.getByRole('link', { name: 'Scratch notes' });
    expect(within(listItem(scratch)).queryByRole('list')).not.toBeInTheDocument();
  });

  it('says the Factory runs the phase session listed under the session of the person who moved the card', async () => {
    phaseSessionOwner = `factory-project:${factoryId}`;
    const user = userEvent.setup();
    renderSection();
    const requester = await screen.findByRole('link', { name: 'Ask for a login fix' });

    await openSessionProperties(user);
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Reveal child sessions' }));
    await closeSessionProperties(user);

    const linked = await within(listItem(requester)).findByRole('link', {
      name: 'Run by Factory: Plan fix login',
    });
    expect(linked).toHaveAttribute('href', expect.stringContaining('plan-session'));
    expect(within(linked).getByText('run by Factory')).toBeVisible();
  });

  it('marks the asking session as waiting on you while the followed card waits on an approval', async () => {
    parkedSessionIds = [planSession.sessionId];
    renderSection();

    expect(await screen.findByRole('status', { name: 'Ask for a login fix waiting on you' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Scratch notes waiting on you' })).not.toBeInTheDocument();
  });

  it("approves what the card waits on from the asking session's menu, answering the card's phase session", async () => {
    parkedSessionIds = [planSession.sessionId];
    const user = userEvent.setup();
    const { client } = renderSection();
    await screen.findByRole('status', { name: 'Ask for a login fix waiting on you' });

    await user.click(screen.getByRole('button', { name: 'Session actions for Ask for a login fix' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Approve' }));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(answers).toEqual([{ sessionId: 'plan-session', body: { decision: 'approve' } }]));
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Ask for a login fix waiting on you' })).not.toBeInTheDocument(),
    );
  });

  it("declines it from the same menu, answering the card's phase session", async () => {
    parkedSessionIds = [planSession.sessionId];
    const user = userEvent.setup();
    const { client } = renderSection();
    await screen.findByRole('status', { name: 'Ask for a login fix waiting on you' });

    await user.click(screen.getByRole('button', { name: 'Session actions for Ask for a login fix' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Decline' }));
    await waitForMutationsIdle(client);

    expect(answers).toEqual([{ sessionId: 'plan-session', body: { decision: 'decline' } }]);
  });

  it("does not ask the viewer to answer for a card only a teammate's session follows", async () => {
    parkedSessionIds = [docsSession.sessionId];
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Teammate asks for docs' });
    // The card's own session still shows it is waiting; the teammate's row makes no claim on the viewer.
    await screen.findByRole('status', { name: 'Write docs waiting on you' });

    expect(screen.queryByRole('status', { name: 'Teammate asks for docs waiting on you' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Session actions for Teammate asks for docs' }));
    await screen.findByRole('menuitem', { name: 'Pin session' });
    expect(screen.queryByRole('menuitem', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Decline' })).not.toBeInTheDocument();
  });

  it('offers no approval on a session whose followed card is not waiting', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Ask for a login fix' });

    await user.click(screen.getByRole('button', { name: 'Session actions for Ask for a login fix' }));

    await screen.findByRole('menuitem', { name: 'Pin session' });
    expect(screen.queryByRole('menuitem', { name: 'Approve' })).not.toBeInTheDocument();
  });
});
