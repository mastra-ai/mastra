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
import type { IntakeConfig } from '../services/intake';
import type { LinearIssue, LinearStatus } from '../services/linear';

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

const triageIssues: GithubIssue[] = [
  {
    ...issues[0]!,
    labels: ['auto-triaged'],
  },
  {
    ...issues[1]!,
    labels: ['auto-triaged', 'triage:needs-approval'],
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

/** Both sources selected so GitHub/Linear specs see data by default. */
const defaultIntakeConfig: IntakeConfig = {
  github: { enabled: true, projectIds: [GITHUB_PROJECT_ID] },
  linear: { enabled: true, projectIds: ['lin-proj-1'] },
};

/** Linear stays out of the way unless a spec opts in. */
const linearDisabledStatus: LinearStatus = { enabled: false, connected: false, workspace: null };

const linearConnectedStatus: LinearStatus = {
  enabled: true,
  connected: true,
  workspace: { name: 'Acme', urlKey: 'acme' },
  reason: 'ready',
};

const linearIssues: LinearIssue[] = [
  {
    id: 'lin-1',
    identifier: 'ENG-42',
    title: 'Fix intake sync',
    url: 'https://linear.app/acme/issue/ENG-42',
    state: 'Todo',
    stateType: 'unstarted',
    priorityLabel: 'High',
    assignee: 'ada',
    team: 'ENG',
    labels: ['bug'],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
  },
];

interface AppHandlerOptions {
  intakeConfig?: IntakeConfig;
  linearStatus?: LinearStatus;
}

function useAppHandlers(githubStatus: GithubStatus, options: AppHandlerOptions = {}) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(githubStatus)),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ config: options.intakeConfig ?? defaultIntakeConfig }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json(options.linearStatus ?? linearDisabledStatus),
    ),
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
  options: AppHandlerOptions = {},
) {
  seedActiveProject(project);
  useAppHandlers(githubStatus, options);
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
    expect(within(nav).getByRole('link', { name: /Triage/ })).toHaveAttribute('href', '/factory/triage');
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
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues, nextPage: null }),
      ),
    );
    renderAt('/factory/intake');

    expect(await screen.findByRole('heading', { name: 'Intake' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Open issues' });
    const rows = within(list).getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('href', 'https://github.com/mastra-ai/mastra/issues/12');
    expect(within(list).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(list).getByText('Improve docs')).toBeInTheDocument();
    // Labels are intentionally not rendered on intake rows.
    expect(within(list).queryByText('bug')).not.toBeInTheDocument();
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

describe('Factory Intake page — Linear source', () => {
  const emptyGithubIssues = () =>
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: [], nextPage: null }),
      ),
    );

  it('given Linear is connected, when Linear is picked in the source rail, then its issues render in the list column', async () => {
    emptyGithubIssues();
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
        HttpResponse.json({ issues: linearIssues, nextCursor: null }),
      ),
    );
    renderAt('/factory/intake', githubProject, connectedStatus, { linearStatus: linearConnectedStatus });

    // Both sources appear in the rail; GitHub is selected by default.
    const rail = await screen.findByRole('navigation', { name: 'Intake sources' });
    expect(within(rail).getByRole('button', { name: /^GitHub/ })).toBeInTheDocument();
    expect(await screen.findByText('No open issues.')).toBeInTheDocument();

    await userEvent.click(within(rail).getByRole('button', { name: /^Linear/ }));

    const list = await screen.findByRole('list', { name: 'Linear issues' });
    expect(within(list).getByRole('link')).toHaveAttribute('href', 'https://linear.app/acme/issue/ENG-42');
    expect(within(list).getByText('Fix intake sync')).toBeInTheDocument();
    expect(within(list).getByText(/ENG-42 · Todo · ada/)).toBeInTheDocument();
    // Switching sources swaps the list column: the GitHub panel is gone.
    expect(screen.queryByText('No open issues.')).not.toBeInTheDocument();
  });

  it('given Linear is enabled but not connected, when Linear is picked in the source rail, then a connect prompt renders', async () => {
    emptyGithubIssues();
    renderAt('/factory/intake', githubProject, connectedStatus, {
      linearStatus: { enabled: true, connected: false, workspace: null, reason: 'not_connected' },
    });

    await userEvent.click(await screen.findByRole('button', { name: /^Linear/ }));

    expect(await screen.findByText('Connect a Linear workspace to see its issues here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Linear issues' })).not.toBeInTheDocument();
  });

  it('given the Linear feature is disabled on the server, when visiting /factory/intake, then Linear is absent from the source rail', async () => {
    emptyGithubIssues();
    renderAt('/factory/intake');

    expect(await screen.findByText('No open issues.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Linear/ })).not.toBeInTheDocument();
  });

  it('given no GitHub selection at all, then a not-selected hint renders and no issues are fetched', async () => {
    renderAt('/factory/intake', githubProject, connectedStatus, {
      intakeConfig: {
        github: { enabled: true, projectIds: null },
        linear: { enabled: false, projectIds: null },
      },
    });

    expect(await screen.findByText(/isn't selected as a GitHub intake source/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Open issues' })).not.toBeInTheDocument();
  });

  it('given the Linear authorization expired, when Linear is picked, then a reconnect notice renders instead of an error', async () => {
    emptyGithubIssues();
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
        HttpResponse.json(
          { error: 'linear_reauth_required', message: 'Linear authorization expired.' },
          { status: 409 },
        ),
      ),
    );
    renderAt('/factory/intake', githubProject, connectedStatus, { linearStatus: linearConnectedStatus });

    await userEvent.click(await screen.findByRole('button', { name: /^Linear/ }));

    expect(
      await screen.findByText('Linear authorization expired. Reconnect to keep syncing issues.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Linear' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Linear issues' })).not.toBeInTheDocument();
  });

  it('given Linear is connected but no projects are selected, then a pick-projects hint renders and no issues are fetched', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: [], nextPage: null }),
      ),
    );
    renderAt('/factory/intake', githubProject, connectedStatus, {
      intakeConfig: {
        github: { enabled: true, projectIds: [GITHUB_PROJECT_ID] },
        linear: { enabled: true, projectIds: null },
      },
      linearStatus: linearConnectedStatus,
    });

    await userEvent.click(await screen.findByRole('button', { name: /^Linear/ }));

    expect(
      await screen.findByText('No Linear projects selected. Pick them in Settings › General.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Linear issues' })).not.toBeInTheDocument();
  });

  it('given an explicit GitHub selection that excludes the active project, then a not-selected hint renders instead of issues', async () => {
    renderAt('/factory/intake', githubProject, connectedStatus, {
      intakeConfig: {
        github: { enabled: true, projectIds: ['some-other-project'] },
        linear: { enabled: false, projectIds: null },
      },
    });

    expect(await screen.findByText(/isn't selected as a GitHub intake source/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Open issues' })).not.toBeInTheDocument();
  });

  it('given an explicit GitHub selection that includes the active project, then its issues render', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues, nextPage: null }),
      ),
    );
    renderAt('/factory/intake', githubProject, connectedStatus, {
      intakeConfig: {
        github: { enabled: true, projectIds: [GITHUB_PROJECT_ID, 'some-other-project'] },
        linear: { enabled: false, projectIds: null },
      },
    });

    const list = await screen.findByRole('list', { name: 'Open issues' });
    expect(within(list).getByText('Fix flaky test')).toBeInTheDocument();
    expect(screen.queryByText(/isn't selected as a GitHub intake source/)).not.toBeInTheDocument();
  });

  it('given GitHub intake is disabled in settings, when visiting /factory/intake, then Linear is the default source and GitHub is absent from the rail', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
        HttpResponse.json({ issues: linearIssues, nextCursor: null }),
      ),
    );
    renderAt('/factory/intake', githubProject, connectedStatus, {
      intakeConfig: {
        github: { enabled: false, projectIds: null },
        linear: { enabled: true, projectIds: ['lin-proj-1'] },
      },
      linearStatus: linearConnectedStatus,
    });

    // Linear is the only source, so its list renders without any clicking.
    expect(await screen.findByRole('list', { name: 'Linear issues' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^GitHub/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Open issues' })).not.toBeInTheDocument();
  });

  it('given a Linear issue, when Investigate is clicked, then a worktree, thread, and understand-issue prompt are created', async () => {
    emptyGithubIssues();
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
        HttpResponse.json({ issues: linearIssues, nextCursor: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-linear-eng-42');
    const { router } = renderAt('/factory/intake', githubProject, connectedStatus, {
      linearStatus: linearConnectedStatus,
    });

    await userEvent.click(await screen.findByRole('button', { name: /^Linear/ }));
    await screen.findByRole('list', { name: 'Linear issues' });
    await userEvent.click(screen.getByRole('button', { name: 'Investigate ENG-42' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/linear-eng-42' });
    expect(captured.threadTitles).toEqual(['ENG-42: Fix intake sync']);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(captured.messages[0]!.message).toContain('https://linear.app/acme/issue/ENG-42');
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

interface CapturedRun {
  worktree?: Record<string, unknown>;
  threadTitles: string[];
  messages: Record<string, unknown>[];
}

/** Registers handlers for the investigate flow: worktree + thread + message. */
function useFactoryRunHandlers(branchDir: string): CapturedRun {
  const captured: CapturedRun = { threadTitles: [], messages: [] };
  server.use(
    http.post(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, async ({ request }) => {
      captured.worktree = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        worktreePath: `/sandbox/mastra/worktrees/${branchDir}`,
        branch: captured.worktree.branch,
        baseBranch: 'main',
        resourceId: RESOURCE_ID,
      });
    }),
    http.post(`${SESSION}/threads`, async ({ request }) => {
      const body = (await request.json()) as { title?: string };
      captured.threadTitles.push(body.title ?? '');
      return HttpResponse.json({ id: 'thread-factory', resourceId: RESOURCE_ID, title: body.title });
    }),
    http.post(`${SESSION}/messages`, async ({ request }) => {
      captured.messages.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${SESSION}/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
  );
  return captured;
}

describe('Factory Triage page', () => {
  it('given auto-triaged issues, when visiting /factory/triage, then labels and label-driven actions render', async () => {
    let requestedLabel: string | null = null;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, ({ request }) => {
        requestedLabel = new URL(request.url).searchParams.get('label');
        return HttpResponse.json({ issues: triageIssues, nextPage: null });
      }),
    );
    renderAt('/factory/triage');

    expect(await screen.findByRole('heading', { name: 'Triage' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Auto-triaged issues' });
    expect(requestedLabel).toBe('auto-triaged');
    expect(within(list).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(list).getByText('Improve docs')).toBeInTheDocument();
    expect(within(list).getAllByText('auto-triaged')).toHaveLength(2);
    expect(within(list).getByText('triage:needs-approval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Investigate issue #12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prepare approval #15' })).toBeInTheDocument();
  });

  it('given no auto-triaged issues, when the page resolves, then an empty message renders', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: [], nextPage: null }),
      ),
    );
    renderAt('/factory/triage');

    expect(await screen.findByText('No auto-triaged issues.')).toBeInTheDocument();
  });
});

describe('Factory investigate flow', () => {
  it('given an issue without auto-triaged, when Triage issue is selected from the action menu, then it shows pending feedback and stays on Intake', async () => {
    const triageRequests: Record<string, unknown>[] = [];
    let resolveTriage!: () => void;
    const triageStarted = new Promise<void>(resolve => {
      resolveTriage = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, ({ request }) => {
        const label = new URL(request.url).searchParams.get('label');
        return HttpResponse.json({ issues: label === 'auto-triaged' ? triageIssues : issues, nextPage: null });
      }),
      http.post(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues/12/triage`, async ({ request }) => {
        triageRequests.push((await request.json()) as Record<string, unknown>);
        await triageStarted;
        return HttpResponse.json({ ok: true }, { status: 202 });
      }),
    );
    const { router } = renderAt('/factory/intake');

    await screen.findByRole('list', { name: 'Open issues' });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for issue #12' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Triage issue' }));

    expect(await screen.findByRole('button', { name: 'Investigate issue #12' })).toHaveTextContent('Starting…');
    expect(triageRequests[0]).toMatchObject({
      title: 'Fix flaky test',
      url: 'https://github.com/mastra-ai/mastra/issues/12',
      labels: ['bug'],
    });
    resolveTriage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Investigate issue #12' })).not.toHaveTextContent('Starting…'));
    expect(router.state.location.pathname).toBe('/factory/intake');
  });

  it('given an auto-triaged issue in intake, when Investigate is clicked, then the existing investigation flow is preserved', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: triageIssues, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/intake');

    await screen.findByRole('list', { name: 'Open issues' });
    await userEvent.click(screen.getByRole('button', { name: 'Investigate issue #12' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.threadTitles).toEqual(['Issue #12: Fix flaky test']);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(captured.messages[0]!.message).toContain('https://github.com/mastra-ai/mastra/issues/12');
  });

  it('given an auto-triaged issue, when Investigate issue is clicked from Triage, then a worktree, thread, and understand-issue prompt are created', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: triageIssues, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/triage');

    await screen.findByRole('list', { name: 'Auto-triaged issues' });
    await userEvent.click(screen.getByRole('button', { name: 'Investigate issue #12' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.threadTitles).toEqual(['Issue #12: Fix flaky test']);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(captured.messages[0]!.message).toContain('https://github.com/mastra-ai/mastra/issues/12');
    expect(captured.messages[0]!.message).toContain('Current triage labels: auto-triaged.');
  });

  it('given an issue needing approval, when Prepare approval is clicked from Triage, then a worktree, thread, and approval prompt are created', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues: triageIssues, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-issue-15');
    const { router } = renderAt('/factory/triage');

    await screen.findByRole('list', { name: 'Auto-triaged issues' });
    await userEvent.click(screen.getByRole('button', { name: 'Prepare approval #15' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-15' });
    expect(captured.threadTitles).toEqual(['Issue #15: Improve docs']);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('Prepare maintainer approval next steps');
    expect(captured.messages[0]!.message).toContain('https://github.com/mastra-ai/mastra/issues/15');
    expect(captured.messages[0]!.message).toContain('triage:needs-approval');
  });

  it('given a pull request, when Review is clicked, then a worktree, thread, and understand-pr prompt are created and the app navigates to the new thread', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/prs`, () =>
        HttpResponse.json({ pullRequests, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-pr-34');
    const { router } = renderAt('/factory/review');

    await screen.findByRole('list', { name: 'Open pull requests' });
    await userEvent.click(screen.getByRole('button', { name: 'Review pull request #34' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/pr-34' });
    expect(captured.threadTitles).toEqual(['PR #34: Add factory pages']);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('understand-pr skill');
    expect(captured.messages[0]!.message).toContain('gh pr checkout 34');
  });

  it('given the new worktree session is seeded with a fresh untitled thread, when Investigate is clicked, then that thread is renamed and reused instead of creating a second one', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/intake');
    // A brand-new scope's session create seeds an empty untitled thread and
    // reports it back; the run must claim it rather than add an "Untitled"
    // sibling next to the run's own thread.
    const renames: Record<string, unknown>[] = [];
    server.use(
      http.post(`${API}/sessions`, () =>
        HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: 'thread-seeded' }),
      ),
      http.get(`${SESSION}/threads`, () =>
        HttpResponse.json({ threads: [{ id: 'thread-seeded', resourceId: RESOURCE_ID, title: '' }] }),
      ),
      http.put(`${SESSION}/threads/thread-seeded`, async ({ request }) => {
        renames.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ok: true });
      }),
    );

    await screen.findByRole('list', { name: 'Open issues' });
    await userEvent.click(screen.getByRole('button', { name: 'Investigate issue #12' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-seeded'));
    expect(renames).toEqual([{ title: 'Issue #12: Fix flaky test' }]);
    expect(captured.threadTitles).toEqual([]);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
  });

  it('given an issue, when a custom prompt is submitted from the action menu, then the run starts with the typed prompt', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/intake');

    await screen.findByRole('list', { name: 'Open issues' });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for issue #12' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom prompt…' }));

    const form = await screen.findByRole('form', { name: 'Custom prompt for issue #12' });
    await userEvent.type(
      within(form).getByRole('textbox', { name: 'Prompt for issue #12' }),
      'Write a failing test first',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.threadTitles).toEqual(['Issue #12: Fix flaky test']);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('Write a failing test first');
    expect(captured.messages[0]!.message).toContain('https://github.com/mastra-ai/mastra/issues/12');
    expect(captured.messages[0]!.message).not.toContain('understand-issue skill');
  });

  it('given a pull request, when a custom prompt is submitted from the action menu, then the run starts with the typed prompt and checkout context', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/prs`, () =>
        HttpResponse.json({ pullRequests, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-pr-34');
    const { router } = renderAt('/factory/review');

    await screen.findByRole('list', { name: 'Open pull requests' });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for pull request #34' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom prompt…' }));

    const form = await screen.findByRole('form', { name: 'Custom prompt for pull request #34' });
    await userEvent.type(
      within(form).getByRole('textbox', { name: 'Prompt for pull request #34' }),
      'Check for security issues only',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/pr-34' });
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('Check for security issues only');
    expect(captured.messages[0]!.message).toContain('gh pr checkout 34');
    expect(captured.messages[0]!.message).not.toContain('understand-pr skill');
  });

  it('given an empty custom prompt, when Run is clicked, then the run does not start', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues, nextPage: null }),
      ),
    );
    const captured = useFactoryRunHandlers('factory-issue-12');
    renderAt('/factory/intake');

    await screen.findByRole('list', { name: 'Open issues' });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for issue #12' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom prompt…' }));

    const form = await screen.findByRole('form', { name: 'Custom prompt for issue #12' });
    expect(within(form).getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(captured.worktree).toBeUndefined();
    expect(captured.messages).toHaveLength(0);
  });

  it('given a typed custom prompt, when the popover is cancelled and reopened, then the prompt is cleared', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues, nextPage: null }),
      ),
    );
    renderAt('/factory/intake');

    await screen.findByRole('list', { name: 'Open issues' });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for issue #12' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom prompt…' }));

    let form = await screen.findByRole('form', { name: 'Custom prompt for issue #12' });
    await userEvent.type(within(form).getByRole('textbox', { name: 'Prompt for issue #12' }), 'Discarded draft');
    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'More actions for issue #12' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom prompt…' }));

    form = await screen.findByRole('form', { name: 'Custom prompt for issue #12' });
    expect(within(form).getByRole('textbox', { name: 'Prompt for issue #12' })).toHaveValue('');
  });

  it('given the worktree call fails, when Investigate is clicked, then an error notice renders and no thread is created', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
        HttpResponse.json({ issues, nextPage: null }),
      ),
      http.post(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, () =>
        HttpResponse.json({ error: 'git_error', message: 'worktree failed' }, { status: 502 }),
      ),
    );
    let threadCreated = false;
    server.use(
      http.post(`${SESSION}/threads`, () => {
        threadCreated = true;
        return HttpResponse.json({ id: 'thread-factory', resourceId: RESOURCE_ID });
      }),
    );
    const { router } = renderAt('/factory/intake');

    await screen.findByRole('list', { name: 'Open issues' });
    await userEvent.click(screen.getByRole('button', { name: 'Investigate issue #12' }));

    expect(await screen.findByText('worktree failed')).toBeInTheDocument();
    expect(threadCreated).toBe(false);
    expect(router.state.location.pathname).toBe('/factory/intake');
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
