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

const reviewItem = {
  ...workItem,
  id: 'review-item-1',
  title: 'Review retry fix',
  stages: ['review'],
  externalSource: {
    integrationId: 'github',
    type: 'pull-request',
    externalId: 'github-pr:8',
    url: 'https://github.com/acme/app/pull/8',
  },
};

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
    metadata: {},
    githubProjectId: FACTORY_ID,
    context: {},
    occurredAt: '2026-08-05T10:00:00.000Z',
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
  {
    id: 'event-review-human',
    orgId: 'org-1',
    actorId: 'user-grace',
    actorType: 'human',
    action: 'factory.run.started',
    targets: [{ type: 'work_item', id: reviewItem.id, name: reviewItem.title }],
    metadata: {},
    githubProjectId: FACTORY_ID,
    context: {},
    occurredAt: '2026-08-05T08:00:00.000Z',
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, () => HttpResponse.json({ events, actors })),
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
    expect(screen.getByLabelText('Work item activity')).toHaveTextContent('Factory agent');
  });

  it('shows the latest human worker, initial fallback, and timeline on review cards', async () => {
    stubBoardEndpoints();
    renderBoard('review');

    await expectActivity('Grace Hopper', 'Started a run', false);
  });
});
