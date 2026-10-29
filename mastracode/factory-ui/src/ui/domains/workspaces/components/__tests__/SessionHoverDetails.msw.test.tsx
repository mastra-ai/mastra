import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionConfigProvider } from '../../../chat/context/ChatSessionProvider';
import { SessionsSection } from '../SessionsSection';
import {
  createSessionHoverDetailsFixtures,
  factoryId,
  projectRepositoryId,
  reviewName,
  reviewSessionId,
  workName,
  workSessionId,
} from './fixtures/sessionHoverDetails';

function stubSessionDetails(updatedAt: string, { includeSessionTitles = true, slackWorkSession = false } = {}) {
  const fixtures = createSessionHoverDetailsFixtures(updatedAt);
  if (!includeSessionTitles) {
    fixtures.sessionsResponse.sessions = fixtures.sessionsResponse.sessions.map(({ title: _, ...session }) => session);
  }
  if (slackWorkSession) fixtures.sessionsResponse.sessions[0].branch = 'slack/1785354600-536029';

  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json(fixtures.projectsResponse)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/source-control-connections`, () =>
      HttpResponse.json(fixtures.connectionsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () =>
      HttpResponse.json(fixtures.sessionsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${workSessionId}`, () =>
      HttpResponse.json(fixtures.currentSessionResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json(fixtures.workItemsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
      HttpResponse.json(fixtures.activeRunsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/mention-roster`, () =>
      HttpResponse.json(fixtures.rosterResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/audit`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (query.get('namespaces') === 'session') return HttpResponse.json(fixtures.transfersResponse);
      if (query.get('actor') === `agent:${workSessionId}`) return HttpResponse.json(fixtures.workRunsResponse);
      return HttpResponse.json({ events: [], actors: {} });
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

function mockMobileViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderSection(wrap: (section: ReactNode) => ReactNode = section => section) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/workspaces/${workSessionId}/threads/${workSessionId}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={<ChatSessionConfigProvider>{wrap(<SessionsSection />)}</ChatSessionConfigProvider>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function setupSessionRows() {
  stubSessionDetails(new Date().toISOString());
  const user = userEvent.setup();
  renderSection();

  return {
    user,
    workRow: await screen.findByRole('link', { name: workName }),
    reviewRow: await screen.findByRole('link', { name: reviewName }),
  };
}

describe('Workspace session hover details', () => {
  it('uses the work-item title when the session has no generated title', async () => {
    stubSessionDetails(new Date().toISOString(), { includeSessionTitles: false, slackWorkSession: true });

    renderSection();

    expect(await screen.findByRole('link', { name: 'Authentication fails after token refresh' })).toBeInTheDocument();
  });

  describe('when a work session is hovered', () => {
    it('shows who owns it, where the work lives, and what the agent is doing', async () => {
      const { user, workRow } = await setupSessionRows();

      await user.hover(workRow);

      const card = await screen.findByLabelText(`${workName} session details`);
      expect(within(card).getByText(workName)).toBeInTheDocument();
      expect(within(card).getByText('Ada Lovelace')).toBeInTheDocument();
      expect(within(card).getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
        'src',
        'https://example.com/ada.png',
      );
      expect(within(card).getByRole('link', { name: 'Open in GitHub: #42' })).toHaveAttribute(
        'href',
        'https://github.com/mastra-ai/mastra/issues/42',
      );
      expect(within(card).getByText('Agent working')).toBeInTheDocument();
      expect(workRow).not.toHaveAttribute('title');
    });

    it('tells the session story from the stage history and the audit trail', async () => {
      const { user, workRow } = await setupSessionRows();

      await user.hover(workRow);

      const card = await screen.findByLabelText(`${workName} session details`);
      expect(await within(card).findByText('Taken over from Grace Hopper')).toBeInTheDocument();
      expect(
        within(card).getByRole('img', {
          name: 'Session timeline. Triage 1h, Building 3h. 1 agent run. Grace Hopper moved it to Building. Ada Lovelace took over',
        }),
      ).toBeInTheDocument();
    });

    it('names the viewer on the track when the host lists no members', async () => {
      stubSessionDetails(new Date().toISOString());
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/mention-roster`, () =>
          HttpResponse.json({ members: [] }),
        ),
        http.get('*/auth/me', () =>
          HttpResponse.json({ authenticated: true, user: { userId: 'user-1', name: 'Ada Lovelace' } }),
        ),
      );
      const user = userEvent.setup();
      renderSection();

      await user.hover(await screen.findByRole('link', { name: workName }));

      const card = await screen.findByLabelText(`${workName} session details`);
      expect(await within(card).findByRole('img', { name: /Ada Lovelace took over/ })).toBeInTheDocument();
    });

    it('pins a takeover on a session that has no stages or agent runs to draw', async () => {
      const updatedAt = new Date().toISOString();
      stubSessionDetails(updatedAt);
      const fixtures = createSessionHoverDetailsFixtures(updatedAt);
      const ownSession = {
        ...fixtures.sessionsResponse.sessions[0],
        id: 'row-session-own',
        sessionId: 'session-own',
        branch: 'user/token-refresh-notes',
        title: 'Notes on token refresh',
      };
      const takeover = fixtures.transfersResponse.events[0];
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () =>
          HttpResponse.json({ sessions: [...fixtures.sessionsResponse.sessions, ownSession] }),
        ),
        http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/audit`, ({ request }) => {
          if (new URL(request.url).searchParams.get('namespaces') !== 'session') {
            return HttpResponse.json({ events: [], actors: {} });
          }
          const ownTakeover = {
            ...takeover,
            targets: [{ type: 'session', id: ownSession.id, name: ownSession.title }],
          };
          return HttpResponse.json({ events: [ownTakeover], actors: {} });
        }),
      );
      const user = userEvent.setup();
      renderSection();

      await user.hover(await screen.findByRole('link', { name: ownSession.title }));

      const card = await screen.findByLabelText(`${ownSession.title} session details`);
      expect(
        await within(card).findByRole('img', { name: 'Session timeline. Ada Lovelace took over' }),
      ).toBeInTheDocument();
    });

    it('closes the details when the pointer leaves', async () => {
      const { user, workRow } = await setupSessionRows();
      await user.hover(workRow);
      expect(await screen.findByLabelText(`${workName} session details`)).toBeInTheDocument();

      await user.unhover(workRow);

      await waitFor(() => expect(screen.queryByLabelText(`${workName} session details`)).not.toBeInTheDocument());
    });
  });

  describe('when a review session receives keyboard focus', () => {
    it('shows the related review metadata', async () => {
      const { user, workRow, reviewRow } = await setupSessionRows();

      act(() => workRow.focus());
      await user.tab();
      await user.tab();

      expect(reviewRow).toHaveFocus();
      const card = await screen.findByLabelText(`${reviewName} session details`);
      expect(within(card).getByText(reviewName)).toBeInTheDocument();
      expect(within(card).getByText('Ada Lovelace')).toBeInTheDocument();
      expect(within(card).getByRole('link', { name: 'Open in GitHub: #99' })).toHaveAttribute(
        'href',
        'https://github.com/mastra-ai/mastra/pull/99',
      );
      expect(reviewRow).not.toHaveAttribute('title');
    });

    it('closes the details when focus moves away', async () => {
      const { user, workRow, reviewRow } = await setupSessionRows();
      act(() => workRow.focus());
      await user.tab();
      await user.tab();
      expect(reviewRow).toHaveFocus();
      expect(await screen.findByLabelText(`${reviewName} session details`)).toBeInTheDocument();

      await user.tab();

      await waitFor(() => expect(screen.queryByLabelText(`${reviewName} session details`)).not.toBeInTheDocument());
    });
  });

  describe('on a touch viewport', () => {
    it('leaves the row bare instead of opening details under the tap', async () => {
      mockMobileViewport();
      stubSessionDetails(new Date().toISOString());
      const user = userEvent.setup();
      const { client } = renderSection(section => (
        <SidebarProvider storageKey="session-hover-test">{section}</SidebarProvider>
      ));

      const workRow = await screen.findByRole('link', { name: workName });
      await waitForMutationsIdle(client);
      await user.hover(workRow);
      await user.tab();

      expect(screen.queryByLabelText(`${workName} session details`)).not.toBeInTheDocument();
    });
  });

  describe('when session actions are used', () => {
    it.each(['context', 'dropdown'])('dismisses the preview when opening the %s menu', async entry => {
      const { user, reviewRow } = await setupSessionRows();
      await user.hover(reviewRow);
      expect(await screen.findByLabelText(`${reviewName} session details`)).toBeInTheDocument();

      if (entry === 'context') await user.pointer({ target: reviewRow, keys: '[MouseRight]' });
      else await user.click(screen.getByRole('button', { name: `Session actions for ${reviewName}` }));

      expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByLabelText(`${reviewName} session details`)).not.toBeInTheDocument());
    });
  });
});
