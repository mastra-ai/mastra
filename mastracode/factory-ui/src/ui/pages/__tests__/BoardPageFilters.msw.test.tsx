import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import {
  closePropertiesMenus,
  openPropertiesMenu,
  openPropertySubmenu,
  togglePropertyOption,
} from '../../../../e2e/ui/properties-menu';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { WorkItem } from '../../domains/factory/services/workItems';
import type { GithubIssue, GithubPullRequest } from '../../domains/factory/services/factory';
import { FactoryLayout } from '../../domains/workspaces/components/FactoryLayout';
import { OverlaysProvider } from '../../lib/overlays';
import { ReviewBoardPage, WorkBoardPage } from '../BoardPage';

const now = '2026-09-01T12:00:00.000Z';
const workItem = (id: string, board: 'work' | 'review', metadata: Record<string, unknown>): WorkItem => ({
  id,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: 'factory-1',
  board,
  source: board === 'review' ? 'github-pr' : 'github-issue',
  sourceKey: `github:${id}`,
  parentWorkItemId: null,
  title: `Card ${id}`,
  url: null,
  stages: [board === 'work' ? 'planning' : 'intake'],
  stageHistory: [{ stage: board === 'work' ? 'planning' : 'intake', enteredAt: now, by: 'user-1' }],
  sessions: {},
  metadata,
  triageType: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdAt: now,
  updatedAt: now,
});

const issue = (number: number, labels: string[], author: string): GithubIssue => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/acme/app/issues/${number}`,
  author,
  labels,
  comments: 0,
  createdAt: now,
  updatedAt: now,
});
const pull = (
  number: number,
  author: string,
  requestedReviewers: string[],
  labels: string[] = [],
): GithubPullRequest => ({
  number,
  title: `Pull ${number}`,
  url: `https://github.com/acme/app/pull/${number}`,
  author,
  requestedReviewers,
  labels,
  baseBranch: 'main',
  headBranch: 'feature',
  createdAt: now,
  updatedAt: now,
});

function Location() {
  const location = useLocation();
  return <output data-testid="board-url">{location.search}</output>;
}

function renderBoard(kind: 'work' | 'review', initialSearch = '') {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [{ id: 'factory-1', name: 'Factory' }],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            integrationId: 'github',
            installationId: '1',
            repositories: [
              {
                id: 'repo-1',
                branch: 'main',
                sandboxWorkdir: '',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/work-items`, () =>
      HttpResponse.json({
        workItems: [
          workItem('bug', 'work', { labels: ['bug'], author: 'alice' }),
          workItem('docs', 'work', { labels: ['documentation'], author: 'bob' }),
          workItem('both', 'work', { labels: ['bug', 'documentation'], author: 'alice' }),
          workItem('unlabelled', 'work', { labels: ['other'], author: 'bob' }),
          workItem('authored', 'review', { author: 'alice' }),
          workItem('requested', 'review', { author: 'bob', requestedReviewers: ['alice'] }),
          workItem('unrelated', 'review', { author: 'bob' }),
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
    // Label-routed intake refetches issues per routed label; keep that lane empty so candidates aren't duplicated.
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) =>
      HttpResponse.json({
        issues: new URL(request.url).searchParams.has('label')
          ? []
          : [issue(10, ['bug'], 'alice'), issue(11, ['other'], 'bob')],
        nextPage: null,
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/prs`, () =>
      HttpResponse.json({
        pullRequests: [pull(20, 'alice', [], ['needs-review']), pull(21, 'bob', ['alice'])],
        nextPage: null,
      }),
    ),
  );
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/factory-1/${kind}${initialSearch}`]}>
      <SidebarProvider storageKey="board-filters-test" mobileBreakpoint={0}>
        <OverlaysProvider>
          <Location />
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryLayout />}>
              <Route path="work" element={<WorkBoardPage />} />
              <Route path="review" element={<ReviewBoardPage />} />
            </Route>
          </Routes>
        </OverlaysProvider>
      </SidebarProvider>
    </MemoryRouter>,
  );
}

const candidateTitles = () => screen.queryAllByTestId('candidate-card').map(card => card.getAttribute('aria-label'));

const MENU = 'Board properties';

describe('BoardPage filters', () => {
  it('offers pull request labels on the review board and filters candidates by them', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard('review');
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(candidateTitles()).toEqual(expect.arrayContaining(['Pull 20', 'Pull 21'])));
    await togglePropertyOption(user, MENU, 'Label', /^needs-review$/);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('label=needs-review'));
    expect(candidateTitles()).toContain('Pull 20');
    expect(candidateTitles()).not.toContain('Pull 21');
  });

  it('requires every selected label on work cards, then restores cards when removed', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard('work');
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

  it('combines labels and relevance on work items and separate intake candidates', async () => {
    const user = userEvent.setup();
    const { client, unmount } = renderBoard('work');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(candidateTitles()).toContain('Issue 10');
    expect(candidateTitles()).toContain('Issue 11');
    await togglePropertyOption(user, MENU, 'Teammate', /alice/i);
    await togglePropertyOption(user, MENU, 'Relevant because', 'Worked on');
    await togglePropertyOption(user, MENU, 'Relevant because', 'Assigned');
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('relevance=authored'));
    expect(screen.getByTestId('board-url')).toHaveTextContent('teammate=github%3Aalice');
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    expect(candidateTitles()).toContain('Issue 10');
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    await waitFor(() => expect(candidateTitles()).not.toContain('Issue 11'));
    await togglePropertyOption(user, MENU, 'Label', /^bug$/);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('label=bug'));
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    expect(screen.getByText('Card both')).toBeInTheDocument();
    expect(candidateTitles()).toContain('Issue 10');
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    const search = screen.getByTestId('board-url').textContent ?? '';
    unmount();
    renderBoard('work', search);
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    expect(candidateTitles()).toContain('Issue 10');
    expect(candidateTitles()).not.toContain('Issue 11');
    await togglePropertyOption(user, MENU, 'Relevant because', 'Worked on');
    await togglePropertyOption(user, MENU, 'Relevant because', 'Assigned');
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('relevance=');
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    await togglePropertyOption(user, MENU, 'Teammate', /alice/i);
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('teammate=');
    expect(screen.getByTestId('board-url')).toHaveTextContent('label=bug');
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Card unlabelled')).not.toBeInTheDocument();
  });

  it('applies authored or review requested to review cards and survives a URL reload', async () => {
    const user = userEvent.setup();
    const { client, unmount } = renderBoard('review');
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await togglePropertyOption(user, MENU, 'Teammate', /alice/i);
    await togglePropertyOption(user, MENU, 'Relevant because', 'Worked on');
    await togglePropertyOption(user, MENU, 'Relevant because', 'Assigned');
    await waitFor(() =>
      expect(screen.getByTestId('board-url')).toHaveTextContent('relevance=authored%2Creview-requested'),
    );
    const search = screen.getByTestId('board-url').textContent ?? '';
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    expect(screen.getByText('Card requested')).toBeInTheDocument();
    expect(screen.queryByText('Card unrelated')).not.toBeInTheDocument();
    unmount();
    renderBoard('review', search);
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    expect(screen.getByText('Card requested')).toBeInTheDocument();
    expect(screen.queryByText('Card unrelated')).not.toBeInTheDocument();
  });

  it('offers Relevant because only once a teammate is picked', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard('work');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await openPropertiesMenu(user, MENU);
    expect(screen.queryByRole('menuitem', { name: /^Relevant because/ })).not.toBeInTheDocument();
    await closePropertiesMenus(user);
    await togglePropertyOption(user, MENU, 'Teammate', /alice/i);
    await openPropertiesMenu(user, MENU);
    expect(screen.getByRole('menuitem', { name: /^Relevant because/ })).toBeInTheDocument();
    await closePropertiesMenus(user);
  });

  it('starts Relevant because with every reason checked, narrows by unchecking and keeps the last one', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard('work');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await togglePropertyOption(user, MENU, 'Teammate', /alice/i);
    await togglePropertyOption(user, MENU, 'Relevant because', 'Assigned');
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('relevance=worked%2Cauthored'));
    await togglePropertyOption(user, MENU, 'Relevant because', 'Worked on');
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('relevance=authored'));
    await openPropertySubmenu(user, MENU, 'Relevant because');
    expect(screen.getByRole('menuitem', { name: /^Relevant because\s*Authored$/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Authored' })).toHaveAttribute('aria-disabled', 'true');
    await closePropertiesMenus(user);
    await togglePropertyOption(user, MENU, 'Relevant because', 'Worked on');
    await togglePropertyOption(user, MENU, 'Relevant because', 'Assigned');
    await waitFor(() => expect(screen.getByTestId('board-url')).not.toHaveTextContent('relevance='));
    await openPropertySubmenu(user, MENU, 'Relevant because');
    expect(screen.getByRole('menuitem', { name: /^Relevant because$/ })).toBeInTheDocument();
    for (const reason of ['Worked on', 'Authored', 'Assigned']) {
      expect(screen.getByRole('menuitemcheckbox', { name: reason })).toHaveAttribute('aria-checked', 'true');
    }
    await closePropertiesMenus(user);
  });

  it('resets every filter and the sort in one step', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard('work', '?label=bug&sort=created-newest');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    const trigger = screen.getByRole('button', { name: 'Board properties, 2 changed' });
    expect(trigger).toHaveTextContent('2');
    await openPropertiesMenu(user, MENU);
    await user.click(screen.getByRole('menuitem', { name: 'Reset to default' }));
    await waitFor(() => expect(screen.getByTestId('board-url')).not.toHaveTextContent('label='));
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('sort=');
    await closePropertiesMenus(user);
    expect(screen.getByRole('button', { name: 'Board properties' })).toBeInTheDocument();
  });

  it('labels a multi-pick with its count', async () => {
    const user = userEvent.setup();
    const { client } = renderBoard('work');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await togglePropertyOption(user, MENU, 'Label', /^bug$/);
    await togglePropertyOption(user, MENU, 'Label', /^documentation$/);
    await openPropertiesMenu(user, MENU);
    expect(screen.getByRole('menuitem', { name: /^Label\s*2 selected$/ })).toBeInTheDocument();
    await closePropertiesMenus(user);
  });
});
