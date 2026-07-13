/**
 * BDD coverage for the propless `WorkspacesSection`.
 *
 * The section reads the active project from `useActiveProjectContext` and the
 * agent session from focused chat hooks, so the spec renders it inside the real
 * provider stack and asserts worktree selection through the MSW-captured
 * session-state requests instead of a session spy.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { ToastProvider } from '../../../../ui';
import { ChatSessionProvider } from '../../../chat/context/ChatSessionProvider';
import { ActiveProjectProvider } from '../../context/ActiveProjectProvider';
import type { Project } from '../../services/projects';
import { loadProjects, saveProjects } from '../../services/projects';
import { WorkspacesSection } from '../WorkspacesSection';

const ORIGIN = TEST_BASE_URL;
const GITHUB_PROJECT_ID = 'github-project-1';
const API = `${ORIGIN}/api/agent-controller/code`;

const githubProject: Project = {
  id: 'project-gh',
  name: 'Mastra',
  source: 'github',
  githubProjectId: GITHUB_PROJECT_ID,
  sandboxWorkdir: '/sandbox/mastra',
  resourceId: 'resource-gh',
  gitBranch: 'main',
  worktrees: [
    { branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' },
    { branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui', baseBranch: 'main' },
  ],
  selectedWorktreePath: '/sandbox/mastra',
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
      HttpResponse.json({ controllerId: 'code', resourceId: 'resource-gh', threadId: 'thread-test' }),
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

function renderSection(children?: ReactNode, initialPath = '/') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <ActiveProjectProvider>
          <ChatSessionProvider>
            <WorkspacesSection>{children}</WorkspacesSection>
            <LocationProbe />
          </ChatSessionProvider>
        </ActiveProjectProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('WorkspacesSection', () => {
  it('lists GitHub worktrees and marks the selected one active', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();

    renderSection();

    expect(await screen.findByText('Workspaces')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'main' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'feat-ui' })).not.toHaveAttribute('aria-current');
  });

  it('nests children under the active worktree row', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();

    renderSection(<div data-testid="nested-threads">Threads</div>);

    const activeRow = await screen.findByRole('button', { name: 'main' });
    const nested = screen.getByTestId('nested-threads');
    // The row button sits inside a hover-group wrapper; nested children render
    // as a sibling of that wrapper inside the worktree's container.
    expect(activeRow.parentElement?.parentElement).toContainElement(nested);
    const inactiveRow = screen.getByRole('button', { name: 'feat-ui' });
    expect(inactiveRow.parentElement?.parentElement).not.toContainElement(nested);
  });

  it('does not render for local projects', async () => {
    seedActiveProject(localProject);
    useAgentControllerHandlers();

    renderSection();

    await waitFor(() => expect(screen.queryByText('Workspaces')).not.toBeInTheDocument());
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
  });

  it('opens the most recent thread of the new worktree when switching workspaces', async () => {
    seedActiveProject(githubProject);
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
    renderSection(undefined, '/threads/thread-test');

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
            { id: 'thread-latest', title: 'Latest', resourceId: 'resource-gh', updatedAt: '2026-06-09T00:00:00.000Z' },
          ],
        }),
      ),
    );
    renderSection(undefined, '/new');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-latest'));
  });

  it('creates and opens a thread when the new worktree has none', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    let created = 0;
    server.use(
      http.post(`${API}/sessions/:resourceId/threads`, () => {
        created += 1;
        return HttpResponse.json({ id: 'thread-fresh', title: 'New thread', resourceId: 'resource-gh' });
      }),
    );
    renderSection(undefined, '/threads/thread-test');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-fresh'));
    expect(created).toBe(1);
  });

  it('stays on non-thread routes when switching workspaces', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    renderSection(undefined, '/factory/intake');

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'feat-ui' })).toHaveAttribute('aria-current', 'true'),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/factory/intake');
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
          resourceId: 'resource-gh',
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
    expect(screen.getByRole('button', { name: 'main' })).toHaveAttribute('aria-current', 'true');
    expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra');
    // Only the provider's initial project-path sync may write state — never a failed create.
    const paths = stateUpdates.map(update => (update.state as { projectPath?: string })?.projectPath);
    expect(paths.filter(path => path !== '/sandbox/mastra')).toEqual([]);
  });

  it('offers a delete action on feature worktrees but not the repo root', async () => {
    seedActiveProject(githubProject);
    useAgentControllerHandlers();
    renderSection();

    await screen.findByRole('button', { name: 'feat-ui' });
    // One actions menu (feat-ui); the root workspace has none.
    expect(screen.getAllByRole('button', { name: 'Workspace actions' })).toHaveLength(1);
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

    await userEvent.click(await screen.findByRole('button', { name: 'Workspace actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete workspace?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletedBranch).toBe('feat-ui'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'feat-ui' })).not.toBeInTheDocument());
    expect(deletedThreads).toEqual(['thread-doomed']);
    expect(loadProjects()[0]?.worktrees?.map(worktree => worktree.branch)).toEqual(['main']);
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

    await userEvent.click(await screen.findByRole('button', { name: 'Workspace actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete workspace?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete workspace?' })).not.toBeInTheDocument());
    expect(deleteCalled).toBe(false);
    expect(screen.getByRole('button', { name: 'feat-ui' })).toBeInTheDocument();
    expect(loadProjects()[0]?.worktrees?.map(worktree => worktree.branch)).toEqual(['main', 'feat-ui']);
  });
});
