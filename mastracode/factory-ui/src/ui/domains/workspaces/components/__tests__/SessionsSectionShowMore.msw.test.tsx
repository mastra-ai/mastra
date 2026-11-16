import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';

import { isStubbedProjectRead } from '../../../../../../e2e/ui/board-reads';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { SessionRowWire } from '../../../../../api/types';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';
import type { FactoryUserSession } from '../../services/user-sessions';
import { presentSessionRow } from '../../services/sessionRows';
import { SessionGroupList } from '../SessionGroupList';
import { SessionsSection } from '../SessionsSection';
import { groupSessionsByBoard, pickSessionProperty } from './fixtures/sessionProperties';

const projectRepositoryId = 'ghp-1';

function listedRow(index: number): SessionRowWire {
  const { id, sessionId, userId, branch, createdAt } = reviewSession(index);
  return {
    session: { id, sessionId, projectRepositoryId, userId, branch, title: null, visibility: 'org', createdAt },
    origin: 'user',
    status: 'idle',
    pinned: false,
    updatedAt: createdAt,
  };
}

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

function appReads(): URL[] {
  const reads: URL[] = [];
  const record = ({ request }: { request: Request }) => {
    if (!isStubbedProjectRead(request)) reads.push(new URL(request.url));
  };
  server.events.on('request:start', record);
  onTestFinished(() => server.events.removeListener('request:start', record));
  return reads;
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
    const links = () => within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ });
    expect(await within(group).findAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5);
    expect(within(group).queryByRole('link', { name: 'factory/pr-20001' })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show 3 more' }));
    await waitFor(() => expect(links()).toHaveLength(8));
    expect(within(group).getByRole('link', { name: 'factory/pr-20001' })).toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    await waitFor(() => expect(links()).toHaveLength(5));
  });

  it('reveals at most 20 more sessions per click and can collapse before reaching the end', async () => {
    stubSessions(Array.from({ length: 68 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    const links = () => within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ });
    await waitFor(() => expect(links()).toHaveLength(5));

    await user.click(within(group).getByRole('button', { name: /Show \d+ more/ }));
    await waitFor(() => expect(links()).toHaveLength(25));
    expect(within(group).queryByRole('link', { name: 'factory/pr-20001' })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    await waitFor(() => expect(links()).toHaveLength(5));

    for (const shown of [25, 45, 65]) {
      await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
      await waitFor(() => expect(links()).toHaveLength(shown));
    }
    await user.click(within(group).getByRole('button', { name: 'Show 3 more' }));
    await waitFor(() => expect(links()).toHaveLength(68));
    expect(within(group).queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    await waitFor(() => expect(links()).toHaveLength(5));
  });

  it('opens another factory with its groups at their first 5 sessions', async () => {
    stubSessions(Array.from({ length: 30 }, (_, index) => reviewSession(index + 1)));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-2/work-items`, () => HttpResponse.json({ items: [] })),
    );
    stubSessionsFactory('fp-1', [projectRepositoryId]);
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/factories/fp-1']}>
        <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
          <Link to="/factories/fp-2">Other factory</Link>
          <Routes>
            <Route path="/factories/:factoryId" element={<SessionsSection />} />
          </Routes>
        </ChatSessionContext.Provider>
      </MemoryRouter>,
    );
    const links = async () =>
      within(await screen.findByRole('region', { name: 'Work sessions' })).getAllByRole('link', {
        name: /^factory\/pr-200\d+$/,
      });
    await waitFor(async () => expect(await links()).toHaveLength(5));
    await user.click(screen.getByRole('button', { name: 'Show 20 more' }));
    await waitFor(async () => expect(await links()).toHaveLength(25));

    await user.click(screen.getByRole('link', { name: 'Other factory' }));

    await waitFor(async () => expect(await links()).toHaveLength(5));
  });

  it('asks the server for 20 more rows of the group, and lists the ones it sends', async () => {
    stubSessions(Array.from({ length: 30 }, (_, index) => reviewSession(index + 1)));
    const reads = appReads();
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    expect(await within(group).findAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5);
    expect(within(group).queryByRole('link', { name: 'factory/pr-20010' })).not.toBeInTheDocument();

    await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));

    expect(await within(group).findByRole('link', { name: 'factory/pr-20010' })).toBeInTheDocument();
    const rowReads = reads.filter(url => url.pathname.endsWith('/session-rows'));
    expect(rowReads.at(-1)?.searchParams.getAll('window')).toEqual(['board:work:25']);
  });

  it('reads the sidebar from its rows alone, never the whole session and card lists', async () => {
    stubSessions(Array.from({ length: 8 }, (_, index) => reviewSession(index + 1)));
    const reads = appReads();

    renderSection('sess-1');

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    expect(await within(group).findByRole('link', { name: 'factory/pr-20001' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const wholeListReads = reads.filter(
      url =>
        url.pathname.endsWith('/sessions') ||
        (url.pathname.endsWith('/work-items') && url.searchParams.get('scope') === 'sessions'),
    );
    expect(wholeListReads).toEqual([]);
  });

  it('filters every session, not only the ones shown so far', async () => {
    // The oldest session lists last: three "Show more" clicks away from the five shown.
    const [oldest, ...newer] = Array.from({ length: 68 }, (_, index) => reviewSession(index + 1));
    stubSessions([{ ...oldest, userId: 'user-grace', owner: { id: 'user-grace', name: 'Grace Hopper' } }, ...newer]);
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    expect(await within(group).findAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5);
    expect(within(group).queryByRole('link', { name: 'factory/pr-20001' })).not.toBeInTheDocument();

    await pickSessionProperty(user, 'Owner', 'Grace Hopper');

    expect(await screen.findByRole('link', { name: 'factory/pr-20001' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(1);
  });

  it.each([1, 30])(
    'keeps open session %i visible across batches and after collapsing without duplicating it',
    async index => {
      stubSessions(Array.from({ length: 48 }, (_, index) => reviewSession(index + 1)));
      const user = userEvent.setup();

      renderSection(`sess-${index}`);

      const group = await screen.findByRole('region', { name: 'Work sessions' });
      const links = () => within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ });
      await waitFor(() => expect(links()).toHaveLength(6));
      const activeName = `factory/pr-${20000 + index}`;
      expect(within(group).getByRole('link', { name: activeName })).toHaveAttribute('aria-current', 'page');

      await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
      await waitFor(() => expect(links()).toHaveLength(26));
      await user.click(within(group).getByRole('button', { name: 'Show 20 more' }));
      await waitFor(() => expect(links()).toHaveLength(46));
      await user.click(within(group).getByRole('button', { name: 'Show 2 more' }));
      await waitFor(() => expect(links()).toHaveLength(48));

      await user.click(within(group).getByRole('button', { name: 'Show less' }));
      await waitFor(() => expect(links()).toHaveLength(6));
      expect(within(group).getByRole('link', { name: activeName })).toHaveAttribute('aria-current', 'page');
    },
  );

  it('keeps keyboard focus on a toggle when the pressed one disappears', async () => {
    stubSessions(Array.from({ length: 28 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    const showMore = await within(group).findByRole('button', { name: 'Show 20 more' });
    expect(showMore).not.toHaveAttribute('aria-expanded');
    showMore.focus();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(within(group).getByRole('button', { name: 'Show 3 more' })).toHaveFocus());

    await user.keyboard('{Enter}');
    await waitFor(() => expect(within(group).getByRole('button', { name: 'Show less' })).toHaveFocus());
    expect(within(group).getByRole('button', { name: 'Show less' })).not.toHaveAttribute('aria-expanded');

    await user.keyboard('{Enter}');
    await waitFor(() => expect(within(group).getByRole('button', { name: 'Show 20 more' })).toHaveFocus());
  });

  it('keeps the sessions it shows when reading more fails, and shows the rest on retry', async () => {
    stubSessions(Array.from({ length: 8 }, (_, index) => reviewSession(index + 1)));
    let deeperReadsFail = true;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/session-rows`, ({ request }) =>
        deeperReadsFail && new URL(request.url).searchParams.has('window')
          ? HttpResponse.json({ error: 'Service unavailable' }, { status: 503 })
          : undefined,
      ),
    );
    const user = userEvent.setup();

    renderSection();

    const group = () => screen.getByRole('region', { name: 'Work sessions' });
    const links = () => within(group()).getAllByRole('link', { name: /^factory\/pr-200\d+$/ });
    await waitFor(() => expect(links()).toHaveLength(5));

    await user.click(within(group()).getByRole('button', { name: 'Show 3 more' }));
    expect(await screen.findByText('Couldn’t load sessions')).toBeInTheDocument();
    expect(links()).toHaveLength(5);

    deeperReadsFail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(links()).toHaveLength(8));
    expect(screen.queryByText('Couldn’t load sessions')).not.toBeInTheDocument();
  });

  it('keeps a pinned session visible and persists the pin', async () => {
    stubSessions(Array.from({ length: 8 }, (_, index) => reviewSession(index + 1)));
    const user = userEvent.setup();

    const rendered = renderSection();
    const group = await screen.findByRole('region', { name: 'Work sessions' });
    await user.click(await within(group).findByRole('button', { name: 'Show 3 more' }));
    await user.click(await within(group).findByRole('button', { name: 'Session actions for factory/pr-20001' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pin session' }));

    expect(await within(group).findByLabelText('factory/pr-20001 pinned')).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Show less' }));
    await waitFor(() => expect(within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(5));
    expect(within(group).getAllByRole('link', { name: /^factory\/pr-200\d+$/ })[0]).toHaveAccessibleName(
      'factory/pr-20001',
    );
    await waitForMutationsIdle(rendered.client);

    rendered.unmount();
    renderSection();
    const remountedGroup = await screen.findByRole('region', { name: 'Work sessions' });
    expect(await within(remountedGroup).findByRole('link', { name: 'factory/pr-20001' })).toBeInTheDocument();
    expect(within(remountedGroup).getByLabelText('factory/pr-20001 pinned')).toBeInTheDocument();

    await user.click(within(remountedGroup).getByRole('button', { name: 'Session actions for factory/pr-20001' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));
    await waitFor(() =>
      expect(within(remountedGroup).queryByRole('link', { name: 'factory/pr-20001' })).not.toBeInTheDocument(),
    );
  });

  it('shows no toggle when a group fits within the cap', async () => {
    stubSessions(Array.from({ length: 3 }, (_, index) => reviewSession(index + 1)));

    renderSection();

    const group = await screen.findByRole('region', { name: 'Work sessions' });
    expect(await within(group).findAllByRole('link', { name: /^factory\/pr-200\d+$/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });

  it.each([
    { listed: 485, offered: 'Show 15 more' },
    { listed: 500, offered: undefined },
  ])('offers no more than the 500 sessions the server lists per group, at $listed listed', ({ listed, offered }) => {
    const rows = Array.from({ length: listed }, (_, index) =>
      presentSessionRow(listedRow(index + 1), {
        factoryId: 'fp-1',
        openSessionId: undefined,
        viewer: undefined,
        repositories: undefined,
      }),
    );

    renderWithProviders(
      <SessionGroupList
        group={{ key: 'board:work', label: 'Work', icon: 'board', total: 600, rows }}
        showHeader
        renderRow={row => <li>{row.name}</li>}
        onShowMore={() => {}}
        onShowLess={() => {}}
      />,
    );

    const group = screen.getByRole('region', { name: 'Work sessions' });
    expect(within(group).queryByRole('button', { name: /Show \d+ more/ })?.textContent).toBe(offered);
    expect(within(group).getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
});
