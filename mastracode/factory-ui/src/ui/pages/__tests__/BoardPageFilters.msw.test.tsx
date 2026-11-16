import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../../e2e/ui/factory-projects';
import { server } from '../../../../e2e/ui/msw-server';
import {
  closePropertiesMenus,
  openPropertiesMenu,
  openPropertySubmenu,
  togglePropertyOption,
} from '../../../../e2e/ui/properties-menu';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { PULL_REQUEST_SOURCE_FILTER } from '@mastra/factory/work-items/card-source-filters';
import type { WorkItem } from '../../domains/factory/services/workItems';
import { FactoryLayout } from '../../domains/workspaces/components/FactoryLayout';
import { OverlaysProvider } from '../../lib/overlays';
import { WorkBoardPage } from '../BoardPage';

const now = '2026-09-01T12:00:00.000Z';
const workItem = (id: string, card: 'issue' | 'pull-request', metadata: Record<string, unknown>): WorkItem => ({
  id,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: 'factory-1',
  board: 'work',
  source: card === 'pull-request' ? 'github-pr' : 'github-issue',
  sourceKey: `github:${id}`,
  parentWorkItemId: null,
  title: `Card ${id}`,
  url: null,
  stages: [card === 'issue' ? 'planning' : 'intake'],
  stageHistory: [{ stage: card === 'issue' ? 'planning' : 'intake', enteredAt: now, by: 'user-1' }],
  sessions: {},
  metadata,
  triageType: null,
  acceptedAt: null,
  description: null,
  revision: 1,
  createdAt: now,
  updatedAt: now,
});

function Location() {
  const location = useLocation();
  return <output data-testid="board-url">{location.search}</output>;
}

function renderBoard(initialSearch = '', extraWorkItems: WorkItem[] = []) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: 'factory-1',
            name: 'Factory',
            repositories: [listedRepository('repo-1', 'acme/app', { branch: 'main' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/work-items`, () =>
      HttpResponse.json({
        workItems: [
          workItem('bug', 'issue', { labels: ['bug'], author: 'alice', assignees: ['bob'] }),
          workItem('docs', 'issue', { labels: ['documentation'], author: 'bob' }),
          workItem('both', 'issue', { labels: ['bug', 'documentation'], author: 'alice' }),
          workItem('unlabelled', 'issue', { labels: ['other'], author: 'bob' }),
          workItem('authored', 'pull-request', { author: 'alice', labels: ['needs-review'] }),
          workItem('requested', 'pull-request', { author: 'bob', requestedReviewers: ['alice'] }),
          workItem('unrelated', 'pull-request', { author: 'bob' }),
          ...extraWorkItems,
        ].map(({ githubProjectId, source, sourceKey, url, ...item }) => ({
          ...item,
          factoryProjectId: githubProjectId,
          externalSource: {
            integrationId: 'github',
            type: source === 'github-pr' ? 'pull-request' : 'issue',
            externalId: sourceKey,
            url,
          },
        })),
        runningSessionIds: [],
        parkedSessionIds: [],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ config: { github: { enabled: true, sourceIds: ['acme/app'] } } }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ connected: false })),
    http.get(`${TEST_BASE_URL}/web/incidentio/status`, () => HttpResponse.json({ connected: false })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions: [] })),
  );
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/factory-1/work${initialSearch}`]}>
      <SidebarProvider storageKey="board-filters-test" mobileBreakpoint={0}>
        <OverlaysProvider>
          <Location />
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryLayout />}>
              <Route path="work" element={<WorkBoardPage />} />
            </Route>
          </Routes>
        </OverlaysProvider>
      </SidebarProvider>
    </MemoryRouter>,
  );
}

const MENU = 'Board properties';

describe('BoardPage filters', () => {
  it('offers pull request labels on Work filtered to pull requests and filters pull request cards by them', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard(`?source=${PULL_REQUEST_SOURCE_FILTER}`);
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(screen.getByText('Card requested')).toBeInTheDocument();
    await togglePropertyOption(user, MENU, 'Label', /^needs-review$/);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('label=needs-review'));
    expect(screen.getByText('Card authored')).toBeInTheDocument();
    expect(screen.queryByText('Card requested')).not.toBeInTheDocument();
    expect(screen.queryByText('Card unrelated')).not.toBeInTheDocument();
  });

  it('requires every selected label on work cards, then restores cards when removed', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard();
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await togglePropertyOption(user, MENU, 'Label', /^bug$/);
    await togglePropertyOption(user, MENU, 'Label', /^documentation$/);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('label=bug'));
    expect(screen.getByTestId('board-url')).toHaveTextContent('label=documentation');
    expect(screen.getByText('Card both')).toBeInTheDocument();
    expect(screen.queryByText('Card bug')).not.toBeInTheDocument();
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Card unlabelled')).not.toBeInTheDocument();
    await togglePropertyOption(user, MENU, 'Label', /^bug$/);
    await togglePropertyOption(user, MENU, 'Label', /^documentation$/);
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('label=');
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    expect(screen.getByText('Card docs')).toBeInTheDocument();
    expect(screen.getByText('Card unlabelled')).toBeInTheDocument();
  });

  it('combines person and label filters on work items and survives a URL reload', async () => {
    const user = userEvent.setup();
    const { client, unmount } = renderBoard();
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(screen.getByText('Card docs')).toBeInTheDocument();
    await togglePropertyOption(user, MENU, 'Author', /alice/i);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('author=github%3Aalice'));
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Card docs')).not.toBeInTheDocument());
    await togglePropertyOption(user, MENU, 'Label', /^bug$/);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('label=bug'));
    expect(screen.getByText('Card both')).toBeInTheDocument();
    expect(screen.queryByText('Card unlabelled')).not.toBeInTheDocument();
    const search = screen.getByTestId('board-url').textContent ?? '';
    unmount();
    renderBoard(search);
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    expect(screen.getByText('Card both')).toBeInTheDocument();
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Card unlabelled')).not.toBeInTheDocument();
    await togglePropertyOption(user, MENU, 'Author', /alice/i);
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('author=');
    expect(screen.getByTestId('board-url')).toHaveTextContent('label=bug');
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
  });

  it('keeps only work cards authored by one person and assigned to another', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard();
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await togglePropertyOption(user, MENU, 'Author', /alice/i);
    await waitFor(() => expect(screen.queryByText('Card docs')).not.toBeInTheDocument());
    expect(screen.getByText('Card both')).toBeInTheDocument();
    await togglePropertyOption(user, MENU, 'Assignee', /bob/i);
    await waitFor(() => expect(screen.queryByText('Card both')).not.toBeInTheDocument());
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    // Work holds pull request cards too, so it filters by who review was requested from.
    await openPropertiesMenu(user, MENU);
    expect(screen.getByRole('menuitem', { name: /^Review requested/ })).toBeInTheDocument();
    await closePropertiesMenus(user);
  });

  it('keeps only pull request cards authored by one person with review requested from another', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard(`?source=${PULL_REQUEST_SOURCE_FILTER}`);
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await togglePropertyOption(user, MENU, 'Involves', /alice/i);
    await waitFor(() => expect(screen.queryByText('Card unrelated')).not.toBeInTheDocument());
    expect(screen.getByText('Card authored')).toBeInTheDocument();
    expect(screen.getByText('Card requested')).toBeInTheDocument();
    await togglePropertyOption(user, MENU, 'Involves', /alice/i);
    await togglePropertyOption(user, MENU, 'Author', /bob/i);
    await togglePropertyOption(user, MENU, 'Review requested', /alice/i);
    await waitFor(() => expect(screen.queryByText('Card unrelated')).not.toBeInTheDocument());
    expect(screen.getByTestId('board-url')).toHaveTextContent('author=github%3Abob&reviewer=github%3Aalice');
    expect(screen.getByText('Card requested')).toBeInTheDocument();
    expect(screen.queryByText('Card authored')).not.toBeInTheDocument();
  });

  it('lists you first and matches your cards through your GitHub login', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-alice', name: 'Alice' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: true,
          installations: [],
          userConnected: true,
          userGithubUsername: 'Alice',
        }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderBoard(`?source=${PULL_REQUEST_SOURCE_FILTER}&teammate=github%3Aalice`);
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await openPropertySubmenu(user, MENU, 'Involves');
    expect(screen.getByRole('menuitem', { name: /^Involves\s*You$/ })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemcheckbox').map(option => option.textContent)).toEqual(['You', 'bob']);
    await user.click(screen.getByRole('menuitemcheckbox', { name: /You$/ }));
    await closePropertiesMenus(user);
    await waitFor(() => expect(screen.getByText('Card unrelated')).toBeInTheDocument());
    await togglePropertyOption(user, MENU, 'Author', /You$/);
    await waitFor(() =>
      expect(screen.getByTestId('board-url')).toHaveTextContent('author=factory%3Auser-alice&author=github%3Aalice'),
    );
    expect(screen.getByText('Card authored')).toBeInTheDocument();
    expect(screen.queryByText('Card requested')).not.toBeInTheDocument();
    expect(screen.queryByText('Card unrelated')).not.toBeInTheDocument();
  });

  it('searches a long list of people and keeps picked people on top', async () => {
    const authors = ['carol', 'dave', 'erin', 'frank', 'grace', 'heidi', 'ivan', 'judy'];
    const user = userEvent.setup();
    const { client } = renderBoard(
      '?author=github%3Ajudy',
      authors.map(author => workItem(author, 'issue', { author })),
    );
    expect(await screen.findByText('Card judy')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(screen.queryByText('Card erin')).not.toBeInTheDocument();
    expect(screen.queryByText('Card bug')).not.toBeInTheDocument();
    await openPropertySubmenu(user, MENU, 'Author');
    expect(screen.getAllByRole('menuitemcheckbox')[0]).toHaveTextContent('judy');
    await user.keyboard('ER');
    expect(screen.getByRole('textbox', { name: 'Search author' })).toHaveValue('ER');
    expect(screen.getAllByRole('menuitemcheckbox').map(option => option.textContent)).toEqual(['erin']);
    await user.keyboard('{ArrowDown} ');
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('github%3Aerin'));
    expect(screen.getByRole('menuitemcheckbox', { name: /erin$/ })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('zz');
    expect(screen.queryAllByRole('menuitemcheckbox')).toEqual([]);
    expect(screen.getByText('No matches')).toBeInTheDocument();
    // Reopen just this submenu, leaving the properties menu mounted.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(1));
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('textbox', { name: 'Search author' })).toHaveValue('');
    expect(
      screen
        .getAllByRole('menuitemcheckbox')
        .slice(0, 2)
        .map(option => option.textContent),
    ).toEqual(expect.arrayContaining(['erin', 'judy']));
    await closePropertiesMenus(user);
    await openPropertySubmenu(user, MENU, 'Author');
    expect(screen.getByRole('textbox', { name: 'Search author' })).toHaveValue('');
    await closePropertiesMenus(user);
  });

  it('resets every filter and the sort in one step', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard('?label=bug&sort=created-newest');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    const trigger = screen.getByRole('button', { name: 'Board properties, 2 changed' });
    expect(trigger).toHaveTextContent('2');
    await user.hover(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Sort:');
    expect(tooltip).toHaveTextContent('Label: bug');
    await user.unhover(trigger);
    await openPropertiesMenu(user, MENU);
    await user.click(screen.getByRole('menuitem', { name: 'Reset to default' }));
    await waitFor(() => expect(screen.getByTestId('board-url')).not.toHaveTextContent('label='));
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('sort=');
    await closePropertiesMenus(user);
    expect(screen.getByRole('button', { name: 'Board properties' })).toBeInTheDocument();
  });

  it('labels a multi-pick with its count', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard();
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await togglePropertyOption(user, MENU, 'Label', /^bug$/);
    await togglePropertyOption(user, MENU, 'Label', /^documentation$/);
    await openPropertiesMenu(user, MENU);
    expect(screen.getByRole('menuitem', { name: /^Label\s*2 selected$/ })).toBeInTheDocument();
    await closePropertiesMenus(user);
  });
});
