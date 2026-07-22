/**
 * BDD coverage for the propless `WorkspacesSection` (factory Sessions).
 *
 * The section reads the active factory from `useActiveFactoryContext` and the
 * agent session from focused chat hooks, so the spec renders it inside the real
 * provider stack and asserts worktree selection through the MSW-captured
 * session-state requests instead of a session spy.
 *
 * Factory sessions are feature worktrees only: the persisted fixture includes
 * a legacy repo-root entry and a `user/` personal-session worktree, and the
 * specs assert both stay out of the list.
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { queryKeys } from '../../../../../../shared/api/keys';
import { ChatSessionConfigProvider } from '../../../chat/context/ChatSessionProvider';
import type { WorkItem } from '../../../factory/services/workItems';
import { ActiveFactoryProvider } from '../../context/ActiveFactoryProvider';
import type { Factory } from '../../services/factories';
import { isServerFactory, loadFactories, saveFactories } from '../../services/factories';
import { playDoneSound } from '../../../settings/services/doneSound';
import { WorkspacesSection } from '../WorkspacesSection';

function storedRepository() {
  const factory = loadFactories()[0];
  if (!factory || !isServerFactory(factory)) throw new Error('expected server factory');
  const repository = factory.binding.repositories[0];
  if (!repository) throw new Error('expected linked repository');
  return repository;
}

// The completion sound synthesizes audio via AudioContext, which jsdom
// doesn't provide; mock playback so specs can assert the notification fired.
vi.mock('../../../settings/services/doneSound', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../settings/services/doneSound')>()),
  playDoneSound: vi.fn(),
}));

const ORIGIN = TEST_BASE_URL;
const PROJECT_REPOSITORY_ID = 'github-project-1';
const GITHUB_PROJECT_ID = 'fp-github-project-1';
const API = `${ORIGIN}/api/agent-controller/code`;

const githubProject: Factory = {
  id: 'project-gh',
  name: 'Mastra',
  resourceId: 'resource-gh',
  createdAt: 1,
  binding: {
    kind: 'factory',
    factoryProjectId: 'fp-github-project-1',
    repositories: [
      {
        projectRepositoryId: PROJECT_REPOSITORY_ID,
        slug: 'mastra-ai/mastra',
        gitBranch: 'main',
        sandboxWorkdir: '/sandbox/mastra',
        selectedWorktreePath: '/sandbox/mastra-worktrees/feat-api',
        worktrees: [
          // Legacy repo-root entry persisted by older builds — never a workspace.
          { branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' },
          { branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui', baseBranch: 'main' },
          { branch: 'feat-api', worktreePath: '/sandbox/mastra-worktrees/feat-api', baseBranch: 'main' },
          { branch: 'feat-unmatched', worktreePath: '/sandbox/mastra-worktrees/feat-unmatched', baseBranch: 'main' },
          // Personal user session — listed by the User Sessions section instead.
          {
            branch: 'user/alice-notes',
            worktreePath: '/sandbox/mastra-worktrees/user-alice-notes',
            baseBranch: 'main',
            threadId: 'thread-user',
          },
        ],
      },
    ],
  },
};

const localProject: Factory = {
  id: 'project-local',
  name: 'Local',
  resourceId: 'resource-local',
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/projects/local',
  },
};

const relatedWorkItems: WorkItem[] = [
  {
    id: 'work-issue-24',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: GITHUB_PROJECT_ID,
    source: 'github-issue',
    sourceKey: 'github-issue:24',
    parentWorkItemId: null,
    title: 'Add logs',
    url: 'https://github.com/mastra-ai/mastra/issues/24',
    stages: ['execute'],
    stageHistory: [],
    sessions: {
      work: {
        sessionId: '/sandbox/mastra-worktrees/feat-ui',
        branch: 'feat-ui',
        threadId: 'thread-work',
        startedBy: 'user-1',
      },
    },
    metadata: { number: 24 },
    revision: 1,
    createdAt: '2026-07-17T00:00:00Z',
    updatedAt: '2026-07-17T00:00:00Z',
  },
  {
    id: 'review-pr-25',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: GITHUB_PROJECT_ID,
    source: 'github-pr',
    sourceKey: 'github-pr:25',
    parentWorkItemId: 'work-issue-24',
    title: 'Add logs to Issue #24',
    url: 'https://github.com/mastra-ai/mastra/pull/25',
    stages: ['review'],
    stageHistory: [],
    sessions: {
      review: {
        sessionId: '/sandbox/mastra-worktrees/feat-api',
        branch: 'feat-api',
        threadId: 'thread-review',
        startedBy: 'user-1',
      },
    },
    metadata: { number: 25 },
    revision: 1,
    createdAt: '2026-07-17T00:00:00Z',
    updatedAt: '2026-07-17T00:00:00Z',
  },
];

afterEach(() => {
  localStorage.clear();
});

function sse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

/** Registers the full agent-controller handler set. */
function useAgentControllerHandlers(workItems: WorkItem[] = relatedWorkItems) {
  const sessionState = (resourceId: string) => ({
    controllerId: 'code',
    resourceId,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: 'thread-test',
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  });

  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: 'resource-gh', threadId: 'thread-test' }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${API}/sessions/:resourceId`, ({ params }) => HttpResponse.json(sessionState(String(params.resourceId)))),
    http.put(`${API}/sessions/:resourceId/state`, ({ params }) =>
      HttpResponse.json(sessionState(String(params.resourceId))),
    ),
    http.get(`${API}/sessions/:resourceId/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${API}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    // Entering an empty worktree creates a thread; handle it here so tests
    // that don't care about the create flow still settle deterministically
    // (tests that count creates register their own handler on top).
    http.post(`${API}/sessions/:resourceId/threads`, () =>
      HttpResponse.json({ id: 'thread-generic', title: 'New thread', resourceId: 'resource-gh' }),
    ),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${API}/sessions/:resourceId/stream`, () => sse()),
    http.get(`${ORIGIN}/web/factory/projects/:factoryProjectId/work-items`, () => HttpResponse.json({ workItems })),
  );
}

function seedActiveFactory(project: Factory) {
  saveFactories([project]);
  localStorage.setItem('mastracode-active-factory', project.id);
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderSection(initialPath = '/') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <ActiveFactoryProvider>
        <ChatSessionConfigProvider>
          <WorkspacesSection />
          <LocationProbe />
        </ChatSessionConfigProvider>
      </ActiveFactoryProvider>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

/** The hover-group container of a worktree row, for targeting its actions menu. */
function rowContainer(name: string): HTMLElement {
  return screen.getByRole('button', { name }).parentElement as HTMLElement;
}

describe('WorkspacesSection', () => {
  it('keeps unmatched Factory sessions while hiding repository roots and user sessions', async () => {
    seedActiveFactory({
      ...githubProject,
      binding: {
        ...githubProject.binding,
        repositories: githubProject.binding.repositories.map((repository, index) =>
          index === 0
            ? {
                ...repository,
                worktrees: [
                  ...repository.worktrees,
                  {
                    branch: 'factory/issue-99',
                    worktreePath: '/sandbox/mastra-worktrees/factory-issue-99',
                    baseBranch: 'main',
                  },
                ],
              }
            : repository,
        ),
      },
    });
    useAgentControllerHandlers(relatedWorkItems);
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-unmatched',
              title: 'Unmatched Factory session',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-unmatched' },
              state: 'idle',
            },
          ],
        }),
      ),
    );

    renderSection();

    expect(await screen.findByText('Work Sessions')).toBeInTheDocument();
    expect(screen.getByText('Review Sessions')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'feat-api' })).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByRole('button', { name: 'feat-ui' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'factory/issue-99' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Unmatched Factory session' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'user/alice-notes' })).not.toBeInTheDocument();
  });

  it('groups related issue and PR sessions into uncluttered, always-visible Work and Review sections', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers(relatedWorkItems);

    renderSection();

    const workGroup = await screen.findByRole('region', { name: 'Work Sessions' });
    const reviewGroup = screen.getByRole('region', { name: 'Review Sessions' });
    expect(screen.queryByRole('button', { name: 'Work Sessions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review Sessions' })).not.toBeInTheDocument();
    expect(await within(workGroup).findByRole('button', { name: 'feat-ui' })).toBeInTheDocument();
    expect(await within(reviewGroup).findByRole('button', { name: 'feat-api' })).toBeInTheDocument();
    expect(within(workGroup).queryByText('Review: PR #25')).not.toBeInTheDocument();
    expect(within(reviewGroup).queryByText('Work item: Issue #24')).not.toBeInTheDocument();
  });

  it('keeps selected and running sessions visible ahead of the five-session recency limit', async () => {
    const worktrees = ['work', 'review'].flatMap(kind =>
      Array.from({ length: 6 }, (_, index) => ({
        branch: `${kind}-${index}`,
        worktreePath: `/sandbox/mastra-worktrees/${kind}-${index}`,
        baseBranch: 'main',
      })),
    );
    const items: WorkItem[] = worktrees.map((worktree, index) => {
      const review = worktree.branch.startsWith('review-');
      return {
        id: `item-${index}`,
        orgId: 'org-1',
        createdBy: 'user-1',
        githubProjectId: GITHUB_PROJECT_ID,
        source: review ? 'github-pr' : 'github-issue',
        sourceKey: `${review ? 'github-pr' : 'github-issue'}:${index}`,
        parentWorkItemId: null,
        title: worktree.branch,
        url: null,
        stages: [review ? 'review' : 'execute'],
        stageHistory: [],
        sessions: {
          [review ? 'review' : 'work']: {
            sessionId: worktree.worktreePath,
            branch: worktree.branch,
            threadId: `thread-${index}`,
            startedBy: 'user-1',
          },
        },
        metadata: {},
        revision: 1,
        createdAt: `2026-07-17T00:00:${String(index).padStart(2, '0')}Z`,
        updatedAt: `2026-07-17T00:00:${String(index).padStart(2, '0')}Z`,
      };
    });
    seedActiveFactory({
      ...githubProject,
      binding: {
        kind: 'factory',
        factoryProjectId: 'fp-github-project-1',
        repositories: [
          {
            ...githubProject.binding.repositories[0],
            worktrees,
            selectedWorktreePath: '/sandbox/mastra-worktrees/work-0',
          },
        ],
      },
    });
    useAgentControllerHandlers(items);
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-running-old-session',
              title: 'Running old session',
              tags: { projectPath: '/sandbox/mastra-worktrees/work-1' },
              state: 'active',
            },
          ],
        }),
      ),
    );

    renderSection();

    const workGroup = await screen.findByRole('region', { name: 'Work Sessions' });
    const reviewGroup = screen.getByRole('region', { name: 'Review Sessions' });
    await within(reviewGroup).findByRole('button', { name: 'review-5' });
    await waitFor(() => {
      expect(within(workGroup).getByRole('button', { name: 'work-0' })).toHaveAttribute('aria-current', 'true');
      expect(within(workGroup).getByRole('button', { name: 'Running old session' })).toBeInTheDocument();
      expect(within(workGroup).queryByRole('button', { name: 'work-2' })).not.toBeInTheDocument();
      expect(within(reviewGroup).getAllByRole('button', { name: /^review-/ })).toHaveLength(5);
      expect(within(reviewGroup).queryByRole('button', { name: 'review-0' })).not.toBeInTheDocument();
    });
  });

  it('does not render for local projects', async () => {
    seedActiveFactory(localProject);
    useAgentControllerHandlers();

    renderSection();

    await waitFor(() => expect(screen.queryByText('Work Sessions')).not.toBeInTheDocument());
  });

  it('shows an activity indicator on workspaces with an active thread', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    // One thread listing covers every worktree: each thread carries its
    // worktree's projectPath tag and a server-annotated run state.
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-api',
              title: 'API work',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-api' },
              state: 'idle',
            },
            {
              id: 'thread-feat',
              title: 'Feature work',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-ui' },
              state: 'active',
            },
          ],
        }),
      ),
    );

    renderSection();

    // The same listing names each row after its thread title.
    expect(await screen.findByRole('status', { name: 'Agent working in Feature work' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /Agent working in (API work|feat-api)/ })).not.toBeInTheDocument();
  });

  it('labels rows with their thread title and falls back to the branch when there is none', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-feat',
              title: 'Fix flaky sidebar test',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-ui' },
              state: 'idle',
            },
          ],
        }),
      ),
    );

    renderSection();

    // feat-ui has a titled thread: the title is the row label, the branch is the tooltip.
    const titled = await screen.findByRole('button', { name: 'Fix flaky sidebar test' });
    expect(titled).toHaveAttribute('title', 'feat-ui');
    expect(screen.queryByRole('button', { name: 'feat-ui' })).not.toBeInTheDocument();
    // feat-api has no titled thread yet: the branch remains the label.
    expect(screen.getByRole('button', { name: 'feat-api' })).toBeInTheDocument();
  });

  it('given a run that finishes, then the dot turns solid and chimes, and opening the workspace dismisses it', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    vi.mocked(playDoneSound).mockClear();
    let featState: 'active' | 'idle' = 'active';
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-feat',
              title: 'Feature work',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-ui' },
              state: featState,
            },
          ],
        }),
      ),
    );
    const { client } = renderSection();

    expect(await screen.findByRole('status', { name: 'Agent working in Feature work' })).toBeInTheDocument();

    // The run finishes; the next activity poll reports the thread idle.
    featState = 'idle';
    await client.invalidateQueries({ queryKey: queryKeys.agentControllerActivity('code', 'resource-gh') });

    const doneDot = await screen.findByRole('status', { name: 'Agent finished in Feature work' });
    expect(doneDot).not.toHaveClass('animate-pulse');
    expect(screen.queryByRole('status', { name: 'Agent working in Feature work' })).not.toBeInTheDocument();
    expect(playDoneSound).toHaveBeenCalledTimes(1);

    // Opening the workspace marks it seen and clears the indicator.
    await userEvent.click(screen.getByRole('button', { name: /Feature work/ }));
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Agent finished in Feature work' })).not.toBeInTheDocument(),
    );
    // Let the open-thread flow settle so its requests can't leak into later tests.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-feat'));
  });

  it('given workspaces that are idle from the start, then no done indicator or chime fires', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    vi.mocked(playDoneSound).mockClear();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-feat',
              title: 'Feature work',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-ui' },
              state: 'idle',
            },
          ],
        }),
      ),
    );
    const { client } = renderSection();

    await screen.findByRole('button', { name: 'Feature work' });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('status', { name: 'Agent finished in Feature work' })).not.toBeInTheDocument();
    expect(playDoneSound).not.toHaveBeenCalled();
  });

  it('selects a workspace row and persists its worktree path', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(storedRepository().selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-ui'));
    // Let the open-thread flow settle so its requests can't leak into later tests.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-generic'));
  });

  it('opens the most recent thread of the new worktree when switching workspaces', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            { id: 'thread-old', title: 'Old', resourceId: 'resource-gh', updatedAt: '2026-06-01T00:00:00.000Z' },
            { id: 'thread-latest', title: 'Latest', resourceId: 'resource-gh', updatedAt: '2026-06-09T00:00:00.000Z' },
          ],
        }),
      ),
    );
    renderSection('/threads/thread-test');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-latest'));
  });

  it('opens the most recent thread of the new worktree when switching from /new', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            { id: 'thread-latest', title: 'Latest', resourceId: 'resource-gh', updatedAt: '2026-06-09T00:00:00.000Z' },
          ],
        }),
      ),
    );
    renderSection('/new');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-latest'));
  });

  it('creates and opens a thread when the new worktree has none', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    let created = 0;
    server.use(
      http.post(`${API}/sessions/:resourceId/threads`, () => {
        created += 1;
        return HttpResponse.json({ id: 'thread-fresh', title: 'New thread', resourceId: 'resource-gh' });
      }),
    );
    renderSection('/threads/thread-test');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-fresh'));
    expect(created).toBe(1);
  });

  it('opens the active session thread when clicked from a Factory page', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-latest',
              title: 'Latest',
              resourceId: 'resource-gh',
              updatedAt: '2026-06-09T00:00:00.000Z',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-api' },
            },
          ],
        }),
      ),
    );
    renderSection('/factory/board');

    const activeSession = await screen.findByRole('button', { name: 'Latest' });
    expect(activeSession).toHaveAttribute('aria-current', 'true');
    await userEvent.click(activeSession);

    // A session row IS its conversation — clicking it opens the thread even
    // from worktree-independent pages like the board.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-latest'));
  });

  it('opens the titled conversation thread, not a newer empty untitled one', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            // The real conversation…
            {
              id: 'thread-convo',
              title: 'Real work',
              resourceId: 'resource-gh',
              updatedAt: '2026-06-01T00:00:00.000Z',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-ui' },
            },
            // …and a newer untitled thread seeded by session creation, whose
            // updatedAt sorts first. The row must still open the conversation
            // it is labeled after.
            {
              id: 'thread-seeded',
              title: '',
              resourceId: 'resource-gh',
              updatedAt: '2026-06-09T00:00:00.000Z',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-ui' },
            },
          ],
        }),
      ),
    );
    renderSection('/factory/board');

    await userEvent.click(await screen.findByRole('button', { name: 'Real work' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-convo'));
  });

  it('opens the already-selected workspace’s thread when its row is clicked from another page', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            {
              id: 'thread-generic',
              title: 'Selected session',
              resourceId: 'resource-gh',
              updatedAt: '2026-06-09T00:00:00.000Z',
              tags: { projectPath: '/sandbox/mastra-worktrees/feat-api' },
            },
          ],
        }),
      ),
    );
    renderSection('/factory/board');

    // feat-api is the selected workspace; its row must still lead to its
    // conversation when the user is elsewhere (board, /new, …).
    const row = await screen.findByRole('button', { name: 'Selected session' });
    expect(row).toHaveAttribute('aria-current', 'true');
    await userEvent.click(row);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-generic'));
    // No re-select happened — the workspace selection is unchanged.
    expect(storedRepository().selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-api');
  });

  it('offers no ad-hoc workspace creation — factory sessions come from board runs', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    renderSection();

    await screen.findByRole('button', { name: 'feat-ui' });
    expect(screen.queryByRole('button', { name: 'New workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Create workspace' })).not.toBeInTheDocument();
  });

  it('offers a delete action on every factory worktree', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    renderSection();

    await screen.findByRole('button', { name: 'feat-ui' });
    // One actions menu per Factory session, including unmatched worktrees.
    expect(screen.getAllByRole('button', { name: 'Workspace actions' })).toHaveLength(3);
  });

  it('deletes a worktree after confirmation, cascading its threads', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    let deletedBranch: unknown;
    const deletedThreads: string[] = [];
    let listRequests = 0;
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, ({ request }) => {
        const url = new URL(request.url);
        // The cascade lists threads scoped to the deleted worktree; return one
        // thread on the first scoped call, none afterwards.
        if (url.searchParams.get('tags') === JSON.stringify({ projectPath: '/sandbox/mastra-worktrees/feat-ui' })) {
          listRequests += 1;
          return HttpResponse.json({
            threads: listRequests === 1 ? [{ id: 'thread-doomed', title: 'Doomed', resourceId: 'resource-gh' }] : [],
          });
        }
        return HttpResponse.json({ threads: [] });
      }),
      http.delete(`${API}/sessions/:resourceId/threads/:threadId`, ({ params }) => {
        deletedThreads.push(String(params.threadId));
        return HttpResponse.json({ ok: true });
      }),
      http.delete(`${ORIGIN}/web/user-sessions/${encodeURIComponent('/sandbox/mastra-worktrees/feat-ui')}`, () => {
        deletedBranch = 'feat-ui';
        return HttpResponse.json({ removed: true });
      }),
    );
    renderSection();

    await screen.findByRole('button', { name: 'feat-ui' });
    await userEvent.click(within(rowContainer('feat-ui')).getByRole('button', { name: 'Workspace actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete workspace?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletedBranch).toBe('feat-ui'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'feat-ui' })).not.toBeInTheDocument());
    expect(deletedThreads).toEqual(['thread-doomed']);
    // The user-session worktree survives; the legacy repo-root entry is
    // dropped for good when the worktree list is rewritten.
    expect(storedRepository().worktrees.map(worktree => worktree.branch)).toEqual([
      'feat-api',
      'feat-unmatched',
      'user/alice-notes',
    ]);
    expect(storedRepository().selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-api');
  });

  it('keeps the worktree when the delete confirmation is cancelled', async () => {
    seedActiveFactory(githubProject);
    useAgentControllerHandlers();
    let deleteCalled = false;
    server.use(
      http.delete(`${ORIGIN}/web/user-sessions/${encodeURIComponent('/sandbox/mastra-worktrees/feat-ui')}`, () => {
        deleteCalled = true;
        return HttpResponse.json({ removed: true });
      }),
    );
    renderSection();

    await screen.findByRole('button', { name: 'feat-ui' });
    await userEvent.click(within(rowContainer('feat-ui')).getByRole('button', { name: 'Workspace actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete workspace?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete workspace?' })).not.toBeInTheDocument());
    expect(deleteCalled).toBe(false);
    expect(screen.getByRole('button', { name: 'feat-ui' })).toBeInTheDocument();
    expect(storedRepository().worktrees.map(worktree => worktree.branch)).toEqual([
      'feat-ui',
      'feat-api',
      'feat-unmatched',
      'user/alice-notes',
    ]);
  });
});
