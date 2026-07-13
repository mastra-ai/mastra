import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '#test/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '#test/render';

import { ActiveProjectProvider, useActiveProjectContext } from '../../context/ActiveProjectProvider';
import { commitChanges, createWorktree, openPullRequest, pushBranch } from '../../services/github';
import type { GithubStatus, GitOpError, MaterializeResult } from '../../services/github';
import { loadProjects } from '../../services/projects';
import type { Project } from '../../services/projects';
import { GithubConnectModal } from '../GithubConnectModal';

// The git-op helpers take the ApiConfig base URL explicitly, so handlers match
// against the same base the app injects (`TEST_BASE_URL` in the jsdom suite).
const ORIGIN = TEST_BASE_URL;
const PROJECT = 'proj-1';

function gitOpUrl(action: string): string {
  return `${ORIGIN}/web/github/projects/${PROJECT}/${action}`;
}

describe('github git-op helpers', () => {
  it('createWorktree posts branch/baseBranch and returns the worktree result', async () => {
    let received: unknown;
    server.use(
      http.post(gitOpUrl('worktree'), async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          worktreePath: '/workspace/worktrees/feat-x',
          branch: 'feat-x',
          baseBranch: 'main',
          resourceId: 'res-1',
        });
      }),
    );

    const result = await createWorktree(TEST_BASE_URL, PROJECT, 'feat-x', 'main');

    expect(received).toEqual({ branch: 'feat-x', baseBranch: 'main' });
    expect(result.worktreePath).toBe('/workspace/worktrees/feat-x');
    expect(result.branch).toBe('feat-x');
    expect(result.baseBranch).toBe('main');
  });

  it('commitChanges reports committed=false when nothing changed', async () => {
    server.use(http.post(gitOpUrl('commit'), () => HttpResponse.json({ committed: false })));
    const result = await commitChanges(TEST_BASE_URL, PROJECT, 'msg', '/workspace/worktrees/feat-x');
    expect(result.committed).toBe(false);
  });

  it('pushBranch returns the pushed branch', async () => {
    let received: unknown;
    server.use(
      http.post(gitOpUrl('push'), async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ pushed: true, branch: 'feat-x' });
      }),
    );
    const result = await pushBranch(TEST_BASE_URL, PROJECT, 'feat-x', '/workspace/worktrees/feat-x');
    expect(received).toEqual({ branch: 'feat-x', worktreePath: '/workspace/worktrees/feat-x' });
    expect(result.pushed).toBe(true);
  });

  it('openPullRequest returns the PR url', async () => {
    server.use(http.post(gitOpUrl('pr'), () => HttpResponse.json({ url: 'https://github.com/o/r/pull/7' })));
    const result = await openPullRequest(TEST_BASE_URL, PROJECT, { branch: 'feat-x', title: 'My PR' });
    expect(result.url).toBe('https://github.com/o/r/pull/7');
  });

  it('surfaces the server error code/message on failure', async () => {
    server.use(
      http.post(gitOpUrl('worktree'), () =>
        HttpResponse.json({ error: 'Invalid branch', message: 'branch name is invalid' }, { status: 400 }),
      ),
    );
    await expect(createWorktree(TEST_BASE_URL, PROJECT, 'bad ref')).rejects.toMatchObject({
      code: 'Invalid branch',
      message: 'branch name is invalid',
      status: 400,
    });
  });

  it('flags authRequired on a 401', async () => {
    server.use(http.post(gitOpUrl('push'), () => new HttpResponse(null, { status: 401 })));
    let caught: GitOpError | undefined;
    try {
      await pushBranch(TEST_BASE_URL, PROJECT, 'feat-x');
    } catch (e) {
      caught = e as GitOpError;
    }
    expect(caught?.authRequired).toBe(true);
    expect(caught?.status).toBe(401);
  });
});

/**
 * Cross-flow journey: pick a repo in the GitHub modal → the project is created
 * server-side and stored locally → selecting it materializes the repo into its
 * sandbox (`/ensure`) and activates the project with the server's resourceId.
 * This is the same wiring `ChatOverlays` composes in the app.
 */
describe('github open-repo journey', () => {
  const connectedStatus: GithubStatus = {
    enabled: true,
    connected: true,
    installations: [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }],
    reason: 'ready',
  };

  const repo = {
    id: 99,
    fullName: 'octo/hello',
    name: 'hello',
    owner: 'octo',
    defaultBranch: 'main',
    private: false,
    installationId: 7,
  };

  const createdProject: Project = {
    id: 'ghp_1',
    name: 'octo/hello',
    source: 'github',
    githubProjectId: 'ghp_1',
    gitBranch: 'main',
    createdAt: 10,
  };

  const materialized: MaterializeResult = {
    resourceId: 'resource-gh',
    githubProjectId: 'ghp_1',
    sandboxId: 'sbx_1',
    sandboxWorkdir: '/workspace/hello',
  };

  afterEach(() => {
    localStorage.clear();
  });

  function Journey() {
    const { activeProject, resourceId, selectProject, preparing } = useActiveProjectContext();
    const [open, setOpen] = useState(true);
    return (
      <div>
        <span data-testid="active">{activeProject?.name ?? '(none)'}</span>
        <span data-testid="resource-id">{resourceId}</span>
        <span data-testid="preparing">{preparing?.message ?? '(idle)'}</span>
        {open && (
          <GithubConnectModal
            status={connectedStatus}
            onProjectCreated={project => void selectProject(project)}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  }

  it('given a connected user, when they pick a repo, then the project is created, materialized, and activated', async () => {
    server.use(
      http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.post(`${ORIGIN}/web/github/projects`, () => HttpResponse.json({ project: createdProject })),
      http.post(`${ORIGIN}/web/github/projects/ghp_1/ensure`, () => HttpResponse.json(materialized)),
    );
    const user = userEvent.setup();

    renderWithProviders(
      <ActiveProjectProvider>
        <Journey />
      </ActiveProjectProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('octo/hello'));
    expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-gh');
    expect(loadProjects().find(p => p.githubProjectId === 'ghp_1')).toMatchObject({
      resourceId: 'resource-gh',
      sandboxId: 'sbx_1',
      sandboxWorkdir: '/workspace/hello',
    });
  });
});
