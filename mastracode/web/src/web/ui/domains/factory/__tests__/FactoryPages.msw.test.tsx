/**
 * BDD coverage for the Factory Board page and sidebar section.
 *
 * Drives the real route table through a memory router with the full provider
 * stack (auth guard, Chat providers, ActiveFactory context), so the specs
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
import type { GithubStatus, Factory } from '../../workspaces';
import { createAppRoutes } from '../../../router';
import { FactoryItemActions } from '../components/FactoryItemActions';
import type { FactoryDecisionSummary } from '../services/decisions';
import type { GithubIssue, GithubPullRequest } from '../services/factory';
import type { IntakeConfig } from '../services/intake';
import type { LinearIssue, LinearStatus } from '../services/linear';
import type { CreateWorkItemInput, UpdateWorkItemInput, WorkItem } from '../services/workItems';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-gh';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const FACTORY_PROJECT_ID = 'fp-github-project-1';
const PROJECT_REPOSITORY_ID = 'repo-link-1';

const githubRepository = {
  projectRepositoryId: PROJECT_REPOSITORY_ID,
  slug: 'mastra-ai/mastra',
  gitBranch: 'main',
  sandboxWorkdir: '/sandbox/mastra',
  selectedWorktreePath: '/sandbox/mastra/worktrees/main',
  worktrees: [{ branch: 'main', worktreePath: '/sandbox/mastra/worktrees/main', baseBranch: 'main' }],
};

const githubProject: Factory = {
  id: 'project-gh',
  name: 'mastra-ai/mastra',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'factory',
    factoryProjectId: FACTORY_PROJECT_ID,
    repositories: [githubRepository],
  },
};

const localProject: Factory = {
  id: 'project-local',
  name: 'Local',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/projects/local',
  },
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

function sessionState(threadId = THREAD_ID) {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId,
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
  github: { enabled: true, repositoryIds: [PROJECT_REPOSITORY_ID] },
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
  sessionThreadId?: string;
}

function useAppHandlers(githubStatus: GithubStatus, options: AppHandlerOptions = {}) {
  let boundThreadId = options.sessionThreadId ?? THREAD_ID;
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(githubStatus)),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ config: options.intakeConfig ?? defaultIntakeConfig }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json(options.linearStatus ?? linearDisabledStatus),
    ),
    http.post(`${API}/sessions`, async ({ request }) => {
      const body = (await request.json()) as { sessionScope?: string };
      if (body.sessionScope && options.sessionThreadId) {
        boundThreadId = body.sessionScope.includes('factory-pr-34') ? 'thread-related-review' : THREAD_ID;
      } else if (body.sessionScope) {
        boundThreadId = 'thread-factory';
      }
      return HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: boundThreadId });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState(boundThreadId))),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState(boundThreadId))),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, ({ request }) => {
      const scoped = new URL(request.url).searchParams.has('sessionScope');
      return HttpResponse.json({
        threads: [
          ...(scoped ? [{ id: 'thread-factory', resourceId: RESOURCE_ID, title: 'Untitled thread' }] : []),
          { id: THREAD_ID, resourceId: RESOURCE_ID, title: 'Existing thread' },
          { id: 'thread-work', resourceId: RESOURCE_ID, title: 'Worker thread' },
          { id: 'thread-related-review', resourceId: RESOURCE_ID, title: 'Related review thread' },
        ],
      });
    }),
    http.post(`${SESSION}/thread`, async ({ request }) => {
      boundThreadId = ((await request.json()) as { threadId: string }).threadId;
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${SESSION}/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => emptySse()),
  );
}

/** A full WorkItem row with sensible defaults, as the server would return it. */
function makeWorkItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'id' | 'title'>): WorkItem {
  return {
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: FACTORY_PROJECT_ID,
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
    ...overrides,
    revision: overrides.revision ?? 1,
  };
}

interface BoardState {
  items: WorkItem[];
  posts: CreateWorkItemInput[];
  patches: Array<{ id: string; stages?: string[] } & UpdateWorkItemInput>;
  starts: Array<{ kickoffMessage: string | null; destinationStage: string; workItem: { id: string; role: string } }>;
  deletes: string[];
  triageRequests: Array<{ number: number; body: unknown }>;
  issueRequests: Array<string | null>;
  decisionRetries: string[];
}

interface BoardHandlerOptions {
  workItems?: WorkItem[];
  decisions?: FactoryDecisionSummary[];
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
    starts: [],
    deletes: [],
    triageRequests: [],
    issueRequests: [],
    decisionRetries: [],
  };
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/issues`, ({ request }) => {
      const label = new URL(request.url).searchParams.get('label');
      state.issueRequests.push(label);
      return HttpResponse.json({
        issues: label === 'auto-triaged' ? (options.triageIssues ?? []) : (options.issues ?? []),
        nextPage: null,
      });
    }),
    http.post(
      `${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/issues/:number/triage`,
      async ({ request, params }) => {
        state.triageRequests.push({ number: Number(params.number), body: await request.json() });
        return HttpResponse.json({ ok: true, threadId: 'thread-triage' }, { status: 202 });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: options.pullRequests ?? [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
      HttpResponse.json({ issues: options.linearIssues ?? [], nextCursor: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items`, () =>
      HttpResponse.json({ workItems: state.items }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/decisions`, ({ request }) => {
      const statuses = new URL(request.url).searchParams.get('statuses')?.split(',');
      const decisions = (options.decisions ?? []).filter(decision => !statuses || statuses.includes(decision.status));
      return HttpResponse.json({ decisions });
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/decisions/:decisionId/retry`,
      ({ params }) => {
        const decisionId = String(params.decisionId);
        state.decisionRetries.push(decisionId);
        const decision = (options.decisions ?? []).find(candidate => candidate.id === decisionId);
        if (!decision || decision.status !== 'failed') {
          return HttpResponse.json({ error: 'decision_not_retryable' }, { status: 409 });
        }
        decision.status = 'retry';
        decision.completedAt = null;
        return HttpResponse.json({ decision });
      },
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items`, async ({ request }) => {
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
        parentWorkItemId: body.parentWorkItemId ?? null,
        url: body.url ?? null,
        stages: body.stages,
        sessions,
        metadata: body.metadata ?? {},
      });
      state.items = [...state.items.filter(i => i.sourceKey !== item.sourceKey || item.sourceKey === null), item];
      return HttpResponse.json({ workItem: item }, { status: 201 });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/runs/start`, async ({ request }) => {
      const body = (await request.json()) as {
        resourceId: string;
        projectPath: string;
        branch: string;
        kickoffMessage: string | null;
        destinationStage: string;
        workItem: { id: string; role: string };
      };
      state.starts.push({
        kickoffMessage: body.kickoffMessage,
        destinationStage: body.destinationStage,
        workItem: body.workItem,
      });
      const existing = state.items.find(item => item.id === body.workItem.id);
      if (!existing) return HttpResponse.json({ error: 'Work item not found' }, { status: 404 });
      const session = {
        projectPath: body.projectPath,
        branch: body.branch,
        threadId: 'thread-factory',
        startedBy: 'user-1',
      };
      const updated = {
        ...existing,
        revision: existing.revision + 1,
        stages: [body.destinationStage],
        sessions: { ...existing.sessions, [body.workItem.role]: session },
      };
      state.items = state.items.map(item => (item.id === existing.id ? updated : item));
      state.patches.push({
        id: existing.id,
        stages: [body.destinationStage],
        sessions: { [body.workItem.role]: session },
      });
      return HttpResponse.json(
        {
          prepared: {
            workItemId: existing.id,
            bindingId: 'binding-1',
            threadId: 'thread-factory',
            resourceId: body.resourceId,
            projectPath: body.projectPath,
            branch: body.branch,
            revision: updated.revision,
            kickoffStatus: 'pending',
            replayed: false,
          },
        },
        { status: 202 },
      );
    }),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items/:id/transition`,
      async ({ request, params }) => {
        const id = params.id as string;
        const body = (await request.json()) as { stage: string; expectedRevision: number };
        state.patches.push({ id, stages: [body.stage] });
        const existing = state.items.find(item => item.id === id) ?? makeWorkItem({ id, title: 'unknown' });
        const updated = { ...existing, stages: [body.stage], revision: existing.revision + 1 };
        state.items = state.items.map(item => (item.id === id ? updated : item));
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-1',
            itemId: id,
            revision: updated.revision,
            stage: body.stage,
            decisions: [],
          },
        });
      },
    ),
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
        ...(body.parentWorkItemId !== undefined ? { parentWorkItemId: body.parentWorkItemId } : {}),
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

function seedActiveFactory(project: Factory) {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-factory', project.id);
}

function renderAt(
  initialEntry: string,
  project: Factory = githubProject,
  githubStatus: GithubStatus = connectedStatus,
  options: AppHandlerOptions = {},
) {
  seedActiveFactory(project);
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
  it('given a GitHub project, when the app renders, then Factory exposes sibling Work and Review links', async () => {
    useBoardHandlers();
    renderAt('/factory/work');

    const nav = await screen.findByRole('navigation', { name: 'Factory' });
    expect(within(nav).getByText('Factory')).toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: 'Work' })).toHaveAttribute('href', '/factory/work');
    expect(within(nav).getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/factory/review');
    expect(within(nav).getByRole('link', { name: /Metrics/ })).toHaveAttribute('href', '/factory/metrics');
    expect(within(nav).getByRole('link', { name: /Audit/ })).toHaveAttribute('href', '/factory/audit');
    expect(within(nav).getByRole('region', { name: 'Factory sessions' })).toBeInTheDocument();
  });

  it('given a local project, when the app renders, then the Factory section is hidden', async () => {
    renderAt('/new', localProject);

    expect(await screen.findByText('What do you want to work on?')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Factory' })).not.toBeInTheDocument();
  });

  it('given GitHub is not connected, when the app renders, then workflow links and Sessions remain', async () => {
    renderAt('/new', githubProject, notConnectedStatus);

    const nav = await screen.findByRole('navigation', { name: 'Factory' });
    expect(within(nav).getByRole('region', { name: 'Factory sessions' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/factory/work');
    expect(within(nav).getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/factory/review');
    expect(within(nav).getByRole('link', { name: /Metrics/ })).toHaveAttribute('href', '/factory/metrics');
    expect(within(nav).getByRole('link', { name: /Audit/ })).toHaveAttribute('href', '/factory/audit');
  });
});

describe('Factory workflow routing', () => {
  it.each(['/factory/board', '/factory/intake'])(
    'given the compatibility route %s, when visited, then it redirects to Work',
    async route => {
      useBoardHandlers();
      const { router } = renderAt(route);

      await waitFor(() => expect(router.state.location.pathname).toBe('/factory/work'));
      expect(await screen.findByRole('heading', { name: 'Work' })).toBeInTheDocument();
    },
  );

  it('given the Review route, when visited, then the Review workflow renders without redirecting', async () => {
    useBoardHandlers({ pullRequests });
    const { router } = renderAt('/factory/review');

    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factory/review');
  });

  it('given a local project, when visiting Work, then a server-factory notice renders instead of columns', async () => {
    renderAt('/factory/work', localProject);

    expect(
      await screen.findByText(/Board, metrics, and audit are available for server-backed Factories/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('board-column-intake')).not.toBeInTheDocument();
  });

  it('given a factory with no linked repositories, when visiting Work, then a connect prompt renders instead of columns', async () => {
    const emptyFactory: Factory = {
      ...githubProject,
      binding: { kind: 'factory', factoryProjectId: FACTORY_PROJECT_ID, repositories: [] },
    };
    renderAt('/factory/work', emptyFactory, notConnectedStatus);

    expect(await screen.findByText(/Connect a repository to start intake/)).toBeInTheDocument();
    expect(screen.queryByTestId('board-column-intake')).not.toBeInTheDocument();
  });
});

describe('Factory Work and Review intake candidates', () => {
  it('given open issues and PRs, when Work renders, then only issue candidates appear', async () => {
    const state = useBoardHandlers({ issues, pullRequests });
    renderAt('/factory/work');

    expect(await screen.findByRole('heading', { name: 'Work' })).toBeInTheDocument();
    await waitFor(() => expect(state.issueRequests).toEqual(expect.arrayContaining([null, 'auto-triaged'])));
    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix flaky test')).toBeInTheDocument();
    expect(within(intake).getByText('Improve docs')).toBeInTheDocument();
    expect(within(intake).getAllByTestId('candidate-card')).toHaveLength(2);
    // Candidates link out to GitHub via the external-link icon (the title
    // opens the session) without exposing implementation label chips.
    const flakyCandidate = within(intake).getByRole('article', { name: 'Fix flaky test' });
    expect(within(flakyCandidate).getByRole('link', { name: 'Open in GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/12',
    );
    expect(within(flakyCandidate).queryByText('bug')).not.toBeInTheDocument();
    // PRs never appear as Work intake candidates — they live on the Review board.
    expect(within(intake).queryByText('Add factory pages')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Intake source' })).not.toBeInTheDocument();
  });

  it('given an external PR, when Review renders, then it stays in Intake without an automatic session or dispatch', async () => {
    const state = useBoardHandlers({ issues, pullRequests });
    renderAt('/factory/review');

    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument();
    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Add factory pages')).toBeInTheDocument();
    expect(within(intake).queryByText('Fix flaky test')).not.toBeInTheDocument();
    expect(screen.getByTestId('board-column-review')).toHaveAccessibleName('Reviewing');
    expect(screen.queryByTestId('board-column-triage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-column-planning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('board-column-execute')).not.toBeInTheDocument();
    expect(state.posts).toHaveLength(0);
  });

  it('given a PR from a Factory issue branch, when it is added to Review, then the issue relation is persisted', async () => {
    const state = useBoardHandlers({
      pullRequests: [{ ...pullRequests[0], headBranch: 'factory/issue-12' }],
      workItems: [
        makeWorkItem({
          id: 'wi-issue',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
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
    renderAt('/factory/review');

    const intake = await screen.findByTestId('board-column-intake');
    await userEvent.click(await within(intake).findByRole('button', { name: 'More actions for Add factory pages' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Add to board' }));

    await waitFor(() => expect(state.posts).toEqual([expect.objectContaining({ parentWorkItemId: 'wi-issue' })]));
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
        github: { enabled: false, repositoryIds: [] },
        linear: { enabled: false, projectIds: [] },
      },
    });

    const intake = await screen.findByTestId('board-column-intake');
    expect(within(intake).queryByRole('link', { name: 'Create GitHub issue' })).not.toBeInTheDocument();
  });

  it('given the repository slug is not a canonical GitHub repository, when the Board renders, then no issue URL is invented', async () => {
    useBoardHandlers();
    renderAt('/factory/board', {
      ...githubProject,
      binding: {
        kind: 'factory',
        factoryProjectId: FACTORY_PROJECT_ID,
        repositories: [{ ...githubRepository, slug: '../not-a-repository' }],
      },
    });

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
          sourceKey: 'github-pr:34',
          stages: ['review'],
        }),
      ],
    });
    const scrollTo = vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => undefined);
    const offsetLeft = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.testid === 'board-column-review' ? 864 : 0;
    });

    try {
      const { client } = renderAt('/factory/review');
      const review = await screen.findByTestId('board-column-review');
      expect(await within(review).findByText('Add factory pages')).toBeInTheDocument();
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ left: 864, behavior: 'auto' }));

      scrollTo.mockClear();
      await client.invalidateQueries();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      offsetLeft.mockRestore();
      scrollTo.mockRestore();
    }
  });

  it('given the user moves the Board before feeds settle, when content loads, then automatic positioning does not override them', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: '00000000-0000-4000-8000-000000000042',
          title: 'Add factory pages',
          source: 'github-pr',
          sourceKey: 'github-pr:34',
          stages: ['review'],
        }),
      ],
    });
    let resolvePulls!: () => void;
    const pullsReady = new Promise<void>(resolve => {
      resolvePulls = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/prs`, async () => {
        await pullsReady;
        return HttpResponse.json({ pullRequests: [], nextPage: null });
      }),
    );
    const scrollTo = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo;

    try {
      const { client } = renderAt('/factory/review');
      fireEvent.wheel(await screen.findByLabelText('Board columns'));
      resolvePulls();

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
        `${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/issues/:number/triage`,
        async ({ request, params }) => {
          state.triageRequests.push({ number: Number(params.number), body: await request.json() });
          await triageStarted;
          return HttpResponse.json({ ok: true, threadId: 'thread-triage' }, { status: 202 });
        },
      ),
    );
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    const card = await within(intake).findByRole('article', { name: 'Fix flaky test' });
    await userEvent.click(within(card).getByRole('button', { name: 'More actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Triage issue' }));

    await waitFor(() => expect(state.triageRequests).toHaveLength(1));
    expect(within(card).getByRole('button', { name: 'Investigate Fix flaky test' })).toBeEnabled();
    await userEvent.click(within(card).getByRole('button', { name: 'More actions for Fix flaky test' }));
    expect(await screen.findByRole('menuitem', { name: 'Starting…' })).toHaveAttribute('aria-disabled', 'true');
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/factory/work'));
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
    renderAt('/factory/work');

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
    renderAt('/factory/work');

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
    renderAt('/factory/work', githubProject, connectedStatus, { linearStatus: linearConnectedStatus });

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
    renderAt('/factory/work', githubProject, connectedStatus, { linearStatus: linearConnectedStatus });

    const intake = await screen.findByTestId('board-column-intake');
    const sources = await within(intake).findByRole('group', { name: 'Intake source' });
    await userEvent.click(within(sources).getByRole('button', { name: 'Linear' }));
    expect(await within(intake).findByText('Fix intake sync')).toBeInTheDocument();
    expect(within(intake).getByText(/ENG-42/)).toBeInTheDocument();
  });

  it('given the Linear feature is disabled, when the Board renders, then no Linear candidates or Linear feed pill appear', async () => {
    useBoardHandlers({ issues, linearIssues });
    renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText('Fix flaky test')).toBeInTheDocument();
    expect(within(intake).queryByText('Fix intake sync')).not.toBeInTheDocument();
    // Work has only the Issues feed when Linear is unavailable; PR intake is
    // owned by the sibling Review workflow.
    expect(within(intake).queryByRole('group', { name: 'Intake source' })).not.toBeInTheDocument();
  });

  it('given a rule-materialized issue exists, when the Board renders, then candidates from both issue feeds are deduped by GitHub identity', async () => {
    useBoardHandlers({
      issues,
      triageIssues: [{ ...issues[0]!, labels: ['auto-triaged'] }],
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github:1299788251:issue:12',
          metadata: { githubIssueNumber: 12 },
          stages: ['execute'],
        }),
      ],
    });
    renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    // Issue #15 is still a candidate; issue #12 lives on as a card in Building.
    expect(await within(intake).findByText('Improve docs')).toBeInTheDocument();
    expect(within(intake).queryByText('Fix flaky test')).not.toBeInTheDocument();
    expect(within(column('triage')).queryByText('Fix flaky test')).not.toBeInTheDocument();
    expect(within(column('execute')).getByText('Fix flaky test')).toBeInTheDocument();
  });

  it('given a rule-materialized pull request exists, when Review renders, then its live candidate is deduped by GitHub identity', async () => {
    useBoardHandlers({
      pullRequests,
      workItems: [
        makeWorkItem({
          id: 'wi-pr',
          title: 'Add factory pages',
          source: 'github-pr',
          sourceKey: 'github:1299788251:pull-request:34',
          metadata: { githubPullRequestNumber: 34 },
          stages: ['review'],
        }),
      ],
    });
    renderAt('/factory/review');

    await screen.findByTestId('board-column-intake');
    expect(within(column('intake')).queryByText('Add factory pages')).not.toBeInTheDocument();
    expect(within(column('review')).getByText('Add factory pages')).toBeInTheDocument();
  });
});

describe('Factory item actions', () => {
  it('given a custom prompt opened before the action starts, then the stale form cannot duplicate the pending action', async () => {
    const onRunPrompt = vi.fn();
    const props = {
      actionLabel: 'Investigate',
      itemLabel: 'Fix flaky test',
      disabled: false,
      onAction: vi.fn(),
      onRunPrompt,
    };
    const view = renderWithProviders(<FactoryItemActions {...props} starting={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'More actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Custom prompt…' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Prompt for Fix flaky test' }), 'Check the race');
    view.rerender(<FactoryItemActions {...props} starting />);

    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Custom prompt for Fix flaky test' }));
    expect(onRunPrompt).not.toHaveBeenCalled();
  });
});

describe('Factory Board — persisted cards', () => {
  it('given a work item in multiple stages, when its title opens a session, then it targets the clicked column', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Parallel effort',
          source: 'github-issue',
          sourceKey: 'github-issue:34',
          stages: ['execute', 'review'],
        }),
      ],
    });
    const captured = useFactoryRunHandlers('item-wi-1');
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    const executeCard = within(column('execute')).getByTestId('work-item-card');
    const reviewCard = within(column('review')).getByTestId('work-item-card');
    expect(within(executeCard).getByText('Parallel effort')).toBeInTheDocument();
    expect(within(reviewCard).getByText('Parallel effort')).toBeInTheDocument();
    // Each card chips the item's other stage.
    expect(within(executeCard).getByText('Review')).toBeInTheDocument();
    expect(within(reviewCard).getByText('Building')).toBeInTheDocument();

    await userEvent.click(within(executeCard).getByRole('button', { name: 'Issue: Parallel effort' }));
    await waitFor(() =>
      expect(captured.starts).toContainEqual({
        kickoffMessage: null,
        destinationStage: 'execute',
        workItem: expect.objectContaining({ id: 'wi-1', role: 'chat' }),
      }),
    );
  });

  it('given related issue and PR items, when switching workflows, then each stays on its own board with a reciprocal relation marker', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-issue',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['review'],
          sessions: {
            work: {
              projectPath: '/sandbox/mastra/worktrees/factory-issue-12',
              branch: 'factory/issue-12',
              threadId: 'thread-work',
              startedBy: 'user-1',
            },
          },
        }),
        makeWorkItem({
          id: 'wi-review',
          title: 'Fix flaky test',
          source: 'github-pr',
          sourceKey: 'github-pr:34',
          stages: ['review'],
          sessions: {
            review: {
              projectPath: '/sandbox/mastra/worktrees/factory-pr-34',
              branch: 'factory/pr-34',
              threadId: 'thread-review',
              startedBy: 'user-1',
            },
          },
          metadata: { headBranch: 'factory/issue-12' },
        }),
      ],
    });
    renderAt('/factory/work', {
      ...githubProject,
      binding: {
        ...githubProject.binding,
        repositories: [
          {
            ...githubRepository,
            worktrees: [
              ...githubRepository.worktrees,
              {
                branch: 'factory/issue-12',
                worktreePath: '/sandbox/mastra/worktrees/factory-issue-12',
                baseBranch: 'main',
              },
              {
                branch: 'factory/pr-34',
                worktreePath: '/sandbox/mastra/worktrees/factory-pr-34',
                baseBranch: 'main',
              },
            ],
          },
        ],
      },
    });

    const workColumn = await screen.findByTestId('board-column-review');
    const workCard = within(workColumn).getByTestId('work-item-card');
    expect(within(workCard).getByText('Issue:')).toBeInTheDocument();
    expect(within(workCard).queryByText('PR Review:')).not.toBeInTheDocument();
    expect(within(workCard).getByRole('link', { name: 'Open Review: PR #34' })).toHaveAttribute(
      'href',
      '/threads/thread-review',
    );

    const nav = screen.getByRole('navigation', { name: 'Factory' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Review' }));
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument();
    const reviewCard = within(column('review')).getByTestId('work-item-card');
    expect(within(reviewCard).getByText('PR Review:')).toBeInTheDocument();
    expect(within(reviewCard).queryByText('Issue:')).not.toBeInTheDocument();
    expect(within(reviewCard).getByRole('link', { name: 'Open Work item: Issue #12' })).toHaveAttribute(
      'href',
      '/threads/thread-work',
    );
  });

  // A project that still has the worktree the cards' session refs point at:
  // the title only links to the thread while the ref's worktree exists.
  const issueWorktreePath = '/sandbox/mastra/worktrees/factory-issue-12';
  const projectWithIssueWorktree: Factory = {
    ...githubProject,
    binding: {
      kind: 'factory',
      factoryProjectId: FACTORY_PROJECT_ID,
      repositories: [
        {
          ...githubRepository,
          worktrees: [
            ...githubRepository.worktrees,
            { branch: 'factory/issue-12', worktreePath: issueWorktreePath, baseBranch: 'main' },
          ],
        },
      ],
    },
  };
  const issueWorkSession = {
    projectPath: issueWorktreePath,
    branch: 'factory/issue-12',
    threadId: 'thread-work',
    startedBy: 'user-1',
  };

  const reviewWorktreePath = '/sandbox/mastra/worktrees/factory-pr-34';
  const relatedWorkItems = [
    makeWorkItem({
      id: 'wi-issue',
      title: 'Fix flaky test',
      source: 'github-issue',
      sourceKey: 'github-issue:12',
      stages: ['review'],
      sessions: { work: { ...issueWorkSession, threadId: THREAD_ID } },
    }),
    makeWorkItem({
      id: 'wi-review',
      title: 'Review fix flaky test',
      source: 'github-pr',
      sourceKey: 'github-pr:34',
      stages: ['review'],
      metadata: { number: 34, headBranch: 'factory/issue-12' },
      sessions: {
        review: {
          projectPath: reviewWorktreePath,
          branch: 'factory/pr-34',
          threadId: 'thread-related-review',
          startedBy: 'user-1',
        },
      },
    }),
  ];

  it.each([
    {
      surface: 'Work',
      initialThreadId: THREAD_ID,
      initialWorktreePath: issueWorktreePath,
      breadcrumbSection: 'Work',
      breadcrumbPath: '/factory/work',
      breadcrumbTitle: 'Issue #12: Fix flaky test',
      composerPrNumber: undefined,
      buttonName: 'Open Review: PR #34: Review fix flaky test',
      destinationThreadId: 'thread-related-review',
      destinationWorktreePath: reviewWorktreePath,
    },
    {
      surface: 'Review',
      initialThreadId: 'thread-related-review',
      initialWorktreePath: reviewWorktreePath,
      breadcrumbSection: 'Review',
      breadcrumbPath: '/factory/review',
      breadcrumbTitle: 'PR #34: Review fix flaky test',
      composerPrNumber: 34,
      buttonName: 'Open Work item: Issue #12: Fix flaky test',
      destinationThreadId: THREAD_ID,
      destinationWorktreePath: issueWorktreePath,
    },
  ])(
    'given related sessions on the $surface thread, when the related session is opened, then its worktree becomes active before navigation',
    async ({
      initialThreadId,
      initialWorktreePath,
      breadcrumbSection,
      breadcrumbPath,
      breadcrumbTitle,
      composerPrNumber,
      buttonName,
      destinationThreadId,
      destinationWorktreePath,
    }) => {
      const relatedProject: Factory = {
        ...projectWithIssueWorktree,
        binding: {
          kind: 'factory',
          factoryProjectId: FACTORY_PROJECT_ID,
          repositories: [
            {
              ...githubRepository,
              selectedWorktreePath: initialWorktreePath,
              worktrees: [
                ...githubRepository.worktrees,
                { branch: 'factory/issue-12', worktreePath: issueWorktreePath, baseBranch: 'main' },
                { branch: 'factory/pr-34', worktreePath: reviewWorktreePath, baseBranch: 'main' },
              ],
            },
          ],
        },
      };
      useBoardHandlers({ workItems: relatedWorkItems });
      const { router } = renderAt(`/threads/${initialThreadId}`, relatedProject, connectedStatus, {
        sessionThreadId: initialThreadId,
      });

      const header = await screen.findByRole('region', { name: 'Factory session' });
      const breadcrumb = within(header).getByRole('navigation', { name: 'Factory session breadcrumb' });
      expect(within(breadcrumb).getByRole('link', { name: breadcrumbSection })).toHaveAttribute('href', breadcrumbPath);
      expect(within(breadcrumb).getByText(breadcrumbTitle)).toBeInTheDocument();
      if (composerPrNumber) {
        expect(
          await screen.findByRole('link', { name: `Open open mastra-ai/mastra pull request ${composerPrNumber}` }),
        ).toHaveAttribute('href', `https://github.com/mastra-ai/mastra/pull/${composerPrNumber}`);
      }

      await userEvent.click(within(header).getByRole('button', { name: buttonName }));

      await waitFor(() => expect(router.state.location.pathname).toBe(`/threads/${destinationThreadId}`));
      const stored = JSON.parse(localStorage.getItem('mastracode-factories') ?? '[]') as Factory[];
      expect(
        stored[0]?.binding.kind === 'factory' ? stored[0].binding.repositories[0]?.selectedWorktreePath : undefined,
      ).toBe(destinationWorktreePath);
    },
  );

  it('given a Review session already subscribed to its Factory PR, when the composer renders, then the PR link is not duplicated', async () => {
    const relatedProject: Factory = {
      ...projectWithIssueWorktree,
      binding: {
        ...projectWithIssueWorktree.binding,
        repositories: projectWithIssueWorktree.binding.repositories.map(repository => ({
          ...repository,
          selectedWorktreePath: reviewWorktreePath,
          worktrees: [
            ...repository.worktrees,
            { branch: 'factory/pr-34', worktreePath: reviewWorktreePath, baseBranch: 'main' },
          ],
        })),
      },
    };
    useBoardHandlers({ workItems: relatedWorkItems });
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () =>
        HttpResponse.json({
          subscriptions: [
            {
              id: 'subscription-34',
              repoFullName: 'mastra-ai/mastra',
              pullRequestNumber: 34,
              status: 'open',
              url: 'https://github.com/mastra-ai/mastra/pull/34',
            },
          ],
        }),
      ),
    );
    renderAt('/threads/thread-related-review', relatedProject, connectedStatus, {
      sessionThreadId: 'thread-related-review',
    });

    expect(await screen.findAllByRole('link', { name: 'Open open mastra-ai/mastra pull request 34' })).toHaveLength(1);
  });

  it('given a related work session whose worktree is gone, when the review thread renders, then it still links to the work item', async () => {
    const reviewOnlyProject: Factory = {
      ...githubProject,
      binding: {
        ...githubProject.binding,
        repositories: [
          {
            ...githubRepository,
            selectedWorktreePath: reviewWorktreePath,
            worktrees: [{ branch: 'factory/pr-34', worktreePath: reviewWorktreePath, baseBranch: 'main' }],
          },
        ],
      },
    };
    useBoardHandlers({ workItems: relatedWorkItems });
    renderAt('/threads/thread-related-review', reviewOnlyProject, connectedStatus, {
      sessionThreadId: 'thread-related-review',
    });

    expect(await screen.findByRole('link', { name: 'Open Work item: Issue #12: Fix flaky test' })).toHaveAttribute(
      'href',
      '/factory/work',
    );
  });

  it('given a work item with sessions, when the Board renders, then the card title links to its thread', async () => {
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
    renderAt('/factory/work', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    expect(within(card).getByRole('link', { name: 'Issue: Fix flaky test' })).toHaveAttribute(
      'href',
      '/threads/thread-work',
    );
  });

  it('given plan and work sessions on the same thread, when the Board renders, then the card shows a single thread link', async () => {
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
    renderAt('/factory/work', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Issue: Fix flaky test');
    expect(links[0]).toHaveAttribute('href', '/threads/thread-shared');
  });

  it('given legacy sessions that diverged onto different threads, when the Board renders, then the card still shows a single thread link', async () => {
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
    renderAt('/factory/work', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Issue: Fix flaky test');
    // The last-filed ref wins until the next run converges them.
    expect(links[0]).toHaveAttribute('href', '/threads/thread-work');
  });

  it('given a session ref whose worktree was deleted, when the Board renders, then the title offers to open a fresh session and runs are offered again', async () => {
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
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    // The stale ref renders no thread link: the title is a create-session button.
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Issue: Fix flaky test' })).toBeInTheDocument();
    // The stale ref no longer occupies the run slot: runs are offered again.
    await userEvent.click(within(card).getByRole('button', { name: 'Actions for Fix flaky test' }));
    expect(await screen.findByRole('menuitem', { name: 'Investigate' })).toBeInTheDocument();
  });

  it('given a card title linking to a thread, when clicked, then its worktree becomes the selected workspace and the app navigates to the thread', async () => {
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
    // Opening an existing session must never create a worktree or send a
    // message — record those endpoints without registering the run handlers.
    const sideEffects: string[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, () => {
        sideEffects.push('worktree');
        return HttpResponse.json({}, { status: 500 });
      }),
      http.post(`${SESSION}/messages`, () => {
        sideEffects.push('message');
        return HttpResponse.json({ ok: true });
      }),
    );
    const { router } = renderAt('/factory/work', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    await userEvent.click(within(card).getByRole('link', { name: 'Issue: Fix flaky test' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-work'));
    const stored = JSON.parse(localStorage.getItem('mastracode-factories') ?? '[]') as Factory[];
    expect(
      stored[0]?.binding.kind === 'factory' ? stored[0].binding.repositories[0]?.selectedWorktreePath : undefined,
    ).toBe(issueWorktreePath);
    expect(sideEffects).toEqual([]);
  });

  it('given a card in Intake, when Move to Triage is chosen from the menu, then the card lands in the Triage swimlane', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-1', title: 'Fix flaky test', source: 'github-issue', sourceKey: 'github-issue:12' }),
      ],
    });
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Triage' }));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['triage'] }]));
    expect(within(column('triage')).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('intake')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given a pending governed move, when the server is evaluating it, then the card appears in its destination with neutral progress and unrelated cards remain usable', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-moving', title: 'Move me', source: 'github-issue', sourceKey: 'github-issue:21' }),
        makeWorkItem({ id: 'wi-other', title: 'Leave me', source: 'github-issue', sourceKey: 'github-issue:22' }),
      ],
    });
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items/wi-moving/transition`,
        async ({ request }) => {
          const body = (await request.json()) as { stage: string };
          await gate;
          const existing = state.items.find(item => item.id === 'wi-moving')!;
          const updated = { ...existing, stages: [body.stage], revision: existing.revision + 1 };
          state.items = state.items.map(item => (item.id === updated.id ? updated : item));
          return HttpResponse.json({
            result: {
              status: 'accepted',
              transitionId: 'transition-pending',
              itemId: updated.id,
              revision: updated.revision,
              stage: body.stage,
              decisions: [],
            },
          });
        },
      ),
    );
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Move me' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Triage' }));

    const movingCard = within(column('triage')).getByRole('article', { name: 'Move me' });
    expect(movingCard).toHaveAttribute('aria-busy', 'true');
    expect(within(movingCard).getByRole('status')).toHaveTextContent('Evaluating…');
    expect(within(movingCard).getByRole('button', { name: 'Actions for Move me' })).toBeDisabled();
    expect(within(column('intake')).getByRole('button', { name: 'Actions for Leave me' })).toBeEnabled();

    release?.();
    await waitFor(() => expect(movingCard).not.toHaveAttribute('aria-busy'));
    expect(within(movingCard).queryByText('Evaluating…')).not.toBeInTheDocument();
  });

  it('given a rule rejects a move, when evaluation settles, then the card rolls back and shows the exact bounded reason', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-rejected',
          title: 'Protected card',
          source: 'github-issue',
          sourceKey: 'github-issue:23',
        }),
      ],
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items/wi-rejected/transition`, () =>
        HttpResponse.json(
          {
            result: {
              status: 'rejected',
              transitionId: 'transition-rejected',
              itemId: 'wi-rejected',
              code: 'forbidden',
              reason: 'Required checks are still incomplete.',
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Protected card' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Triage' }));

    const rolledBackCard = await within(column('intake')).findByRole('article', { name: 'Protected card' });
    expect(within(rolledBackCard).getByRole('alert')).toHaveTextContent('Required checks are still incomplete.');
    expect(within(column('triage')).queryByRole('article', { name: 'Protected card' })).not.toBeInTheDocument();
  });

  it('given a stale move response, when canonical data is refetched, then the card settles at the server stage with the stale reason', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-stale',
          title: 'Concurrent card',
          source: 'github-issue',
          sourceKey: 'github-issue:24',
        }),
      ],
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/work-items/wi-stale/transition`, () => {
        state.items = state.items.map(item =>
          item.id === 'wi-stale' ? { ...item, stages: ['planning'], revision: item.revision + 1 } : item,
        );
        return HttpResponse.json(
          {
            result: {
              status: 'rejected',
              transitionId: 'transition-stale',
              itemId: 'wi-stale',
              code: 'stale',
              reason: 'The card changed before this move was evaluated.',
            },
          },
          { status: 409 },
        );
      }),
    );
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Concurrent card' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Triage' }));

    const canonicalCard = await within(column('planning')).findByRole('article', { name: 'Concurrent card' });
    expect(within(canonicalCard).getByRole('alert')).toHaveTextContent(
      'The card changed before this move was evaluated.',
    );
  });

  it('given durable rule effects, when the board polls status, then affected cards show retry, failure, and safe requeue', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-retry', title: 'Retrying card' }),
        makeWorkItem({ id: 'wi-failed', title: 'Failed card' }),
      ],
      decisions: [
        {
          id: 'decision-retry',
          evaluationId: 'evaluation-retry',
          workItemId: 'wi-retry',
          type: 'invokeSkill',
          status: 'retry',
          attempts: 2,
          lastError: 'Session temporarily unavailable.',
          createdAt: '2026-07-10T00:00:00Z',
          updatedAt: '2026-07-10T00:01:00Z',
          completedAt: null,
        },
        {
          id: 'decision-failed',
          evaluationId: 'evaluation-failed',
          workItemId: 'wi-failed',
          type: 'notify',
          status: 'failed',
          attempts: 5,
          lastError: 'Delivery exhausted its retry budget.',
          createdAt: '2026-07-10T00:00:00Z',
          updatedAt: '2026-07-10T00:05:00Z',
          completedAt: null,
        },
      ],
    });
    renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    const retrying = await within(intake).findByRole('article', { name: 'Retrying card' });
    expect(within(retrying).getByRole('status')).toHaveTextContent('Rule effect retrying · invokeSkill · attempt 2');
    const failed = within(column('intake')).getByRole('article', { name: 'Failed card' });
    expect(within(failed).getByRole('alert')).toHaveTextContent(
      'Rule effect failed: Delivery exhausted its retry budget.',
    );

    await userEvent.click(within(failed).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(state.decisionRetries).toEqual(['decision-failed']));
    await waitFor(() => expect(within(failed).getByRole('status')).toHaveTextContent('Rule effect retrying'));
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
    const { router } = renderAt('/factory/work');

    await screen.findByTestId('board-column-triage');
    await userEvent.click(within(column('triage')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.starts).toMatchObject([{ destinationStage: 'planning', workItem: { id: 'wi-1' } }]);
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
    const { router } = renderAt('/factory/work');

    await screen.findByTestId('board-column-triage');
    await userEvent.click(within(column('triage')).getByRole('button', { name: 'Actions for Add OAuth support' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Prepare approval' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-21' });
    await waitFor(() =>
      expect(captured.messages[0]?.message).toContain(
        'Prepare approval for GitHub issue #21 (https://github.com/mastra-ai/mastra/issues/21)',
      ),
    );
    expect(captured.messages[0]?.message).not.toContain('Add OAuth support');
    expect(captured.starts).toMatchObject([{ workItem: { id: 'wi-approval', role: 'triage' } }]);
    expect(state.patches).toEqual([]);
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
    renderAt('/factory/work');

    await screen.findByTestId('board-column-triage');
    await userEvent.click(within(column('triage')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Planning' }));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['planning'] }]));
    expect(within(column('planning')).getByText('Fix flaky test')).toBeInTheDocument();
    expect(within(column('triage')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given two same-role cards, when one run starts, then only its action shows progress', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['triage'],
          metadata: { number: 12 },
        }),
        makeWorkItem({
          id: 'wi-2',
          title: 'Improve docs',
          source: 'github-issue',
          sourceKey: 'github-issue:15',
          stages: ['triage'],
          metadata: { number: 15 },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-12');
    let releaseWorktree!: () => void;
    const worktreeBlocked = new Promise<void>(resolve => {
      releaseWorktree = resolve;
    });
    let markWorktreeRequested!: () => void;
    const worktreeRequested = new Promise<void>(resolve => {
      markWorktreeRequested = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, async () => {
        markWorktreeRequested();
        await worktreeBlocked;
        return HttpResponse.json({
          worktreePath: '/sandbox/mastra/worktrees/factory-issue-12',
          branch: 'factory/issue-12',
          baseBranch: 'main',
          resourceId: RESOURCE_ID,
        });
      }),
    );
    renderAt('/factory/board');

    try {
      const triageColumn = await screen.findByTestId('board-column-triage');
      const firstActions = within(triageColumn).getByRole('button', { name: 'Actions for Fix flaky test' });
      await userEvent.click(firstActions);
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));
      await worktreeRequested;
      await waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument());
      await userEvent.click(firstActions);
      expect(await screen.findByRole('menuitem', { name: 'Starting…' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('menuitem', { name: 'Build' })).not.toHaveAttribute('aria-disabled', 'true');

      await userEvent.click(within(triageColumn).getByRole('button', { name: 'Actions for Improve docs' }));
      expect(await screen.findByRole('menuitem', { name: 'Investigate' })).not.toHaveAttribute('aria-disabled', 'true');
    } finally {
      releaseWorktree();
      await waitFor(() => expect(captured.messages).toHaveLength(1));
    }
  });

  it('given two runs start concurrently, when one fails, then each action keeps its own pending lifecycle', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['triage'],
          metadata: { number: 12 },
        }),
        makeWorkItem({
          id: 'wi-2',
          title: 'Improve docs',
          source: 'github-issue',
          sourceKey: 'github-issue:15',
          stages: ['triage'],
          metadata: { number: 15 },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-12');
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let releaseSecond!: () => void;
    const secondBlocked = new Promise<void>(resolve => {
      releaseSecond = resolve;
    });
    let markFirstRequested!: () => void;
    const firstRequested = new Promise<void>(resolve => {
      markFirstRequested = resolve;
    });
    let markSecondRequested!: () => void;
    const secondRequested = new Promise<void>(resolve => {
      markSecondRequested = resolve;
    });
    let requestCount = 0;
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, async () => {
        requestCount += 1;
        if (requestCount === 1) {
          markFirstRequested();
          await firstBlocked;
          return HttpResponse.json({
            worktreePath: '/sandbox/mastra/worktrees/factory-issue-12',
            branch: 'factory/issue-12',
            baseBranch: 'main',
            resourceId: RESOURCE_ID,
          });
        }
        markSecondRequested();
        await secondBlocked;
        return HttpResponse.json({ error: 'git_error', message: 'second worktree failed' }, { status: 502 });
      }),
    );
    renderAt('/factory/board');

    try {
      const triageColumn = await screen.findByTestId('board-column-triage');
      const firstActions = within(triageColumn).getByRole('button', { name: 'Actions for Fix flaky test' });
      const secondActions = within(triageColumn).getByRole('button', { name: 'Actions for Improve docs' });

      await userEvent.click(firstActions);
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));
      await firstRequested;
      await userEvent.click(secondActions);
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));
      await secondRequested;

      await userEvent.click(firstActions);
      expect(await screen.findByRole('menuitem', { name: 'Starting…' })).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(secondActions);
      expect(await screen.findByRole('menuitem', { name: 'Starting…' })).toHaveAttribute('aria-disabled', 'true');

      releaseSecond();
      expect(await screen.findByText('second worktree failed')).toBeInTheDocument();
      await userEvent.click(secondActions);
      expect(await screen.findByRole('menuitem', { name: 'Investigate' })).not.toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(firstActions);
      expect(await screen.findByRole('menuitem', { name: 'Starting…' })).toHaveAttribute('aria-disabled', 'true');
    } finally {
      releaseSecond();
      releaseFirst();
      await waitFor(() => expect(captured.messages).toHaveLength(1));
    }
  });

  it('given two actions on one card start concurrently, then both exact actions remain pending', async () => {
    useBoardHandlers({
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
    let releaseWorktrees!: () => void;
    const worktreesBlocked = new Promise<void>(resolve => {
      releaseWorktrees = resolve;
    });
    let requestCount = 0;
    let markBothRequested!: () => void;
    const bothRequested = new Promise<void>(resolve => {
      markBothRequested = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, async () => {
        requestCount += 1;
        if (requestCount === 2) markBothRequested();
        await worktreesBlocked;
        return HttpResponse.json({
          worktreePath: '/sandbox/mastra/worktrees/factory-issue-12',
          branch: 'factory/issue-12',
          baseBranch: 'main',
          resourceId: RESOURCE_ID,
        });
      }),
    );
    renderAt('/factory/board');

    try {
      const triageColumn = await screen.findByTestId('board-column-triage');
      const actions = within(triageColumn).getByRole('button', { name: 'Actions for Fix flaky test' });
      await userEvent.click(actions);
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));
      await waitFor(() => expect(requestCount).toBe(1));
      await userEvent.click(actions);
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Build' }));
      await bothRequested;

      await userEvent.click(actions);
      expect(await screen.findAllByRole('menuitem', { name: 'Starting…' })).toHaveLength(2);
    } finally {
      releaseWorktrees();
      await waitFor(() => expect(captured.messages).toHaveLength(2));
    }
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
    const { router } = renderAt('/factory/work');

    await screen.findByTestId('board-column-planning');
    await userEvent.click(within(column('planning')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Build' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    await waitFor(() => expect(captured.messages[0]?.message).toContain('Implement a fix for GitHub issue #12'));
    expect(captured.starts).toMatchObject([{ destinationStage: 'execute', workItem: { id: 'wi-1' } }]);
  });

  it('given a card in Intake, when Mark done is chosen from the menu, then the stages PATCH to done and the card moves', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({ id: 'wi-1', title: 'Fix flaky test', source: 'github-issue', sourceKey: 'github-issue:12' }),
      ],
    });
    renderAt('/factory/work');

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
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    await waitFor(() => expect(state.deletes).toEqual(['wi-1']));
    await waitFor(() => expect(screen.queryByTestId('work-item-card')).not.toBeInTheDocument());
  });

  it('given a candidate, when "Add to board" is chosen, then a work item is filed into Intake without starting a run', async () => {
    const state = useBoardHandlers({ issues });
    renderAt('/factory/work');

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
    renderAt('/factory/work');

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
          source: 'github-issue',
          sourceKey: 'github-issue:34',
          stages: ['execute', 'review'],
        }),
      ],
    });
    renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    dragTo(within(column('review')).getByTestId('work-item-card'), column('done'));

    await waitFor(() => expect(state.patches).toEqual([{ id: 'wi-1', stages: ['done'] }]));
    expect(within(column('done')).getByText('Parallel effort')).toBeInTheDocument();
    expect(within(column('execute')).queryByTestId('work-item-card')).not.toBeInTheDocument();
  });

  it('given an unmaterialized candidate, when dragged to Building, then it is filed in Intake and moved through authority without a run', async () => {
    const state = useBoardHandlers({ issues });
    renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    dragTo(within(intake).getAllByTestId('candidate-card')[0]!, column('execute'));

    await waitFor(() =>
      expect(state.posts).toMatchObject([
        { source: 'github-issue', sourceKey: 'github-issue:12', title: 'Fix flaky test', stages: ['intake'] },
      ]),
    );
    expect(state.patches).toEqual(expect.arrayContaining([{ id: 'wi-post-1', stages: ['execute'] }]));
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
    renderAt('/factory/work');

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
  starts: Array<{
    workItem: { id: string; role: string };
    kickoffMessage: string | null;
    destinationStage: string;
  }>;
  skillInvocations: Record<string, unknown>[];
}

/** Registers handlers for the investigate flow: worktree + thread + message. */
function useFactoryRunHandlers(branchDir: string): CapturedRun {
  const captured: CapturedRun = { threadTitles: [], messages: [], starts: [], skillInvocations: [] };
  server.use(
    http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, async ({ request }) => {
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
    http.put(`${SESSION}/threads/:threadId`, async ({ request }) => {
      const body = (await request.json()) as { title?: string };
      captured.threadTitles.push(body.title ?? '');
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/messages`, async ({ request }) => {
      captured.messages.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/runs/start`, async ({ request }) => {
      const body = (await request.json()) as {
        resourceId: string;
        projectPath: string;
        branch: string;
        threadTitle: string;
        kickoffMessage: string | null;
        destinationStage: string;
        workItem: { id: string; role: string };
      };
      captured.threadTitles.push(body.threadTitle);
      captured.starts.push({
        workItem: body.workItem,
        kickoffMessage: body.kickoffMessage,
        destinationStage: body.destinationStage,
      });
      if (body.kickoffMessage !== null) captured.messages.push({ message: body.kickoffMessage });
      return HttpResponse.json(
        {
          prepared: {
            workItemId: body.workItem.id,
            bindingId: 'binding-1',
            threadId: 'thread-factory',
            resourceId: body.resourceId,
            projectPath: body.projectPath,
            branch: body.branch,
            revision: 3,
            kickoffStatus: 'pending',
            replayed: false,
          },
        },
        { status: 202 },
      );
    }),
    http.post(`${TEST_BASE_URL}/web/agent-controller/code/skills/prepare`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      captured.skillInvocations.push(body);
      const name = body.name as string;
      const message = `<skill name="${name}">\nActivated ${name}.\n\nARGUMENTS: ${body.arguments as string}\n</skill>`;
      return HttpResponse.json({ ok: true, skill: name, message });
    }),
    http.get(`${SESSION}/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
  );
  return captured;
}

describe('Factory Board — investigate flow', () => {
  it('given two candidates, when one run starts, then the unrelated candidate stays operable', async () => {
    useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    let releaseWorktree!: () => void;
    const worktreeBlocked = new Promise<void>(resolve => {
      releaseWorktree = resolve;
    });
    let markWorktreeRequested!: () => void;
    const worktreeRequested = new Promise<void>(resolve => {
      markWorktreeRequested = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, async () => {
        markWorktreeRequested();
        await worktreeBlocked;
        return HttpResponse.json({
          worktreePath: '/sandbox/mastra/worktrees/factory-issue-12',
          branch: 'factory/issue-12',
          baseBranch: 'main',
          resourceId: RESOURCE_ID,
        });
      }),
    );
    renderAt('/factory/board');

    try {
      const intake = await screen.findByTestId('board-column-intake');
      await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));
      await worktreeRequested;

      expect(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' })).toBeDisabled();
      expect(within(intake).getByRole('button', { name: 'Investigate Improve docs' })).toBeEnabled();
      await userEvent.click(within(intake).getByRole('button', { name: 'More actions for Fix flaky test' }));
      expect(await screen.findByRole('menuitem', { name: 'Custom prompt…' })).toHaveAttribute('aria-disabled', 'true');
    } finally {
      releaseWorktree();
      await waitFor(() => expect(captured.messages).toHaveLength(1));
    }
  });

  it('given an issue candidate, when Investigate is clicked, then a worktree, thread, and direct skill activation are created, a work item materializes into Planning, and the app navigates to the thread', async () => {
    const state = useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.threadTitles).toEqual(['Issue #12: Fix flaky test']);
    await waitFor(() => expect(captured.messages).toHaveLength(1));
    expect(captured.messages[0]?.message).toContain('<skill name="understand-issue">');
    expect(captured.skillInvocations).toEqual([
      {
        resourceId: RESOURCE_ID,
        scope: '/sandbox/mastra/worktrees/factory-issue-12',
        name: 'understand-issue',
        arguments:
          'GitHub issue #12 (https://github.com/mastra-ai/mastra/issues/12)\n\n' +
          'Prepared workspace context:\n' +
          '- Worktree: /sandbox/mastra/worktrees/factory-issue-12\n' +
          '- Branch: factory/issue-12',
      },
    ]);
    expect(JSON.stringify(captured.skillInvocations)).not.toContain('Fix flaky test');
    // One server-owned start request creates the Intake card, binds it, and requests Planning.
    expect(state.posts).toEqual([]);
    expect(state.patches).toEqual([]);
    expect(captured.starts).toMatchObject([{ destinationStage: 'planning', workItem: { role: 'plan' } }]);
  });

  it('given a prepared skill, when Factory starts the run, then the browser navigates only after the server coordinator accepts one kickoff', async () => {
    const state = useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    let releaseStart!: () => void;
    const startResponse = new Promise<void>(resolve => {
      releaseStart = resolve;
    });
    const startBodies: Array<{
      resourceId: string;
      projectPath: string;
      branch: string;
      kickoffMessage: string | null;
      destinationStage: string;
      workItem: { id?: string };
    }> = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/runs/start`, async ({ request }) => {
        const body = (await request.json()) as (typeof startBodies)[number];
        startBodies.push(body);
        await startResponse;
        return HttpResponse.json(
          {
            prepared: {
              workItemId: body.workItem.id,
              bindingId: 'binding-1',
              threadId: 'thread-factory',
              resourceId: body.resourceId,
              projectPath: body.projectPath,
              branch: body.branch,
              revision: 3,
              kickoffStatus: 'pending',
              replayed: false,
            },
          },
          { status: 202 },
        );
      }),
    );
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    await waitFor(() => expect(startBodies).toHaveLength(1));
    expect(router.state.location.pathname).toBe('/factory/work');
    expect(captured.skillInvocations).toHaveLength(1);
    expect(startBodies[0]).toMatchObject({
      kickoffMessage: expect.stringContaining('<skill name="understand-issue">'),
      destinationStage: 'planning',
      workItem: { role: 'plan', input: { stages: ['intake'] } },
    });
    expect(state.posts).toHaveLength(0);
    releaseStart();
    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(startBodies).toHaveLength(1);
  });

  it('given a server coordinator failure, when a run is requested, then the browser stays on the board and shows the failure', async () => {
    useBoardHandlers({ issues });
    useFactoryRunHandlers('factory-issue-12');
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/runs/start`, () =>
        HttpResponse.json({ error: 'kickoff failed' }, { status: 500 }),
      ),
    );
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    expect(await screen.findByText(/kickoff failed/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factory/work');
  });

  it('given a missing workspace skill, when Investigate is clicked, then the error is visible and no fallback prompt or card is dispatched', async () => {
    const state = useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    server.use(
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/skills/prepare`, async ({ request }) => {
        captured.skillInvocations.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { error: 'skill_not_found', message: 'Skill not found: understand-issue.' },
          { status: 404 },
        );
      }),
    );
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    expect(await screen.findByText('Skill not found: understand-issue.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factory/work');
    expect(captured.skillInvocations).toHaveLength(1);
    expect(captured.messages).toHaveLength(0);
    expect(state.posts).toHaveLength(0);
  });

  it('given an issue candidate, when Build is chosen, then the item moves through authority before the server-bound kickoff', async () => {
    const state = useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'More actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Build' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.skillInvocations).toHaveLength(0);
    expect(captured.messages[0]!.message).toContain('Implement a fix for GitHub issue #12');
    expect(state.posts).toEqual([]);
    expect(captured.starts).toMatchObject([{ destinationStage: 'execute', workItem: { role: 'work' } }]);
  });

  it('given server start coordination failure, when Investigate is clicked, then no kickoff is accepted', async () => {
    useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/runs/start`, () =>
        HttpResponse.json({ error: 'board persistence failed' }, { status: 500 }),
      ),
    );
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    expect(await screen.findByText(/board persistence failed/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factory/work');
    expect(captured.starts).toEqual([]);
    expect(captured.messages).toEqual([]);
  });

  it('given a PR candidate in Review Intake, when Review is clicked, then the review prompt runs and a work item materializes into Reviewing with a review session', async () => {
    const state = useBoardHandlers({ pullRequests });
    const captured = useFactoryRunHandlers('factory-pr-34');
    const { router } = renderAt('/factory/review');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Add factory pages');
    await userEvent.click(within(intake).getByRole('button', { name: 'Review Add factory pages' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/pr-34' });
    expect(captured.threadTitles).toEqual(['PR #34: Add factory pages']);
    await waitFor(() => expect(captured.messages).toHaveLength(1));
    expect(captured.messages[0]?.message).toContain('<skill name="understand-pr">');
    expect(captured.skillInvocations).toEqual([
      {
        resourceId: RESOURCE_ID,
        scope: '/sandbox/mastra/worktrees/factory-pr-34',
        name: 'understand-pr',
        arguments:
          'GitHub pull request #34 (https://github.com/mastra-ai/mastra/pull/34)\n\n' +
          'Check out the PR in this worktree first with `gh pr checkout 34`. Expected head branch: feat/factory.\n\n' +
          'Prepared workspace context:\n' +
          '- Worktree: /sandbox/mastra/worktrees/factory-pr-34\n' +
          '- Branch: factory/pr-34',
      },
    ]);
    expect(JSON.stringify(captured.skillInvocations)).not.toContain('Add factory pages');
    expect(state.posts).toEqual([]);
    expect(captured.starts).toMatchObject([{ destinationStage: 'review', workItem: { role: 'review' } }]);
  });

  it('given a Linear candidate, when Investigate is clicked, then the prompt mentions the linear_get_issue tool', async () => {
    useBoardHandlers({ linearIssues });
    const captured = useFactoryRunHandlers('factory-linear-eng-42');
    const { router } = renderAt('/factory/work', githubProject, connectedStatus, {
      linearStatus: linearConnectedStatus,
    });

    const intake = await screen.findByTestId('board-column-intake');
    const sources = await within(intake).findByRole('group', { name: 'Intake source' });
    await userEvent.click(within(sources).getByRole('button', { name: 'Linear' }));
    await within(intake).findByText('Fix intake sync');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix intake sync' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/linear-eng-42' });
    await waitFor(() => expect(captured.messages).toHaveLength(1));
    expect(captured.messages[0]?.message).toContain('<skill name="understand-issue">');
    expect(captured.skillInvocations).toHaveLength(1);
    expect(captured.skillInvocations[0]).toMatchObject({
      name: 'understand-issue',
      arguments: expect.stringContaining('Linear issue ENG-42 (https://linear.app/acme/issue/ENG-42)'),
    });
    expect(captured.skillInvocations[0]!.arguments).toContain('linear_get_issue');
    expect(captured.skillInvocations[0]!.arguments).not.toContain('Fix intake sync');
  });

  it('given an issue candidate, when a custom prompt is submitted, then the run keeps the issue context and adds the typed guidance', async () => {
    useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/work');

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
    await waitFor(() => expect(captured.messages).toHaveLength(1));
    // The base issue context survives; the typed text guides the run instead
    // of the explicit skill directive.
    expect(captured.messages[0]!.message).toContain(
      'Investigate GitHub issue #12 (https://github.com/mastra-ai/mastra/issues/12)',
    );
    expect(captured.messages[0]!.message).toContain('Guidance for this run: Write a failing test first');
    expect(captured.messages[0]!.message).not.toContain('Fix flaky test');
    expect(captured.messages[0]!.message).not.toContain('understand-issue skill');
  });

  it('given a persisted issue card without a plan session, when Investigate is chosen, then authority moves it before the server binds the plan role', async () => {
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
    const { router } = renderAt('/factory/work');

    await screen.findByTestId('board-column-intake');
    await userEvent.click(within(column('intake')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Investigate' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    await waitFor(() => expect(captured.messages).toHaveLength(1));
    expect(captured.messages[0]?.message).toContain('<skill name="understand-issue">');
    expect(captured.skillInvocations).toHaveLength(1);
    expect(captured.skillInvocations[0]).toMatchObject({
      name: 'understand-issue',
      arguments: expect.stringContaining('GitHub issue #12 (https://github.com/mastra-ai/mastra/issues/12)'),
    });
    expect(JSON.stringify(captured.skillInvocations)).not.toContain('Fix flaky test');
    expect(state.patches).toEqual([]);
    expect(captured.starts).toMatchObject([{ destinationStage: 'planning', workItem: { id: 'wi-1', role: 'plan' } }]);
  });

  it('given a card with a legacy plan ref, when Build is chosen, then only the exact work role is bound server-side', async () => {
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
    const { router } = renderAt('/factory/work');

    await screen.findByTestId('board-column-planning');
    await userEvent.click(within(column('planning')).getByRole('button', { name: 'Actions for Fix flaky test' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Build' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.starts).toMatchObject([{ destinationStage: 'execute', workItem: { id: 'wi-1' } }]);
    expect(captured.starts).toMatchObject([{ workItem: { id: 'wi-1', role: 'work' } }]);
  });

  it('given a repeat run on the same item, when Review is chosen, then the browser delegates exact-thread reuse to the server coordinator', async () => {
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
    const { router } = renderAt('/factory/review');
    await screen.findByTestId('board-column-review');
    await userEvent.click(within(column('review')).getByRole('button', { name: 'Actions for Add factory pages' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Review' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.threadTitles).toEqual(['PR #34: Add factory pages']);
    await waitFor(() => expect(captured.messages).toHaveLength(1));
    expect(captured.messages[0]?.message).toContain('<skill name="understand-pr">');
    expect(captured.skillInvocations).toHaveLength(1);
    expect(captured.skillInvocations[0]).toMatchObject({
      name: 'understand-pr',
      arguments: expect.stringContaining(
        'Check out the PR in this worktree first with `gh pr checkout 34`. Expected head branch: feat/factory-pages.',
      ),
    });
    expect(state.patches).toEqual([]);
    expect(captured.starts).toMatchObject([{ workItem: { id: 'wi-pr', role: 'review' } }]);
  });

  it('given the worktree call fails, when Investigate is clicked, then an error notice renders and no work item is filed', async () => {
    const state = useBoardHandlers({ issues });
    server.use(
      http.post(`${TEST_BASE_URL}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, () =>
        HttpResponse.json({ error: 'git_error', message: 'worktree failed' }, { status: 502 }),
      ),
    );
    const { router } = renderAt('/factory/work');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' }));

    expect(await screen.findByText('worktree failed')).toBeInTheDocument();
    expect(within(intake).getByRole('button', { name: 'Investigate Fix flaky test' })).toBeEnabled();
    expect(state.posts).toEqual([]);
    expect(router.state.location.pathname).toBe('/factory/work');
  });
});

describe('Factory Board — open session from the card title', () => {
  const issueWorktreePath = '/sandbox/mastra/worktrees/factory-issue-12';
  const projectWithIssueWorktree: Factory = {
    ...githubProject,
    binding: {
      kind: 'factory',
      factoryProjectId: FACTORY_PROJECT_ID,
      repositories: [
        {
          ...githubRepository,
          worktrees: [
            ...githubRepository.worktrees,
            { branch: 'factory/issue-12', worktreePath: issueWorktreePath, baseBranch: 'main' },
          ],
        },
      ],
    },
  };

  it('given a persisted card without a session, when the title is clicked, then the server binds an empty chat session with no prompt', async () => {
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
    const card = within(column('intake')).getByTestId('work-item-card');
    await userEvent.click(within(card).getByRole('button', { name: 'Issue: Fix flaky test' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.threadTitles).toEqual(['Issue #12: Fix flaky test']);
    // No agent run: nothing was sent to the session.
    expect(captured.messages).toEqual([]);
    // Opening a session is not a stage transition; only the exact chat role is sent to the coordinator.
    expect(state.patches).toEqual([]);
    expect(captured.starts).toMatchObject([{ workItem: { id: 'wi-1', role: 'chat' }, kickoffMessage: null }]);
  });

  it('given a card whose run refs went stale, when the title is clicked, then only chat is filed and the stale roles are not revived', async () => {
    const state = useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['execute'],
          metadata: { number: 12 },
          // Ref to a deleted worktree: the run happened once but its thread is
          // gone, so the run slot is open again.
          sessions: {
            work: {
              projectPath: '/sandbox/mastra/worktrees/gone',
              branch: 'factory/issue-12',
              threadId: 'thread-old',
              startedBy: 'user-1',
            },
          },
        }),
      ],
    });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    const card = within(column('execute')).getByTestId('work-item-card');
    await userEvent.click(within(card).getByRole('button', { name: 'Issue: Fix flaky test' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.messages).toEqual([]);
    // The browser delegates only the fresh chat role; the stale work role is not inferred as authority.
    expect(state.patches).toEqual([]);
    expect(captured.starts).toMatchObject([{ workItem: { id: 'wi-1', role: 'chat' }, kickoffMessage: null }]);
  });

  it('given a candidate, when the title is clicked, then the card materializes with a chat session in its own column and no prompt is sent', async () => {
    const state = useBoardHandlers({ issues });
    const captured = useFactoryRunHandlers('factory-issue-12');
    const { router } = renderAt('/factory/board');

    const intake = await screen.findByTestId('board-column-intake');
    await within(intake).findByText('Fix flaky test');
    await userEvent.click(within(intake).getByRole('button', { name: 'Issue: Fix flaky test' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/issue-12' });
    expect(captured.messages).toEqual([]);
    expect(state.posts).toEqual([]);
    expect(captured.starts).toMatchObject([
      { destinationStage: 'intake', workItem: { role: 'chat' }, kickoffMessage: null },
    ]);
  });

  it('given a manual card without run metadata, when the title is clicked, then the session opens on an id-derived branch', async () => {
    const state = useBoardHandlers({
      workItems: [makeWorkItem({ id: 'wi-manual', title: 'Manual card' })],
    });
    const captured = useFactoryRunHandlers('factory-item-wi-manual');
    const { router } = renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    const card = within(column('intake')).getByTestId('work-item-card');
    await userEvent.click(within(card).getByRole('button', { name: 'Manual: Manual card' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/threads/thread-factory'));
    expect(captured.worktree).toMatchObject({ branch: 'factory/item-wi-manual' });
    expect(captured.threadTitles).toEqual(['Manual card']);
    expect(captured.messages).toEqual([]);
    expect(state.patches).toEqual([]);
    expect(captured.starts).toMatchObject([{ workItem: { id: 'wi-manual', role: 'chat' }, kickoffMessage: null }]);
  });

  it('given a card whose only session is a chat session, when the Board renders, then the title links to the thread and runs are still offered', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-1',
          title: 'Fix flaky test',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          stages: ['intake'],
          metadata: { number: 12 },
          sessions: {
            chat: {
              projectPath: issueWorktreePath,
              branch: 'factory/issue-12',
              threadId: 'thread-work',
              startedBy: 'user-1',
            },
          },
        }),
      ],
    });
    renderAt('/factory/board', projectWithIssueWorktree);

    await screen.findByTestId('board-column-intake');
    const card = within(column('intake')).getByTestId('work-item-card');
    expect(within(card).getByRole('link', { name: 'Issue: Fix flaky test' })).toHaveAttribute(
      'href',
      '/threads/thread-work',
    );
    // A chat session occupies no run slot: Investigate and Build stay offered.
    await userEvent.click(within(card).getByRole('button', { name: 'Actions for Fix flaky test' }));
    expect(await screen.findByRole('menuitem', { name: 'Investigate' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Build' })).toBeInTheDocument();
  });

  it('given cards from different sources, when the Board renders, then each shows a source-appropriate external link', async () => {
    useBoardHandlers({
      workItems: [
        makeWorkItem({
          id: 'wi-gh',
          title: 'GitHub card',
          source: 'github-issue',
          sourceKey: 'github-issue:12',
          url: 'https://github.com/mastra-ai/mastra/issues/12',
        }),
        makeWorkItem({
          id: 'wi-lin',
          title: 'Linear card',
          source: 'linear-issue',
          sourceKey: 'linear:ENG-42',
          url: 'https://linear.app/acme/issue/ENG-42',
        }),
        makeWorkItem({ id: 'wi-man', title: 'Manual card' }),
      ],
    });
    renderAt('/factory/board');

    await screen.findByTestId('board-column-intake');
    const githubCard = within(column('intake')).getByRole('article', { name: 'GitHub card' });
    expect(within(githubCard).getByRole('link', { name: 'Open in GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/12',
    );
    const linearCard = within(column('intake')).getByRole('article', { name: 'Linear card' });
    expect(within(linearCard).getByRole('link', { name: 'Open in Linear' })).toHaveAttribute(
      'href',
      'https://linear.app/acme/issue/ENG-42',
    );
    // No URL means no external link — and with no session, no links at all.
    const manualCard = within(column('intake')).getByRole('article', { name: 'Manual card' });
    expect(within(manualCard).queryByRole('link')).not.toBeInTheDocument();
  });
});
