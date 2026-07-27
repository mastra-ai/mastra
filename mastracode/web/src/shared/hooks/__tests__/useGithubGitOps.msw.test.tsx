/**
 * BDD coverage for the app-used Factory session and push mutation hooks.
 *
 * Drives the real `postRepositoryGitOp`-backed services + React Query mutations;
 * only the network is mocked (MSW). Handlers assert the request bodies so the
 * wire contract with `/web/github/projects/:id/*` stays pinned.
 */
import { act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { FactoryUserSession, GitOpError, PushResult } from '../../../web/ui/domains/workspaces/services/github';
import { useCreateUserSessionMutation, usePushBranchMutation } from '../useGithubGitOps';

const ORIGIN = TEST_BASE_URL;
const PROJECT = 'ghp_1';
const PROJECT_URL = `${ORIGIN}/web/github/projects/${PROJECT}`;

describe('git operation mutation hooks', () => {
  it('given a branch and base, when creating a session, then it persists metadata without materializing a worktree', async () => {
    const session: FactoryUserSession = {
      id: 'stored-session',
      sessionId: 'session-feat-x',
      projectRepositoryId: PROJECT,
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'feat-x',
      baseBranch: 'main',
      sandboxId: null,
      sandboxWorkdir: null,
      materializedAt: null,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
    };
    server.use(
      http.post(`${PROJECT_URL}/sessions`, async ({ request }) => {
        expect(await request.json()).toEqual({ branch: 'feat-x', baseBranch: 'main' });
        return HttpResponse.json({ session });
      }),
    );

    const { result, client } = renderHookWithProviders(() => useCreateUserSessionMutation());

    let resolved: FactoryUserSession | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({
        projectRepositoryId: PROJECT,
        branch: 'feat-x',
        baseBranch: 'main',
      });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(session);
  });

  it('given a branch, when pushing, then it resolves the pushed branch', async () => {
    const push: PushResult = { pushed: true, branch: 'feat-x' };
    server.use(
      http.post(`${PROJECT_URL}/push`, async ({ request }) => {
        expect(await request.json()).toEqual({ branch: 'feat-x', sessionId: 'session-feat-x' });
        return HttpResponse.json(push);
      }),
    );

    const { result, client } = renderHookWithProviders(() => usePushBranchMutation());

    let resolved: PushResult | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({
        projectRepositoryId: PROJECT,
        branch: 'feat-x',
        sessionId: 'session-feat-x',
      });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(push);
  });

  it('given the server rejects with a 400 error body, when the mutation fails, then the error carries the code and status', async () => {
    server.use(
      http.post(`${PROJECT_URL}/sessions`, () =>
        HttpResponse.json({ error: 'invalid_branch', message: 'Invalid branch' }, { status: 400 }),
      ),
    );

    const { result, client } = renderHookWithProviders(() => useCreateUserSessionMutation());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ projectRepositoryId: PROJECT, branch: 'bad ref' }),
      ).rejects.toMatchObject({
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
      await expect(
        result.current.mutateAsync({
          projectRepositoryId: PROJECT,
          branch: 'feat-x',
          sessionId: 'session-feat-x',
        }),
      ).rejects.toMatchObject({
        status: 401,
        authRequired: true,
      });
    });
    await waitForMutationsIdle(client);

    const error = result.current.error as GitOpError | null;
    expect(error?.authRequired).toBe(true);
  });
});
