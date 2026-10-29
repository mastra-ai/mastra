import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../../api/types';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import {
  closeSessionProperties,
  groupSessionsByBoard,
  openNestedSessionProperty,
  openSessionProperties,
  openSessionProperty,
  pickSessionProperty,
  sessionPropertiesTrigger,
} from './fixtures/sessionProperties';
import { stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';

function session(sessionId: string, title: string, branch: string, age: 'old' | 'new'): FactoryUserSession {
  const createdAt = age === 'old' ? '2026-09-04T08:00:00.000Z' : '2026-09-04T10:00:00.000Z';
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
    materializedAt: age === 'old' ? null : '2026-09-04T10:00:00.000Z',
    createdAt,
    updatedAt: createdAt,
  };
}

const releaseOld = session('release-old', 'Release old', 'factory/issue-21', 'old');
const releaseNew = session('release-new', 'Release new', 'factory/issue-22', 'new');
const sessions = [
  session('work-old', 'Work old', 'factory/issue-1', 'old'),
  session('work-new', 'Work new', 'factory/issue-2', 'new'),
  session('review-old', 'Review old', 'factory/pr-11', 'old'),
  session('review-new', 'Review new', 'factory/pr-12', 'new'),
  releaseOld,
  releaseNew,
  session('user-old', 'User old', 'user/old', 'old'),
  session('user-new', 'User new', 'user/new', 'new'),
];

const releaseItem = {
  id: 'release-item',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: factoryId,
  board: 'release',
  externalSource: null,
  parentWorkItemId: null,
  title: 'Ship 1.0',
  stages: ['preparing'],
  stageHistory: [],
  sessions: Object.fromEntries(
    [releaseOld, releaseNew].map(release => [
      release.sessionId,
      { sessionId: release.sessionId, branch: release.branch, threadId: release.sessionId, startedBy: 'user-1' },
    ]),
  ),
  metadata: {},
  revision: 1,
  createdAt: '2026-09-04T08:00:00.000Z',
  updatedAt: '2026-09-04T10:00:00.000Z',
};

beforeEach(() => {
  groupSessionsByBoard();
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, () =>
      HttpResponse.json({ boards: [...builtinBoardCatalog.boards, releaseBoard] } satisfies BoardCatalogResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({ workItems: [releaseItem] }),
    ),
  );
});

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}`]}>
      <ChatSessionContext.Provider value={testChatSession(factoryId, projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

const groupRegions = () =>
  within(screen.getByRole('region', { name: 'Sessions' }))
    .queryAllByRole('region')
    .map(region => region.getAttribute('aria-label'));

const rowNamesIn = (groupLabel: string) =>
  within(screen.getByRole('region', { name: groupLabel }))
    .getAllByRole('link', { name: /^\w+ (old|new)$/ })
    .map(row => row.getAttribute('aria-label'));

describe('Sessions sidebar groups', () => {
  it('groups sessions by board: Work, Review, custom boards, then User', async () => {
    renderSection();

    await screen.findByRole('link', { name: 'Release old' });
    expect(groupRegions()).toEqual(['Work sessions', 'Review sessions', 'Release Preview sessions', 'User sessions']);
    expect(rowNamesIn('Release Preview sessions')).toEqual(['Release old', 'Release new']);
  });

  it('applies one sort to every group', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });
    expect(rowNamesIn('Work sessions')).toEqual(['Work old', 'Work new']);
    expect(rowNamesIn('Review sessions')).toEqual(['Review old', 'Review new']);
    expect(rowNamesIn('Release Preview sessions')).toEqual(['Release old', 'Release new']);
    expect(rowNamesIn('User sessions')).toEqual(['User old', 'User new']);

    await pickSessionProperty(user, 'Sort', 'Last created');

    await waitFor(() => expect(rowNamesIn('Work sessions')).toEqual(['Work new', 'Work old']));
    expect(rowNamesIn('Review sessions')).toEqual(['Review new', 'Review old']);
    expect(rowNamesIn('Release Preview sessions')).toEqual(['Release new', 'Release old']);
    expect(rowNamesIn('User sessions')).toEqual(['User new', 'User old']);
  });

  it('regroups the list by status and remembers the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSection();
    await screen.findByRole('link', { name: 'Release old' });

    await openNestedSessionProperty(user, 'Group', 'Group by');
    await user.click(await screen.findByRole('menuitemradio', { name: 'Status' }));
    await closeSessionProperties(user);

    await waitFor(() => expect(groupRegions()).toEqual(['Initializing sessions', 'Idle sessions']));
    expect(rowNamesIn('Idle sessions').toSorted()).toEqual(['Release new', 'Review new', 'User new', 'Work new']);
    expect(sessionPropertiesTrigger(1)).toBeInTheDocument();

    unmount();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });

    expect(groupRegions()).toEqual(['Initializing sessions', 'Idle sessions']);
  });

  it('drops the headers when grouping is None', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });

    await openNestedSessionProperty(user, 'Group', 'Group by');
    await user.click(await screen.findByRole('menuitemradio', { name: 'None' }));
    await closeSessionProperties(user);

    await waitFor(() => expect(groupRegions()).toEqual(['All sessions']));
    expect(screen.queryByText('Work')).toBeNull();
  });

  it('hides a group from the menu until reset', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });

    await openSessionProperty(user, 'Group');
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Review' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Review' })).not.toBeChecked();
    await closeSessionProperties(user);

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Review sessions' })).toBeNull());
    expect(groupRegions()).toEqual(['Work sessions', 'Release Preview sessions', 'User sessions']);
    expect(sessionPropertiesTrigger(2)).toBeInTheDocument();

    await openSessionProperties(user);
    await user.click(screen.getByRole('menuitem', { name: 'Reset to default' }));

    await waitFor(() => expect(groupRegions()).toEqual(['All sessions']));
    expect(sessionPropertiesTrigger()).toBeInTheDocument();
  });

  it('says so when every group that has sessions is hidden', async () => {
    localStorage.setItem(
      'mastracode.sessionListView',
      JSON.stringify({ groupBy: 'status', hiddenGroups: { status: ['status:initializing', 'status:idle'] } }),
    );
    renderSection();

    expect(await screen.findByRole('status')).toHaveTextContent('All groups with sessions are hidden');
    expect(groupRegions()).toEqual([]);
  });

  it('offers Reset for groups hidden under another grouping', async () => {
    localStorage.setItem('mastracode.sessionListView', JSON.stringify({ hiddenGroups: { status: ['status:idle'] } }));
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });
    expect(sessionPropertiesTrigger(1)).toBeInTheDocument();

    await openSessionProperties(user);
    await user.click(screen.getByRole('menuitem', { name: 'Reset to default' }));

    await waitFor(() => expect(sessionPropertiesTrigger()).toBeInTheDocument());
  });

  it("lists sessions in a custom board's terminal phase under Done", async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
        HttpResponse.json({ workItems: [{ ...releaseItem, stages: ['shipped'] }] }),
      ),
    );
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });

    await pickSessionProperty(user, 'Status', 'Done');

    await waitFor(() => expect(groupRegions()).toEqual(['Release Preview sessions']));
  });

  it('moves a group with Alt and the arrow keys, keeping focus on it', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });

    await openSessionProperty(user, 'Group');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Work' })).toHaveFocus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Work' })).toHaveFocus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Work' })).toHaveFocus();
    await closeSessionProperties(user);

    expect(groupRegions()).toEqual(['Review sessions', 'Release Preview sessions', 'Work sessions', 'User sessions']);
  });

  it('forgets the group order once the groups are moved back', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Release old' });

    await openSessionProperty(user, 'Group');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await closeSessionProperties(user);

    expect(sessionPropertiesTrigger(1)).toBeInTheDocument();
  });

  it("never lists a custom board's terminal-phase session as Idle while the board catalog loads", async () => {
    let releaseCatalog = () => {};
    const catalogLoaded = new Promise<void>(resolve => (releaseCatalog = resolve));
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
        HttpResponse.json({ workItems: [{ ...releaseItem, stages: ['shipped'] }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/boards`, async () => {
        await catalogLoaded;
        return HttpResponse.json({
          boards: [...builtinBoardCatalog.boards, releaseBoard],
        } satisfies BoardCatalogResponse);
      }),
    );
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole('link', { name: 'Work old' });

    await pickSessionProperty(user, 'Status', 'Idle');

    expect(screen.queryByRole('link', { name: 'Release new' })).not.toBeInTheDocument();
    releaseCatalog();
  });
});
