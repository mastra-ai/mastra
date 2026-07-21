import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { ActiveFactoryProvider, useActiveFactoryContext } from '../../context/ActiveFactoryProvider';
import { commitChanges, createWorktree, openPullRequest, pushBranch } from '../../services/github';
import type { GithubStatus, GitOpError } from '../../services/github';
import { loadFactories } from '../../services/factories';
import { GithubConnectModal } from '../GithubConnectModal';

// The git-op helpers take the ApiConfig base URL explicitly, so handlers match
// against the same base the app injects (`TEST_BASE_URL` in the jsdom suite).
const ORIGIN = TEST_BASE_URL;
const PROJECT = 'proj-1';

function gitOpUrl(action: string): string {
  return `${ORIGIN}/web/github/repositories/${PROJECT}/${action}`;
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

  it('openPullRequest carries the originating session so the created PR is subscribed', async () => {
    let received: unknown;
    server.use(
      http.post(gitOpUrl('pr'), async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ url: 'https://github.com/o/r/pull/7' });
      }),
    );
    const result = await openPullRequest(TEST_BASE_URL, PROJECT, {
      branch: 'feat-x',
      title: 'My PR',
      worktreePath: '/workspace/worktrees/feat-x',
      sessionId: 'session-1',
      threadId: 'thread-1',
    });
    expect(received).toEqual({
      branch: 'feat-x',
      title: 'My PR',
      worktreePath: '/workspace/worktrees/feat-x',
      sessionId: 'session-1',
      threadId: 'thread-1',
    });
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

  const createdProject = {
    id: 'ghp_1',
    name: 'octo/hello',
    source: 'github' as const,
    githubProjectId: 'ghp_1',
    resourceId: 'ghp_1',
    gitBranch: 'main',
  };

  afterEach(() => {
    localStorage.clear();
  });

  function Journey() {
    const { activeFactory, resourceId, selectFactory } = useActiveFactoryContext();
    const [open, setOpen] = useState(true);
    return (
      <div>
        <span data-testid="active">{activeFactory?.name ?? '(none)'}</span>
        <span data-testid="resource-id">{resourceId}</span>
        {open && (
          <GithubConnectModal
            status={connectedStatus}
            onFactoryCreated={project => void selectFactory(project)}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  }

  it('given a connected user, when they pick a repo, then its source-control row is bound without materializing', async () => {
    let ensureCalls = 0;
    let connected = false;
    server.use(
      http.get(`${ORIGIN}/web/github/repos`, () => HttpResponse.json({ repos: [repo] })),
      http.get(`${ORIGIN}/web/github/repositories`, () => HttpResponse.json(connected ? [createdProject] : [])),
      http.post(`${ORIGIN}/web/github/repositories`, () => {
        connected = true;
        return HttpResponse.json({ repository: createdProject });
      }),
      http.post(`${ORIGIN}/web/github/repositories/ghp_1/ensure`, () => {
        ensureCalls += 1;
        return HttpResponse.json({ error: 'must stay deferred' }, { status: 500 });
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(
      <ActiveFactoryProvider>
        <Journey />
      </ActiveFactoryProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /octo\/hello/ }));

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('octo/hello'));
    expect(screen.getByTestId('resource-id')).toHaveTextContent('ghp_1');
    expect(ensureCalls).toBe(0);
    const stored = loadFactories().find(
      factory => factory.binding.kind === 'github' && factory.binding.githubProjectId === 'ghp_1',
    );
    expect(stored).toMatchObject({
      resourceId: 'ghp_1',
      binding: {
        kind: 'github',
        githubProjectId: 'ghp_1',
        gitBranch: 'main',
        worktrees: [],
      },
    });
    expect(stored?.id).not.toBe('ghp_1');
  });
});
