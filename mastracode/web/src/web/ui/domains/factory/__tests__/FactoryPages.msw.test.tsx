/**
 * BDD coverage for the Factory pages (Intake / Review) and sidebar section.
 *
 * Drives the real route table through a memory router with the full provider
 * stack (auth guard, Chat providers, ActiveProject context), so the specs
 * exercise exactly what a user sees: the Factory sidebar links and the
 * issue/PR lists fetched from the server. Only the network is mocked (MSW).
 */
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/web-ui/render';
import type { GithubStatus, Project } from '../../workspaces';
import { createAppRoutes } from '../../../router';
import type { GithubIssue, GithubPullRequest } from '../services/factory';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-gh';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const GITHUB_PROJECT_ID = 'github-project-1';

const githubProject: Project = {
  id: 'project-gh',
  name: 'Mastra',
  source: 'github',
  githubProjectId: GITHUB_PROJECT_ID,
  sandboxWorkdir: '/sandbox/mastra',
  resourceId: RESOURCE_ID,
  gitBranch: 'main',
  worktrees: [{ branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' }],
  selectedWorktreePath: '/sandbox/mastra',
  createdAt: 1,
};

const localProject: Project = {
  id: 'project-local',
  name: 'Local',
  path: '/projects/local',
  resourceId: RESOURCE_ID,
  createdAt: 1,
};

const issues: GithubIssue[] = [
  {
    number: 12,
    title: 'Fix flaky test',
    url: 'https://github.com/mastra-ai/mastra/issues/12',
    author: 'ada',
    labels: ['bug'],
    comments: 3,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
  },
  {
    number: 15,
    title: 'Improve docs',
    url: 'https://github.com/mastra-ai/mastra/issues/15',
    author: null,
    labels: [],
    comments: 0,
    createdAt: '2026-07-05T00:00:00Z',
    updatedAt: '2026-07-05T00:00:00Z',
  },
];

const pullRequests: GithubPullRequest[] = [
  {
    number: 34,
    title: 'Add factory pages',
    url: 'https://github.com/mastra-ai/mastra/pull/34',
    author: 'grace',
    baseBranch: 'main',
    headBranch: 'feat/factory',
    createdAt: '2026-07-03T00:00:00Z',
    updatedAt: '2026-07-04T00:00:00Z',
  },
];

afterEach(() => {
  localStorage.clear();
});

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function sessionState() {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' }],
};

const notConnectedStatus: GithubStatus = {
  enabled: true,
  connected: false,
  installations: [],
  reason: 'not_connected',
};

function useAppHandlers(githubStatus: GithubStatus) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(githubStatus)),
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => emptySse()),
  );
}

function seedActiveProject(project: Project) {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
}

function renderAt(
  initialEntry: string,
  project: Project = githubProject,
  githubStatus: GithubStatus = connectedStatus,
) {
  seedActiveProject(project);
  useAppHandlers(githubStatus);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

describe('Factory sidebar section', () => {
  it('given a GitHub project, when the app renders, then the Factory heading exposes Intake and Review links', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: [], nextPage: null }),
      ),
    );
    renderAt('/factory/intake');

    const nav = await screen.findByRole('navigation', { name: 'Factory' });
    expect(within(nav).getByText('Factory')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Intake/ })).toHaveAttribute('href', '/factory/intake');
    expect(within(nav).getByRole('link', { name: /Review/ })).toHaveAttribute('href', '/factory/review');
  });

  it('given a local project, when the app renders, then the Factory section is hidden', async () => {
    renderAt('/new', localProject);

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Factory' })).not.toBeInTheDocument();
  });

  it('given GitHub is not connected, when the app renders, then the Factory section is hidden', async () => {
    renderAt('/new', githubProject, notConnectedStatus);

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Factory' })).not.toBeInTheDocument());
  });
});

describe('Factory Intake page', () => {
  it('given open issues, when visiting /factory/intake, then they render as links to GitHub', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () => HttpResponse.json({ issues, nextPage: null })),
    );
    renderAt('/factory/intake');

    expect(await screen.findByRole('heading', { name: 'Intake' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Open issues' });
    const rows = within(list).getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('href', 'https://github.com/mastra-ai/mastra/issues/12');
    expect(within(list).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(list).getByText('bug')).toBeInTheDocument();
    expect(within(list).getByText('Improve docs')).toBeInTheDocument();
  });

  it('given an issue with many labels, when the row renders, then labels collapse into a "+N" badge', async () => {
    const busyIssue = {
      ...issues[0]!,
      labels: ['bug', 'Agents', 'status: needs triage', 'trio-tb', 'impact:high', 'effort:medium'],
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: [busyIssue], nextPage: null }),
      ),
    );
    renderAt('/factory/intake');

    const list = await screen.findByRole('list', { name: 'Open issues' });
    expect(within(list).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(list).getByText('trio-tb')).toBeInTheDocument();
    expect(within(list).queryByText('impact:high')).not.toBeInTheDocument();
    expect(within(list).getByText('+2')).toHaveAttribute('title', 'impact:high, effort:medium');
  });

  it('given more pages, when "Load more issues" is activated, then the next page appends to the list', async () => {
    const pageTwoIssue: GithubIssue = { ...issues[0]!, number: 99, title: 'From page two' };
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        return page === '1'
          ? HttpResponse.json({ issues, nextPage: 2 })
          : HttpResponse.json({ issues: [pageTwoIssue], nextPage: null });
      }),
    );
    renderAt('/factory/intake');

    const list = await screen.findByRole('list', { name: 'Open issues' });
    expect(within(list).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(list).queryByText('From page two')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more issues' }));

    expect(await within(list).findByText('From page two')).toBeInTheDocument();
    // Last page reached — the load-more control disappears.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more issues' })).not.toBeInTheDocument());
  });

  it('given no open issues, when the page resolves, then an empty message renders', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: [], nextPage: null }),
      ),
    );
    renderAt('/factory/intake');

    expect(await screen.findByText('No open issues.')).toBeInTheDocument();
  });

  it('given the server fails, when the page resolves, then the error message renders', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ error: 'github_error', message: 'GitHub unavailable' }, { status: 502 }),
      ),
    );
    renderAt('/factory/intake');

    expect(await screen.findByText('GitHub unavailable')).toBeInTheDocument();
  });

  it('given a local project, when visiting /factory/intake, then a GitHub-only notice renders instead of a list', async () => {
    renderAt('/factory/intake', localProject);

    expect(await screen.findByText(/only available for GitHub projects/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Open issues' })).not.toBeInTheDocument();
  });

  it('given GitHub is not connected, when visiting /factory/intake, then a connect notice renders instead of a list', async () => {
    renderAt('/factory/intake', githubProject, notConnectedStatus);

    expect(await screen.findByText(/Factory requires a GitHub connection/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Open issues' })).not.toBeInTheDocument();
  });
});

describe('Factory Review page', () => {
  it('given open pull requests, when visiting /factory/review, then they render with branch metadata', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/prs`, () =>
        HttpResponse.json({ pullRequests, nextPage: null }),
      ),
    );
    renderAt('/factory/review');

    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Open pull requests' });
    const rows = within(list).getAllByRole('link');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('href', 'https://github.com/mastra-ai/mastra/pull/34');
    expect(within(list).getByText('Add factory pages')).toBeInTheDocument();
    expect(within(list).getByText(/feat\/factory → main/)).toBeInTheDocument();
  });

  it('given no open pull requests, when the page resolves, then an empty message renders', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/prs`, () =>
        HttpResponse.json({ pullRequests: [], nextPage: null }),
      ),
    );
    renderAt('/factory/review');

    expect(await screen.findByText('No open pull requests.')).toBeInTheDocument();
  });
});

describe('Factory routing', () => {
  it('given a GitHub project, when navigating between Intake and Review via the sidebar, then the router swaps pages', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: [], nextPage: null }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/prs`, () =>
        HttpResponse.json({ pullRequests: [], nextPage: null }),
      ),
    );
    const { router } = renderAt('/factory/intake');

    expect(await screen.findByRole('heading', { name: 'Intake' })).toBeInTheDocument();

    const nav = await screen.findByRole('navigation', { name: 'Factory' });
    await userEvent.click(within(nav).getByRole('link', { name: /Review/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/factory/review'));
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument();
  });
});
