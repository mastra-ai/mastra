import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

const workItem = {
  id: 'work-item-1',
  orgId: 'org-1',
  createdBy: 'user-creator',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'github-issue:7',
    url: 'https://github.com/acme/app/issues/7',
  },
  parentWorkItemId: null,
  title: 'Fix login bug',
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  metadata: { number: 7 },
  revision: 1,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
};

const relevanceWorkItems = [
  {
    id: 'authored',
    title: 'Authored issue',
    metadata: { author: 'octocat', assignees: [] },
  },
  {
    id: 'assigned',
    title: 'Assigned issue',
    metadata: { author: 'grace', assignees: ['octocat'] },
  },
  {
    id: 'unrelated',
    title: 'Unrelated issue',
    metadata: { author: 'grace', assignees: [] },
  },
].map(({ id, title, metadata }, index) => ({
  ...workItem,
  id: `work-relevance-${id}`,
  createdBy: 'factory-rule-dispatcher',
  title,
  metadata: { number: 30 + index, ...metadata },
  externalSource: {
    ...workItem.externalSource,
    externalId: `github-issue:${30 + index}`,
    url: `https://github.com/acme/app/issues/${30 + index}`,
  },
}));

const reviewItem = {
  ...workItem,
  id: 'review-item-1',
  createdBy: 'factory-rule-dispatcher',
  title: 'Review retry fix',
  stages: ['review'],
  sessions: {
    review: {
      sessionId: 'session-review',
      threadId: 'thread-review',
      branch: 'review/retry-fix',
      startedBy: 'user-grace',
    },
  },
  metadata: { number: 8, author: 'octocat' },
  externalSource: {
    integrationId: 'github',
    type: 'pull-request',
    externalId: 'github-pr:8',
    url: 'https://github.com/acme/app/pull/8',
  },
};

const relevanceReviewItems = [
  {
    id: 'authored',
    title: 'Authored PR',
    metadata: { author: 'octocat', assignees: [], requestedReviewers: [] },
    sessions: {},
  },
  {
    id: 'assigned',
    title: 'Assigned PR',
    metadata: { author: 'grace', assignees: ['octocat'], requestedReviewers: [] },
    sessions: {},
  },
  {
    id: 'requested',
    title: 'Requested PR',
    metadata: { author: 'grace', assignees: [], requestedReviewers: ['octocat'] },
    sessions: {},
  },
  {
    id: 'worked',
    title: 'Worked PR',
    metadata: { author: 'grace', assignees: [], requestedReviewers: [] },
    sessions: {
      review: {
        sessionId: 'session-worked',
        threadId: 'thread-worked',
        branch: 'review/worked',
        startedBy: 'user-ada',
      },
    },
  },
].map(({ id, title, metadata, sessions }, index) => ({
  ...reviewItem,
  id: `review-relevance-${id}`,
  title,
  sessions,
  metadata: { number: 40 + index, ...metadata },
  externalSource: {
    ...reviewItem.externalSource,
    externalId: `github-pr:${40 + index}`,
    url: `https://github.com/acme/app/pull/${40 + index}`,
  },
}));

const pullRequestStatusItems = [
  { id: 'draft', title: 'Draft PR', stages: ['review'], metadata: { state: 'open', draft: true, merged: false } },
  { id: 'open', title: 'Open PR', stages: ['review'], metadata: { state: 'open', draft: false, merged: false } },
  {
    id: 'closed',
    title: 'Closed PR',
    stages: ['canceled'],
    metadata: { state: 'closed', draft: false, merged: false },
  },
  { id: 'merged', title: 'Merged PR', stages: ['done'], metadata: { state: 'closed', draft: false, merged: true } },
].map(({ id, title, stages, metadata }, index) => ({
  ...reviewItem,
  id: `review-item-${id}`,
  title,
  stages,
  sessions: {},
  metadata: { number: 20 + index, author: `author-${id}`, ...metadata },
  externalSource: {
    ...reviewItem.externalSource,
    externalId: `github-pr:${20 + index}`,
    url: `https://github.com/acme/app/pull/${20 + index}`,
  },
}));

const actors = {
  'user-ada': {
    id: 'user-ada',
    name: 'Ada Lovelace',
    avatarUrl: 'https://avatars.example/ada.png',
  },
  'user-grace': {
    id: 'user-grace',
    name: 'Grace Hopper',
  },
};

const events = [
  {
    id: 'event-agent',
    orgId: 'org-1',
    actorId: 'agent:thread-1',
    actorType: 'agent',
    action: 'factory.work_item.updated',
    targets: [{ type: 'work_item', id: workItem.id, name: workItem.title }],
    metadata: { agentName: 'build agent', modelId: 'anthropic/claude-sonnet-4-5' },
    githubProjectId: FACTORY_ID,
    context: {},
    occurredAt: '2026-08-05T10:00:00.000Z',
  },
  {
    id: 'event-work-automation',
    orgId: 'org-1',
    actorId: 'factory-rule-dispatcher',
    actorType: 'human',
    action: 'factory.work_item.updated',
    targets: [{ type: 'work_item', id: workItem.id, name: workItem.title }],
    metadata: {},
    githubProjectId: FACTORY_ID,
    context: {},
    occurredAt: '2026-08-05T09:30:00.000Z',
  },
  {
    id: 'event-work-human',
    orgId: 'org-1',
    actorId: 'user-ada',
    actorType: 'human',
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: workItem.id, name: workItem.title }],
    metadata: {},
    githubProjectId: FACTORY_ID,
    context: {},
    occurredAt: '2026-08-05T09:00:00.000Z',
  },
];

function stubBoardEndpoints() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-ada' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [workItem, reviewItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, ({ request }) => {
      const actorIds = new URL(request.url).searchParams.get('actorIds')?.split(',') ?? [];
      if (actorIds.length === 0) {
        return HttpResponse.json({ events, actors: { 'user-ada': actors['user-ada'] } });
      }
      expect(actorIds).toEqual(expect.arrayContaining(['user-creator', 'user-grace']));
      expect(actorIds).not.toContain('factory-rule-dispatcher');
      return HttpResponse.json({ events, actors });
    }),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: true, sourceIds: ['acme/app'] },
          linear: { enabled: false, sourceIds: null },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
  );
}

function renderBoard(board: 'work' | 'review') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/${board}`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

async function expectActivity(name: string, eventLabel: string, avatarAvailable = true) {
  const user = userEvent.setup();
  const trigger = await screen.findByRole('button', { name: `View activity by ${name}` });
  if (avatarAvailable) {
    expect(within(trigger).getByRole('img', { name })).toHaveAttribute('src');
  } else {
    expect(within(trigger).queryByRole('img')).not.toBeInTheDocument();
    expect(within(trigger).getByText(name[0] ?? '')).toBeInTheDocument();
  }

  await user.hover(trigger);

  const popup = await screen.findByLabelText('Work item activity');
  expect(popup).toHaveTextContent(`Last worked on by ${name}`);
  expect(popup).toHaveTextContent(eventLabel);
}

describe('Board work-item activity', () => {
  it('shows the latest human worker and timeline on work cards', async () => {
    stubBoardEndpoints();
    renderBoard('work');

    await expectActivity('Ada Lovelace', 'Moved the item');
    expect(screen.getByLabelText('Work item activity')).toHaveTextContent('build agent · anthropic/claude-sonnet-4-5');
  });

  it('filters work cards by teammate and selected relevance types', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: relevanceWorkItems }),
      ),
    );
    const user = userEvent.setup();
    renderBoard('work');

    await screen.findByText('Authored issue');
    await user.click(screen.getByLabelText('Filter by teammate'));
    await user.click(await screen.findByRole('option', { name: /octocat/ }));

    expect(screen.getByText('Authored issue')).toBeInTheDocument();
    expect(screen.getByText('Assigned issue')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated issue')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Filter by relevance'));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Authored' }));
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Review requested' })).not.toBeInTheDocument();

    expect(screen.queryByText('Authored issue')).not.toBeInTheDocument();
    expect(screen.getByText('Assigned issue')).toBeInTheDocument();
  });

  it('shows the latest human worker, initial fallback, and synthetic created event on review cards', async () => {
    stubBoardEndpoints();
    renderBoard('review');

    const createdAt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(reviewItem.createdAt),
    );
    await expectActivity('Grace Hopper', `Created at: ${createdAt}`, false);
    // The synthetic created event resolves to the external PR opener.
    const popup = screen.getByLabelText('Work item activity');
    expect(popup).toHaveTextContent('octocat');
    expect(popup).not.toHaveTextContent('Created the item');
    expect(within(popup).getByText(`Created at: ${createdAt}`)).toHaveAttribute('datetime', reviewItem.createdAt);
  });

  it('filters review cards by teammate and selected relevance types', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authenticated: true,
          authEnabled: true,
          user: { userId: 'user-ada', name: 'Ada Lovelace' },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: relevanceReviewItems }),
      ),
    );
    const user = userEvent.setup();
    renderBoard('review');

    await screen.findByText('Authored PR');
    await user.click(screen.getByLabelText('Filter by teammate'));
    await user.click(await screen.findByRole('option', { name: /octocat/ }));

    expect(screen.getByText('Authored PR')).toBeInTheDocument();
    expect(screen.getByText('Assigned PR')).toBeInTheDocument();
    expect(screen.getByText('Requested PR')).toBeInTheDocument();
    expect(screen.queryByText('Worked PR')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Filter by relevance'));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Authored' }));

    expect(screen.queryByText('Authored PR')).not.toBeInTheDocument();
    expect(screen.getByText('Assigned PR')).toBeInTheDocument();
    expect(screen.getByText('Requested PR')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByLabelText('Filter by teammate'));
    await user.click(await screen.findByRole('option', { name: /Ada Lovelace/ }));

    expect(screen.getByText('Worked PR')).toBeInTheDocument();
    expect(screen.queryByText('Authored PR')).not.toBeInTheDocument();
    expect(screen.queryByText('Assigned PR')).not.toBeInTheDocument();
    expect(screen.queryByText('Requested PR')).not.toBeInTheDocument();
  });

  it('shows distinct draft, open, closed, and merged pull request icons', async () => {
    stubBoardEndpoints();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: pullRequestStatusItems }),
      ),
    );
    renderBoard('review');

    expect(await screen.findByLabelText('Draft pull request')).toBeInTheDocument();
    expect(screen.getByLabelText('Open pull request')).toBeInTheDocument();
    expect(screen.getByLabelText('Closed pull request')).toBeInTheDocument();
    expect(screen.getByLabelText('Merged pull request')).toBeInTheDocument();
  });
});
