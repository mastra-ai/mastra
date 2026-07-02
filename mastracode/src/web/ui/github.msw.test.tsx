import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/web-ui/msw-server';
import { commitChanges, createWorktree, openPullRequest, pushBranch } from './github';
import type { GitOpError } from './github';

/**
 * The GitHub git-op helpers use raw relative `fetch('/api/web/github/...')`
 * (not the injected ApiConfig base), so jsdom resolves them against its default
 * origin. Match handlers against that origin.
 */
const ORIGIN = 'http://localhost:3000';
const PROJECT = 'proj-1';

function gitOpUrl(action: string): string {
  return `${ORIGIN}/api/web/github/projects/${PROJECT}/${action}`;
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

    const result = await createWorktree(PROJECT, 'feat-x', 'main');

    expect(received).toEqual({ branch: 'feat-x', baseBranch: 'main' });
    expect(result.worktreePath).toBe('/workspace/worktrees/feat-x');
    expect(result.branch).toBe('feat-x');
    expect(result.baseBranch).toBe('main');
  });

  it('commitChanges reports committed=false when nothing changed', async () => {
    server.use(http.post(gitOpUrl('commit'), () => HttpResponse.json({ committed: false })));
    const result = await commitChanges(PROJECT, 'msg', '/workspace/worktrees/feat-x');
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
    const result = await pushBranch(PROJECT, 'feat-x', '/workspace/worktrees/feat-x');
    expect(received).toEqual({ branch: 'feat-x', worktreePath: '/workspace/worktrees/feat-x' });
    expect(result.pushed).toBe(true);
  });

  it('openPullRequest returns the PR url', async () => {
    server.use(http.post(gitOpUrl('pr'), () => HttpResponse.json({ url: 'https://github.com/o/r/pull/7' })));
    const result = await openPullRequest(PROJECT, { branch: 'feat-x', title: 'My PR' });
    expect(result.url).toBe('https://github.com/o/r/pull/7');
  });

  it('surfaces the server error code/message on failure', async () => {
    server.use(
      http.post(gitOpUrl('worktree'), () =>
        HttpResponse.json({ error: 'Invalid branch', message: 'branch name is invalid' }, { status: 400 }),
      ),
    );
    await expect(createWorktree(PROJECT, 'bad ref')).rejects.toMatchObject({
      code: 'Invalid branch',
      message: 'branch name is invalid',
      status: 400,
    });
  });

  it('flags authRequired on a 401', async () => {
    server.use(http.post(gitOpUrl('push'), () => new HttpResponse(null, { status: 401 })));
    let caught: GitOpError | undefined;
    try {
      await pushBranch(PROJECT, 'feat-x');
    } catch (e) {
      caught = e as GitOpError;
    }
    expect(caught?.authRequired).toBe(true);
    expect(caught?.status).toBe(401);
  });
});
