/**
 * BDD coverage for workspace sidebar previews. The real workspace, work-item,
 * and agent-controller reads are driven through MSW so the card exercises the
 * same joins used by the live sidebar without adding a hover-time request.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatSessionConfigProvider } from '../../../chat/context/ChatSessionProvider';
import { WorkspacesSection } from '../WorkspacesSection';
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
  if (slackWorkSession) fixtures.sessionsResponse.sessions[0]!.branch = 'slack/1785354600-536029';

  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json(fixtures.projectsResponse)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/source-control-connections`, () =>
      HttpResponse.json(fixtures.connectionsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json(fixtures.sessionsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${workSessionId}`, () =>
      HttpResponse.json(fixtures.currentSessionResponse),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/ensure`, () =>
      HttpResponse.json(fixtures.ensureResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json(fixtures.workItemsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
      HttpResponse.json(fixtures.activeRunsResponse),
    ),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/workspaces/${workSessionId}/threads/${workSessionId}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={
            <ChatSessionConfigProvider>
              <WorkspacesSection />
            </ChatSessionConfigProvider>
          }
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
    workRow: await screen.findByRole('button', { name: workName }),
    reviewRow: await screen.findByRole('button', { name: reviewName }),
  };
}

describe('Workspace session hover details', () => {
  it('uses the work-item title when the session has no generated title', async () => {
    stubSessionDetails(new Date().toISOString(), { includeSessionTitles: false, slackWorkSession: true });

    renderSection();

    expect(await screen.findByRole('button', { name: 'Authentication fails after token refresh' })).toBeInTheDocument();
  });

  describe('when a work session is hovered', () => {
    it('shows the related work metadata', async () => {
      const { user, workRow } = await setupSessionRows();

      await user.hover(workRow);

      const card = await screen.findByLabelText(`${workName} session details`);
      expect(within(card).getByText(workName)).toBeInTheDocument();
      expect(within(card).getByText('Work session · Agent working')).toBeInTheDocument();
      expect(within(card).getByText('Ada Lovelace')).toBeInTheDocument();
      expect(within(card).getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
        'src',
        'https://example.com/ada.png',
      );
      expect(within(card).getByText('Work item: Issue #42')).toBeInTheDocument();
      expect(within(card).getByText('Authentication fails after token refresh')).toBeInTheDocument();
      expect(within(card).getByText('factory/issue-42-authentication-regression')).toBeInTheDocument();
      expect(within(card).getByText('main')).toBeInTheDocument();
      expect(within(card).getByText('just now')).toBeInTheDocument();
      expect(workRow).not.toHaveAttribute('title');
    });

    it('names the icon-only rows for screen readers', async () => {
      const { user, workRow } = await setupSessionRows();

      await user.hover(workRow);

      const card = await screen.findByLabelText(`${workName} session details`);
      expect(within(card).getByText('Owner')).toBeInTheDocument();
      expect(within(card).getByText('Work item')).toBeInTheDocument();
      expect(within(card).getByText('Branch')).toBeInTheDocument();
      expect(within(card).getByText('Base branch')).toBeInTheDocument();
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
      const { user, reviewRow } = await setupSessionRows();

      await user.tab();
      await user.tab();
      await user.tab();

      expect(reviewRow).toHaveFocus();
      const card = await screen.findByLabelText(`${reviewName} session details`);
      expect(within(card).getByText(reviewName)).toBeInTheDocument();
      expect(within(card).getByText('Review session')).toBeInTheDocument();
      expect(within(card).getByText('Ada Lovelace')).toBeInTheDocument();
      expect(within(card).getByText('Review: PR #99')).toBeInTheDocument();
      expect(within(card).getByText('Fix authentication refresh handling')).toBeInTheDocument();
      expect(within(card).getByText('factory/pr-99-authentication-refresh')).toBeInTheDocument();
      expect(within(card).getByText('main')).toBeInTheDocument();
      expect(within(card).getByText('just now')).toBeInTheDocument();
      expect(reviewRow).not.toHaveAttribute('title');
    });

    it('closes the details when focus moves away', async () => {
      const { user, reviewRow } = await setupSessionRows();
      await user.tab();
      await user.tab();
      await user.tab();
      expect(reviewRow).toHaveFocus();
      expect(await screen.findByLabelText(`${reviewName} session details`)).toBeInTheDocument();

      await user.tab();

      await waitFor(() => expect(screen.queryByLabelText(`${reviewName} session details`)).not.toBeInTheDocument());
    });
  });

  describe('when session actions are used', () => {
    it('opens the delete menu independently from the details trigger', async () => {
      const { user } = await setupSessionRows();
      const actions = screen.getByRole('button', { name: `Session actions for ${reviewName}` });

      await user.click(actions);

      expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });
  });
});
