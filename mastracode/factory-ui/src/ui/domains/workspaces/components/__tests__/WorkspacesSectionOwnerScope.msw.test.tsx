/**
 * BDD coverage for the sidebar's owner scope: the work and review session lists open on the
 * viewer's own sessions, and each heading carries one icon that widens its list to every session
 * in the org and back again. Before this, a busy factory rendered everyone's sessions as one
 * undifferentiated list, and the reader had no way to cut it down to their own work.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspacesSection } from '../WorkspacesSection';

const projectRepositoryId = 'ghp-1';
const viewerUserId = 'user-me';

function session(index: number, userId: string, branch: string): FactoryUserSession {
  const createdAt = `2026-07-23T00:00:${String(index).padStart(2, '0')}.000Z`;
  return {
    id: `row-${index}`,
    sessionId: `sess-${index}`,
    projectRepositoryId,
    orgId: 'org-1',
    userId,
    owner: { id: userId, name: userId },
    visibility: 'org',
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

/** A `factory/pr-<n>` branch reads as a review session while no work item claims it. */
const reviewSession = (index: number, userId: string) => session(index, userId, `factory/pr-${20000 + index}`);
const workSession = (index: number, userId: string) => session(index, userId, `factory/issue-${20000 + index}`);

function stubSessions(sessions: FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/source-control/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ workItems: [] })),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <ChatSessionContext.Provider
        value={{
          resourceId: 'resource-1',
          sessionEnabled: false,
          resourceReady: false,
          sandboxReady: false,
          sandboxPreparing: false,
          resourceEnabled: false,
          factorySessionState: { factoryProjectId: 'fp-1', projectRepositoryId },
          baseUrl: TEST_BASE_URL,
          kind: 'factory',
        }}
      >
        <Routes>
          <Route path="/factories/:factoryId" element={<WorkspacesSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Workspaces sidebar owner scope', () => {
  beforeEach(() => {
    localStorage.removeItem('mastracode.pinnedSessions');
    window.__MASTRACODE_CONFIG__ = { authEnabled: true };
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authEnabled: true,
          authenticated: true,
          user: { userId: viewerUserId, name: 'Romain', email: 'romain@example.com' },
        }),
      ),
    );
  });

  afterEach(() => {
    delete window.__MASTRACODE_CONFIG__;
  });

  it('opens each sessions group on the viewer and widens it to everyone and back', async () => {
    stubSessions([reviewSession(1, viewerUserId), reviewSession(2, 'user-grace')]);
    const user = userEvent.setup();

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);

    const group = await screen.findByRole('region', { name: 'Review Sessions' });
    expect(await within(group).findByRole('button', { name: 'factory/pr-20001' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'factory/pr-20002' })).not.toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Show all review sessions' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(group).getByRole('button', { name: 'Show all review sessions' }));

    expect(await within(group).findByRole('button', { name: 'factory/pr-20002' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'factory/pr-20001' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Show only my review sessions' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(within(group).getByRole('button', { name: 'Show only my review sessions' }));

    await waitFor(() => {
      expect(within(group).queryByRole('button', { name: 'factory/pr-20002' })).not.toBeInTheDocument();
    });
    expect(within(group).getByRole('button', { name: 'factory/pr-20001' })).toBeInTheDocument();
  });

  it('keeps the heading and its toggle when the viewer owns nothing in the group', async () => {
    stubSessions([reviewSession(1, 'user-grace')]);
    const user = userEvent.setup();

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);

    const group = await screen.findByRole('region', { name: 'Review Sessions' });
    expect(await within(group).findByText('No sessions of your own.')).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'factory/pr-20001' })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show all review sessions' }));

    expect(await within(group).findByRole('button', { name: 'factory/pr-20001' })).toBeInTheDocument();
    expect(within(group).queryByText('No sessions of your own.')).not.toBeInTheDocument();
  });

  it('scopes each sessions group on its own', async () => {
    stubSessions([
      reviewSession(1, viewerUserId),
      reviewSession(2, 'user-grace'),
      workSession(3, viewerUserId),
      workSession(4, 'user-grace'),
    ]);
    const user = userEvent.setup();

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);

    const review = await screen.findByRole('region', { name: 'Review Sessions' });
    const work = await screen.findByRole('region', { name: 'Work Sessions' });
    expect(await within(work).findByRole('button', { name: 'factory/issue-20003' })).toBeInTheDocument();
    expect(within(work).queryByRole('button', { name: 'factory/issue-20004' })).not.toBeInTheDocument();

    await user.click(within(work).getByRole('button', { name: 'Show all work sessions' }));

    expect(await within(work).findByRole('button', { name: 'factory/issue-20004' })).toBeInTheDocument();
    expect(within(review).queryByRole('button', { name: 'factory/pr-20002' })).not.toBeInTheDocument();
    expect(within(review).getByRole('button', { name: 'Show all review sessions' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
