import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { WorkspaceSession } from '../../hooks/useWorkspaces';
import type { Project } from '../../services/projects';
import { loadProjects, saveProjects } from '../../services/projects';
import { WorkspacesSection } from '../WorkspacesSection';

const ORIGIN = TEST_BASE_URL;
const GITHUB_PROJECT_ID = 'github-project-1';

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

function sessionStub() {
  return { setState: vi.fn<WorkspaceSession['setState']>().mockResolvedValue(undefined) };
}

function renderSection(project: Project) {
  const session = sessionStub();
  const view = renderWithProviders(
    createElement(WorkspacesSection, {
      activeProject: project,
      session,
      agentControllerId: 'code',
      resourceId: project.resourceId,
    }),
  );
  return { session, ...view };
}

describe('WorkspacesSection', () => {
  it('lists GitHub worktrees and marks the selected one active', async () => {
    saveProjects([githubProject]);

    renderSection(githubProject);

    expect(await screen.findByText('Workspaces')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'main' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'feat-ui' })).not.toHaveAttribute('aria-current');
  });

  it('does not render for local projects', () => {
    saveProjects([localProject]);

    renderSection(localProject);

    expect(screen.queryByText('Workspaces')).not.toBeInTheDocument();
  });

  it('selects a workspace row and rebinds the session', async () => {
    saveProjects([githubProject]);
    const { session } = renderSection(githubProject);

    await userEvent.click(await screen.findByRole('button', { name: 'feat-ui' }));

    expect(session.setState).toHaveBeenCalledWith({ projectPath: '/sandbox/mastra-worktrees/feat-ui' });
    await waitFor(() => expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-ui'));
  });

  it('creates a new workspace and selects it', async () => {
    saveProjects([githubProject]);
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
    const { session } = renderSection(githubProject);

    await userEvent.click(await screen.findByRole('button', { name: 'New workspace' }));
    const form = screen.getByRole('form', { name: 'Create workspace' });
    await userEvent.type(within(form).getByRole('textbox', { name: 'Branch name' }), 'feat-new{Enter}');

    expect(received).toEqual({ branch: 'feat-new' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'feat-new' })).toHaveAttribute('aria-current', 'true'),
    );
    expect(session.setState).toHaveBeenCalledWith({ projectPath: '/sandbox/mastra-worktrees/feat-new' });
  });

  it('shows an error and keeps the current selection when create fails', async () => {
    saveProjects([githubProject]);
    server.use(
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, () =>
        HttpResponse.json({ error: 'Invalid branch', message: 'branch name is invalid' }, { status: 400 }),
      ),
    );
    const { session } = renderSection(githubProject);

    await userEvent.click(await screen.findByRole('button', { name: 'New workspace' }));
    const form = screen.getByRole('form', { name: 'Create workspace' });
    await userEvent.type(within(form).getByRole('textbox', { name: 'Branch name' }), 'bad branch{Enter}');

    expect(await screen.findByText('branch name is invalid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'main' })).toHaveAttribute('aria-current', 'true');
    expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra');
    expect(session.setState).not.toHaveBeenCalled();
  });
});
