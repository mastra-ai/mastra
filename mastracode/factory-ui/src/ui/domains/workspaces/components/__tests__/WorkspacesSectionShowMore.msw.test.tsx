/**
 * BDD coverage for the sidebar session groups: each group shows the latest 5
 * sessions with a "Show N more" toggle that expands to the full list. Before
 * this, sessions past the cap were silently hidden — users with many review
 * sessions couldn't reach them from the sidebar at all.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspacesSection } from '../WorkspacesSection';

const projectRepositoryId = 'ghp-1';

function reviewSession(index: number): FactoryUserSession {
  const createdAt = `2026-07-23T00:00:${String(index).padStart(2, '0')}.000Z`;
  return {
    id: `row-${index}`,
    sessionId: `sess-${index}`,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org' as const,
    branch: `factory/pr-${20000 + index}`,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function stubSessions(sessions: FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ items: [] })),
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

describe('Workspaces sidebar show more', () => {
  beforeEach(() => {
    localStorage.removeItem('mastracode.pinnedSessions');
  });

  it('caps a group at 5 sessions and expands to the full list on demand', async () => {
    stubSessions(Array.from({ length: 8 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Review Sessions' });
    expect(await within(group).findAllByRole('button', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5);
    expect(within(group).queryByRole('button', { name: 'factory/pr-20001' })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show 3 more' }));
    expect(within(group).getAllByRole('button', { name: /^factory\/pr-200\d+$/ })).toHaveLength(8);
    expect(within(group).getByRole('button', { name: 'factory/pr-20001' })).toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    expect(within(group).getAllByRole('button', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5);
  });

  it('keeps a pinned session visible and persists the pin', async () => {
    stubSessions(Array.from({ length: 8 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);
    const group = screen.getByRole('region', { name: 'Review Sessions' });
    await user.click(within(group).getByRole('button', { name: 'Show 3 more' }));
    await user.click(within(group).getByRole('button', { name: 'Session actions for factory/pr-20001' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pin session' }));

    expect(within(group).getByLabelText('factory/pr-20001 pinned')).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    expect(within(group).getAllByRole('button', { name: /^factory\/pr-200\d+$/ })[0]).toHaveAccessibleName(
      'factory/pr-20001',
    );

    rendered.unmount();
    renderSection();
    const remountedGroup = await screen.findByRole('region', { name: 'Review Sessions' });
    expect(within(remountedGroup).getByRole('button', { name: 'factory/pr-20001' })).toBeInTheDocument();
    expect(within(remountedGroup).getByLabelText('factory/pr-20001 pinned')).toBeInTheDocument();

    await user.click(within(remountedGroup).getByRole('button', { name: 'Session actions for factory/pr-20001' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));
    expect(within(remountedGroup).queryByRole('button', { name: 'factory/pr-20001' })).not.toBeInTheDocument();
  });

  it('shows no toggle when a group fits within the cap', async () => {
    stubSessions(Array.from({ length: 3 }, (_, index) => reviewSession(index + 1)));

    renderSection();

    const group = await screen.findByRole('region', { name: 'Review Sessions' });
    expect(await within(group).findAllByRole('button', { name: /^factory\/pr-200\d+$/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });
});
