/**
 * BDD coverage for the Factory Board page and sidebar section.
 *
 * Drives the real route table through a memory router with the full provider
 * stack (auth guard, Chat providers, ActiveProject context), so the specs
 * exercise exactly what a user sees: the Factory sidebar link and the kanban
 * board that merges live GitHub/Linear candidates with persisted work items.
 * Only the network is mocked (MSW).
 */
import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/web-ui/render';
import type { GithubStatus, Project } from '../../workspaces';
import { createAppRoutes } from '../../../router';
import type { GithubIssue, GithubPullRequest } from '../services/factory';
import type { IntakeConfig } from '../services/intake';
import type { LinearIssue, LinearStatus } from '../services/linear';
import type { CreateWorkItemInput, UpdateWorkItemInput, WorkItem } from '../services/workItems';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-gh';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const GITHUB_PROJECT_ID = 'github-project-1';

const githubProject: Project = {
  id: 'project-gh',
  name: 'mastra-ai/mastra',
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

/** A full WorkItem row with sensible defaults, as the server would return it. */
function makeWorkItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'id' | 'title'>): WorkItem {
  return {
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: GITHUB_PROJECT_ID,
    source: 'manual',
    sourceKey: null,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
    ...overrides,
  };
}

interface BoardState {
  items: WorkItem[];
  posts: CreateWorkItemInput[];
  patches: Array<{ id: string } & UpdateWorkItemInput>;
  deletes: string[];
  triageRequests: Array<{ number: number; body: unknown }>;
  issueRequests: Array<string | null>;
}

interface BoardHandlerOptions {
  workItems?: WorkItem[];
  issues?: GithubIssue[];
  triageIssues?: GithubIssue[];
  pullRequests?: GithubPullRequest[];
  linearIssues?: LinearIssue[];
}

/**
 * Registers the Board's data handlers: candidate feeds (issues/PRs/Linear) and
 * an in-memory work-items store that records writes and echoes server-shaped
 * rows back, so the UI's cache updates behave like production.
 */
function useBoardHandlers(options: BoardHandlerOptions = {}): BoardState {
  const state: BoardState = {
    items: [...(options.workItems ?? [])],
    posts: [],
    patches: [],
    deletes: [],
    triageRequests: [],
    issueRequests: [],
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, ({ request }) => {
      const label = new URL(request.url).searchParams.get('label');
      state.issueRequests.push(label);
      return HttpResponse.json({
        issues: label === 'auto-triaged' ? (options.triageIssues ?? []) : (options.issues ?? []),
        nextPage: null,
      });
    }),
    http.post(
      `${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues/:number/triage`,
      async ({ request, params }) => {
        state.triageRequests.push({ number: Number(params.number), body: await request.json() });
        return HttpResponse.json({ ok: true, threadId: 'thread-triage' }, { status: 202 });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: options.pullRequests ?? [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
      HttpResponse.json({ issues: options.linearIssues ?? [], nextCursor: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${GITHUB_PROJECT_ID}/work-items`, () =>
      HttpResponse.json({ workItems: state.items }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${GITHUB_PROJECT_ID}/work-items`, async ({ request }) => {
      const body = (await request.json()) as CreateWorkItemInput;
      state.posts.push(body);
      const sessions = Object.fromEntries(
        Object.entries(body.sessions ?? {}).map(([role, ref]) => [role, { ...ref, startedBy: 'user-1' }]),
      );
      const item = makeWorkItem({
        id: `wi-post-${state.posts.length}`,
        title: body.title,
        source: body.source,
        sourceKey: body.sourceKey,
        url: body.url ?? null,
        stages: body.stages,
        sessions,
        metadata: body.metadata ?? {},
      });
      state.items = [...state.items.filter(i => i.sourceKey !== item.sourceKey || item.sourceKey === null), item];
      return HttpResponse.json({ workItem: item }, { status: 201 });
    }),
    http.patch(`${TEST_BASE_URL}/web/factory/work-items/:id`, async ({ request, params }) => {
      const id = params.id as string;
      const body = (await request.json()) as UpdateWorkItemInput;
      state.patches.push({ id, ...body });
      const existing = state.items.find(i => i.id === id) ?? makeWorkItem({ id, title: 'unknown' });
      const stampedSessions = Object.fromEntries(
        Object.entries(body.sessions ?? {}).map(([role, ref]) => [role, { ...ref, startedBy: 'user-1' }]),
      );
      const updated: WorkItem = {
        ...existing,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.stages !== undefined ? { stages: body.stages } : {}),
        sessions: { ...existing.sessions, ...stampedSessions },
        metadata: { ...existing.metadata, ...(body.metadata ?? {}) },
      };
      state.items = state.items.map(i => (i.id === id ? updated : i));
      return HttpResponse.json({ workItem: updated });
    }),
    http.delete(`${TEST_BASE_URL}/web/factory/work-items/:id`, ({ params }) => {
      const id = params.id as string;
      state.deletes.push(id);
      state.items = state.items.filter(i => i.id !== id);
      return HttpResponse.json({ ok: true });
    }),
  );
  return state;
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

function column(stage: string) {
  return screen.getByTestId(`board-column-${stage}`);
}

/** Minimal DataTransfer stand-in shared across dragstart → dragover → drop. */
function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? '',
    get types() {
      return Object.keys(store);
    },
    effectAllowed: 'none',
    dropEffect: 'none',
  };
}

function dragTo(card: HTMLElement, target: HTMLElement) {
  const dataTransfer = makeDataTransfer();
  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe('Factory sidebar section', () => {
  it('given a GitHub project, when the app renders, then the Factory heading exposes the Board link', async () => {
    useBoardHandlers();
    renderAt('/factory/board');

    const nav = await screen.findByRole('navigation', { name: 'Factory' });
    expect(within(nav).getByText('Factory')).toBeInTheDocument();
    // The Board link appears once the GitHub status query resolves as connected.
    expect(await within(nav).findByRole('link', { name: /Board/ })).toHaveAttribute('href', '/factory/board');
    expect(within(nav).getByRole('link', { name: /Metrics/ })).toHaveAttribute('href', '/factory/metrics');
    expect(within(nav).getByRole('link', { name: /Audit/ })).toHaveAttribute('href', '/factory/audit');
    // The factory Sessions list is nested under the same menu.
    expect(within(nav).getByRole('region', { name: 'Factory sessions' })).toBeInTheDocument();
  });

  it('given a local project, when the app renders, then the Factory section is hidden', async () => {
    renderAt('/new', localProject);

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Factory' })).not.toBeInTheDocument();
  });

  it('given GitHub is not connected, when the app renders, then the Board link is hidden but Sessions remain', async () => {
    renderAt('/new', githubProject, notConnectedStatus);

    // Sessions work off the project's own worktrees, so the Factory menu stays;
    // only the Board (which needs the GitHub integration) disappears.
    const nav = await screen.findByRole('navigation', { name: 'Factory' });
    expect(within(nav).getByRole('region', { name: 'Factory sessions' })).toBeInTheDocument();
    await waitFor(() => expect(within(nav).queryByRole('link', { name: /Board/ })).not.toBeInTheDocument());
    expect(within(nav).queryByRole('link', { name: /Metrics/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Audit/ })).not.toBeInTheDocument();
  });
});

describe('Factory Board routing', () => {
  it('given the legacy intake route, when visited, then it redirects to the Board', async () => {
    useBoardHandlers();
    const { router } = renderAt('/factory/intake');

    await waitFor(() => expect(router.state.location.pathname).toBe('/factory/board'));
    expect(await screen.findByRole('heading', { name: 'Board' })).toBeInTheDocument();
  });

  it('given the legacy review route, when visited, then it redirects to the Board', async () => {
    useBoardHandlers();
    const { router } = renderAt('/factory/review');

    await waitFor(() => expect(router.state.location.pathname).toBe('/factory/board'));
    expect(await screen.findByRole('heading', { name: 'Board' })).toBeInTheDocument();
  });

  it('given a local project, when visiting the Board, then a GitHub-only notice renders instead of columns', async () => {
    renderAt('/factory/board', localProject);

    expect(await screen.findByText(/only available for GitHub projects/)).toBeInTheDocument();
    expect(screen.queryByTestId('board-column-intake')).not.toBeInTheDocument();
  });

  it('given GitHub is not connected, when visiting the Board, then a connect notice renders instead of columns', async () => {
    renderAt('/factory/board', githubProject, notConnectedStatus);

    expect(await screen.findByText(/Factory requires a GitHub connection/)).toBeInTheDocument();
    expect(screen.queryByTestId('board-column-intake')).not.toBeInTheDocument();
  });
});

describe('Factory Board — Intake candidates', () => {
  it('given open issues and PRs, when the Board renders, then both appear as Intake candidates behind the feed filter', async () => {
    const state = useBoardHandlers({ issues, pullRequests });
    renderAt('/factory/board');

    expect(await screen.findByRole('heading', { name: 'Board' })).toBeInTheDocument();
    await waitFor(() => expect(state.issueRequests).toEqual(expect.arrayContaining([null, 'auto-triaged'])));
    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix flaky test')).toBeInTheDocument();
    expect(within(intake).getByText('Improve docs')).toBeInTheDocument();
    expect(within(intake).getAllByTestId('candidate-card')).toHaveLength(2);
    // Candidates link out to GitHub without exposing implementation label chips.
    expect(within(intake).getByText('Fix flaky test').closest('a')).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/12',
    );
    expect(
      within(within(intake).getByRole('article', { name: 'Fix flaky test' })).queryByText('bug'),
    ).not.toBeInTheDocument();
    // PRs start in Intake too — behind the PRs feed pill, never in Review.
    expect(within(column('review')).queryByTestId('candidate-card')).not.toBeInTheDocument();
    const sources = within(intake).getByRole('group', { name: 'Intake source' });
    await userEvent.click(within(sources).getByRole('button', { name: 'PRs' }));
    expect(await within(column('intake')).findByText('Add factory pages')).toBeInTheDocument();
    expect(within(column('intake')).queryByText('Fix flaky test')).not.toBeInTheDocument();
    expect(within(column('review')).queryByTestId('candidate-card')).not.toBeInTheDocument();
  });

  it('given GitHub Intake is configured, when the Board renders, then Intake offers repository issue creation in a new tab', async () => {
    useBoardHandlers();
    renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    expect(within(intake).getByRole('link', { name: 'Create GitHub issue' })).toMatchObject({
      href: 'https://github.com/mastra-ai/mastra/issues/new',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('given GitHub Intake is unavailable, when the Board renders, then issue creation is hidden', async () => {
    useBoardHandlers();
    renderAt('/factory/board', githubProject, connectedStatus, {
      intakeConfig: {
        github: { enabled: false, projectIds: [] },
        linear: { enabled: false, projectIds: [] },
      },
    });

    const intake = await screen.findByTestId('board-column-intake');
    expect(within(intake).queryByRole('link', { name: 'Create GitHub issue' })).not.toBeInTheDocument();
  });

  it('given the project name is not a canonical GitHub repository, when the Board renders, then no issue URL is invented', async () => {
    useBoardHandlers();
    renderAt('/factory/board', { ...githubProject, name: '../not-a-repository' });

    const intake = await screen.findByTestId('board-column-intake');
    expect(within(intake).queryByRole('link', { name: 'Create GitHub issue' })).not.toBeInTheDocument();
  });

  it('given the first board content is in Review, when all feeds settle, then the Board positions Review in view', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: '00000000-0000-4000-8000-000000000042',
          title: 'Add factory pages',
          source: 'github-pr',
          sourceKey: 'github-pr:42',
          stages: ['review'],
        }),
      ],
    });
    let resolveIssues!: () => void;
    const issuesReady = new Promise<void>(resolve => {
      resolveIssues = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, async ({ request }) => {
        if (new URL(request.url).searchParams.has('label')) return HttpResponse.json({ issues: [], nextPage: null });
        await issuesReady;
        return HttpResponse.json({ issues: [], nextPage: null });
      }),
    );
    const scrollTo = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo;

    try {
      const { client } = renderAt('/factory/board');
      const review = await screen.findByTestId('board-column-review');
      Object.defineProperty(review, 'offsetLeft', { configurable: true, value: 864 });
      resolveIssues();

      expect(await within(review).findByText('Add factory pages')).toBeInTheDocument();
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ left: 864, behavior: 'auto' }));

      scrollTo.mockClear();
      await client.invalidateQueries();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollTo = originalScrollTo;
    }
  });

  it('given the user moves the Board before feeds settle, when content loads, then automatic positioning does not override them', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: '00000000-0000-4000-8000-000000000042',
          title: 'Add factory pages',
          source: 'github-pr',
          sourceKey: 'github-pr:42',
          stages: ['review'],
        }),
      ],
    });
    let resolveIssues!: () => void;
    const issuesReady = new Promise<void>(resolve => {
      resolveIssues = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, async ({ request }) => {
        if (new URL(request.url).searchParams.has('label')) return HttpResponse.json({ issues: [], nextPage: null });
        await issuesReady;
        return HttpResponse.json({ issues: [], nextPage: null });
      }),
    );
    const scrollTo = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo;

    try {
      const { client } = renderAt('/factory/board');
      fireEvent.wheel(await screen.findByLabelText('Board columns'));
      resolveIssues();

      expect(await within(column('review')).findByText('Add factory pages')).toBeInTheDocument();
      await client.invalidateQueries();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollTo = originalScrollTo;
    }
  });

  it('given an untriaged issue candidate, when Triage issue is chosen, then the server triage run starts and the Board stays open', async () => {
    const state = useBoardHandlers({ issues });
    let resolveTriage!: () => void;
    const triageStarted = new Promise<void>(resolve => {
      resolveTriage = resolve;
    });
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues/:number/triage`,
        async ({ request, params }) => {
          state.triageRequests.push({ number: Number(params.number), body: await request.json() });
          await triageStarted;
          return HttpResponse.json({ ok: true, threadId: 'thread-triage' }, { status: 202 });
        },
      ),
    );
    const { router } = renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    const card = within(intake).getByRole('article', { name: 'Fix flaky test' });
    await userEvent.click(within(card).getByRole('button', { name: 'More actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Triage issue' }));

    const pendingButton = await within(card).findByRole('button', { name: 'Investigate Fix flaky test' });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveTextContent('Starting…');
    expect(state.triageRequests).toEqual([
      {
        number: 12,
        body: {
          title: 'Fix flaky test',
          url: 'https://github.com/mastra-ai/mastra/issues/12',
          labels: ['bug'],
        },
      },
    ]);
    const unfilteredRequestsBeforeResolve = state.issueRequests.filter(label => label === null).length;
    const autoTriagedRequestsBeforeResolve = state.issueRequests.filter(label => label === 'auto-triaged').length;
    resolveTriage();
    await waitFor(() => expect(router.state.location.pathname).toBe('/factory/board'));
    await waitFor(() => {
      expect(state.issueRequests.filter(label => label === null).length).toBeGreaterThan(
        unfilteredRequestsBeforeResolve,
      );
      expect(state.issueRequests.filter(label => label === 'auto-triaged').length).toBeGreaterThan(
        autoTriagedRequestsBeforeResolve,
      );
    });
  });

  it('given an auto-triaged issue candidate, when the Board renders, then it appears in Triage with Investigate and no label chips', async () => {
    const state = useBoardHandlers({ triageIssues: [{ ...issues[0]!, labels: ['bug', 'auto-triaged'] }] });
    renderAt('/factory/board');

    await waitFor(() => expect(state.issueRequests).toContain('auto-triaged'));
    const triageColumn = await screen.findByTestId('board-column-triage');
    const card = await within(triageColumn).findByRole('article', { name: 'Fix flaky test' });
    expect(within(card).getByRole('button', { name: 'Investigate Fix flaky test' })).toBeInTheDocument();
    expect(within(card).queryByText('auto-triaged')).not.toBeInTheDocument();
    expect(within(card).queryByText('bug')).not.toBeInTheDocument();
    expect(within(column('intake')).queryByText('Fix flaky test')).not.toBeInTheDocument();
  });

  it('given an auto-triaged issue needing approval, when the Board renders, then it appears in Triage with Prepare approval and no label chips', async () => {
    const state = useBoardHandlers({
      triageIssues: [{ ...issues[0]!, labels: ['bug', 'auto-triaged', 'needs-approval'] }],
    });
    renderAt('/factory/board');

    await waitFor(() => expect(state.issueRequests).toContain('auto-triaged'));
    const triageColumn = await screen.findByTestId('board-column-triage');
    const card = await within(triageColumn).findByRole('article', { name: 'Fix flaky test' });
    expect(within(card).getByRole('button', { name: 'Prepare approval Fix flaky test' })).toBeInTheDocument();
    expect(within(card).queryByText('needs-approval')).not.toBeInTheDocument();
    expect(within(card).queryByText('auto-triaged')).not.toBeInTheDocument();
    expect(within(column('intake')).queryByText('Fix flaky test')).not.toBeInTheDocument();
  });

  it('given GitHub and Linear intake sources, when the swimlane source pill is toggled, then only that feed\u2019s candidates render', async () => {
    useBoardHandlers({
      issues,
      pullRequests,
      linearIssues,
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Linear card',
          source: 'linear-issue',
          sourceKey: 'linear:ENG-7',
          stages: ['execute'],
        }),
      ],
    });
    renderAt('/factory/board', githubProject, connectedStatus, { linearStatus: linearConnectedStatus });

    // GitHub issues are the default feed: they show, Linear's don't.
    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    expect(within(intake).queryByText('Fix intake sync')).not.toBeInTheDocument();

    const sources = within(intake).getByRole('group', { name: 'Intake source' });
    await userEvent.click(within(sources).getByRole('button', { name: 'Linear' }));

    // Only the Linear feed's candidates remain in Intake.
    expect(await within(column('intake')).findByText('Fix intake sync')).toBeInTheDocument();
    expect(within(column('intake')).queryByText('Fix flaky test')).not.toBeInTheDocument();
    // The switch only affects the Intake feed: persisted cards stay put, and
    // PR candidates only render behind their own feed pill.
    expect(within(column('execute')).getByText('Linear card')).toBeInTheDocument();
    expect(within(column('intake')).queryByText('Add factory pages')).not.toBeInTheDocument();
    expect(within(column('review')).queryByTestId('candidate-card')).not.toBeInTheDocument();

    await userEvent.click(within(sources).getByRole('button', { name: 'Issues' }));
    expect(await within(column('intake')).findByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('intake')).queryByText('Fix intake sync')).not.toBeInTheDocument();
  });

  it('given Linear is connected and selected, when the Linear feed is picked, then Linear issues appear as candidates', async () => {
    useBoardHandlers({ linearIssues });
    renderAt('/factory/board', githubProject, connectedStatus, { linearStatus: linearConnectedStatus });

    const intake = await screen.findByTestId('board-column-intake');
    const sources = await within(intake).findByRole('group', { name: 'Intake source' });
    await userEvent.click(within(sources).getByRole('button', { name: 'Linear' }));
    expect(await within(intake).findByText('Fix intake sync')).toBeInTheDocument();
    expect(within(intake).getByText(/ENG-42/)).toBeInTheDocument();
  });

  it('given the Linear feature is disabled, when the Board renders, then no Linear candidates or Linear feed pill appear', async () => {
    useBoardHandlers({ issues, linearIssues });
    renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix flaky test')).toBeInTheDocument();
    expect(within(intake).queryByText('Fix intake sync')).not.toBeInTheDocument();
    // Issues + PRs still get a switcher, but Linear is not offered.
    const sources = within(intake).getByRole('group', { name: 'Intake source' });
    expect(within(sources).getByRole('button', { name: 'Issues' })).toBeInTheDocument();
    expect(within(sources).getByRole('button', { name: 'PRs' })).toBeInTheDocument();
    expect(within(sources).queryByRole('button', { name: 'Linear' })).not.toBeInTheDocument();
  });

  it('given a work item exists for an issue, when the Board renders, then candidates from both issue feeds are deduped by source key', async () => {
    useBoardHandlers({
      issues,
      triageIssues: [{ ...issues[0]!, labels: ['auto-triaged'] }],
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
        }),
      ],
    });
    renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    // Issue #15 is still a candidate; issue #12 lives on as a card in Building.
    expect(await within(intake).findByText('Improve docs')).toBeInTheDocument();
    expect(within(intake).queryByText('Fix flaky test')).not.toBeInTheDocument();
    expect(within(column('triage')).queryByText('Fix flaky test')).not.toBeInTheDocument();
    expect(within(column('execute')).getByText('Fix flaky test')).toBeInTheDocument();
  });
});

describe('Factory Board — persisted cards', () => {
  it('given a work item in multiple stages, when the Board renders, then it shows a card in each column with a chip for the other stage', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Parallel effort',
          source: 'github-pr',
          sourceKey: 'github-pr:34',
          stages: ['execute', 'review'],
        }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    const executeCard = within(column('execute')).getByTestId('work-item-card');
    const reviewCard = within(column('review')).getByTestId('work-item-card');
    expect(within(executeCard).getByText('Parallel effort')).toBeInTheDocument();
    expect(within(reviewCard).getByText('Parallel effort')).toBeInTheDocument();
    // Each card chips the item's other stage.
    expect(within(executeCard).getByText('Review')).toBeInTheDocument();
    expect(within(reviewCard).getByText('Building')).toBeInTheDocument();
  });

  // A project that still has the worktree the cards' session refs point at:
  // Thread links only render while the ref's worktree exists.
  const issueWorktreePath = '/sandbox/mastra/worktrees/factory-issue-12';
  const projectWithIssueWorktree: Project = {
    ...githubProject,
    worktrees: [
      ...(githubProject.worktrees ?? []),
      { branch: 'factory/issue-12', worktreePath: issueWorktreePath, baseBranch: 'main' },
    ],
  };
  const issueWorkSession = {
    projectPath: issueWorktreePath,
    branch: 'factory/issue-12',
    threadId: 'thread-work',
    startedBy: 'user-1',
  };

  it('given a work item with sessions, when the Board renders, then the card links to its thread', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
          sessions: { work: issueWorkSession },
        }),
      ],
    });
    renderAt('/factory/board', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    expect(within(card).getByRole('link', { name: 'Thread' })).toHaveAttribute('href', '/threads/thread-work');
  });

  it('given plan and work sessions on the same thread, when the Board renders, then the card shows a single Thread link', async () => {
    const sharedThread = { ...issueWorkSession, threadId: 'thread-shared' };
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
          sessions: { plan: sharedThread, work: sharedThread },
        }),
      ],
    });
    renderAt('/factory/board', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    const links = within(card).getAllByRole('link', { name: /thread/i });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Thread');
    expect(links[0]).toHaveAttribute('href', '/threads/thread-shared');
  });

  it('given legacy sessions that diverged onto different threads, when the Board renders, then the card still shows a single Thread link', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
          // Refs filed while session scoping was broken point at two threads;
          // the card must not surface role-labelled links for them.
          sessions: { plan: { ...issueWorkSession, threadId: 'thread-plan' }, work: issueWorkSession },
        }),
      ],
    });
    renderAt('/factory/board', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    const links = within(card).getAllByRole('link', { name: /thread/i });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Thread');
    // The last-filed ref wins until the next run converges them.
    expect(links[0]).toHaveAttribute('href', '/threads/thread-work');
  });

  it('given a session ref whose worktree was deleted, when the Board renders, then the stale thread link is hidden and runs are offered again', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
          metadata: { number: 12 },
          sessions: { work: issueWorkSession },
        }),
      ],
    });
    // The default project does not have the ref's worktree — it was deleted.
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    expect(within(card).queryByRole('link', { name: /thread/i })).not.toBeInTheDocument();
    // The stale ref no longer occupies the run slot: runs are offered again.
    await userEvent.click(within(card).getByRole('button', { name: 'Actions for Fix flaky test' }));
    expect(await screen.findByRole('menuitem', { name: 'Investigate' })).toBeInTheDocument();
  });

  it('given a thread link, when clicked, then its worktree becomes the selected workspace and the app navigates to the thread', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
          sessions: { work: issueWorkSession },
        }),
      ],
    });
    const { router } = renderAt('/factory/board', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    await userEvent.click(within(card).getByRole('link', { name: 'Thread' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-work'));
    const stored = JSON.parse(localStorage.getItem('mastracode-projects') ?? '[]') as Project[];
    expect(stored[0]?.selectedWorktreePath).toBe(issueWorktreePath);
  });

  it('given a card in Intake, when Move to Triage is chosen from the menu, then the card lands in the Triage swimlane', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-1', title: 'Fix flaky test', source: 'github-issue', sourceKey: 'github-issue:12' }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Triage' }));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['triage'] }]));
    expect(within(column('triage')).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('intake')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given a card in Triage, when Investigate is chosen, then triage exits and the card moves to Planning', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['triage'],
          metadata: { number: 12 },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-triage');
    await userEvent.click(within(column('triage')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(state.patches).toMatchObject([{ id: 'wi-1', stages: ['planning'] }]);
  });

  it('given a persisted issue card needing approval, when Prepare approval is chosen, then the triage session ref is recorded without leaving Triage', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-approval',
          title: 'Add OAuth support',
          source: 'github-issue',
          sourceKey: 'github-issue:21',
          url: 'https://github.com/mastra-ai/mastra/issues/21',
          stages: ['triage'],
          metadata: { number: 21, labels: ['auto-triaged', 'needs-approval'] },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-21');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-triage');
    await userEvent.click(within(column('triage')).getByRole('button', { name: 'Actions for Add OAuth support' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Prepare approval' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-21' });
    expect(captured.messages[0]!.message).toContain(
      'Prepare approval for GitHub issue #21 (https://github.com/mastra-ai/mastra/issues/21)',
    );
    expect(captured.messages[0]!.message).not.toContain('Add OAuth support');
    expect(state.patches).toMatchObject([
      {
        id: 'wi-approval',
        stages: ['triage'],
        sessions: { triage: { branch: 'factory/issue-21', threadId: 'thread-factory' } },
      },
    ]);
  });

  it('given a card in Triage, when Move to Planning is chosen from the menu, then the card lands in the Planning swimlane', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['triage'],
        }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-triage');
    await userEvent.click(within(column('triage')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Planning' }));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['planning'] }]));
    expect(within(column('planning')).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('triage')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given a card in Planning, when Build is chosen, then planning exits and the card moves to Building', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['planning'],
          metadata: { number: 12 },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-planning');
    await userEvent.click(within(column('planning')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Build' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.messages[0]!.message).toContain('Implement a fix for GitHub issue #12');
    expect(state.patches).toMatchObject([{ id: 'wi-1', stages: ['execute'] }]);
  });

  it('given a card in Intake, when Mark done is chosen from the menu, then the stages PATCH to done and the card moves', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-1', title: 'Fix flaky test', source: 'github-issue', sourceKey: 'github-issue:12' }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Mark done' }));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['done'] }]));
    expect(within(column('done')).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('intake')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given a card, when Remove is chosen from the menu, then the item is deleted and the card disappears', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-1', title: 'Fix flaky test', source: 'github-issue', sourceKey: 'github-issue:12' }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    await waitFor(() => expect(state.deletes).toEqual(['wi-1']));
    await waitFor(() => expect(screen.queryByTestId('work-item-card')).not.toBeInTheDocument());
  });

  it('given a candidate, when "Add to board" is chosen, then a work item is filed into Intake without starting a run', async () => {
    const state = useBoardHandlers({ issues });
    renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'More actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Add to board' }));

    await waitFor(() =>
      expect(state.posts).toMatchObject([
        { source: 'github-issue', sourceKey: 'github-issue:12', title: 'Fix flaky test', stages: ['intake'] },
      ]),
    );
    // The candidate card is replaced by the persisted card; no run was started.
    expect(await within(column('intake')).findByTestId('work-item-card')).toBeInTheDocument();
    expect(within(column('intake')).getAllByTestId('candidate-card')).toHaveLength(1); // issue #15 remains
  });
});

describe('Factory Board — drag and drop', () => {
  it('given a persisted card in Intake, when dragged to Building, then the stages PATCH and the card moves optimistically', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-1', title: 'Fix flaky test', source: 'github-issue', sourceKey: 'github-issue:12' }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    dragTo(within(column('intake')).getByTestId('work-item-card'), column('execute'));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['execute'] }]));
    expect(within(column('execute')).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('intake')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given a multi-stage card, when dragged from Review to Done, then done replaces all stages', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Parallel effort',
          source: 'github-pr',
          sourceKey: 'github-pr:34',
          stages: ['execute', 'review'],
        }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    dragTo(within(column('review')).getByTestId('work-item-card'), column('done'));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['done'] }]));
    expect(within(column('done')).getByText('Parallel effort')).toBeInTheDocument();
    expect(within(column('execute')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given an unmaterialized candidate, when dragged to Building, then a work item is filed with that stage and no run starts', async () => {
    const state = useBoardHandlers({ issues });
    renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    dragTo(within(intake).getAllByTestId('candidate-card')[0]!, column('execute'));

    await waitFor(() =>
      expect(state.posts).toMatchObject([
        { source: 'github-issue', sourceKey: 'github-issue:12', title: 'Fix flaky test', stages: ['execute'] },
      ]),
    );
    expect(await within(column('execute')).findByText('Fix flaky test')).toBeInTheDocument();
    // No worktree/run side effects from a drop: the card is filed, nothing else.
    expect(within(column('intake')).queryByText('Fix flaky test')).not.toBeInTheDocument();
  });

  it(`given a drop on the card's own column, when it lands, then no PATCH is sent`, async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-1', title: 'Fix flaky test', source: 'github-issue', sourceKey: 'github-issue:12' }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    dragTo(within(column('intake')).getByTestId('work-item-card'), column('intake'));

    // Give any accidental mutation a tick to fire.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(state.patches).toEqual([]);
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

describe('Factory Board — investigate flow', () => {
  it('given an issue candidate, when Investigate is clicked, then a worktree, thread, and prompt are created, a work item materializes into Planning, and the app navigates to the thread', async () => {
    const state = useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.threadTitles).toEqual(['Issue #12: Fix flaky test']);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(captured.messages[0]!.message).toContain('GitHub issue #12 (https://github.com/mastra-ai/mastra/issues/12)');
    expect(captured.messages[0]!.message).not.toContain('Fix flaky test');
    // The run files a board record in the planning stage with the plan session ref.
    expect(state.posts).toMatchObject([
      {
        source: 'github-issue',
        sourceKey: 'github-issue:12',
        title: 'Fix flaky test',
        stages: ['planning'],
        sessions: {
          plan: {
            projectPath: '/sandbox/mastra/worktrees/factory-issue-12',
            branch: 'factory/issue-12',
            threadId: 'thread-factory',
          },
        },
      },
    ]);
  });

  it('given an issue candidate, when Build is chosen from the menu, then a work item materializes into Building with a work session', async () => {
    const state = useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'More actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Build' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.messages[0]!.message).toContain('Implement a fix for GitHub issue #12');
    expect(state.posts).toMatchObject([
      {
        source: 'github-issue',
        sourceKey: 'github-issue:12',
        stages: ['execute'],
        sessions: { work: { branch: 'factory/issue-12', threadId: 'thread-factory' } },
      },
    ]);
  });

  it('given board-card filing that fails, when Investigate is clicked, then the run still succeeds and navigates to the thread', async () => {
    useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    // The card filing endpoint blows up, but the run itself already succeeded.
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${GITHUB_PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { router } = renderAt('/factory/board');

      const intake = await screen.findByTestId('board-column-intake');
      await within(intake).findByText('Fix flaky test');
      await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

      // Filing is best-effort: the user still lands on the running thread.
      await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
      expect(captured.messages).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalledWith('Failed to file the board card for this run', expect.anything());
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('given a PR candidate in Intake, when Review is clicked, then the review prompt runs and a work item materializes into Review with a review session', async () => {
    const state = useBoardHandlers({ pullRequests });
    const captured = useFactoryRunHandlers('factory-pr-34');
    const { router } = renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    const sources = within(intake).getByRole('group', { name: 'Intake source' });
    await userEvent.click(within(sources).getByRole('button', { name: 'PRs' }));
    await within(intake).findByText('Add factory pages');
    await userEvent.click(within(intake).getByRole('button', { name: 'Review Add factory pages' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/pr-34' });
    expect(captured.threadTitles).toEqual(['PR #34: Add factory pages']);
    expect(captured.messages[0]!.message).toContain('understand-pr skill');
    expect(captured.messages[0]!.message).toContain(
      'GitHub pull request #34 (https://github.com/mastra-ai/mastra/pull/34)',
    );
    expect(captured.messages[0]!.message).toContain('gh pr checkout 34');
    expect(captured.messages[0]!.message).not.toContain('Add factory pages');
    expect(captured.messages[0]!.message).not.toContain('feat/factory-pages');
    expect(state.posts).toMatchObject([
      {
        source: 'github-pr',
        sourceKey: 'github-pr:34',
        stages: ['review'],
        sessions: { review: { branch: 'factory/pr-34', threadId: 'thread-factory' } },
      },
    ]);
  });

  it('given a Linear candidate, when Investigate is clicked, then the prompt mentions the linear_get_issue tool', async () => {
    useBoardHandlers({ linearIssues });
    const captured = useFactoryRunHandlers('factory-linear-eng-42');
    const { router } = renderAt('/factory/board', githubProject, connectedStatus, {
      linearStatus: linearConnectedStatus,
    });

    const intake = await screen.findByTestId('board-column-intake');
    const sources = await within(intake).findByRole('group', { name: 'Intake source' });
    await userEvent.click(within(sources).getByRole('button', { name: 'Linear' }));
    await within(intake).findByText('Fix intake sync');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix intake sync' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/linear-eng-42' });
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(captured.messages[0]!.message).toContain('Linear issue ENG-42 (https://linear.app/acme/issue/ENG-42)');
    expect(captured.messages[0]!.message).toContain('linear_get_issue');
    expect(captured.messages[0]!.message).not.toContain('Fix intake sync');
  });

  it('given an issue candidate, when a custom prompt is submitted, then the run keeps the issue context and adds the typed guidance', async () => {
    useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'More actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom prompt…' }));

    const form = await screen.findByRole('form', { name: 'Custom prompt for Fix flaky test' });
    await userEvent.type(
      within(form).getByRole('textbox', { name: 'Prompt for Fix flaky test' }),
      'Write a failing test first',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.messages).toHaveLength(1);
    // The base issue context survives; the typed text guides the run instead
    // of the explicit skill directive.
    expect(captured.messages[0]!.message).toContain(
      'Investigate GitHub issue #12 (https://github.com/mastra-ai/mastra/issues/12)',
    );
    expect(captured.messages[0]!.message).toContain('Guidance for this run: Write a failing test first');
    expect(captured.messages[0]!.message).not.toContain('Fix flaky test');
    expect(captured.messages[0]!.message).not.toContain('understand-issue skill');
  });

  it('given a persisted issue card without a plan session, when Investigate is chosen, then the run starts and the card PATCHes into Planning with the session ref', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          url: 'https://github.com/mastra-ai/mastra/issues/12',
          stages: ['intake'],
          metadata: { number: 12 },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(captured.messages[0]!.message).toContain('GitHub issue #12 (https://github.com/mastra-ai/mastra/issues/12)');
    expect(captured.messages[0]!.message).not.toContain('Fix flaky test');
    expect(state.patches).toMatchObject([
      {
        id: 'wi-1',
        stages: ['planning'],
        sessions: { plan: { branch: 'factory/issue-12', threadId: 'thread-factory' } },
      },
    ]);
  });

  it('given a card with a legacy plan ref, when Build is chosen, then filing repoints every role at the run thread', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          url: 'https://github.com/mastra-ai/mastra/issues/12',
          stages: ['planning'],
          metadata: { number: 12 },
          // Legacy ref from before scoping was fixed: dead worktree, own thread.
          sessions: {
            plan: {
              projectPath: '/gone/worktree',
              branch: 'factory/issue-12',
              threadId: 'thread-legacy-plan',
              startedBy: 'user-1',
            },
          },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-planning');
    await userEvent.click(within(column('planning')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Build' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    // One thread per item: every role ref converges onto the run's thread.
    expect(state.patches).toMatchObject([
      {
        id: 'wi-1',
        stages: ['execute'],
        sessions: {
          plan: { branch: 'factory/issue-12', threadId: 'thread-factory' },
          work: { branch: 'factory/issue-12', threadId: 'thread-factory' },
        },
      },
    ]);
  });

  it('given a repeat run on the same item, when the worktree session already has a thread, then the prompt lands on that thread instead of creating a new one', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-pr',
          title: 'Add factory pages',
          source: 'github-pr',
          sourceKey: 'github-pr:34',
          url: 'https://github.com/mastra-ai/mastra/pull/34',
          stages: ['review'],
          metadata: { number: 34, headBranch: 'feat/factory-pages', baseBranch: 'main' },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-pr-34');
    const { router } = renderAt('/factory/board');
    // The worktree session resumes a real (titled) thread from a previous run.
    // Registered after renderAt so it takes precedence over the default empty
    // thread list from useAppHandlers (MSW resolves newest-first).
    server.use(
      http.get(`${SESSION}/threads`, () =>
        HttpResponse.json({
          threads: [{ id: THREAD_ID, resourceId: RESOURCE_ID, title: 'PR #34: Add factory pages' }],
        }),
      ),
      http.post(`${SESSION}/thread`, () => HttpResponse.json({ ok: true })),
    );

    await screen.findByTestId('board-column-review');
    await userEvent.click(within(column('review')).getByRole('button', { name: 'Actions for Add factory pages' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Review' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/threads/${THREAD_ID}`));
    // No new thread was created — the resumed thread carried the follow-up run.
    expect(captured.threadTitles).toEqual([]);
    expect(captured.messages).toHaveLength(1);
    expect(captured.messages[0]!.message).toContain('understand-pr skill');
    expect(state.patches).toMatchObject([
      {
        id: 'wi-pr',
        stages: ['review'],
        sessions: { review: { branch: 'factory/pr-34', threadId: THREAD_ID } },
      },
    ]);
  });

  it('given the worktree call fails, when Investigate is clicked, then an error notice renders and no work item is filed', async () => {
    const state = useBoardHandlers({ issues });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, () =>
        HttpResponse.json({ error: 'git_error', message: 'worktree failed' }, { status: 502 }),
      ),
    );
    const { router } = renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    expect(await screen.findByText('worktree failed')).toBeInTheDocument();
    expect(state.posts).toEqual([]);
    expect(router.state.location.pathname).toBe('/factory/board');
  });
});
