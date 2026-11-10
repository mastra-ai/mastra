import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import { groupSessionsByBoard } from './fixtures/sessionProperties';

const projectRepositoryId = 'ghp-1';

function reviewSession(index: number): FactoryUserSession {
  const createdAt = new Date(Date.parse('2026-07-23T00:00:00.000Z') + index * 1_000).toISOString();
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ items: [] })),
  );
}

function renderSection(sessionId?: string) {
  stubSessionsFactory('fp-1', [projectRepositoryId]);
  return renderWithProviders(
    <MemoryRouter initialEntries={[sessionId ? `/factories/fp-1/workspaces/${sessionId}` : '/factories/fp-1']}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
          <Route path="/factories/:factoryId/workspaces/:sessionId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Sessions sidebar show more', () => {
  beforeEach(() => {
    localStorage.removeItem('mastracode.pinnedSessions');
    groupSessionsByBoard();
  });

  it('caps a group at 5 sessions and reveals a small remainder on demand', async () => {
    stubSessions(Array.from({ length: 8 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    expect(await within(group).findAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5);
    expect(within(group).queryByRole('link', { name: 'factory/pr-20001' })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show 3 more' }));
    expect(within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(8);
    expect(within(group).getByRole('link', { name: 'factory/pr-20001' })).toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    expect(within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5);
  });

  it('reveals at most 20 more sessions per click and can collapse before reaching the end', async () => {
    stubSessions(Array.from({ length: 68 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    const links = () => within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ });
    expect(links()).toHaveLength(5);

    await user.click(within(group).getByRole('button', { name: /Show \d+ more/ }));
    expect(links()).toHaveLength(25);
    expect(within(group).queryByRole('link', { name: 'factory/pr-20001' })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    expect(links()).toHaveLength(5);

    await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
    expect(links()).toHaveLength(25);
    await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
    expect(links()).toHaveLength(45);
    await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
    expect(links()).toHaveLength(65);
    await user.click(within(group).getByRole('button', { name: 'Show 3 more' }));
    expect(links()).toHaveLength(68);
    expect(within(group).queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    expect(links()).toHaveLength(5);
  });

  it.each([1, 30])(
    'keeps open session %i visible across batches and after collapsing without duplicating it',
    async index => {
      stubSessions(Array.from({ length: 48 }, (_, index) => reviewSession(index + 1)));
      const user = userEvent.setup();

      renderSection(`sess-${index}`);

      const group = await screen.findByRole('region', { name: 'Work sessions' });
      const links = () => within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ });
      expect(links()).toHaveLength(6);
      const activeName = `factory/pr-${20000 + index}`;
      expect(within(group).getByRole('link', { name: activeName })).toHaveAttribute('aria-current', 'page');

      await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
      expect(links()).toHaveLength(26);
      await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
      expect(links()).toHaveLength(46);
      await user.click(within(group).getByRole('button', { name: 'Show 2 more' }));
      expect(links()).toHaveLength(48);

      await user.click(within(group).getByRole('button', { name: 'Show less' }));
      expect(links()).toHaveLength(6);
      expect(within(group).getByRole('link', { name: activeName })).toHaveAttribute('aria-current', 'page');
    },
  );

  it('keeps keyboard focus on a toggle when the pressed one disappears', async () => {
    stubSessions(Array.from({ length: 28 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    const showMore = within(group).getByRole('button', { name: 'Show 20 more' });
    expect(showMore).not.toHaveAttribute('aria-expanded');
    showMore.focus();

    await user.keyboard('{Enter}');
    expect(within(group).getByRole('button', { name: 'Show 3 more' })).toHaveFocus();

    await user.keyboard('{Enter}');
    const showLess = within(group).getByRole('button', { name: 'Show less' });
    expect(showLess).toHaveFocus();
    expect(showLess).not.toHaveAttribute('aria-expanded');

    await user.keyboard('{Enter}');
    expect(within(group).getByRole('button', { name: 'Show 20 more' })).toHaveFocus();
  });

  it('keeps a pinned session visible and persists the pin', async () => {
    stubSessions(Array.from({ length: 8 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    const rendered = renderSection();
    await waitForMutationsIdle(rendered.client);
    const group = screen.getByRole('region', { name: 'Work sessions' });
    await user.click(within(group).getByRole('button', { name: 'Show 3 more' }));
    await user.click(within(group).getByRole('button', { name: 'Session actions for factory/pr-20001' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pin session' }));

    expect(within(group).getByLabelText('factory/pr-20001 pinned')).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    expect(within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ })[0]).toHaveAccessibleName(
      'factory/pr-20001',
    );

    rendered.unmount();
    renderSection();
    const remountedGroup = await screen.findByRole('region', { name: 'Work sessions' });
    expect(within(remountedGroup).getByRole('link', { name: 'factory/pr-20001' })).toBeInTheDocument();
    expect(within(remountedGroup).getByLabelText('factory/pr-20001 pinned')).toBeInTheDocument();

    await user.click(within(remountedGroup).getByRole('button', { name: 'Session actions for factory/pr-20001' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));
    expect(within(remountedGroup).queryByRole('link', { name: 'factory/pr-20001' })).not.toBeInTheDocument();
  });

  it('shows no toggle when a group fits within the cap', async () => {
    stubSessions(Array.from({ length: 3 }, (_, index) => reviewSession(index + 1)));

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    expect(await within(group).findAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });
});
