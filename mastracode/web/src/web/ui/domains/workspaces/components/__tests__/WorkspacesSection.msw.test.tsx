/**
 * BDD coverage for the propless `WorkspacesSection` (factory Sessions).
 *
 * The section reads the active project from `useActiveProjectContext` and the
 * agent session from focused chat hooks, so the spec renders it inside the real
 * provider stack and asserts worktree selection through the MSW-captured
 * session-state requests instead of a session spy.
 *
 * Factory sessions are feature worktrees only: the persisted fixture includes
 * a legacy repo-root entry and a `user/` personal-session worktree, and the
 * specs assert both stay out of the list.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { queryKeys } from '../../../../../../shared/api/keys';
import { ToastProvider } from '../../../../ui';
import { ChatSessionProvider } from '../../../chat/context/ChatSessionProvider';
import { ActiveProjectProvider } from '../../context/ActiveProjectProvider';
import type { Project } from '../../services/projects';
import { playDoneSound } from '../../../settings/services/doneSound';
import { loadProjects, saveProjects } from '../../services/projects';
import { WorkspacesSection } from '../WorkspacesSection';

// The completion sound synthesizes audio via AudioContext, which jsdom
// doesn't provide; mock playback so specs can assert the notification fired.
vi.mock('../../../settings/services/doneSound', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../settings/services/doneSound')>()),
  playDoneSound: vi.fn(),
}));

const ORIGIN = TEST_BASE_URL;
const GITHUB_PROJECT_ID = 'github-project-1';
const RESOURCE_ID = 'resource-workspaces';
const API = `${ORIGIN}/api/agent-controller/code`;

const githubProject: Project = {
  id: 'project-gh',
  name: 'Mastra',
  source: 'github',
  githubProjectId: GITHUB_PROJECT_ID,
  sandboxWorkdir: '/sandbox/mastra',
  resourceId: RESOURCE_ID,
  gitBranch: 'main',
  worktrees: [
    // Legacy repo-root entry persisted by older builds — never a workspace.
    { branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' },
    { branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui', baseBranch: 'main' },
    { branch: 'feat-api', worktreePath: '/sandbox/mastra-worktrees/feat-api', baseBranch: 'main' },
    // Personal user session — listed by the User Sessions section instead.
    {
      branch: 'user/alice-notes',
      worktreePath: '/sandbox/mastra-worktrees/user-alice-notes',
      baseBranch: 'main',
      threadId: 'thread-user',
    },
  ],
  selectedWorktreePath: '/sandbox/mastra-worktrees/feat-api',
  createdAt: 1,
};

const localProject: Project = {
  id: 'project-local',
  name: 'Local',
  path: '/projects/local',
  resourceId: 'resource-local',
  createdAt: 1,
};

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

/** Registers the full agent-controller handler set and captures session-state writes. */
function useAgentControllerHandlers(): { stateUpdates: Array<Record<string, unknown>> } {
  const stateUpdates: Array<Record<string, unknown>> = [];
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
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: 'thread-test' }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(`${API}/sessions/:resourceId`, ({ params }) => HttpResponse.json(sessionState(String(params.resourceId)))),
    http.put(`${API}/sessions/:resourceId/state`, async ({ params, request }) => {
      stateUpdates.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(sessionState(String(params.resourceId)));
    }),
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
  );

  return { stateUpdates };
}

function seedActiveProject(project: Project) {
  saveProjects([project]);
  localStorage.setItem('mastracode-active-project', project.id);
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderSection(initialPath = '/') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <ActiveProjectProvider>
          <ChatSessionProvider>
            <WorkspacesSection />
            <LocationProbe />
          </ChatSessionProvider>
        </ActiveProjectProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** The hover-group container of a worktree row, for targeting its actions menu. */
function rowContainer(name: string): HTMLElement {
  return screen.getByRole('button', { name }).parentElement as HTMLElement;
}

describe('WorkspacesSection', () => {
  it('lists factory worktrees, hides the repo root and user sessions, and marks the selected one active', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();

    renderSection();

    expect(await screen.findByText('Sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'feat-api' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'feat-ui' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('button', { name: 'main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'user/alice-notes' })).not.toBeInTheDocument();
  });

  it('does not render for local projects', async () => {
    seedActiveProject(localProject);
    useAgentControllerHandlers();

    renderSection();

    await waitFor(() => expect(screen.queryByText('Sessions')).not.toBeInTheDocument());
  });

  it('shows an activity indicator on workspaces with an active thread', async () => {
    seedActiveProject(githubProject);
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

    expect(await screen.findByRole('status', { name: 'Agent working in feat-ui' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Agent working in feat-api' })).not.toBeInTheDocument();
  });

  it('given a run that finishes, then the dot turns solid and chimes, and opening the workspace dismisses it', async () => {
    seedActiveProject(githubProject);
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

    expect(await screen.findByRole('status', { name: 'Agent working in feat-ui' })).toBeInTheDocument();

    // The run finishes; the next activity poll reports the thread idle.
    featState = 'idle';
    await client.invalidateQueries({ queryKey: queryKeys.agentControllerActivity('code', 'resource-gh') });

    const doneDot = await screen.findByRole('status', { name: 'Agent finished in feat-ui' });
    expect(doneDot).not.toHaveClass('animate-pulse');
    expect(screen.queryByRole('status', { name: 'Agent working in feat-ui' })).not.toBeInTheDocument();
    expect(playDoneSound).toHaveBeenCalledTimes(1);

    // Opening the workspace marks it seen and clears the indicator.
    await userEvent.click(screen.getByRole('button', { name: /feat-ui/ }));
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Agent finished in feat-ui' })).not.toBeInTheDocument(),
    );
    // Let the open-thread flow settle so its requests can't leak into later tests.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-feat'));
  });

  it('given workspaces that are idle from the start, then no done indicator or chime fires', async () => {
    seedActiveProject(githubProject);
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

    await screen.findByRole('button', { name: 'feat-ui' });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('status', { name: 'Agent finished in feat-ui' })).not.toBeInTheDocument();
    expect(playDoneSound).not.toHaveBeenCalled();
  });

  it('selects a workspace row and rebinds the session to its worktree path', async () => {
    seedActiveProject(githubProject);
    const { stateUpdates } = useAgentControllerHandlers();
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() =>
      expect(stateUpdates).toContainEqual({ state: { projectPath: '/sandbox/mastra-worktrees/feat-ui' } }),
    );
    await waitFor(() => expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-ui'));
    // Let the open-thread flow settle so its requests can't leak into later tests.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-generic'));
  });

  it('opens the most recent thread of the new worktree when switching workspaces', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            { id: 'thread-old', title: 'Old', resourceId: RESOURCE_ID, updatedAt: '2026-06-01T00:00:00.000Z' },
            { id: 'thread-latest', title: 'Latest', resourceId: RESOURCE_ID, updatedAt: '2026-06-09T00:00:00.000Z' },
          ],
        }),
      ),
    );
    renderSection('/threads/thread-test');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-latest'));
  });

  it('opens the most recent thread of the new worktree when switching from /new', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, () =>
        HttpResponse.json({
          threads: [
            { id: 'thread-latest', title: 'Latest', resourceId: RESOURCE_ID, updatedAt: '2026-06-09T00:00:00.000Z' },
          ],
        }),
      ),
    );
    renderSection('/new');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-latest'));
  });

  it('creates and opens a thread when the new worktree has none', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    let created = 0;
    server.use(
      http.post(`${API}/sessions/${RESOURCE_ID}/threads`, () => {
        created += 1;
        return HttpResponse.json({ id: 'thread-fresh', title: 'New thread', resourceId: RESOURCE_ID });
      }),
    );
    renderSection('/threads/thread-test');

    const workspace = await screen.findByRole('button', { name: 'feat-ui' });
    expect(created).toBe(0);
    await userEvent.click(workspace);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-fresh'));
    expect(created).toBe(1);
  });

  it('stays on non-thread routes when switching workspaces', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    renderSection('/factory/board');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'feat-ui' })).toHaveAttribute('aria-current', 'true'),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/factory/board');
  });

  it('creates a new workspace and selects it', async () => {
    seedActiveProject(githubProject);
    const { stateUpdates } = useAgentControllerHandlers();
    let received: unknown;
    server.use(
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          branch: 'feat-new',
          worktreePath: '/sandbox/mastra-worktrees/feat-new',
          baseBranch: 'main',
          resourceId: RESOURCE_ID,
        });
      }),
    );
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: 'New workspace' }));
    const form = screen.getByRole('form', { name: 'Create workspace' });
    await userEvent.type(within(form).getByRole('textbox', { name: 'Branch name' }), 'feat-new{Enter}');

    expect(received).toEqual({ branch: 'feat-new' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'feat-new' })).toHaveAttribute('aria-current', 'true'),
    );
    await waitFor(() =>
      expect(stateUpdates).toContainEqual({ state: { projectPath: '/sandbox/mastra-worktrees/feat-new' } }),
    );
    // Let the open-thread flow settle so its requests can't leak into later tests.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-generic'));
  });

  it('shows an error and keeps the current selection when create fails', async () => {
    seedActiveProject(githubProject);
    const { stateUpdates } = useAgentControllerHandlers();
    server.use(
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, () =>
        HttpResponse.json({ error: 'Invalid branch', message: 'branch name is invalid' }, { status: 400 }),
      ),
    );
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: 'New workspace' }));
    const form = screen.getByRole('form', { name: 'Create workspace' });
    await userEvent.type(within(form).getByRole('textbox', { name: 'Branch name' }), 'bad branch{Enter}');

    expect(await screen.findAllByText('branch name is invalid')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'feat-api' })).toHaveAttribute('aria-current', 'true');
    expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-api');
    // Only the provider's initial project-path sync may write state — never a failed create.
    const paths = stateUpdates.map(update => (update.state as { projectPath?: string })?.projectPath);
    expect(paths.filter(path => path !== '/sandbox/mastra-worktrees/feat-api')).toEqual([]);
  });

  it('offers a delete action on every factory worktree', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    renderSection();

    await screen.findByRole('button', { name: 'feat-ui' });
    // One actions menu per factory worktree (feat-ui, feat-api).
    expect(screen.getAllByRole('button', { name: 'Workspace actions' })).toHaveLength(2);
  });

  it('deletes a worktree after confirmation, cascading its threads', async () => {
    seedActiveProject(githubProject);
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
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree/delete`, async ({ request }) => {
        deletedBranch = ((await request.json()) as { branch: string }).branch;
        return HttpResponse.json({
          removed: true,
          branch: 'feat-ui',
          worktreePath: '/sandbox/mastra-worktrees/feat-ui',
        });
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
    expect(loadProjects()[0]?.worktrees?.map(worktree => worktree.branch)).toEqual(['feat-api', 'user/alice-notes']);
    expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-api');
  });

  it('keeps the worktree when the delete confirmation is cancelled', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    let deleteCalled = false;
    server.use(
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree/delete`, () => {
        deleteCalled = true;
        return HttpResponse.json({
          removed: true,
          branch: 'feat-ui',
          worktreePath: '/sandbox/mastra-worktrees/feat-ui',
        });
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
    expect(loadProjects()[0]?.worktrees?.map(worktree => worktree.branch)).toEqual([
      'main',
      'feat-ui',
      'feat-api',
      'user/alice-notes',
    ]);
  });
});
