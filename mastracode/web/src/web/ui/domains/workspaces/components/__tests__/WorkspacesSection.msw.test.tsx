/**
 * BDD coverage for the propless `WorkspacesSection`.
 *
 * The section reads the active project from `useActiveProjectContext` and the
 * agent session from `useChatSession`, so the spec renders it inside the real
 * provider stack and asserts worktree selection through the MSW-captured
 * session-state requests instead of a session spy.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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

function renderSection() {
  return renderWithProviders(
    <ToastProvider>
      <ActiveProjectProvider>
        <ChatSessionProvider>
          <WorkspacesSection />
        </ChatSessionProvider>
      </ActiveProjectProvider>
    </ToastProvider>,
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
});
