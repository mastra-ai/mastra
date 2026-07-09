/**
 * BDD coverage for the git-operation mutation hooks (worktree/commit/push/PR).
 *
 * Drives the real `postProjectGitOp`-backed services + React Query mutations;
 * only the network is mocked (MSW). Handlers assert the request bodies so the
 * wire contract with `/web/github/projects/:id/*` stays pinned.
 */
import { act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { CommitResult, GitOpError, PullRequestResult, PushResult, WorktreeResult } from '../../services/github';
import {
  useCommitChangesMutation,
  useCreateWorktreeMutation,
  useOpenPullRequestMutation,
  usePushBranchMutation,
} from '../useGithubGitOps';

const ORIGIN = TEST_BASE_URL;
const PROJECT = 'ghp_1';
const PROJECT_URL = `${ORIGIN}/web/github/projects/${PROJECT}`;

describe('git operation mutation hooks', () => {
  it('given a branch and base, when creating a worktree, then it posts them and resolves the worktree result', async () => {
    const worktree: WorktreeResult = {
      worktreePath: '/workspace/worktrees/feat-x',
      branch: 'feat-x',
      baseBranch: 'main',
      resourceId: 'resource-feat-x',
    };
    server.use(
      http.post(`${PROJECT_URL}/worktree`, async ({ request }) => {
        expect(await request.json()).toEqual({ branch: 'feat-x', baseBranch: 'main' });
        return HttpResponse.json(worktree);
      }),
    );

    const { result, client } = renderHookWithProviders(() => useCreateWorktreeMutation());

    let resolved: WorktreeResult | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ githubProjectId: PROJECT, branch: 'feat-x', baseBranch: 'main' });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(worktree);
  });

  it('given nothing changed, when committing, then it resolves committed=false', async () => {
    const commit: CommitResult = { committed: false };
    server.use(
      http.post(`${PROJECT_URL}/commit`, async ({ request }) => {
        expect(await request.json()).toEqual({ message: 'chore: noop', worktreePath: '/workspace/worktrees/feat-x' });
        return HttpResponse.json(commit);
      }),
    );

    const { result, client } = renderHookWithProviders(() => useCommitChangesMutation());

    let resolved: CommitResult | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({
        githubProjectId: PROJECT,
        message: 'chore: noop',
        worktreePath: '/workspace/worktrees/feat-x',
      });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(commit);
  });

  it('given a branch, when pushing, then it resolves the pushed branch', async () => {
    const push: PushResult = { pushed: true, branch: 'feat-x' };
    server.use(
      http.post(`${PROJECT_URL}/push`, async ({ request }) => {
        expect(await request.json()).toEqual({ branch: 'feat-x' });
        return HttpResponse.json(push);
      }),
    );

    const { result, client } = renderHookWithProviders(() => usePushBranchMutation());

    let resolved: PushResult | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ githubProjectId: PROJECT, branch: 'feat-x' });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(push);
  });

  it('given a branch and title, when opening a pull request, then it resolves the PR url', async () => {
    const pr: PullRequestResult = { url: 'https://github.com/mastra-ai/mastra/pull/1' };
    server.use(
      http.post(`${PROJECT_URL}/pr`, async ({ request }) => {
        expect(await request.json()).toEqual({ branch: 'feat-x', title: 'My PR', body: 'Details', base: 'main' });
        return HttpResponse.json(pr);
      }),
    );

    const { result, client } = renderHookWithProviders(() => useOpenPullRequestMutation());

    let resolved: PullRequestResult | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({
        githubProjectId: PROJECT,
        branch: 'feat-x',
        title: 'My PR',
        body: 'Details',
        base: 'main',
      });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(pr);
  });

  it('given the server rejects with a 400 error body, when the mutation fails, then the error carries the code and status', async () => {
    server.use(
      http.post(`${PROJECT_URL}/worktree`, () =>
        HttpResponse.json({ error: 'invalid_branch', message: 'Invalid branch' }, { status: 400 }),
      ),
    );

    const { result, client } = renderHookWithProviders(() => useCreateWorktreeMutation());

    await act(async () => {
      await expect(result.current.mutateAsync({ githubProjectId: PROJECT, branch: 'bad ref' })).rejects.toMatchObject({
        message: 'Invalid branch',
        code: 'invalid_branch',
        status: 400,
      });
    });
    await waitForMutationsIdle(client);

    const error = result.current.error as GitOpError | null;
    expect(error?.code).toBe('invalid_branch');
    expect(error?.authRequired).toBeUndefined();
  });

  it('given the session expired, when the mutation fails with a 401, then the error reports authRequired', async () => {
    server.use(http.post(`${PROJECT_URL}/push`, () => HttpResponse.json({ error: 'auth_required' }, { status: 401 })));

    const { result, client } = renderHookWithProviders(() => usePushBranchMutation());

    await act(async () => {
      await expect(result.current.mutateAsync({ githubProjectId: PROJECT, branch: 'feat-x' })).rejects.toMatchObject({
        status: 401,
        authRequired: true,
      });
    });
    await waitForMutationsIdle(client);

    const error = result.current.error as GitOpError | null;
    expect(error?.authRequired).toBe(true);
  });
});
