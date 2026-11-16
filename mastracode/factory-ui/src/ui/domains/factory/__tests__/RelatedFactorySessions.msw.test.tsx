import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { workBoardCatalog } from '../../../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import { sessionCardsWhileBoardLoads } from '../../../../../e2e/ui/session-cards';

import type { BoardCatalogResponse, InstalledBoardInfo } from '../../../../api/types';
import { ChatSessionTestProvider } from '../../chat/context/ChatSessionTestProvider';
import { WorkspaceFilesProvider } from '../../workspace-viewer/context/WorkspaceFilesProvider';
import { FactorySessionPage } from '../components/RelatedFactorySessions';
import type { FactoryDecisionSummary } from '../services/decisions';

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

function stubHeader(item: unknown) {
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
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [{ id: FACTORY_ID, name: 'Acme', repositories: [listedRepository(REPOSITORY_ID, 'acme/app')] }],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: {} })),
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
              <ChatSessionTestProvider threadId={THREAD_ID} deferUntilMessagesReady={false}>
                <WorkspaceFilesProvider>
                  <FactorySessionPage>{null}</FactorySessionPage>
                </WorkspaceFilesProvider>
              </ChatSessionTestProvider>
            }
          />
        </Routes>
      </SidebarProvider>
      <Toaster />
    </MemoryRouter>,
  );
}

describe('FactorySessionPage', () => {
  describe('while the board is still loading', () => {
    it("names the session among the card's others before the board arrives", async () => {
      const card = workItem(undefined);
      const currentItem = {
        ...card,
        sessions: {
          ...card.sessions,
          triage: {
            sessionId: 'triage-session',
            branch: 'factory/issue-7-triage',
            threadId: 'triage-thread',
            startedBy: 'user-1',
          },
        },
      };
      stubHeader(currentItem);
      server.use(sessionCardsWhileBoardLoads(FACTORY_ID, SESSION_ID, [currentItem]));
      renderHeader();

      expect(await screen.findByRole('heading', { level: 1, name: 'Execute session' })).toBeInTheDocument();
    });
  });

  describe("the stage bar follows the card's own board", () => {
    const to = (...phases: string[]) => phases.map(phase => ({ outcome: null, to: phase }));
    const launchBoard: InstalledBoardInfo = {
      id: 'launch',
      name: 'Launch',
      title: 'Launch',
      initialPhase: 'drafting',
      phases: [
        { id: 'drafting', name: 'Drafting', title: 'Drafting', kind: 'resting', transitions: to('writing', 'shelved') },
        {
          id: 'writing',
          name: 'Writing',
          title: 'Writing',
          kind: 'working',
          context: 'work',
          role: 'work',
          transitions: to('drafting', 'proofing', 'shelved'),
        },
        {
          id: 'proofing',
          name: 'Proofing',
          title: 'Proofing',
          kind: 'working',
          context: 'review',
          role: 'review',
          transitions: to('writing', 'published'),
        },
        { id: 'published', name: 'Published', title: 'Published', kind: 'terminal', transitions: [] },
        { id: 'shelved', name: 'Shelved', title: 'Shelved', kind: 'terminal', transitions: to('drafting') },
      ],
    };

    function launchCard(stage: string, revision = 1) {
      return {
        ...workItem(undefined),
        board: 'launch',
        stages: [stage],
        stageHistory: [{ stage, enteredAt: new Date(Date.now() - 46 * 60_000).toISOString(), by: 'user-1' }],
        sessions: {
          work: { sessionId: SESSION_ID, branch: 'factory/issue-7', threadId: THREAD_ID, startedBy: 'user-1' },
        },
        revision,
      };
    }

    function stubLaunchCard(stage: string, result: (body: Record<string, unknown>) => Record<string, unknown>) {
      let card = launchCard(stage);
      const moves: Record<string, unknown>[] = [];
      stubHeader(card);
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () =>
          HttpResponse.json({ boards: [launchBoard] } satisfies BoardCatalogResponse),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
          HttpResponse.json({ workItems: [card] }),
        ),
        http.post(
          `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/${card.id}/transition`,
          async ({ request }) => {
            const body = z.record(z.string(), z.unknown()).parse(await request.json());
            moves.push(body);
            const answer = result(body);
            if (answer.status === 'accepted') card = launchCard(String(body.stage), Number(answer.revision));
            return HttpResponse.json({ result: answer });
          },
        ),
      );
      return moves;
    }

    it("offers the board's phases around the card's, each saying what the move does", async () => {
      const user = userEvent.setup();
      stubLaunchCard('writing', () => ({}));
      renderHeader();

      const stageBar = await screen.findByRole('group', { name: 'Card stage' });
      expect(within(stageBar).getByRole('button', { name: 'Move back to Drafting' })).toBeEnabled();
      expect(within(stageBar).getByRole('button', { name: 'Move to Proofing' })).toBeEnabled();
      await user.click(within(stageBar).getByRole('button', { name: 'Change stage from Writing' }));

      const menu = await screen.findByRole('menu');
      expect(
        within(menu)
          .getAllByRole('menuitemradio')
          .map(item => item.getAttribute('aria-label')),
      ).toEqual(['Move to Drafting', 'Writing, current stage', 'Move to Proofing', 'Move to Shelved']);
      expect(within(menu).getByRole('menuitemradio', { name: 'Writing, current stage' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(within(menu).getByRole('menuitemradio', { name: 'Move to Proofing' })).toHaveTextContent(
        'Factory works on it in the Proofing session',
      );
    });

    it('moves the card on to the next phase', async () => {
      const user = userEvent.setup();
      const moves = stubLaunchCard('writing', body => ({
        status: 'accepted',
        transitionId: 'transition-1',
        itemId: 'work-item-1',
        revision: 2,
        stage: body.stage,
        decisions: [],
      }));
      renderHeader();

      await user.click(await screen.findByRole('button', { name: 'Move to Proofing' }));

      expect(await screen.findByRole('button', { name: 'Change stage from Proofing' })).toBeInTheDocument();
      expect(moves).toEqual([
        expect.objectContaining({ board: 'launch', stage: 'proofing', expectedRevision: 1, cause: 'card_action' }),
      ]);
      expect(screen.getByRole('button', { name: 'Move to Published' })).toBeEnabled();
    });

    it('says why the server refused a move and leaves the card where it was', async () => {
      const user = userEvent.setup();
      stubLaunchCard('writing', () => ({
        status: 'rejected',
        transitionId: 'transition-1',
        itemId: 'work-item-1',
        code: 'approval_required',
        reason: 'Proofing needs an editor to sign off first',
      }));
      renderHeader();

      await user.click(await screen.findByRole('button', { name: 'Change stage from Writing' }));
      await user.click(await screen.findByRole('menuitemradio', { name: 'Move to Proofing' }));

      expect(await screen.findByText('Proofing needs an editor to sign off first')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Change stage from Writing' })).toBeInTheDocument();
    });

    it.each([
      { stage: 'writing', name: 'Writing', kind: 'a phase Factory works in', elapsed: '46m' },
      { stage: 'drafting', name: 'Drafting', kind: 'a phase the card waits in', elapsed: undefined },
      { stage: 'published', name: 'Published', kind: 'a phase the card ends in', elapsed: undefined },
    ])('times the card in $name only when it is $kind', async ({ stage, name, elapsed }) => {
      stubLaunchCard(stage, () => ({}));
      renderHeader();

      const current = await screen.findByRole('button', { name: `Change stage from ${name}` });
      if (elapsed) expect(current).toHaveTextContent(elapsed);
      else expect(current).toHaveTextContent(new RegExp(`^${name}$`));
    });

    it('offers no arrow toward a phase the card never enters from its own', async () => {
      stubLaunchCard('published', () => ({}));
      renderHeader();

      expect(await screen.findByRole('button', { name: 'Change stage from Published' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Move (back )?to / })).not.toBeInTheDocument();
    });

    it('holds back moves that would start a run while automation works the card', async () => {
      const user = userEvent.setup();
      stubLaunchCard('writing', () => ({}));
      const runningEffect: FactoryDecisionSummary = {
        id: 'decision-1',
        evaluationId: 'evaluation-1',
        workItemId: 'work-item-1',
        type: 'invokeSkill',
        role: 'work',
        source: null,
        status: 'leased',
        attempts: 1,
        failureOccurrence: 0,
        failureCode: null,
        canRetry: false,
        lastError: null,
        createdAt: '2026-07-29T00:00:00.000Z',
        updatedAt: '2026-07-29T00:00:00.000Z',
        completedAt: null,
      };
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
          HttpResponse.json({ decisions: [runningEffect] }),
        ),
      );
      renderHeader();

      const proofing = await screen.findByRole('button', {
        name: "Move to Proofing, Another run can't start while this card is busy.",
      });
      expect(proofing).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move back to Drafting' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Change stage from Writing' }));

      const menu = await screen.findByRole('menu');
      const heldMove = within(menu).getByRole('menuitemradio', { name: 'Move to Proofing' });
      expect(heldMove).toHaveAttribute('aria-disabled', 'true');
      expect(heldMove).toHaveTextContent("Another run can't start while this card is busy.");
      expect(within(menu).getByRole('menuitemradio', { name: 'Move to Shelved' })).not.toHaveAttribute('aria-disabled');
    });

    it("holds back moves that would start a run while the card's session works", async () => {
      const user = userEvent.setup();
      stubLaunchCard('writing', () => ({}));
      server.use(
        http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
          HttpResponse.json({ runs: [{ runId: 'run-1', resourceId: SESSION_ID, threadId: THREAD_ID }] }),
        ),
      );
      renderHeader();

      const proofing = await screen.findByRole('button', {
        name: "Move to Proofing, Another run can't start while this card is busy.",
      });
      expect(proofing).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move back to Drafting' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Change stage from Writing' }));

      const menu = await screen.findByRole('menu');
      expect(within(menu).getByRole('menuitemradio', { name: 'Move to Proofing' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(within(menu).getByRole('menuitemradio', { name: 'Move to Shelved' })).not.toHaveAttribute('aria-disabled');
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

    const title = () => screen.queryByRole('heading', { level: 1 });

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
                  <ChatSessionTestProvider threadId={threadId} deferUntilMessagesReady={false}>
                    <WorkspaceFilesProvider>
                      <FactorySessionPage>{null}</FactorySessionPage>
                    </WorkspaceFilesProvider>
                  </ChatSessionTestProvider>
                }
              />
            </Routes>
          </SidebarProvider>
        </MemoryRouter>,
      );
    }

    it("names the session's context and leads to the session the card moved on to", async () => {
      renderContextHeader('triage-session', 'triage-thread');

      const workingSession = await screen.findByRole('link', { name: 'Go to Work session' });
      expect(workingSession).toHaveAttribute(
        'href',
        `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`,
      );
      expect(title()).toHaveTextContent(/^Triage session$/);
    });

    it("switches to another of the card's sessions from beside the title", async () => {
      const user = userEvent.setup();
      renderContextHeader('triage-session', 'triage-thread', 'execute', undefined, ['review-session']);

      await waitFor(() => expect(title()).toHaveTextContent(/^Triage session$/));
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
      await waitFor(() => expect(title()).toHaveTextContent(/^Work session$/));
      expect(screen.queryByRole('link', { name: /^Go to / })).not.toBeInTheDocument();
    });

    it('names only the context when the card still works in it', async () => {
      renderContextHeader(SESSION_ID, THREAD_ID);

      await waitFor(() => expect(title()).toHaveTextContent(/^Work session$/));
      expect(screen.queryByRole('link', { name: /^Go to / })).not.toBeInTheDocument();
    });

    it("names only the context of self-review's session, which no phase runs in", async () => {
      renderContextHeader('review-session', 'review-thread', 'review');

      await waitFor(() => expect(title()).toHaveTextContent(/^Review session$/));
      expect(screen.queryByRole('link', { name: /^Go to / })).not.toBeInTheDocument();
    });
  });
});
