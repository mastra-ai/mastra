import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
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
const pull = (number: number, author: string, requestedReviewers: string[]): GithubPullRequest => ({
  number,
  title: `Pull ${number}`,
  url: `https://github.com/acme/app/pull/${number}`,
  author,
  requestedReviewers,
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
    http.get(`${TEST_BASE_URL}/web/source-control/projects/repo-1/sessions`, () => HttpResponse.json({ sessions: [] })),
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
      HttpResponse.json({ pullRequests: [pull(20, 'alice', []), pull(21, 'bob', ['alice'])], nextPage: null }),
    ),
  );
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/factory-1/${kind}${initialSearch}`]}>
      <MainSidebarProvider storageKey="board-filters-test" mobileBreakpoint={0}>
        <OverlaysProvider>
          <Location />
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryLayout />}>
              <Route path="work" element={<WorkBoardPage />} />
              <Route path="review" element={<ReviewBoardPage />} />
            </Route>
          </Routes>
        </OverlaysProvider>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

const candidateTitles = () => screen.queryAllByTestId('candidate-card').map(card => card.getAttribute('aria-label'));

const input = () => screen.getByRole('combobox', { name: 'Add filter' });
async function selectField(name: string) {
  input().focus();
  fireEvent.change(input(), { target: { value: name } });
  await screen.findByRole('option', { name: new RegExp(`^${name}$`, 'i') });
  fireEvent.keyDown(input(), { key: 'ArrowDown' });
  fireEvent.keyDown(input(), { key: 'Enter' });
}

async function selectTeammate() {
  await selectField('Teammate');
  await screen.findByRole('option', { name: /alice/i });
  fireEvent.keyDown(input(), { key: 'Enter' });
}

async function selectMany(name: string, options: RegExp[]) {
  await selectField(name);
  for (const option of options) {
    fireEvent.click(await screen.findByRole('option', { name: option }));
  }
  fireEvent.click(screen.getByRole('button', { name: /^Done/ }));
}

describe('BoardPage filters', () => {
  it('requires every selected label on work cards, then restores cards when removed', async () => {
    const { client } = renderBoard('work');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await selectMany('Label', [/^bug$/, /^documentation$/]);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('label=bug'));
    expect(screen.getByTestId('board-url')).toHaveTextContent('label=documentation');
    expect(screen.getByText('Card both')).toBeInTheDocument();
    expect(screen.queryByText('Card bug')).not.toBeInTheDocument();
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Card unlabelled')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Label filter' }));
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('label=');
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    expect(screen.getByText('Card docs')).toBeInTheDocument();
    expect(screen.getByText('Card unlabelled')).toBeInTheDocument();
  });

  it('combines labels and relevance on work items and separate intake candidates', async () => {
    const { client, unmount } = renderBoard('work');
    expect(await screen.findByText('Card bug')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(candidateTitles()).toContain('Issue 10');
    expect(candidateTitles()).toContain('Issue 11');
    await selectTeammate();
    await selectMany('Relevant because', [/Authored/i]);
    await waitFor(() => expect(screen.getByTestId('board-url')).toHaveTextContent('relevance=authored'));
    expect(screen.getByTestId('board-url')).toHaveTextContent('teammate=github%3Aalice');
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    expect(candidateTitles()).toContain('Issue 10');
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    await waitFor(() => expect(candidateTitles()).not.toContain('Issue 11'));
    await selectMany('Label', [/^bug$/]);
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
    fireEvent.click(screen.getByRole('button', { name: 'Remove Relevant because filter' }));
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('relevance=');
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Teammate filter' }));
    expect(screen.getByTestId('board-url')).not.toHaveTextContent('teammate=');
    expect(screen.getByTestId('board-url')).toHaveTextContent('label=bug');
    expect(screen.getByText('Card bug')).toBeInTheDocument();
    expect(screen.queryByText('Card docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Card unlabelled')).not.toBeInTheDocument();
  });

  it('applies authored or review requested to review cards after Done and URL reload', async () => {
    const { client, unmount } = renderBoard('review');
    expect(await screen.findByText('Card authored')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    await selectTeammate();
    await selectMany('Relevant because', [/Authored/i, /Review requested/i]);
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
});
