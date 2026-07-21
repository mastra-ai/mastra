/**
 * Regression: thread & goal mutation hooks must forward `projectPath` as the
 * worktree `sessionScope` on the wire, so that create/delete/rename/clone/
 * switch/goal operations hit the same server-side session as the reader hooks
 * (`useAgentControllerThreads`, `useAgentControllerSettings`, ...).
 *
 * Bug being pinned down: the mutation hooks used to spread `args` into
 * `createAgentControllerClient(args)`, which expects `scope` — not
 * `projectPath` — so mutations silently addressed the unscoped session. New
 * threads were written into one session and never showed up in the scoped
 * session's list, breaking `/new` → `POST thread` → `navigate('/threads/:id')`
 * → `useRouteThreadSync` → "thread was not found" toast.
 */
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { useSetAgentControllerGoalMutation } from '../useAgentControllerGoalMutations';
import {
  useCloneAgentControllerThreadMutation,
  useCreateAgentControllerThreadMutation,
  useDeleteAgentControllerThreadMutation,
  useRenameAgentControllerThreadMutation,
  useSwitchAgentControllerThreadMutation,
} from '../useAgentControllerThreadMutations';

const controllerId = 'code';
const resourceId = 'resource-test';
const projectPath = '/sandbox/mastra';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;
const hookArgs = {
  agentControllerId: controllerId,
  resourceId,
  projectPath,
  baseUrl: TEST_BASE_URL,
  enabled: true,
};

const encodedProjectPath = encodeURIComponent(projectPath);

describe('thread & goal mutation hooks forward projectPath as sessionScope', () => {
  it('createThread sends the projectPath as sessionScope on the wire', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.post(`${sessionUrl}/threads`, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({
          id: 'thread-new',
          title: 'New work',
          updatedAt: '2026-07-21T00:00:00.000Z',
        });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      createThread: useCreateAgentControllerThreadMutation(hookArgs),
    }));

    await act(async () => result.current.createThread.mutateAsync('New work'));
    await waitForMutationsIdle(client);

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toContain(`sessionScope=${encodedProjectPath}`);
  });

  it('deleteThread sends the projectPath as sessionScope on the wire', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.delete(`${sessionUrl}/threads/:threadId`, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      deleteThread: useDeleteAgentControllerThreadMutation(hookArgs),
    }));

    await act(async () => result.current.deleteThread.mutateAsync('thread-old'));
    await waitForMutationsIdle(client);

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toContain(`sessionScope=${encodedProjectPath}`);
  });

  it('renameThread sends the projectPath as sessionScope on the wire', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.put(`${sessionUrl}/threads/:threadId`, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      renameThread: useRenameAgentControllerThreadMutation(hookArgs),
    }));

    await act(async () =>
      result.current.renameThread.mutateAsync({ threadId: 'thread-old', title: 'New title' }),
    );
    await waitForMutationsIdle(client);

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toContain(`sessionScope=${encodedProjectPath}`);
  });

  it('cloneThread sends the projectPath as sessionScope on the wire', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.post(`${sessionUrl}/threads/clone`, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({
          id: 'thread-clone',
          title: 'Clone',
          updatedAt: '2026-07-21T00:00:00.000Z',
        });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      cloneThread: useCloneAgentControllerThreadMutation(hookArgs),
    }));

    await act(async () => result.current.cloneThread.mutateAsync({ sourceThreadId: 'thread-source' }));
    await waitForMutationsIdle(client);

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toContain(`sessionScope=${encodedProjectPath}`);
  });

  it('switchThread sends the projectPath as sessionScope on the wire', async () => {
    const capturedUrls: string[] = [];
    const stateHandler = vi.fn(() => HttpResponse.json({ threadId: 'thread-target', settings: null }));
    server.use(
      http.post(`${sessionUrl}/thread`, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({ ok: true });
      }),
      // switchThread mutation reads session state after the switch to refresh the cache.
      http.get(sessionUrl, stateHandler),
    );

    const { result, client } = renderHookWithProviders(() => ({
      switchThread: useSwitchAgentControllerThreadMutation(hookArgs),
    }));

    await act(async () => result.current.switchThread.mutateAsync('thread-target'));
    await waitForMutationsIdle(client);

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toContain(`sessionScope=${encodedProjectPath}`);
  });

  it('setGoal sends the projectPath as sessionScope on the wire', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.post(`${sessionUrl}/goal`, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({ goal: { objective: 'ship it', status: 'active' } });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      setGoal: useSetAgentControllerGoalMutation(hookArgs),
    }));

    await act(async () => result.current.setGoal.mutateAsync('ship it'));
    await waitForMutationsIdle(client);

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toContain(`sessionScope=${encodedProjectPath}`);
  });

  it('scoped createThread appears in the scoped list, unblocking /new → /threads/:id', async () => {
    // End-to-end shape of the bug: create in scope A, list in scope A, id must line up.
    let threads: Array<{ id: string; title: string; updatedAt: string }> = [];
    let createRequestScope: string | null = null;
    let listRequestScope: string | null = null;

    server.use(
      http.get(`${sessionUrl}/threads`, ({ request }) => {
        listRequestScope = new URL(request.url).searchParams.get('sessionScope');
        return HttpResponse.json({ threads });
      }),
      http.post(`${sessionUrl}/threads`, async ({ request }) => {
        createRequestScope = new URL(request.url).searchParams.get('sessionScope');
        const created = { id: 'thread-new', title: 'New work', updatedAt: '2026-07-21T00:00:00.000Z' };
        // Server only adds the thread to the list if the create hit the same scope as the list.
        if (createRequestScope === listRequestScope) {
          threads = [created, ...threads];
        }
        return HttpResponse.json(created);
      }),
    );

    const { useAgentControllerThreads } = await import('../useAgentControllerThreads');
    const { result, client } = renderHookWithProviders(() => ({
      threadsQuery: useAgentControllerThreads(hookArgs),
      createThread: useCreateAgentControllerThreadMutation(hookArgs),
    }));

    await waitFor(() => expect(result.current.threadsQuery.isSuccess).toBe(true));
    await act(async () => result.current.createThread.mutateAsync('New work'));
    await waitForMutationsIdle(client);

    expect(createRequestScope).toBe(projectPath);
    expect(listRequestScope).toBe(projectPath);
    await waitFor(() =>
      expect(result.current.threadsQuery.data?.map(thread => thread.id)).toEqual(['thread-new']),
    );
  });
});
