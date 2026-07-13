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
import { afterEach, describe, expect, it } from 'vitest';

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
}

interface BoardHandlerOptions {
  workItems?: WorkItem[];
  issues?: GithubIssue[];
  pullRequests?: GithubPullRequest[];
  linearIssues?: LinearIssue[];
}

/**
 * Registers the Board's data handlers: candidate feeds (issues/PRs/Linear) and
 * an in-memory work-items store that records writes and echoes server-shaped
 * rows back, so the UI's cache updates behave like production.
 */
function useBoardHandlers(options: BoardHandlerOptions = {}): BoardState {
  const state: BoardState = { items: [...(options.workItems ?? [])], posts: [], patches: [], deletes: [] };
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${GITHUB_PROJECT_ID}/issues`, () =>
      HttpResponse.json({ issues: options.issues ?? [], nextPage: null }),
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
    expect(within(nav).getByRole('link', { name: /Board/ })).toHaveAttribute('href', '/factory/board');
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
  it('given open issues and PRs, when the Board renders, then issues appear as Intake candidates and PRs as Review candidates', async () => {
    useBoardHandlers({ issues, pullRequests });
    renderAt('/factory/board');

    expect(await screen.findByRole('heading', { name: 'Board' })).toBeInTheDocument();
    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix flaky test')).toBeInTheDocument();
    expect(within(intake).getByText('Improve docs')).toBeInTheDocument();
    expect(within(intake).getAllByTestId('candidate-card')).toHaveLength(2);
    // Candidates link out to GitHub.
    expect(within(intake).getByText('Fix flaky test').closest('a')).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/12',
    );
    // Open PRs are review work: they land in the Review column, not Intake.
    const review = column('review');
    expect(await within(review).findByText('Add factory pages')).toBeInTheDocument();
    expect(within(review).getAllByTestId('candidate-card')).toHaveLength(1);
    expect(within(intake).queryByText('Add factory pages')).not.toBeInTheDocument();
  });

  it('given a source filter, when a pill is toggled, then only matching cards and candidates stay visible', async () => {
    useBoardHandlers({
      issues,
      pullRequests,
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
    renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');

    const filters = screen.getByRole('group', { name: 'Filter by source' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Pull requests' }));

    // Only the PR candidate survives the filter.
    expect(within(column('review')).getByText('Add factory pages')).toBeInTheDocument();
    expect(within(column('intake')).queryByText('Fix flaky test')).not.toBeInTheDocument();
    expect(within(column('execute')).queryByText('Linear card')).not.toBeInTheDocument();

    await userEvent.click(within(filters).getByRole('button', { name: 'Linear' }));
    expect(within(column('execute')).getByText('Linear card')).toBeInTheDocument();
    expect(within(column('review')).queryByText('Add factory pages')).not.toBeInTheDocument();

    await userEvent.click(within(filters).getByRole('button', { name: 'All' }));
    expect(within(column('intake')).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('review')).getByText('Add factory pages')).toBeInTheDocument();
    expect(within(column('execute')).getByText('Linear card')).toBeInTheDocument();
  });

  it('given Linear is connected and selected, when the Board renders, then Linear issues appear as candidates', async () => {
    useBoardHandlers({ linearIssues });
    renderAt('/factory/board', githubProject, connectedStatus, { linearStatus: linearConnectedStatus });

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix intake sync')).toBeInTheDocument();
    expect(within(intake).getByText(/ENG-42/)).toBeInTheDocument();
  });

  it('given the Linear feature is disabled, when the Board renders, then no Linear candidates appear', async () => {
    useBoardHandlers({ issues, linearIssues });
    renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix flaky test')).toBeInTheDocument();
    expect(within(intake).queryByText('Fix intake sync')).not.toBeInTheDocument();
  });

  it('given a work item exists for an issue, when the Board renders, then the candidate is deduped by source key', async () => {
    useBoardHandlers({
      issues,
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
    // Issue #15 is still a candidate; issue #12 lives on as a card in In progress.
    expect(await within(intake).findByText('Improve docs')).toBeInTheDocument();
    expect(within(intake).queryByText('Fix flaky test')).not.toBeInTheDocument();
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
    expect(within(reviewCard).getByText('In progress')).toBeInTheDocument();
  });

  it('given a work item with sessions, when the Board renders, then the card links to each role thread', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
          sessions: {
            work: {
              projectPath: '/sandbox/mastra/worktrees/factory-issue-12',
              branch: 'factory/issue-12',
              threadId: 'thread-work',
              startedBy: 'user-1',
            },
          },
        }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    expect(within(card).getByRole('link', { name: /work thread/ })).toHaveAttribute('href', '/threads/thread-work');
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
  it('given a persisted card in Intake, when dragged to In progress, then the stages PATCH and the card moves optimistically', async () => {
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

  it('given an unmaterialized candidate, when dragged to In progress, then a work item is filed with that stage and no run starts', async () => {
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
  it('given an issue candidate, when Investigate is clicked, then a worktree, thread, and prompt are created, a work item materializes into In progress, and the app navigates to the thread', async () => {
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
    expect(captured.messages[0]!.message).toContain('https://github.com/mastra-ai/mastra/issues/12');
    // The run files a board record in the execute stage with the work session ref.
    expect(state.posts).toMatchObject([
      {
        source: 'github-issue',
        sourceKey: 'github-issue:12',
        title: 'Fix flaky test',
        stages: ['execute'],
        sessions: {
          work: {
            projectPath: '/sandbox/mastra/worktrees/factory-issue-12',
            branch: 'factory/issue-12',
            threadId: 'thread-factory',
          },
        },
      },
    ]);
  });

  it('given a PR candidate, when Review is clicked, then the review prompt runs and a work item materializes into Review with a review session', async () => {
    const state = useBoardHandlers({ pullRequests });
    const captured = useFactoryRunHandlers('factory-pr-34');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    const review = column('review');
    await within(review).findByText('Add factory pages');
    await userEvent.click(within(review).getByRole('button', { name: 'Review Add factory pages' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/pr-34' });
    expect(captured.threadTitles).toEqual(['PR #34: Add factory pages']);
    expect(captured.messages[0]!.message).toContain('understand-pr skill');
    expect(captured.messages[0]!.message).toContain('gh pr checkout 34');
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
    await within(intake).findByText('Fix intake sync');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix intake sync' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/linear-eng-42' });
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(captured.messages[0]!.message).toContain('linear_get_issue');
  });

  it('given an issue candidate, when a custom prompt is submitted from the action menu, then the run starts with the typed prompt', async () => {
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
    expect(captured.messages[0]!.message).toContain('Write a failing test first');
    expect(captured.messages[0]!.message).not.toContain('understand-issue skill');
  });

  it('given a persisted issue card without a work session, when Start work is chosen, then the run starts and the card PATCHes into In progress with the session ref', async () => {
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
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Start work' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.messages[0]!.message).toContain('understand-issue skill');
    expect(state.patches).toMatchObject([
      {
        id: 'wi-1',
        stages: ['execute'],
        sessions: { work: { branch: 'factory/issue-12', threadId: 'thread-factory' } },
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
